import { describe, expect, it } from 'vitest'
import { detectFormat, getFormat } from './index'

const json = getFormat('json')!
const xml = getFormat('xml')!

describe('json adapter', () => {
  it('parses valid documents', () => {
    expect(json.parse('{"a": [1, true, null]}')).toEqual({
      ok: true,
      value: { a: [1, true, null] },
    })
  })

  it('reports the line and column of a syntax error', () => {
    const result = json.parse('{\n  "a": 1,\n  "b" 2\n}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.line).toBe(3)
      expect(result.error.column).toBeGreaterThanOrEqual(6)
    }
  })

  it('formats and minifies', () => {
    expect(json.format('{"a":1}')).toBe('{\n  "a": 1\n}')
    expect(json.minify!('{\n  "a": 1\n}')).toBe('{"a":1}')
  })
})

describe('xml adapter', () => {
  it('maps attributes, text and repeated elements', () => {
    const result = xml.parse(
      '<root id="7"><item>a</item><item>b</item><zip>02134</zip><n unit="kg">3.4</n></root>',
    )
    expect(result).toEqual({
      ok: true,
      value: {
        root: {
          '@id': 7,
          item: ['a', 'b'],
          zip: '02134',
          n: { '@unit': 'kg', '#text': 3.4 },
        },
      },
    })
  })

  it('reports the line of a mismatched tag', () => {
    const result = xml.parse('<a>\n  <b>\n</a>')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.line).toBe(3)
  })

  it('formats with two-space indentation', () => {
    expect(xml.format('<a><b>1</b></a>')).toBe('<a>\n  <b>1</b>\n</a>')
  })
})

describe('detectFormat', () => {
  it('uses the file extension first', () => {
    expect(detectFormat({ fileName: 'x.xml', raw: '{}' })?.id).toBe('xml')
  })

  it('falls back to content sniffing', () => {
    expect(detectFormat({ raw: '  [1]' })?.id).toBe('json')
    expect(detectFormat({ raw: '<?xml version="1.0"?><a/>' })?.id).toBe('xml')
    expect(detectFormat({ raw: 'hello' })).toBeUndefined()
  })
})
