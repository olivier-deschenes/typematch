import { formatPrimitive } from './resolve'
import type { FieldNode, Primitive } from './types'

export type SortBy = 'none' | 'key' | 'value'
export type SortDirection = 'asc' | 'desc'

export interface TreeSort {
  by: SortBy
  direction: SortDirection
}

export const DEFAULT_SORT: TreeSort = { by: 'none', direction: 'asc' }

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

/** The value a node sorts by; containers have none. */
function sortValue(node: FieldNode): Primitive | undefined {
  if (node.children.length > 0) return undefined
  if (node.value !== undefined) return node.value
  return node.samples.length ? node.samples[0] : undefined
}

function compareValues(a: Primitive, b: Primitive) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(formatPrimitive(a), formatPrimitive(b))
}

/**
 * Orders sibling fields. Value sorting keeps fields without a value (null,
 * objects, arrays of objects) last in both directions, ordered by key.
 */
export function sortChildren(
  children: Array<FieldNode>,
  sort: TreeSort,
): Array<FieldNode> {
  if (sort.by === 'none') return children
  const sign = sort.direction === 'asc' ? 1 : -1
  const byKey = (a: FieldNode, b: FieldNode) =>
    collator.compare(a.label, b.label)

  return [...children].sort((a, b) => {
    if (sort.by === 'key') return sign * byKey(a, b)
    const va = sortValue(a) ?? null
    const vb = sortValue(b) ?? null
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1
      return byKey(a, b)
    }
    return sign * compareValues(va, vb) || byKey(a, b)
  })
}
