import { json } from '@codemirror/lang-json'
import { offsetToLineColumn } from './types'
import type { FormatAdapter, ParseError } from './types'

/**
 * Engines report JSON errors differently (V8 gives a position, Firefox a
 * line/column, Safari nothing), so fall back to a small scanner that finds
 * the offset of the first syntax error.
 */
function locateError(raw: string, error: unknown): ParseError {
  const message =
    error instanceof Error ? error.message : 'Invalid JSON document'
  const lineCol = /line (\d+) column (\d+)/i.exec(message)
  if (lineCol) {
    return {
      message: cleanMessage(message),
      line: Number(lineCol[1]),
      column: Number(lineCol[2]),
    }
  }
  const position = /position (\d+)/i.exec(message)
  const offset = position ? Number(position[1]) : findErrorOffset(raw)
  return { message: cleanMessage(message), ...offsetToLineColumn(raw, offset) }
}

function cleanMessage(message: string) {
  return message
    .replace(/^JSON\.parse: /, '')
    .replace(/^JSON Parse error: /, '')
    .replace(/ in JSON at position \d+.*$/, '')
    .replace(/ at line \d+ column \d+ of the JSON data$/, '')
}

function findErrorOffset(raw: string): number {
  let i = 0
  const ws = () => {
    while (i < raw.length && /\s/.test(raw[i])) i++
  }
  const fail = (): never => {
    throw i
  }
  const literal = (word: string) => {
    if (raw.startsWith(word, i)) i += word.length
    else fail()
  }
  const string = () => {
    i++
    while (i < raw.length && raw[i] !== '"') {
      if (raw[i] === '\\') i++
      else if (raw.charCodeAt(i) < 0x20) fail()
      i++
    }
    if (i >= raw.length) fail()
    i++
  }
  const number = () => {
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(raw.slice(i))
    if (!match) fail()
    else i += match[0].length
  }
  const value = (): void => {
    ws()
    const c = raw[i]
    if (c === '{') {
      i++
      ws()
      if (raw[i] === '}') {
        i++
        return
      }
      for (;;) {
        ws()
        if (raw[i] !== '"') fail()
        string()
        ws()
        if (raw[i] !== ':') fail()
        i++
        value()
        ws()
        if (raw[i] === ',') {
          i++
          continue
        }
        if (raw[i] === '}') {
          i++
          return
        }
        fail()
      }
    }
    if (c === '[') {
      i++
      ws()
      if (raw[i] === ']') {
        i++
        return
      }
      for (;;) {
        value()
        ws()
        if (raw[i] === ',') {
          i++
          continue
        }
        if (raw[i] === ']') {
          i++
          return
        }
        fail()
      }
    }
    if (c === '"') return string()
    if (c === 't') return literal('true')
    if (c === 'f') return literal('false')
    if (c === 'n') return literal('null')
    return number()
  }
  try {
    value()
    ws()
    return i
  } catch (offset) {
    return typeof offset === 'number' ? offset : 0
  }
}

export const jsonFormat: FormatAdapter = {
  id: 'json',
  label: 'JSON',
  extensions: ['json'],
  mimeTypes: ['application/json', 'text/json'],
  sniff(raw) {
    const start = raw.trimStart()[0]
    return start === '{' || start === '[' ? 0.9 : 0
  },
  parse(raw) {
    if (!raw.trim()) {
      return {
        ok: false,
        error: { message: 'Document is empty', line: 1, column: 1 },
      }
    }
    try {
      return { ok: true, value: JSON.parse(raw) }
    } catch (error) {
      return { ok: false, error: locateError(raw, error) }
    }
  },
  format(raw) {
    return JSON.stringify(JSON.parse(raw), null, 2)
  },
  minify(raw) {
    return JSON.stringify(JSON.parse(raw))
  },
  language: () => json(),
}
