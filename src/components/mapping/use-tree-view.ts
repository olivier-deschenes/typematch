import { useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { useSelector } from '@tanstack/react-store'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Virtualizer } from '@tanstack/react-virtual'
import { fieldKey } from '#/db/actions'
import { useWorkspace } from '#/hooks/use-workspace'
import { anchorRow, flattenTree } from '#/lib/model/flatten'
import type { FlatTree } from '#/lib/model/flatten'
import { ancestorPaths } from '#/lib/model/path'
import { filterTree } from '#/lib/model/search'
import type { TreeFilter } from '#/lib/model/search'
import type { TreeIndex } from '#/lib/model/tree'
import type { FieldNode, Side } from '#/lib/model/types'
import { mappingUi } from '#/stores/mapping-ui'

export const ROW_HEIGHT = 32

export interface TreeView {
  side: Side
  tree: TreeIndex | null
  flat: FlatTree
  filter: TreeFilter | null
  query: string
  setQuery: (query: string) => void
  searching: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
  searchRef: React.RefObject<HTMLInputElement | null>
  virtualizer: Virtualizer<HTMLDivElement, Element>
  /** Expands collapsed ancestors and scrolls the field into view. */
  reveal: (path: string) => void
}

const EMPTY_FLAT: FlatTree = { rows: [], rowIndex: new Map() }

/**
 * Search, filter, collapse and virtualization state for one side. Lives in
 * the canvas so the connector layer can read row geometry for both sides.
 */
export function useTreeView(side: Side): TreeView {
  // TanStack Virtual's instance is mutable; opt out of React Compiler
  // memoization so virtual items stay fresh.
  'use no memo'
  const workspace = useWorkspace()
  const tree = workspace.sides[side].tree
  const [query, setQuery] = useState('')
  const [debouncedQuery, debouncer] = useDebouncedValue(
    query,
    { wait: 150 },
    (state) => ({ isPending: state.isPending }),
  )
  const filterMode = useSelector(mappingUi, (s) => s.filter[side])
  const collapsed = useSelector(mappingUi, (s) => s.collapsed[side])

  const mapped = workspace.mappedCount[side]
  const rules = workspace.rules
  const filter = useMemo(() => {
    if (!tree) return null
    const predicate =
      filterMode === 'all'
        ? undefined
        : (node: FieldNode) => {
            const isMapped = (mapped.get(node.path) ?? 0) > 0
            if (filterMode === 'mapped') return isMapped
            if (filterMode === 'unmapped') {
              return node.children.length === 0 && !isMapped
            }
            return rules.has(fieldKey(side, node.path))
          }
    return filterTree(tree.root, debouncedQuery, predicate)
  }, [tree, debouncedQuery, filterMode, mapped, rules, side])

  const flat = useMemo(
    () => (tree ? flattenTree(tree.root, collapsed, filter) : EMPTY_FLAT),
    [tree, collapsed, filter],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const virtualizer = useVirtualizer({
    count: flat.rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  const latest = useRef({ flat, filter, tree })
  latest.current = { flat, filter, tree }

  const reveal = (path: string) => {
    const hidden = ancestorPaths(path).filter((p) =>
      mappingUi.state.collapsed[side].has(p),
    )
    if (hidden.length) {
      const next = new Set(mappingUi.state.collapsed[side])
      for (const p of hidden) next.delete(p)
      mappingUi.actions.setCollapsed(side, next)
    }
    // Wait for the expanded rows to render before scrolling.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const { flat: current, filter: f, tree: t } = latest.current
        if (!t) return
        const anchor = anchorRow(path, t, current, f)
        if (anchor) virtualizer.scrollToIndex(anchor.index, { align: 'auto' })
      }),
    )
  }

  return {
    side,
    tree,
    flat,
    filter,
    query,
    setQuery,
    searching: debouncer.state.isPending,
    scrollRef,
    searchRef,
    virtualizer,
    reveal,
  }
}
