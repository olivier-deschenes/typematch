import { createContext, use, useMemo } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { fieldKey } from '#/db/actions'
import {
  arrayViewsCollection,
  fieldRulesCollection,
  mappingsCollection,
  sourcesCollection,
} from '#/db/collections'
import type {
  ArrayViewRecord,
  FieldRule,
  Mapping,
  SourceDoc,
} from '#/db/collections'
import { getFormat } from '#/lib/formats'
import type { FormatAdapter, ParseResult } from '#/lib/formats'
import { tryParsePath } from '#/lib/model/path'
import { formatPrimitive, isPrimitive, resolvePath } from '#/lib/model/resolve'
import { buildFieldTree, indexTree, listFields } from '#/lib/model/tree'
import type { TreeIndex } from '#/lib/model/tree'
import type { FieldNode, Side } from '#/lib/model/types'

export interface SideState {
  side: Side
  doc: SourceDoc | undefined
  format: FormatAdapter | undefined
  parsed: ParseResult | null
  tree: TreeIndex | null
  fields: Array<FieldNode>
}

export interface MappingStatus {
  sourceMissing: boolean
  targetMissing: boolean
}

export interface RequiredStatus {
  rule: FieldRule
  satisfied: boolean
  exists: boolean
}

export interface Workspace {
  ready: boolean
  sides: Record<Side, SideState>
  mappings: Array<Mapping>
  rules: Map<string, FieldRule>
  views: Map<string, ArrayViewRecord>
  mappingStatus: Map<string, MappingStatus>
  /** Exact-path mapping counts per side */
  mappedCount: Record<Side, Map<string, number>>
  required: Array<RequiredStatus>
  requiredSatisfied: number
}

const WorkspaceContext = createContext<Workspace | null>(null)

function sideState(
  side: Side,
  doc: SourceDoc | undefined,
  views: Map<string, ArrayViewRecord>,
): SideState {
  const format = doc ? getFormat(doc.formatId) : undefined
  const parsed = doc && format && doc.raw.trim() ? format.parse(doc.raw) : null
  const tree = parsed?.ok
    ? indexTree(
        buildFieldTree(parsed.value, (path) => views.get(fieldKey(side, path))),
      )
    : null
  return {
    side,
    doc,
    format,
    parsed,
    tree,
    fields: tree ? listFields(tree.root) : [],
  }
}

function pathExists(state: SideState, path: string): boolean {
  if (!state.parsed?.ok) return true // unknown; don't flag
  if (state.tree?.byPath.has(path)) return true
  const segments = tryParsePath(path)
  return !!segments && resolvePath(state.parsed.value, segments).length > 0
}

function isSameOrDescendant(candidate: string, path: string) {
  if (!candidate.startsWith(path)) return false
  if (candidate.length === path.length) return true
  const next = candidate[path.length]
  return next === '.' || next === '['
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { data: docs, isReady: docsReady } = useLiveQuery((q) =>
    q.from({ doc: sourcesCollection }),
  )
  const { data: mappings, isReady: mappingsReady } = useLiveQuery((q) =>
    q
      .from({ mapping: mappingsCollection })
      .orderBy(({ mapping }) => mapping.createdAt, 'asc'),
  )
  const { data: ruleList } = useLiveQuery((q) =>
    q.from({ rule: fieldRulesCollection }),
  )
  const { data: viewList } = useLiveQuery((q) =>
    q.from({ view: arrayViewsCollection }),
  )

  const views = useMemo(
    () => new Map(viewList.map((view) => [view.id, view])),
    [viewList],
  )
  const rules = useMemo(
    () => new Map(ruleList.map((rule) => [rule.id, rule])),
    [ruleList],
  )

  const sourceDoc = docs.find((d) => d.id === 'source')
  const targetDoc = docs.find((d) => d.id === 'target')
  const source = useMemo(
    () => sideState('source', sourceDoc, views),
    [sourceDoc, views],
  )
  const target = useMemo(
    () => sideState('target', targetDoc, views),
    [targetDoc, views],
  )

  const workspace = useMemo<Workspace>(() => {
    const sideMap = { source, target }
    const mappedCount: Record<Side, Map<string, number>> = {
      source: new Map(),
      target: new Map(),
    }
    const mappingStatus = new Map<string, MappingStatus>()
    for (const mapping of mappings) {
      const s = mappedCount.source
      const t = mappedCount.target
      s.set(mapping.sourcePath, (s.get(mapping.sourcePath) ?? 0) + 1)
      t.set(mapping.targetPath, (t.get(mapping.targetPath) ?? 0) + 1)
      mappingStatus.set(mapping.id, {
        sourceMissing: !pathExists(source, mapping.sourcePath),
        targetMissing: !pathExists(target, mapping.targetPath),
      })
    }

    const required = [...rules.values()].map((rule) => {
      const mapped = mappings.some((m) =>
        isSameOrDescendant(
          rule.side === 'source' ? m.sourcePath : m.targetPath,
          rule.path,
        ),
      )
      return {
        rule,
        satisfied: mapped,
        exists: pathExists(sideMap[rule.side], rule.path),
      }
    })

    return {
      ready: docsReady && mappingsReady,
      sides: sideMap,
      mappings,
      rules,
      views,
      mappingStatus,
      mappedCount,
      required,
      requiredSatisfied: required.filter((r) => r.satisfied).length,
    }
  }, [source, target, mappings, rules, views, docsReady, mappingsReady])

  return <WorkspaceContext value={workspace}>{children}</WorkspaceContext>
}

export function useWorkspace(): Workspace {
  const workspace = use(WorkspaceContext)
  if (!workspace) {
    throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  }
  return workspace
}

/** First primitive value at `path`, for previews and exports. */
export function samplePreview(state: SideState, path: string): string | null {
  const node = state.tree?.byPath.get(path)
  if (node) {
    if (node.samples.length) return formatPrimitive(node.samples[0])
    if (node.kind === 'object' || node.kind === 'array') return null
  }
  if (!state.parsed?.ok) return null
  const segments = tryParsePath(path)
  const value = segments
    ? resolvePath(state.parsed.value, segments).find(isPrimitive)
    : undefined
  return value === undefined ? null : formatPrimitive(value)
}

export function isRequired(workspace: Workspace, side: Side, path: string) {
  return workspace.rules.has(fieldKey(side, path))
}
