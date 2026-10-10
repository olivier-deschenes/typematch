import { describe, expect, it } from 'vitest'
import { getFormat } from '#/lib/formats'
import { sampleSource, sampleTarget } from '#/lib/samples'
import { anchorRow, flattenTree } from './flatten'
import { describePath, parsePath, serializePath } from './path'
import { resolvePath } from './resolve'
import { filterTree } from './search'
import { buildFieldTree, indexTree } from './tree'
import type { ArrayView, FieldNode, PathSegment } from './types'

const order = (getFormat('json')!.parse(sampleSource.raw) as { value: unknown })
  .value
const shipment = (
  getFormat('xml')!.parse(sampleTarget.raw) as { value: unknown }
).value

const childLabels = (node: FieldNode | undefined) =>
  node?.children.map((c) => c.label)

describe('paths', () => {
  const cases: Array<[string, Array<PathSegment>]> = [
    ['$', []],
    [
      '$.order.items[*].sku',
      [
        { type: 'key', key: 'order' },
        { type: 'key', key: 'items' },
        { type: 'each' },
        { type: 'key', key: 'sku' },
      ],
    ],
    [
      "$.order.addresses[?(@.type=='sender')].street",
      [
        { type: 'key', key: 'order' },
        { type: 'key', key: 'addresses' },
        { type: 'where', field: 'type', equals: 'sender' },
        { type: 'key', key: 'street' },
      ],
    ],
    [
      "$.Shipment['@id'].Package[2][?(@['@seq']==1)]['it\\'s']",
      [
        { type: 'key', key: 'Shipment' },
        { type: 'key', key: '@id' },
        { type: 'key', key: 'Package' },
        { type: 'index', index: 2 },
        { type: 'where', field: '@seq', equals: 1 },
        { type: 'key', key: "it's" },
      ],
    ],
  ]

  it.each(cases)('round-trips %s', (path, segments) => {
    expect(parsePath(path)).toEqual(segments)
    expect(serializePath(segments)).toBe(path)
  })

  it('describes paths for humans', () => {
    expect(describePath("$.order.addresses[?(@.type=='sender')].street")).toBe(
      'order › addresses[type=sender] › street',
    )
  })

  it('rejects malformed paths', () => {
    expect(() => parsePath('order.id')).toThrow()
    expect(() => parsePath('$.a[?(@.b=)]')).toThrow()
  })
})

describe('resolvePath', () => {
  it('resolves filters, wildcards and indexes', () => {
    expect(
      resolvePath(
        order,
        parsePath("$.order.addresses[?(@.type=='sender')].city"),
      ),
    ).toEqual(['Montréal'])
    expect(resolvePath(order, parsePath('$.order.items[*].sku'))).toEqual([
      'LMP-001',
      'CBL-210',
    ])
    expect(resolvePath(order, parsePath('$.order.items[1].quantity'))).toEqual([
      3,
    ])
    expect(resolvePath(order, parsePath('$.order.nope'))).toEqual([])
  })
})

describe('buildFieldTree', () => {
  const views = new Map<string, ArrayView>()
  const tree = () => indexTree(buildFieldTree(order, (p) => views.get(p)))

  it('merges array items in "all" view', () => {
    views.clear()
    const addresses = tree().byPath.get('$.order.addresses')!
    expect(addresses.kind).toBe('array')
    expect(addresses.itemCount).toBe(2)
    expect(addresses.children[0].path).toBe('$.order.addresses[*].type')
    expect(addresses.children[0].samples).toEqual(['sender', 'receiver'])
    expect(addresses.discriminators?.[0]).toMatchObject({
      field: 'type',
      suggested: true,
    })
  })

  it('splits items by index', () => {
    views.set('$.order.addresses', { mode: 'index' })
    const addresses = tree().byPath.get('$.order.addresses')!
    expect(childLabels(addresses)).toEqual(['[0]', '[1]'])
    expect(addresses.children[1].children[2].value).toBe('88 Queen St W')
  })

  it('groups items by a discriminator', () => {
    views.set('$.order.addresses', { mode: 'group', groupBy: 'type' })
    const index = tree()
    const addresses = index.byPath.get('$.order.addresses')!
    expect(childLabels(addresses)).toEqual(['type = sender', 'type = receiver'])
    const street = index.byPath.get(
      "$.order.addresses[?(@.type=='sender')].street",
    )
    expect(street?.value).toBe('1200 Rue Sainte-Catherine O')
  })

  it('keeps primitive array samples', () => {
    views.clear()
    expect(tree().byPath.get('$.order.notes')?.samples).toEqual([
      'Leave at reception',
      'Fragile',
    ])
  })

  it('handles XML attributes and repeated elements', () => {
    const index = indexTree(buildFieldTree(shipment))
    expect(index.byPath.get("$.Shipment['@id']")?.value).toBe('SHP-77310')
    const packages = index.byPath.get('$.Shipment.Packages.Package')!
    expect(packages.kind).toBe('array')
    expect(childLabels(packages)).toEqual([
      '@seq',
      'Weight',
      'Contents',
      'Quantity',
    ])
    expect(
      index.byPath.get("$.Shipment.Packages.Package[*].Weight['#text']")
        ?.samples,
    ).toEqual([3.4, 0.4])
  })
})

describe('filterTree and flattenTree', () => {
  const index = indexTree(buildFieldTree(order))

  it('keeps matches and their ancestors, expanded', () => {
    const filter = filterTree(index.root, 'postal')!
    const flat = flattenTree(index.root, new Set(['$.order']), filter)
    expect(flat.rows.map((r) => r.node.path)).toEqual([
      '$.order',
      '$.order.addresses',
      '$.order.addresses[*].postalCode',
    ])
    expect(flat.rows[2].match?.label).toEqual([0, 6])
  })

  it('matches values', () => {
    const filter = filterTree(index.root, 'toronto')!
    expect([...filter.matches.keys()]).toEqual(['$.order.addresses[*].city'])
  })

  it('applies a predicate without a query', () => {
    const filter = filterTree(index.root, '', (n) => n.label === 'sku')!
    const flat = flattenTree(index.root, new Set(), filter)
    expect(flat.rows.map((r) => r.node.label)).toEqual([
      'order',
      'items',
      'sku',
    ])
  })

  it('anchors hidden fields to the nearest visible ancestor', () => {
    const flat = flattenTree(index.root, new Set(['$.order.customer']), null)
    expect(anchorRow('$.order.customer.email', index, flat, null)).toEqual({
      index: flat.rowIndex.get('$.order.customer'),
      exact: false,
    })
    // A path from another array view anchors to the array row.
    expect(
      anchorRow(
        "$.order.addresses[?(@.type=='sender')].city",
        index,
        flat,
        null,
      ),
    ).toEqual({ index: flat.rowIndex.get('$.order.addresses'), exact: false })
  })
})
