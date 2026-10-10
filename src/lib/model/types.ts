export type Primitive = string | number | boolean | null

export type FieldKind =
  'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export type PathSegment =
  | { type: 'key'; key: string }
  | { type: 'each' }
  | { type: 'index'; index: number }
  | { type: 'where'; field: string; equals: Primitive }

export type Side = 'source' | 'target'

export const sides: ReadonlyArray<Side> = ['source', 'target']

export function otherSide(side: Side): Side {
  return side === 'source' ? 'target' : 'source'
}

export type ArrayViewMode = 'all' | 'index' | 'group'

export interface ArrayView {
  mode: ArrayViewMode
  groupBy?: string
}

/**
 * How a node came to exist:
 * - root: the document itself
 * - field: an object key
 * - element: an array element (`[0]`) or nested-array items (`[*]`)
 * - group: array items sharing a discriminator value (`[?(@.type=='x')]`)
 */
export type NodeRole = 'root' | 'field' | 'element' | 'group'

export interface DiscriminatorCandidate {
  field: string
  values: Array<Primitive>
  /** Share of items that have a primitive value for this field (0..1) */
  coverage: number
  suggested: boolean
}

export interface FieldNode {
  /** Canonical JSONPath, unique within a tree */
  path: string
  segments: Array<PathSegment>
  label: string
  role: NodeRole
  kind: FieldKind
  depth: number
  parentPath?: string
  /** First sample for primitive nodes */
  value?: Primitive
  /** Up to five distinct primitive samples (items for primitive arrays) */
  samples: Array<Primitive>
  /** How many times this path occurs in the document */
  occurrences: number
  /** Arrays: total items. Groups: matching items. */
  itemCount?: number
  /** Arrays: the view actually applied */
  view?: ArrayView
  /** Arrays of objects: fields usable to split items into groups */
  discriminators?: Array<DiscriminatorCandidate>
  /** Arrays in group view: items without a value for the group field */
  ungroupedCount?: number
  children: Array<FieldNode>
}

export function isPrimitiveKind(kind: FieldKind) {
  return kind !== 'object' && kind !== 'array'
}
