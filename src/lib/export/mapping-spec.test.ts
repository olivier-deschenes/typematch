import { describe, expect, it } from 'vitest'
import type { Mapping } from '#/db/collections'
import {
  buildMappingSpec,
  exportFileName,
  parseMappingSpec,
  specToWorkspace,
} from './mapping-spec'

const mappings: Array<Mapping> = [
  {
    id: "$.order.addresses[?(@.type=='sender')].street=>$.Shipment.Shipper.Address.Street",
    sourcePath: "$.order.addresses[?(@.type=='sender')].street",
    targetPath: '$.Shipment.Shipper.Address.Street',
    note: 'Sender only',
    createdAt: 1,
  },
  {
    id: '$.order.id=>$.Shipment.Reference',
    sourcePath: '$.order.id',
    targetPath: '$.Shipment.Reference',
    note: '',
    createdAt: 2,
  },
]

const spec = buildMappingSpec({
  documents: {
    source: { id: 'source', name: 'order.json', formatId: 'json', raw: '{}' },
    target: {
      id: 'target',
      name: 'shipment.xml',
      formatId: 'xml',
      raw: '<a/>',
    },
  },
  mappings,
  rules: [
    {
      id: 'target:$.Shipment.ShipDate',
      side: 'target',
      path: '$.Shipment.ShipDate',
      required: true,
    },
  ],
  views: [
    {
      id: 'source:$.order.addresses',
      side: 'source',
      path: '$.order.addresses',
      mode: 'group',
      groupBy: 'type',
    },
  ],
  requiredUnmapped: [{ side: 'target', path: '$.Shipment.ShipDate' }],
  sample: (side, path) => `${side}:${path}`,
  includeDocuments: true,
  now: new Date('2026-10-10T12:00:00Z'),
})

describe('mapping spec', () => {
  it('captures mappings, rules, views and documents', () => {
    expect(spec.kind).toBe('typematch.mapping')
    expect(spec.mappings[0]).toEqual({
      source: "$.order.addresses[?(@.type=='sender')].street",
      target: '$.Shipment.Shipper.Address.Street',
      sourceSample: "source:$.order.addresses[?(@.type=='sender')].street",
      targetSample: 'target:$.Shipment.Shipper.Address.Street',
      note: 'Sender only',
    })
    expect(spec.summary).toEqual({
      mappingCount: 2,
      requiredCount: 1,
      requiredUnmapped: [{ side: 'target', path: '$.Shipment.ShipDate' }],
    })
    expect(spec.documents.target?.content).toBe('<a/>')
  })

  it('round-trips through JSON', () => {
    const parsed = parseMappingSpec(JSON.stringify(spec))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const workspace = specToWorkspace(parsed.spec, 100)
    expect(workspace.mappings.map((m) => m.id)).toEqual(
      mappings.map((m) => m.id),
    )
    expect(workspace.mappings[0].note).toBe('Sender only')
    expect(workspace.rules).toEqual([
      {
        id: 'target:$.Shipment.ShipDate',
        side: 'target',
        path: '$.Shipment.ShipDate',
        required: true,
      },
    ])
    expect(workspace.views[0]).toMatchObject({ mode: 'group', groupBy: 'type' })
    expect(workspace.sources.map((s) => s.id)).toEqual(['source', 'target'])
  })

  it('rejects files that are not mapping specs', () => {
    expect(parseMappingSpec('nope')).toEqual({
      ok: false,
      error: 'The file is not valid JSON.',
    })
    const invalid = parseMappingSpec(
      JSON.stringify({ ...spec, mappings: [{ source: 'x', target: '$.a' }] }),
    )
    expect(invalid.ok).toBe(false)
  })

  it('names the file after both documents', () => {
    expect(exportFileName(spec)).toBe('order-to-shipment.mapping.json')
  })
})
