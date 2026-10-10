import { xml } from '@codemirror/lang-xml'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import formatXml from 'xml-formatter'
import type { FormatAdapter } from './types'

/**
 * Attributes become `@name` keys and mixed text becomes `#text`, so they
 * read naturally in the field tree. Repeated sibling elements become arrays.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  ignoreDeclaration: true,
  ignorePiTags: true,
  trimValues: true,
  parseTagValue: true,
  parseAttributeValue: true,
  // Keep identifiers like postal codes ("02134") as strings.
  numberParseOptions: { hex: false, leadingZeros: false, eNotation: false },
})

/** fast-xml-parser lists attributes last; show them first, like the markup. */
function attributesFirst(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(attributesFirst)
  if (typeof value !== 'object' || value === null) return value
  const entries = Object.entries(value).map(
    ([key, child]) => [key, attributesFirst(child)] as const,
  )
  const rank = (key: string) =>
    key.startsWith('@') ? 0 : key === '#text' ? 2 : 1
  return Object.fromEntries(entries.sort(([a], [b]) => rank(a) - rank(b)))
}

export const xmlFormat: FormatAdapter = {
  id: 'xml',
  label: 'XML',
  extensions: ['xml', 'xsd', 'svg', 'rss', 'atom'],
  mimeTypes: ['application/xml', 'text/xml'],
  sniff(raw) {
    const trimmed = raw.trimStart()
    if (trimmed.startsWith('<?xml')) return 1
    return trimmed.startsWith('<') ? 0.9 : 0
  },
  parse(raw) {
    if (!raw.trim()) {
      return {
        ok: false,
        error: { message: 'Document is empty', line: 1, column: 1 },
      }
    }
    // XMLValidator is marked deprecated in favour of fast-xml-validator,
    // but that package depends on Node's Buffer and can't run in browsers.
    const validation = XMLValidator.validate(raw)
    if (validation !== true) {
      return {
        ok: false,
        error: {
          message: validation.err.msg,
          line: validation.err.line,
          column: validation.err.col,
        },
      }
    }
    try {
      return { ok: true, value: attributesFirst(parser.parse(raw)) }
    } catch (error) {
      return {
        ok: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          line: 1,
          column: 1,
        },
      }
    }
  },
  format(raw) {
    return formatXml(raw, {
      indentation: '  ',
      lineSeparator: '\n',
      collapseContent: true,
    })
  },
  minify(raw) {
    return formatXml.minify(raw, { collapseContent: true })
  },
  language: () => xml(),
}
