import { z } from 'zod'
import { fieldKey, mappingKey } from '#/lib/keys'
import type {
  ArrayViewRecord,
  FieldRule,
  Mapping,
  SourceDoc,
} from '#/db/collections'
import { tryParsePath } from '#/lib/model/path'
import type { Side } from '#/lib/model/types'

/**
 * The exported mapping document. Versioned so future changes can migrate
 * older files; re-importing it restores mappings, required fields, array
 * views and (optionally) the source documents.
 */

const SideSchema = z.enum(['source', 'target'])
const PathSchema = z
  .string()
  .refine((path) => tryParsePath(path) !== null, 'Invalid field path')

const FieldRefSchema = z.object({ side: SideSchema, path: PathSchema })

const DocumentSchema = z.object({
  name: z.string(),
  format: z.string(),
  content: z.string().optional(),
})

export const MappingSpecSchema = z.object({
  kind: z.literal('typematch.mapping'),
  version: z.literal(1),
  exportedAt: z.string(),
  summary: z.object({
    mappingCount: z.number(),
    requiredCount: z.number(),
    requiredUnmapped: z.array(FieldRefSchema),
  }),
  mappings: z.array(
    z.object({
      source: PathSchema,
      target: PathSchema,
      sourceSample: z.string().nullable(),
      targetSample: z.string().nullable(),
      note: z.string().default(''),
    }),
  ),
  required: z.array(FieldRefSchema),
  arrayViews: z.array(
    FieldRefSchema.extend({
      mode: z.enum(['all', 'index', 'group']),
      groupBy: z.string().optional(),
    }),
  ),
  documents: z.object({
    source: DocumentSchema.nullable(),
    target: DocumentSchema.nullable(),
  }),
})

export type MappingSpec = z.infer<typeof MappingSpecSchema>

export interface SpecInput {
  documents: Record<Side, SourceDoc | undefined>
  mappings: ReadonlyArray<Mapping>
  rules: ReadonlyArray<FieldRule>
  views: ReadonlyArray<ArrayViewRecord>
  requiredUnmapped: ReadonlyArray<{ side: Side; path: string }>
  sample: (side: Side, path: string) => string | null
  includeDocuments: boolean
  now?: Date
}

export function buildMappingSpec(input: SpecInput): MappingSpec {
  const document = (doc: SourceDoc | undefined) =>
    doc
      ? {
          name: doc.name,
          format: doc.formatId,
          ...(input.includeDocuments ? { content: doc.raw } : {}),
        }
      : null

  return {
    kind: 'typematch.mapping',
    version: 1,
    exportedAt: (input.now ?? new Date()).toISOString(),
    summary: {
      mappingCount: input.mappings.length,
      requiredCount: input.rules.length,
      requiredUnmapped: input.requiredUnmapped.map(({ side, path }) => ({
        side,
        path,
      })),
    },
    mappings: input.mappings.map((mapping) => ({
      source: mapping.sourcePath,
      target: mapping.targetPath,
      sourceSample: input.sample('source', mapping.sourcePath),
      targetSample: input.sample('target', mapping.targetPath),
      note: mapping.note,
    })),
    required: input.rules.map(({ side, path }) => ({ side, path })),
    arrayViews: input.views.map(({ side, path, mode, groupBy }) => ({
      side,
      path,
      mode,
      ...(groupBy ? { groupBy } : {}),
    })),
    documents: {
      source: document(input.documents.source),
      target: document(input.documents.target),
    },
  }
}

export type ParsedSpec =
  { ok: true; spec: MappingSpec } | { ok: false; error: string }

export function parseMappingSpec(raw: string): ParsedSpec {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' }
  }
  const result = MappingSpecSchema.safeParse(json)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue.path.length ? ` at ${issue.path.join('.')}` : ''
    return {
      ok: false,
      error: `Not a Typematch mapping file: ${issue.message}${where}.`,
    }
  }
  return { ok: true, spec: result.data }
}

/** Converts a spec into collection records for `replaceWorkspace`. */
export function specToWorkspace(spec: MappingSpec, now = Date.now()) {
  const mappings: Array<Mapping> = spec.mappings.map((m, index) => ({
    id: mappingKey(m.source, m.target),
    sourcePath: m.source,
    targetPath: m.target,
    note: m.note,
    createdAt: now + index,
  }))
  const unique = [...new Map(mappings.map((m) => [m.id, m])).values()]

  const rules: Array<FieldRule> = [
    ...new Map(
      spec.required.map(({ side, path }) => [
        fieldKey(side, path),
        { id: fieldKey(side, path), side, path, required: true },
      ]),
    ).values(),
  ]

  const views: Array<ArrayViewRecord> = spec.arrayViews
    .filter((view) => view.mode !== 'all')
    .map(({ side, path, mode, groupBy }) => ({
      id: fieldKey(side, path),
      side,
      path,
      mode,
      ...(groupBy ? { groupBy } : {}),
    }))

  const sources: Array<SourceDoc> = []
  for (const side of ['source', 'target'] as const) {
    const doc = spec.documents[side]
    if (doc?.content !== undefined) {
      sources.push({
        id: side,
        name: doc.name,
        formatId: doc.format,
        raw: doc.content,
      })
    }
  }

  return { mappings: unique, rules, views, sources }
}

export function exportFileName(spec: MappingSpec) {
  const base = (name?: string) =>
    name
      ?.replace(/\.[^.]+$/, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const source = base(spec.documents.source?.name)
  const target = base(spec.documents.target?.name)
  return source && target
    ? `${source}-to-${target}.mapping.json`
    : 'typematch.mapping.json'
}
