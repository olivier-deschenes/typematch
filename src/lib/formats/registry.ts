import type { FormatAdapter } from './types'

const formats = new Map<string, FormatAdapter>()

export function registerFormat(adapter: FormatAdapter) {
  formats.set(adapter.id, adapter)
}

export function getFormat(id: string): FormatAdapter | undefined {
  return formats.get(id)
}

export function listFormats(): Array<FormatAdapter> {
  return [...formats.values()]
}

export function detectFormat({
  fileName,
  mimeType,
  raw,
}: {
  fileName?: string
  mimeType?: string
  raw?: string
}): FormatAdapter | undefined {
  const all = listFormats()
  const extension = fileName?.split('.').pop()?.toLowerCase()
  if (extension && fileName?.includes('.')) {
    const byExtension = all.find((f) => f.extensions.includes(extension))
    if (byExtension) return byExtension
  }
  if (mimeType) {
    const byMime = all.find((f) => f.mimeTypes.includes(mimeType))
    if (byMime) return byMime
  }
  if (raw) {
    let best: FormatAdapter | undefined
    let bestScore = 0
    for (const format of all) {
      const score = format.sniff(raw)
      if (score > bestScore) {
        best = format
        bestScore = score
      }
    }
    return best
  }
  return undefined
}
