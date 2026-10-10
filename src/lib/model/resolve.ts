import type { PathSegment, Primitive } from './types'

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

/**
 * XML yields an object for a single element and an array for repeated
 * ones, so array segments also accept a lone value as a one-item list.
 */
function asItems(value: unknown): Array<unknown> {
  if (Array.isArray(value)) return value
  return value === undefined ? [] : [value]
}

/** Every value the path points to in the document (empty when missing). */
export function resolvePath(
  document: unknown,
  segments: ReadonlyArray<PathSegment>,
): Array<unknown> {
  let current: Array<unknown> = [document]
  for (const segment of segments) {
    switch (segment.type) {
      case 'key':
        current = current.flatMap((value) =>
          isPlainObject(value) && segment.key in value
            ? [value[segment.key]]
            : [],
        )
        break
      case 'each':
        current = current.flatMap(asItems)
        break
      case 'index':
        current = current.flatMap((value) => {
          const items = asItems(value)
          return segment.index < items.length ? [items[segment.index]] : []
        })
        break
      case 'where':
        current = current.flatMap((value) =>
          asItems(value).filter(
            (item) =>
              isPlainObject(item) && item[segment.field] === segment.equals,
          ),
        )
        break
    }
  }
  return current
}

export function formatPrimitive(value: Primitive): string {
  return value === null ? 'null' : String(value)
}
