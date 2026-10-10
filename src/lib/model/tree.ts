import { discriminatorCandidates } from './discriminators'
import { serializePath } from './path'
import { formatPrimitive, isPlainObject, isPrimitive } from './resolve'
import type {
  ArrayView,
  FieldKind,
  FieldNode,
  NodeRole,
  PathSegment,
  Primitive,
} from './types'

/** Index-mode arrays render at most this many elements. */
export const MAX_INDEX_CHILDREN = 500

export type ArrayViewLookup = (path: string) => ArrayView | undefined

function kindOf(value: unknown): FieldKind {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  if (isPlainObject(value)) return 'object'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

/** Most frequent non-null kind; XML single/repeated elements count as array. */
function kindOfSamples(samples: ReadonlyArray<unknown>): FieldKind {
  const counts = new Map<FieldKind, number>()
  for (const sample of samples) {
    const kind = kindOf(sample)
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  if (counts.has('array') && counts.has('object')) return 'array'
  let best: FieldKind = 'null'
  let bestCount = 0
  for (const [kind, count] of counts) {
    if (kind !== 'null' && count > bestCount) {
      best = kind
      bestCount = count
    }
  }
  return best
}

function distinctPrimitives(values: ReadonlyArray<unknown>, limit = 5) {
  const out: Array<Primitive> = []
  const seen = new Set<Primitive>()
  for (const value of values) {
    if (!isPrimitive(value) || seen.has(value)) continue
    seen.add(value)
    out.push(value)
    if (out.length >= limit) break
  }
  return out
}

function unionKeys(objects: ReadonlyArray<Record<string, unknown>>) {
  const keys = new Set<string>()
  for (const object of objects)
    for (const key of Object.keys(object)) keys.add(key)
  return [...keys]
}

function resolveView(
  requested: ArrayView | undefined,
  items: ReadonlyArray<unknown>,
): ArrayView {
  if (requested?.mode === 'index') return { mode: 'index' }
  if (requested?.mode === 'group' && requested.groupBy) {
    if (items.some((item) => isPlainObject(item))) return requested
  }
  return { mode: 'all' }
}

class TreeBuilder {
  constructor(private readonly getView: ArrayViewLookup) {}

  node(
    samples: ReadonlyArray<unknown>,
    segments: Array<PathSegment>,
    label: string,
    role: NodeRole,
    depth: number,
    parentPath: string | undefined,
  ): FieldNode {
    const present = samples.filter((sample) => sample !== undefined)
    const kind = kindOfSamples(present)
    const path = serializePath(segments)
    const node: FieldNode = {
      path,
      segments,
      label,
      role,
      kind,
      depth,
      parentPath,
      samples: distinctPrimitives(present),
      occurrences: present.length,
      children: [],
    }

    if (kind === 'object') {
      node.children = this.fields(
        present.filter(isPlainObject),
        segments,
        depth,
        path,
      )
    } else if (kind === 'array') {
      this.array(node, present)
    } else {
      node.value = node.samples[0] ?? null
    }
    return node
  }

  fields(
    objects: ReadonlyArray<Record<string, unknown>>,
    segments: Array<PathSegment>,
    depth: number,
    parentPath: string,
  ): Array<FieldNode> {
    return unionKeys(objects).map((key) =>
      this.node(
        objects.filter((o) => key in o).map((o) => o[key]),
        [...segments, { type: 'key', key }],
        key,
        'field',
        depth + 1,
        parentPath,
      ),
    )
  }

  array(node: FieldNode, samples: ReadonlyArray<unknown>) {
    const instances = samples.map((s) => (Array.isArray(s) ? s : [s]))
    const items = instances.flat(1)
    const view = resolveView(this.getView(node.path), items)
    const itemKind = kindOfSamples(items)
    const { segments, depth, path } = node

    node.itemCount = items.length
    node.view = view
    if (itemKind === 'object') {
      node.discriminators = discriminatorCandidates(items)
    } else if (itemKind !== 'array') {
      node.samples = distinctPrimitives(items)
    }

    if (view.mode === 'index') {
      const longest = Math.max(0, ...instances.map((i) => i.length))
      for (
        let index = 0;
        index < Math.min(longest, MAX_INDEX_CHILDREN);
        index++
      ) {
        node.children.push(
          this.node(
            instances.map((instance) => instance[index]),
            [...segments, { type: 'index', index }],
            `[${index}]`,
            'element',
            depth + 1,
            path,
          ),
        )
      }
      return
    }

    if (view.mode === 'group' && view.groupBy) {
      const field = view.groupBy
      const groups = new Map<Primitive, Array<Record<string, unknown>>>()
      let ungrouped = 0
      for (const item of items) {
        const value = isPlainObject(item) ? item[field] : undefined
        if (!isPlainObject(item) || !isPrimitive(value)) {
          ungrouped++
          continue
        }
        let group = groups.get(value)
        if (!group) groups.set(value, (group = []))
        group.push(item)
      }
      node.ungroupedCount = ungrouped
      for (const [equals, groupItems] of groups) {
        const child = this.node(
          groupItems,
          [...segments, { type: 'where', field, equals }],
          `${field} = ${formatPrimitive(equals)}`,
          'group',
          depth + 1,
          path,
        )
        child.itemCount = groupItems.length
        node.children.push(child)
      }
      return
    }

    // "All items": fields of object items sit directly under the array.
    if (itemKind === 'object') {
      node.children = this.fields(
        items.filter(isPlainObject),
        [...segments, { type: 'each' }],
        depth,
        path,
      )
    } else if (itemKind === 'array') {
      node.children = [
        this.node(
          items,
          [...segments, { type: 'each' }],
          '[*]',
          'element',
          depth + 1,
          path,
        ),
      ]
    }
  }
}

export function buildFieldTree(
  document: unknown,
  getView: ArrayViewLookup = () => undefined,
): FieldNode {
  return new TreeBuilder(getView).node(
    [document],
    [],
    '(root)',
    'root',
    0,
    undefined,
  )
}

export interface TreeIndex {
  root: FieldNode
  byPath: Map<string, FieldNode>
}

export function indexTree(root: FieldNode): TreeIndex {
  const byPath = new Map<string, FieldNode>()
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()!
    byPath.set(node.path, node)
    for (const child of node.children) stack.push(child)
  }
  return { root, byPath }
}

export function* walkTree(root: FieldNode): Generator<FieldNode> {
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()!
    yield node
    for (let i = node.children.length - 1; i >= 0; i--)
      stack.push(node.children[i])
  }
}

/** All mappable nodes (everything but the root) in document order. */
export function listFields(root: FieldNode): Array<FieldNode> {
  return [...walkTree(root)].filter((node) => node.role !== 'root')
}
