import { xml } from '@codemirror/lang-xml'
import { XMLParser } from 'fast-xml-parser'
import { SyntaxValidator } from 'fast-xml-validator'
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
    try {
      SyntaxValidator.validate(raw)
    } catch (error) {
      const e = error as { message?: string; line?: number; col?: number }
      return {
        ok: false,
        error: {
          message: e.message ?? 'Invalid XML document',
          line: e.line ?? 1,
          column: e.col ?? 1,
        },
      }
    }
    try {
      return { ok: true, value: parser.parse(raw) }
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
