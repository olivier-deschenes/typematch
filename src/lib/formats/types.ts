import type { Extension } from '@codemirror/state'

export interface ParseError {
  message: string
  /** 1-based line of the error */
  line: number
  /** 1-based column of the error */
  column: number
}

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: ParseError }

/**
 * A pluggable document format. Every adapter turns raw text into a plain
 * JS value (objects, arrays, primitives) so the rest of the app is
 * format-agnostic. Add a new format by implementing this interface and
 * calling `registerFormat`.
 */
export interface FormatAdapter {
  id: string
  label: string
  extensions: Array<string>
  mimeTypes: Array<string>
  /** Confidence (0..1) that `raw` is in this format. */
  sniff: (raw: string) => number
  parse: (raw: string) => ParseResult
  /** Pretty-print. Throws on invalid input. */
  format: (raw: string) => string
  /** Compact output. Throws on invalid input. */
  minify?: (raw: string) => string
  /** CodeMirror language support for the editor. */
  language: () => Extension
}

export function offsetToLineColumn(
  raw: string,
  offset: number,
): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, raw.length))
  let line = 1
  let lineStart = 0
  for (let i = 0; i < clamped; i++) {
    if (raw.charCodeAt(i) === 10) {
      line++
      lineStart = i + 1
    }
  }
  return { line, column: clamped - lineStart + 1 }
}

export function lineColumnToOffset(
  raw: string,
  line: number,
  column: number,
): number {
  let current = 1
  let offset = 0
  while (current < line) {
    const next = raw.indexOf('\n', offset)
    if (next === -1) return raw.length
    offset = next + 1
    current++
  }
  return Math.min(raw.length, offset + Math.max(0, column - 1))
}
