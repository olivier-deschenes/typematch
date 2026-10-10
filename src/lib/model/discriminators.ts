import { isPlainObject, isPrimitive } from './resolve'
import type { DiscriminatorCandidate, Primitive } from './types'

const STRONG_NAME =
  /^@?(type|kind|role|category|qualifier|usage|purpose|code)$/i
const WEAK_NAME = /(type|kind|role|category|qualifier)$/i

/**
 * Fields that can split array items into groups, e.g. `type` for
 * addresses that are either `sender` or `receiver`. Best candidates first.
 */
export function discriminatorCandidates(
  items: ReadonlyArray<unknown>,
): Array<DiscriminatorCandidate> {
  const objects = items.filter(isPlainObject)
  if (objects.length === 0) return []

  const valuesByField = new Map<string, Array<Primitive>>()
  for (const item of objects) {
    for (const [field, value] of Object.entries(item)) {
      if (!isPrimitive(value)) continue
      let values = valuesByField.get(field)
      if (!values) valuesByField.set(field, (values = []))
      values.push(value)
    }
  }

  const scored = [...valuesByField]
    .filter(([, values]) => new Set(values).size >= 2)
    .map(([field, values]) => {
      const distinct = [...new Set(values)]
      const coverage = values.length / objects.length
      const nameScore = STRONG_NAME.test(field)
        ? 3
        : WEAK_NAME.test(field)
          ? 1.5
          : 0
      const repeats = distinct.length < objects.length
      const numeric = distinct.every((v) => typeof v === 'number')
      const score =
        nameScore +
        coverage +
        (repeats ? 1 : 0) -
        (distinct.length / objects.length) * 0.5 -
        (numeric ? 1 : 0)
      return {
        candidate: {
          field,
          values: distinct.slice(0, 8),
          coverage,
          suggested:
            coverage >= 0.8 &&
            distinct.length >= 2 &&
            (nameScore > 0 || (repeats && !numeric)),
        },
        score,
      }
    })

  return scored
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate)
}
