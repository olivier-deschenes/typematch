import type { Side } from '#/lib/model/types'

/** Collection key for per-field records (rules, array views). */
export const fieldKey = (side: Side, path: string) => `${side}:${path}`

/** Collection key for a mapping; one mapping per source/target pair. */
export const mappingKey = (sourcePath: string, targetPath: string) =>
  `${sourcePath}=>${targetPath}`
