import {
  createCollection,
  localStorageCollectionOptions,
} from '@tanstack/react-db'
import { z } from 'zod'

/**
 * Workspace data persisted in localStorage. Everything else (parsed
 * documents, field trees, mapping status) is derived from these.
 */

export const SideSchema = z.enum(['source', 'target'])

export const SourceDocSchema = z.object({
  id: SideSchema,
  name: z.string(),
  formatId: z.string(),
  raw: z.string(),
})
export type SourceDoc = z.infer<typeof SourceDocSchema>

export const MappingSchema = z.object({
  /** `${sourcePath}=>${targetPath}`: one mapping per pair */
  id: z.string(),
  sourcePath: z.string(),
  targetPath: z.string(),
  note: z.string(),
  createdAt: z.number(),
})
export type Mapping = z.infer<typeof MappingSchema>

export const FieldRuleSchema = z.object({
  /** `${side}:${path}` */
  id: z.string(),
  side: SideSchema,
  path: z.string(),
  required: z.boolean(),
})
export type FieldRule = z.infer<typeof FieldRuleSchema>

export const ArrayViewModeSchema = z.enum(['all', 'index', 'group'])

export const ArrayViewRecordSchema = z.object({
  /** `${side}:${path}` */
  id: z.string(),
  side: SideSchema,
  path: z.string(),
  mode: ArrayViewModeSchema,
  groupBy: z.string().optional(),
})
export type ArrayViewRecord = z.infer<typeof ArrayViewRecordSchema>

export const sourcesCollection = createCollection(
  localStorageCollectionOptions({
    id: 'sources',
    storageKey: 'typematch:sources',
    getKey: (doc) => doc.id,
    schema: SourceDocSchema,
  }),
)

export const mappingsCollection = createCollection(
  localStorageCollectionOptions({
    id: 'mappings',
    storageKey: 'typematch:mappings',
    getKey: (mapping) => mapping.id,
    schema: MappingSchema,
  }),
)

export const fieldRulesCollection = createCollection(
  localStorageCollectionOptions({
    id: 'field-rules',
    storageKey: 'typematch:field-rules',
    getKey: (rule) => rule.id,
    schema: FieldRuleSchema,
  }),
)

export const arrayViewsCollection = createCollection(
  localStorageCollectionOptions({
    id: 'array-views',
    storageKey: 'typematch:array-views',
    getKey: (view) => view.id,
    schema: ArrayViewRecordSchema,
  }),
)
