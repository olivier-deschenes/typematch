import { createContext, use } from 'react'
import type { Side } from '#/lib/model/types'
import type { FieldRef } from '#/stores/mapping-ui'
import type { TreeView } from './use-tree-view'

export interface MappingCanvasApi {
  views: Record<Side, TreeView>
  /** Mappings related to the hovered/selected mapping or hovered field */
  activeMappingIds: ReadonlySet<string>
  /** Field paths at either end of the active mappings */
  activePaths: Record<Side, ReadonlySet<string>>
  beginDrag: (field: FieldRef, event: React.PointerEvent) => void
  /** Keyboard / click-mode connect: start, or complete a pending one */
  toggleConnect: (field: FieldRef) => void
  /** Row click: completes a pending connection from the other side */
  activateRow: (field: FieldRef) => boolean
  openMapTo: (field: FieldRef) => void
}

export const MappingCanvasContext = createContext<MappingCanvasApi | null>(null)

export function useMappingCanvas() {
  const api = use(MappingCanvasContext)
  if (!api) throw new Error('useMappingCanvas must be used inside the canvas')
  return api
}
