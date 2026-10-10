import { jsonFormat } from './json'
import { registerFormat } from './registry'
import { xmlFormat } from './xml'

// Register built-in formats. To support a new format, add an adapter file
// implementing `FormatAdapter` and register it here.
registerFormat(jsonFormat)
registerFormat(xmlFormat)

export { detectFormat, getFormat, listFormats, registerFormat } from './registry'
export { lineColumnToOffset, offsetToLineColumn } from './types'
export type { FormatAdapter, ParseError, ParseResult } from './types'
