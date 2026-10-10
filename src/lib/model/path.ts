import type { PathSegment, Primitive } from './types'

/**
 * Paths are serialized as a JSONPath subset:
 *   $.order.addresses[?(@.type=='sender')].street
 *   $.order.items[*].sku
 *   $.order.items[0].sku
 *   $['Shipment']['@id']
 */

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function quote(value: string) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function literal(value: Primitive) {
  return typeof value === 'string' ? quote(value) : String(value)
}

function member(key: string) {
  return IDENTIFIER.test(key) ? `.${key}` : `[${quote(key)}]`
}

export function serializePath(segments: ReadonlyArray<PathSegment>): string {
  let out = '$'
  for (const segment of segments) {
    switch (segment.type) {
      case 'key':
        out += member(segment.key)
        break
      case 'each':
        out += '[*]'
        break
      case 'index':
        out += `[${segment.index}]`
        break
      case 'where':
        out += `[?(@${member(segment.field)}==${literal(segment.equals)})]`
        break
    }
  }
  return out
}

export class PathSyntaxError extends Error {}

export function parsePath(path: string): Array<PathSegment> {
  let i = 0
  const fail = (expected: string): never => {
    throw new PathSyntaxError(
      `Invalid path "${path}": expected ${expected} at ${i}`,
    )
  }
  const expect = (token: string) => {
    if (!path.startsWith(token, i)) fail(`"${token}"`)
    i += token.length
  }
  const identifier = () => {
    const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(path.slice(i))
    if (!match) return fail('an identifier')
    i += match[0].length
    return match[0]
  }
  const quoted = () => {
    expect("'")
    let out = ''
    while (i < path.length && path[i] !== "'") {
      if (path[i] === '\\') i++
      out += path[i]
      i++
    }
    expect("'")
    return out
  }
  const memberName = () => {
    if (path[i] === '.') {
      i++
      return identifier()
    }
    expect('[')
    const name = quoted()
    expect(']')
    return name
  }
  const value = (): Primitive => {
    if (path[i] === "'") return quoted()
    for (const [token, v] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (path.startsWith(token, i)) {
        i += token.length
        return v
      }
    }
    const match = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(path.slice(i))
    if (!match) return fail('a literal')
    i += match[0].length
    return Number(match[0])
  }

  expect('$')
  const segments: Array<PathSegment> = []
  while (i < path.length) {
    if (path[i] === '.') {
      i++
      segments.push({ type: 'key', key: identifier() })
      continue
    }
    expect('[')
    if (path[i] === '*') {
      i++
      expect(']')
      segments.push({ type: 'each' })
    } else if (path[i] === "'") {
      const key = quoted()
      expect(']')
      segments.push({ type: 'key', key })
    } else if (path[i] === '?') {
      expect('?(@')
      const field = memberName()
      expect('==')
      const equals = value()
      expect(')]')
      segments.push({ type: 'where', field, equals })
    } else {
      const match = /^\d+/.exec(path.slice(i))
      if (!match) fail('an index, "*", a quoted key or a filter')
      else {
        i += match[0].length
        expect(']')
        segments.push({ type: 'index', index: Number(match[0]) })
      }
    }
  }
  return segments
}

export function tryParsePath(path: string): Array<PathSegment> | null {
  try {
    return parsePath(path)
  } catch {
    return null
  }
}

/** Human-readable form used in the UI: order › addresses[type=sender] › street */
export function describePath(path: string): string {
  const segments = tryParsePath(path)
  if (!segments) return path
  const parts: Array<string> = []
  for (const segment of segments) {
    switch (segment.type) {
      case 'key':
        parts.push(segment.key)
        break
      case 'each':
        parts[parts.length - 1] = `${parts.at(-1) ?? ''}[*]`
        break
      case 'index':
        parts[parts.length - 1] = `${parts.at(-1) ?? ''}[${segment.index}]`
        break
      case 'where':
        parts[parts.length - 1] =
          `${parts.at(-1) ?? ''}[${segment.field}=${String(segment.equals)}]`
        break
    }
  }
  return parts.join(' › ') || '(root)'
}

/** Ancestor paths from nearest to farthest, excluding the path itself. */
export function ancestorPaths(path: string): Array<string> {
  const segments = tryParsePath(path)
  if (!segments) return []
  const out: Array<string> = []
  for (let length = segments.length - 1; length >= 0; length--) {
    out.push(serializePath(segments.slice(0, length)))
  }
  return out
}
