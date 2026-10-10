import { createStore } from '@tanstack/react-store'
import type { Side } from '#/lib/model/types'

export type FilterMode = 'all' | 'mapped' | 'unmapped' | 'required'

export interface FieldRef {
  side: Side
  path: string
}

export interface MappingUiState {
  selectedMappingId: string | null
  hoveredMappingId: string | null
  /** Row under the pointer; highlights its arrows */
  hoveredField: FieldRef | null
  /** Origin of a connection being drawn (drag or click-click) */
  pending: (FieldRef & { mode: 'drag' | 'click' }) | null
  /** Pointer position during a drag, relative to the mapping canvas */
  pointer: { x: number; y: number } | null
  dropTarget: FieldRef | null
  collapsed: Record<Side, ReadonlySet<string>>
  filter: Record<Side, FilterMode>
}

const initialState: MappingUiState = {
  selectedMappingId: null,
  hoveredMappingId: null,
  hoveredField: null,
  pending: null,
  pointer: null,
  dropTarget: null,
  collapsed: { source: new Set(), target: new Set() },
  filter: { source: 'all', target: 'all' },
}

export const mappingUi = createStore(initialState, ({ setState }) => ({
  selectMapping(id: string | null) {
    setState((s) => ({ ...s, selectedMappingId: id }))
  },
  hoverMapping(id: string | null) {
    setState((s) =>
      s.hoveredMappingId === id ? s : { ...s, hoveredMappingId: id },
    )
  },
  hoverField(field: FieldRef | null) {
    setState((s) =>
      s.hoveredField?.side === field?.side &&
      s.hoveredField?.path === field?.path
        ? s
        : { ...s, hoveredField: field },
    )
  },
  startConnection(field: FieldRef, mode: 'drag' | 'click') {
    setState((s) => ({
      ...s,
      pending: { ...field, mode },
      selectedMappingId: null,
      dropTarget: null,
    }))
  },
  movePointer(pointer: { x: number; y: number } | null) {
    setState((s) => ({ ...s, pointer }))
  },
  setDropTarget(field: FieldRef | null) {
    setState((s) =>
      s.dropTarget?.side === field?.side && s.dropTarget?.path === field?.path
        ? s
        : { ...s, dropTarget: field },
    )
  },
  cancelConnection() {
    setState((s) => ({ ...s, pending: null, pointer: null, dropTarget: null }))
  },
  toggleCollapsed(side: Side, path: string) {
    setState((s) => {
      const next = new Set(s.collapsed[side])
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return { ...s, collapsed: { ...s.collapsed, [side]: next } }
    })
  },
  setCollapsed(side: Side, paths: Iterable<string>) {
    setState((s) => ({
      ...s,
      collapsed: { ...s.collapsed, [side]: new Set(paths) },
    }))
  },
  setFilter(side: Side, filter: FilterMode) {
    setState((s) => ({ ...s, filter: { ...s.filter, [side]: filter } }))
  },
}))
