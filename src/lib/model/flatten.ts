import { ancestorPaths } from './path'
import type { MatchInfo, TreeFilter } from './search'
import type { TreeIndex } from './tree'
import type { FieldNode } from './types'

export interface FlatRow {
  node: FieldNode
  /** Visual indentation level */
  level: number
  expandable: boolean
  expanded: boolean
  match?: MatchInfo
}

export interface FlatTree {
  rows: Array<FlatRow>
  rowIndex: Map<string, number>
}

/**
 * Turns the tree into the list of rows to render. An object root is
 * implicit (its fields are top-level rows); other roots render as a row.
 */
export function flattenTree(
  root: FieldNode,
  collapsed: ReadonlySet<string>,
  filter: TreeFilter | null,
): FlatTree {
  const rows: Array<FlatRow> = []
  const rowIndex = new Map<string, number>()

  const visit = (node: FieldNode, level: number) => {
    if (filter && !filter.visible.has(node.path)) return
    const expandable = node.children.length > 0
    const expanded =
      expandable &&
      (filter?.forceExpanded.has(node.path) || !collapsed.has(node.path))
    rowIndex.set(node.path, rows.length)
    rows.push({
      node,
      level,
      expandable,
      expanded,
      match: filter?.matches.get(node.path),
    })
    if (expanded) for (const child of node.children) visit(child, level + 1)
  }

  if (root.kind === 'object') {
    for (const child of root.children) visit(child, 0)
  } else {
    visit(root, 0)
  }
  return { rows, rowIndex }
}

export interface RowAnchor {
  index: number
  /** False when the row is an ancestor standing in for a hidden field */
  exact: boolean
}

/**
 * The row an arrow should attach to for `path`: the field itself, or its
 * nearest rendered ancestor when it is collapsed away or belongs to a
 * different array view. Null when filtered out entirely.
 */
export function anchorRow(
  path: string,
  index: TreeIndex,
  flat: FlatTree,
  filter: TreeFilter | null,
): RowAnchor | null {
  const direct = flat.rowIndex.get(path)
  if (direct !== undefined) return { index: direct, exact: true }

  const inTree = index.byPath.get(path)
  if (inTree && filter && !filter.visible.has(path)) return null

  // Walk up the tree when the node exists; otherwise trim path segments.
  const candidates: Array<string> = []
  if (inTree) {
    let parent = inTree.parentPath
    while (parent !== undefined) {
      candidates.push(parent)
      parent = index.byPath.get(parent)?.parentPath
    }
  } else {
    candidates.push(...ancestorPaths(path))
  }

  for (const candidate of candidates) {
    const row = flat.rowIndex.get(candidate)
    if (row !== undefined) return { index: row, exact: false }
    if (
      filter &&
      index.byPath.has(candidate) &&
      !filter.visible.has(candidate)
    ) {
      return null
    }
  }
  return null
}
