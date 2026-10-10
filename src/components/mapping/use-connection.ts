import { toast } from 'sonner'
import { addMapping, mappingKey } from '#/db/actions'
import { describePath } from '#/lib/model/path'
import type { Side } from '#/lib/model/types'
import { mappingUi } from '#/stores/mapping-ui'
import type { FieldRef } from '#/stores/mapping-ui'

function fieldAt(x: number, y: number): FieldRef | null {
  const element = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>('[data-field-path]')
  if (!element?.dataset.fieldPath) return null
  return {
    side: element.dataset.fieldSide as Side,
    path: element.dataset.fieldPath,
  }
}

/** Creates the mapping between two fields on opposite sides. */
export function connect(a: FieldRef, b: FieldRef) {
  const source = a.side === 'source' ? a : b
  const target = a.side === 'source' ? b : a
  const added = addMapping(source.path, target.path)
  mappingUi.actions.cancelConnection()
  mappingUi.actions.selectMapping(mappingKey(source.path, target.path))
  if (!added) {
    toast('Already mapped', {
      description: `${describePath(source.path)} → ${describePath(target.path)}`,
    })
  }
}

/**
 * Drawing connections: drag from a port onto a row of the other side, or
 * click a port then click a row. A drag that never moves becomes click mode.
 */
export function useConnection(
  canvasRef: React.RefObject<HTMLDivElement | null>,
) {
  const relative = (event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return rect
      ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
      : null
  }

  const trackPointer = (event: { clientX: number; clientY: number }) => {
    const pending = mappingUi.state.pending
    if (!pending) return
    mappingUi.actions.movePointer(relative(event))
    const over = fieldAt(event.clientX, event.clientY)
    mappingUi.actions.setDropTarget(
      over && over.side !== pending.side ? over : null,
    )
  }

  const beginDrag = (field: FieldRef, event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const pending = mappingUi.state.pending
    if (pending && pending.side !== field.side) {
      connect(pending, field)
      return
    }
    if (pending?.path === field.path && pending.side === field.side) {
      mappingUi.actions.cancelConnection()
      return
    }

    const start = { x: event.clientX, y: event.clientY }
    let moved = false
    mappingUi.actions.startConnection(field, 'drag')
    mappingUi.actions.movePointer(relative(event))

    const onMove = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) {
        moved = true
      }
      trackPointer(e)
    }
    const onUp = (e: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      if (!moved) {
        mappingUi.actions.startConnection(field, 'click')
        mappingUi.actions.movePointer(relative(e))
        return
      }
      const over = fieldAt(e.clientX, e.clientY)
      if (over && over.side !== field.side) connect(field, over)
      else mappingUi.actions.cancelConnection()
    }
    const onCancel = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      mappingUi.actions.cancelConnection()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  const toggleConnect = (field: FieldRef) => {
    const pending = mappingUi.state.pending
    if (pending && pending.side !== field.side) connect(pending, field)
    else if (pending?.path === field.path) mappingUi.actions.cancelConnection()
    else mappingUi.actions.startConnection(field, 'click')
  }

  const activateRow = (field: FieldRef) => {
    const pending = mappingUi.state.pending
    if (pending?.mode === 'click' && pending.side !== field.side) {
      connect(pending, field)
      return true
    }
    return false
  }

  /** Pointer tracking for the click-mode preview line. */
  const onCanvasPointerMove = (event: React.PointerEvent) => {
    if (mappingUi.state.pending?.mode === 'click') trackPointer(event)
  }

  return { beginDrag, toggleConnect, activateRow, onCanvasPointerMove }
}
