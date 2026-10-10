import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { useSelector } from '@tanstack/react-store'
import { IconX } from '@tabler/icons-react'
import { removeMappings } from '#/db/actions'
import { useWorkspace } from '#/hooks/use-workspace'
import { anchorRow } from '#/lib/model/flatten'
import { describePath } from '#/lib/model/path'
import type { Side } from '#/lib/model/types'
import { mappingUi } from '#/stores/mapping-ui'
import { useMappingCanvas } from './canvas-context'
import { ROW_HEIGHT } from './use-tree-view'
import type { TreeView } from './use-tree-view'

/** Distance from a column's inner edge to the port centre. */
const PORT_OFFSET = 10
/** Gap between the arrow tip and the port centre. */
const TIP_GAP = 7

interface ColumnGeometry {
  top: number
  height: number
  scrollTop: number
  x: number
}

interface Endpoint {
  x: number
  y: number
  index: number
  exact: boolean
  offscreen: 'above' | 'below' | null
}

interface Line {
  key: string
  ids: Array<string>
  from: Endpoint
  to: Endpoint
}

function columnGeometry(
  view: TreeView,
  canvas: DOMRect,
): ColumnGeometry | null {
  const element = view.scrollRef.current
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top - canvas.top,
    height: element.clientHeight,
    scrollTop: element.scrollTop,
    x:
      view.side === 'source'
        ? rect.left - canvas.left + element.clientWidth - PORT_OFFSET
        : rect.left - canvas.left + PORT_OFFSET,
  }
}

function endpoint(
  geometry: ColumnGeometry,
  index: number,
  exact: boolean,
): Endpoint {
  const y =
    geometry.top + index * ROW_HEIGHT + ROW_HEIGHT / 2 - geometry.scrollTop
  const min = geometry.top + 4
  const max = geometry.top + geometry.height - 4
  return {
    x: geometry.x,
    y: Math.min(max, Math.max(min, y)),
    index,
    exact,
    offscreen: y < min ? 'above' : y > max ? 'below' : null,
  }
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(32, Math.abs(x2 - x1) * 0.5)
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

/** Point at t=0.5 on the cubic curve above. */
function midpoint(x1: number, y1: number, x2: number, y2: number) {
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }
}

/**
 * Re-renders on scroll/resize of either column. Scroll events fire once per
 * frame before paint, so render synchronously there to keep arrows locked to
 * their rows; a deferred update would trail the scrolled content by a frame.
 */
function useGeometryTick(
  canvasRef: React.RefObject<HTMLDivElement | null>,
  views: Record<Side, TreeView>,
) {
  const [, setTick] = useState(0)
  useEffect(() => {
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setTick((t) => t + 1))
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      flushSync(() => setTick((t) => t + 1))
    }
    const elements = [
      views.source.scrollRef.current,
      views.target.scrollRef.current,
    ].filter((e): e is HTMLDivElement => !!e)
    for (const element of elements) {
      element.addEventListener('scroll', onScroll, { passive: true })
    }
    const observer = new ResizeObserver(schedule)
    if (canvasRef.current) observer.observe(canvasRef.current)
    for (const element of elements) observer.observe(element)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      for (const element of elements) {
        element.removeEventListener('scroll', onScroll)
      }
    }
  }, [canvasRef, views.source.scrollRef, views.target.scrollRef])
}

export function ConnectorLayer({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLDivElement | null>
}) {
  // Reads live DOM geometry while rendering, so React Compiler must not
  // memoize the output (the scroll tick isn't an input it can see).
  'use no memo'
  const { views, activeMappingIds } = useMappingCanvas()
  const { mappings } = useWorkspace()
  const selectedId = useSelector(mappingUi, (s) => s.selectedMappingId)
  const hoveredId = useSelector(mappingUi, (s) => s.hoveredMappingId)
  const pending = useSelector(mappingUi, (s) => s.pending)
  const pointer = useSelector(mappingUi, (s) => s.pointer)
  const dropTarget = useSelector(mappingUi, (s) => s.dropTarget)
  useGeometryTick(canvasRef, views)

  const canvas = canvasRef.current?.getBoundingClientRect()
  const source = canvas ? columnGeometry(views.source, canvas) : null
  const target = canvas ? columnGeometry(views.target, canvas) : null
  if (
    !canvas ||
    !source ||
    !target ||
    !views.source.tree ||
    !views.target.tree
  ) {
    return null
  }

  // Resolve endpoints; mappings sharing both anchor rows are bundled.
  const lines = new Map<string, Line>()
  let hiddenByFilter = 0
  for (const mapping of mappings) {
    const a = anchorRow(
      mapping.sourcePath,
      views.source.tree,
      views.source.flat,
      views.source.filter,
    )
    const b = anchorRow(
      mapping.targetPath,
      views.target.tree,
      views.target.flat,
      views.target.filter,
    )
    if (!a || !b) {
      hiddenByFilter++
      continue
    }
    const key = `${a.index}:${b.index}`
    const existing = lines.get(key)
    if (existing) {
      existing.ids.push(mapping.id)
      existing.from.exact &&= a.exact
      existing.to.exact &&= b.exact
    } else {
      lines.set(key, {
        key,
        ids: [mapping.id],
        from: endpoint(source, a.index, a.exact),
        to: endpoint(target, b.index, b.exact),
      })
    }
  }

  const isActive = (line: Line) =>
    line.ids.some((id) => activeMappingIds.has(id))
  const anyActive = activeMappingIds.size > 0 || !!pending

  // Live preview while drawing a connection.
  let preview: { d: string } | null = null
  if (pending) {
    const originView = views[pending.side]
    const originGeometry = pending.side === 'source' ? source : target
    const anchor = originView.tree
      ? anchorRow(
          pending.path,
          originView.tree,
          originView.flat,
          originView.filter,
        )
      : null
    if (anchor) {
      const origin = endpoint(originGeometry, anchor.index, true)
      let end = pointer
      if (dropTarget) {
        const otherView = views[dropTarget.side]
        const otherAnchor = otherView.tree
          ? anchorRow(
              dropTarget.path,
              otherView.tree,
              otherView.flat,
              otherView.filter,
            )
          : null
        if (otherAnchor) {
          const geometry = dropTarget.side === 'source' ? source : target
          end = endpoint(geometry, otherAnchor.index, true)
        }
      }
      if (end) {
        preview =
          pending.side === 'source'
            ? { d: curve(origin.x, origin.y, end.x - TIP_GAP, end.y) }
            : { d: curve(end.x, end.y, origin.x - TIP_GAP, origin.y) }
      }
    }
  }

  const focusLine = (line: Line) => {
    mappingUi.actions.selectMapping(line.ids[0])
    const mapping = mappings.find((m) => m.id === line.ids[0])
    if (!mapping) return
    if (line.from.offscreen) views.source.reveal(mapping.sourcePath)
    if (line.to.offscreen) views.target.reveal(mapping.targetPath)
  }

  const ordered = [...lines.values()].sort(
    (a, b) => Number(isActive(a)) - Number(isActive(b)),
  )
  const selectedLine = ordered.find((line) =>
    line.ids.some((id) => id === selectedId || id === hoveredId),
  )

  return (
    <>
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
      >
        <defs>
          {(['idle', 'active'] as const).map((state) => (
            <marker
              key={state}
              id={`tm-arrow-${state}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 1 L 9 5 L 0 9 z"
                fill={
                  state === 'active'
                    ? 'var(--connector-active)'
                    : 'var(--connector)'
                }
              />
            </marker>
          ))}
        </defs>

        {ordered.map((line) => {
          const active = isActive(line)
          const d = curve(
            line.from.x,
            line.from.y,
            line.to.x - TIP_GAP,
            line.to.y,
          )
          const offscreen = !!(line.from.offscreen || line.to.offscreen)
          return (
            <g
              key={line.key}
              opacity={anyActive && !active ? 0.3 : offscreen ? 0.55 : 1}
              className="transition-opacity"
            >
              <path
                d={d}
                fill="none"
                stroke={active ? 'var(--connector-active)' : 'var(--connector)'}
                strokeWidth={active ? 2 : 1.5}
                strokeDasharray={
                  line.from.exact && line.to.exact ? undefined : '4 3'
                }
                markerEnd={`url(#tm-arrow-${active ? 'active' : 'idle'})`}
              />
              {line.from.offscreen && (
                <circle
                  cx={line.from.x}
                  cy={line.from.y}
                  r={3}
                  fill={active ? 'var(--connector-active)' : 'var(--connector)'}
                />
              )}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                data-keep-selection
                className="pointer-events-auto cursor-pointer"
                onPointerEnter={() =>
                  mappingUi.actions.hoverMapping(line.ids[0])
                }
                onPointerLeave={() => mappingUi.actions.hoverMapping(null)}
                onClick={(event) => {
                  event.stopPropagation()
                  focusLine(line)
                }}
              >
                <title>
                  {line.ids.length > 1
                    ? `${line.ids.length} mappings`
                    : line.ids[0]
                        .split('=>')
                        .map((p) => describePath(p))
                        .join(' → ')}
                </title>
              </path>
            </g>
          )
        })}

        {preview && (
          <path
            d={preview.d}
            fill="none"
            stroke="var(--connector-active)"
            strokeWidth={2}
            strokeDasharray="5 4"
            markerEnd="url(#tm-arrow-active)"
          />
        )}
      </svg>

      {/* Bundle counts and the remove button sit above the SVG as HTML. */}
      {ordered
        .filter((line) => line.ids.length > 1)
        .map((line) => {
          const mid = midpoint(line.from.x, line.from.y, line.to.x, line.to.y)
          return (
            <span
              key={`count-${line.key}`}
              className="pointer-events-none absolute z-10 -translate-1/2 bg-background px-1 font-mono text-[10px] text-muted-foreground tabular-nums"
              style={{ left: mid.x, top: mid.y }}
            >
              {line.ids.length}
            </span>
          )
        })}

      {selectedLine && !pending && (
        <button
          type="button"
          data-keep-selection
          aria-label={
            selectedLine.ids.length > 1
              ? `Remove ${selectedLine.ids.length} mappings`
              : 'Remove mapping'
          }
          className="absolute z-20 flex size-5 -translate-1/2 items-center justify-center border bg-background text-muted-foreground hover:border-destructive hover:text-destructive"
          style={(() => {
            const mid = midpoint(
              selectedLine.from.x,
              selectedLine.from.y,
              selectedLine.to.x,
              selectedLine.to.y,
            )
            return {
              left: mid.x,
              top: mid.y + (selectedLine.ids.length > 1 ? 14 : 0),
            }
          })()}
          onPointerEnter={() =>
            mappingUi.actions.hoverMapping(selectedLine.ids[0])
          }
          onClick={(event) => {
            event.stopPropagation()
            removeMappings(selectedLine.ids)
            mappingUi.actions.selectMapping(null)
            mappingUi.actions.hoverMapping(null)
          }}
        >
          <IconX className="size-3" />
        </button>
      )}

      {hiddenByFilter > 0 && (
        <p
          className="pointer-events-none absolute z-10 -translate-x-1/2 text-center text-[11px] text-muted-foreground"
          style={{
            left: (source.x + target.x) / 2,
            top: Math.max(source.top, target.top) + 8,
          }}
        >
          {hiddenByFilter} hidden
          <br />
          by filters
        </p>
      )}
    </>
  )
}
