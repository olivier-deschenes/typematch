import { useState } from 'react'
import {
  IconAlignLeft,
  IconAsterisk,
  IconAt,
  IconBraces,
  IconBrackets,
  IconChevronRight,
  IconCircleDashed,
  IconFilter,
  IconHash,
  IconLetterCase,
  IconToggleLeft,
} from '@tabler/icons-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import type { FlatRow } from '#/lib/model/flatten'
import { describePath } from '#/lib/model/path'
import { formatPrimitive } from '#/lib/model/resolve'
import type { Range } from '#/lib/model/search'
import type { FieldNode, Side } from '#/lib/model/types'
import { cn } from '#/lib/utils'
import { mappingUi } from '#/stores/mapping-ui'
import { useMappingCanvas } from './canvas-context'
import { FieldMenu } from './field-menu'
import { ROW_HEIGHT } from './use-tree-view'

export type RequiredState = 'none' | 'satisfied' | 'unsatisfied'

function TypeIcon({ node }: { node: FieldNode }) {
  const className = 'size-3.5 shrink-0 text-muted-foreground'
  if (node.role === 'group') return <IconFilter className={className} />
  if (node.label.startsWith('@')) return <IconAt className={className} />
  if (node.label === '#text') return <IconAlignLeft className={className} />
  switch (node.kind) {
    case 'object':
      return <IconBraces className={className} />
    case 'array':
      return <IconBrackets className={className} />
    case 'number':
      return <IconHash className={className} />
    case 'boolean':
      return <IconToggleLeft className={className} />
    case 'null':
      return <IconCircleDashed className={className} />
    default:
      return <IconLetterCase className={className} />
  }
}

function Highlight({ text, range }: { text: string; range?: Range }) {
  if (!range) return <>{text}</>
  return (
    <>
      {text.slice(0, range[0])}
      <mark className="bg-warning/20 text-foreground">
        {text.slice(range[0], range[1])}
      </mark>
      {text.slice(range[1])}
    </>
  )
}

const plural = (count: number, word: string) =>
  `${count} ${count === 1 ? word : `${word}s`}`

function ValuePreview({ node, range }: { node: FieldNode; range?: Range }) {
  const muted = 'text-muted-foreground'
  if (node.role === 'group') {
    return <span className={muted}>{plural(node.itemCount ?? 0, 'item')}</span>
  }
  if (node.kind === 'object') {
    return (
      <span className={muted}>{plural(node.children.length, 'field')}</span>
    )
  }
  if (node.kind === 'array') {
    const view =
      node.view?.mode === 'index'
        ? 'by position'
        : node.view?.mode === 'group'
          ? `by ${node.view.groupBy}`
          : null
    const preview =
      node.children.length === 0 && node.samples.length
        ? node.samples.map(formatPrimitive).join(', ')
        : null
    return (
      <span className={muted}>
        {plural(node.itemCount ?? 0, 'item')}
        {view && ` · ${view}`}
        {preview && <span className="text-foreground/80"> · {preview}</span>}
      </span>
    )
  }
  const value = node.value ?? null
  const extra = node.samples.length - 1
  return (
    <>
      {value === null ? (
        <span className={cn(muted, 'italic')}>null</span>
      ) : value === '' ? (
        <span className={cn(muted, 'italic')}>empty</span>
      ) : (
        <span
          className={cn(
            'text-foreground/70',
            typeof value === 'number' && 'tabular-nums',
          )}
        >
          <Highlight text={formatPrimitive(value)} range={range} />
        </span>
      )}
      {extra > 0 && <span className={muted}> +{extra} more</span>}
    </>
  )
}

export function FieldRow({
  row,
  side,
  id,
  top,
  focused,
  mappedCount,
  requiredState,
  highlighted,
  isOrigin,
  isDropTarget,
  awaitingTarget,
  onFocusRow,
}: {
  row: FlatRow
  side: Side
  id: string
  top: number
  focused: boolean
  mappedCount: number
  requiredState: RequiredState
  highlighted: boolean
  isOrigin: boolean
  isDropTarget: boolean
  /** A connection from the other side is waiting for this side */
  awaitingTarget: boolean
  onFocusRow: () => void
}) {
  const { node, level, expandable, expanded, match } = row
  const { beginDrag, toggleConnect, activateRow } = useMappingCanvas()
  const [menuOpen, setMenuOpen] = useState(false)
  const field = { side, path: node.path }
  const isSource = side === 'source'
  const indent = 6 + level * 14

  const port = (
    <div className="flex w-5 shrink-0 items-center justify-center self-stretch">
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Connect ${node.label}`}
        data-mapped={mappedCount > 0}
        data-active={isOrigin || isDropTarget || highlighted}
        className="size-2.5 rounded-full border border-muted-foreground/70 bg-background transition-transform hover:scale-150 hover:border-primary data-[active=true]:border-primary data-[active=true]:bg-primary data-[mapped=true]:border-connector data-[mapped=true]:bg-connector data-[mapped=true]:data-[active=true]:border-primary data-[mapped=true]:data-[active=true]:bg-primary"
        onPointerDown={(event) => beginDrag(field, event)}
        onClick={(event) => {
          event.stopPropagation()
          // Pointer interactions are handled on pointerdown.
          if (event.detail === 0) toggleConnect(field)
        }}
      />
    </div>
  )

  return (
    <div
      id={id}
      role="treeitem"
      aria-level={level + 1}
      aria-expanded={expandable ? expanded : undefined}
      aria-selected={focused}
      data-field-side={side}
      data-field-path={node.path}
      className={cn(
        'group/row absolute inset-x-0 top-0 flex items-center text-xs select-none',
        'hover:bg-muted/60 aria-selected:bg-accent',
        highlighted && 'bg-accent hover:bg-accent',
        isOrigin && 'bg-accent hover:bg-accent',
        isDropTarget &&
          'bg-accent outline outline-1 -outline-offset-1 outline-primary hover:bg-accent',
        awaitingTarget && 'cursor-crosshair',
      )}
      style={{ height: ROW_HEIGHT, transform: `translateY(${top}px)` }}
      onPointerEnter={() => mappingUi.actions.hoverField(field)}
      onPointerLeave={() => mappingUi.actions.hoverField(null)}
      onClick={() => {
        onFocusRow()
        activateRow(field)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        onFocusRow()
        setMenuOpen(true)
      }}
    >
      {!isSource && port}
      <div
        className="flex min-w-0 flex-1 items-center gap-1.5 pr-1"
        style={{ paddingLeft: indent }}
      >
        {expandable ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            className="-ml-1 flex size-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation()
              mappingUi.actions.toggleCollapsed(side, node.path)
            }}
          >
            <IconChevronRight
              className={cn(
                'size-3.5 transition-transform',
                expanded && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <span className="-ml-1 size-4 shrink-0" />
        )}
        <TypeIcon node={node} />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
              <span
                className={cn(
                  'shrink-0 font-mono',
                  node.role === 'group' || node.role === 'element'
                    ? 'text-muted-foreground'
                    : 'text-foreground',
                )}
              >
                <Highlight text={node.label} range={match?.label} />
              </span>
              <span className="min-w-0 truncate font-mono">
                <ValuePreview node={node} range={match?.value} />
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent
            side={isSource ? 'left' : 'right'}
            className="max-w-sm flex-col items-start gap-1"
          >
            <span className="font-mono break-all">{node.path}</span>
            <span className="text-background/70">
              {describePath(node.path)}
            </span>
            {node.samples.length > 0 && (
              <span className="font-mono break-all">
                {node.samples.map(formatPrimitive).join(' · ')}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
        {requiredState === 'unsatisfied' && (
          <span className="flex shrink-0 items-center gap-0.5 font-medium text-warning">
            <IconAsterisk className="size-3" aria-hidden />
            Required
          </span>
        )}
        {requiredState === 'satisfied' && (
          <span className="flex shrink-0 items-center text-success">
            <IconAsterisk className="size-3" aria-hidden />
            <span className="sr-only">Required</span>
          </span>
        )}
        {mappedCount > 1 && (
          <span
            className="shrink-0 text-muted-foreground tabular-nums"
            aria-label={`${mappedCount} mappings`}
          >
            ×{mappedCount}
          </span>
        )}
        <FieldMenu
          node={node}
          side={side}
          required={requiredState !== 'none'}
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      </div>
      {isSource && port}
    </div>
  )
}
