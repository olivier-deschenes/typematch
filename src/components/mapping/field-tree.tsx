import { useState } from 'react'
import { useSelector } from '@tanstack/react-store'
import {
  IconArrowsSort,
  IconChevronsDown,
  IconChevronsUp,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from '@tabler/icons-react'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#/components/ui/input-group'
import { Kbd } from '#/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { fieldKey, setRequired } from '#/db/actions'
import { useWorkspace } from '#/hooks/use-workspace'
import type { SortBy, SortDirection } from '#/lib/model/sort'
import { walkTree } from '#/lib/model/tree'
import type { Side } from '#/lib/model/types'
import { cn } from '#/lib/utils'
import { mappingUi } from '#/stores/mapping-ui'
import type { FilterMode } from '#/stores/mapping-ui'
import { useMappingCanvas } from './canvas-context'
import { FieldRow } from './field-row'
import type { RequiredState } from './field-row'

const SIDE_LABEL: Record<Side, string> = { source: 'Source', target: 'Target' }
const FILTERS: Array<{ value: FilterMode; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'mapped', label: 'Mapped' },
  { value: 'unmapped', label: 'Unmapped' },
  { value: 'required', label: 'Required' },
]

function SortMenu({ side }: { side: Side }) {
  const sort = useSelector(mappingUi, (s) => s.sort[side])
  const linked = useSelector(mappingUi, (s) => s.sortLinked)
  const Icon =
    sort.by === 'none'
      ? IconArrowsSort
      : sort.direction === 'asc'
        ? IconSortAscending
        : IconSortDescending
  const text = sort.by === 'none' ? 'Sort' : sort.by === 'key' ? 'Key' : 'Value'
  const label =
    sort.by === 'none'
      ? 'Sort fields'
      : `Sorted by ${sort.by}, ${sort.direction === 'asc' ? 'ascending' : 'descending'}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          aria-label={label}
          data-active={sort.by !== 'none'}
          className="text-muted-foreground data-[active=true]:text-foreground"
        >
          <Icon data-icon="inline-start" />
          {text}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-muted-foreground">
          Sort by
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sort.by}
          onValueChange={(by) =>
            mappingUi.actions.setSort(side, { ...sort, by: by as SortBy })
          }
        >
          <DropdownMenuRadioItem value="none">
            Document order
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="key">Key</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="value">Value</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={sort.direction}
          onValueChange={(direction) =>
            mappingUi.actions.setSort(side, {
              by: sort.by === 'none' ? 'key' : sort.by,
              direction: direction as SortDirection,
            })
          }
        >
          <DropdownMenuRadioItem value="asc">
            <IconSortAscending className="text-muted-foreground" />
            Ascending
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="desc">
            <IconSortDescending className="text-muted-foreground" />
            Descending
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={linked}
          onCheckedChange={(checked) =>
            mappingUi.actions.setSortLinked(side, checked)
          }
          onSelect={(event) => event.preventDefault()}
        >
          Same sort on both sides
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TreeHeader({ side }: { side: Side }) {
  const { views } = useMappingCanvas()
  const view = views[side]
  const workspace = useWorkspace()
  const doc = workspace.sides[side].doc
  const filterMode = useSelector(mappingUi, (s) => s.filter[side])
  const matchCount = view.filter?.matchCount ?? 0
  const filtering = !!view.query.trim() || filterMode !== 'all'

  const setAllCollapsed = (collapsed: boolean) => {
    if (!view.tree) return
    const paths = collapsed
      ? [...walkTree(view.tree.root)]
          .filter((n) => n.children.length > 0 && n.role !== 'root')
          .map((n) => n.path)
      : []
    mappingUi.actions.setCollapsed(side, paths)
  }

  return (
    <header className="flex flex-col gap-2 border-b p-2">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="text-sm font-medium">{SIDE_LABEL[side]}</h2>
        <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
          {doc?.name || workspace.sides[side].format?.label}
        </span>
        <div className="ml-auto flex shrink-0 items-center">
          <SortMenu side={side} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Expand all"
                onClick={() => setAllCollapsed(false)}
              >
                <IconChevronsDown />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Expand all</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Collapse all"
                onClick={() => setAllCollapsed(true)}
              >
                <IconChevronsUp />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse all</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <InputGroup className="h-7">
        <InputGroupAddon>
          <IconSearch />
        </InputGroupAddon>
        <InputGroupInput
          ref={view.searchRef}
          aria-label={`Search ${SIDE_LABEL[side].toLowerCase()} fields`}
          placeholder="Search fields and values"
          value={view.query}
          onChange={(event) => view.setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && view.query) {
              event.stopPropagation()
              view.setQuery('')
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              view.scrollRef.current?.focus()
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          {view.query ? (
            <>
              <span className="tabular-nums" aria-live="polite">
                {view.searching ? '…' : `${matchCount} found`}
              </span>
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => view.setQuery('')}
              >
                <IconX />
              </InputGroupButton>
            </>
          ) : (
            side === 'source' && <Kbd>/</Kbd>
          )}
        </InputGroupAddon>
      </InputGroup>
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        spacing={0}
        value={filterMode}
        onValueChange={(value) => {
          if (value) mappingUi.actions.setFilter(side, value as FilterMode)
        }}
        aria-label={`Filter ${SIDE_LABEL[side].toLowerCase()} fields`}
        className="w-full"
      >
        {FILTERS.map((filter) => (
          <ToggleGroupItem
            key={filter.value}
            value={filter.value}
            className="flex-1 text-xs"
          >
            {filter.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {filtering && view.flat.rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No fields match. Clear the search or filter to see everything.
        </p>
      )}
    </header>
  )
}

export function FieldTree({ side }: { side: Side }) {
  // TanStack Virtual returns fresh items from a mutable instance.
  'use no memo'
  const { views, activePaths, toggleConnect, openMapTo } = useMappingCanvas()
  const view = views[side]
  const workspace = useWorkspace()
  const pending = useSelector(mappingUi, (s) => s.pending)
  const dropTarget = useSelector(mappingUi, (s) => s.dropTarget)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [treeFocused, setTreeFocused] = useState(false)
  const { rows } = view.flat
  const focused = Math.min(focusedIndex, Math.max(0, rows.length - 1))
  const rowId = (index: number) => `${side}-row-${index}`

  const requiredState = (path: string): RequiredState => {
    if (!workspace.rules.has(fieldKey(side, path))) return 'none'
    const status = workspace.required.find(
      (r) => r.rule.side === side && r.rule.path === path,
    )
    return status?.satisfied ? 'satisfied' : 'unsatisfied'
  }

  const moveFocus = (index: number) => {
    const next = Math.max(0, Math.min(rows.length - 1, index))
    setFocusedIndex(next)
    view.virtualizer.scrollToIndex(next, { align: 'auto' })
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const row = rows[focused] as (typeof rows)[number] | undefined
    if (!row) return
    const field = { side, path: row.node.path }
    switch (event.key) {
      case 'ArrowDown':
        moveFocus(focused + 1)
        break
      case 'ArrowUp':
        moveFocus(focused - 1)
        break
      case 'Home':
        moveFocus(0)
        break
      case 'End':
        moveFocus(rows.length - 1)
        break
      case 'PageDown':
        moveFocus(focused + 10)
        break
      case 'PageUp':
        moveFocus(focused - 10)
        break
      case 'ArrowRight':
        if (row.expandable && !row.expanded) {
          mappingUi.actions.toggleCollapsed(side, row.node.path)
        } else if (row.expandable) moveFocus(focused + 1)
        break
      case 'ArrowLeft':
        if (row.expandable && row.expanded) {
          mappingUi.actions.toggleCollapsed(side, row.node.path)
        } else if (row.node.parentPath) {
          const parent = view.flat.rowIndex.get(row.node.parentPath)
          if (parent !== undefined) moveFocus(parent)
        }
        break
      case 'Enter':
      case ' ':
        toggleConnect(field)
        break
      case 'm':
      case 'M':
        openMapTo(field)
        break
      case 'r':
      case 'R':
        setRequired(
          side,
          row.node.path,
          requiredState(row.node.path) === 'none',
        )
        break
      default:
        return
    }
    event.preventDefault()
  }

  const awaitingTarget = !!pending && pending.side !== side

  return (
    <section
      aria-label={`${SIDE_LABEL[side]} fields`}
      className="flex min-h-0 min-w-0 flex-col"
    >
      <TreeHeader side={side} />
      <div
        ref={view.scrollRef}
        role="tree"
        tabIndex={0}
        aria-label={`${SIDE_LABEL[side]} fields`}
        aria-activedescendant={rows.length ? rowId(focused) : undefined}
        className={cn(
          'relative min-h-0 flex-1 overflow-auto overscroll-contain outline-none',
          'focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
        )}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          if (event.target === event.currentTarget) setTreeFocused(true)
        }}
        onBlur={() => setTreeFocused(false)}
      >
        <div
          className="relative w-full"
          style={{ height: view.virtualizer.getTotalSize() }}
        >
          {view.virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index] as (typeof rows)[number] | undefined
            if (!row) return null
            const path = row.node.path
            return (
              <FieldRow
                key={path}
                id={rowId(item.index)}
                row={row}
                side={side}
                top={item.start}
                focused={treeFocused && item.index === focused}
                mappedCount={workspace.mappedCount[side].get(path) ?? 0}
                requiredState={requiredState(path)}
                highlighted={activePaths[side].has(path)}
                isOrigin={pending?.side === side && pending.path === path}
                isDropTarget={
                  dropTarget?.side === side && dropTarget.path === path
                }
                awaitingTarget={awaitingTarget}
                onFocusRow={() => setFocusedIndex(item.index)}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
