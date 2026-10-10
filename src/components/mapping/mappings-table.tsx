import { useMemo, useState } from 'react'
import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useSelector } from '@tanstack/react-store'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCircleCheck,
  IconArrowsSort,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from '@tabler/icons-react'
import { Button } from '#/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '#/components/ui/input-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { removeMappings, setMappingNote } from '#/db/actions'
import { samplePreview, useWorkspace } from '#/hooks/use-workspace'
import { describePath } from '#/lib/model/path'
import { mappingUi } from '#/stores/mapping-ui'
import { useMappingCanvas } from './canvas-context'

export interface MappingRow {
  id: string
  sourcePath: string
  targetPath: string
  source: string
  target: string
  sourceValue: string
  targetValue: string
  note: string
  status: 'ok' | 'missing-source' | 'missing-target' | 'missing-both'
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
})

const STATUS_LABEL: Record<MappingRow['status'], string> = {
  ok: 'OK',
  'missing-source': 'Source missing',
  'missing-target': 'Target missing',
  'missing-both': 'Both missing',
}

function NoteInput({ id, note }: { id: string; note: string }) {
  const [value, setValue] = useState(note)
  const [prev, setPrev] = useState(note)
  if (note !== prev) {
    setPrev(note)
    setValue(note)
  }
  return (
    <input
      aria-label="Note"
      value={value}
      placeholder="Add note"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => value !== note && setMappingNote(id, value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      onClick={(event) => event.stopPropagation()}
      className="h-7 w-full min-w-24 border border-transparent bg-transparent px-1.5 text-xs outline-none placeholder:text-muted-foreground/60 hover:border-input focus:border-ring"
    />
  )
}

const helper = createColumnHelper<typeof features, MappingRow>()
const columns = helper.columns([
  helper.accessor('source', {
    header: 'Source field',
    sortFn: 'text',
    cell: ({ row }) => (
      <span className="font-mono" title={row.original.sourcePath}>
        {row.original.source}
      </span>
    ),
  }),
  helper.accessor('sourceValue', {
    header: 'Value',
    sortFn: 'text',
    cell: ({ getValue }) => (
      <span className="font-mono text-muted-foreground">{getValue()}</span>
    ),
  }),
  helper.display({
    id: 'arrow',
    header: () => <span className="sr-only">maps to</span>,
    cell: () => (
      <IconArrowRight
        className="size-3.5 text-muted-foreground"
        aria-label="maps to"
      />
    ),
  }),
  helper.accessor('target', {
    header: 'Target field',
    sortFn: 'text',
    cell: ({ row }) => (
      <span className="font-mono" title={row.original.targetPath}>
        {row.original.target}
      </span>
    ),
  }),
  helper.accessor('targetValue', {
    header: 'Value',
    sortFn: 'text',
    cell: ({ getValue }) => (
      <span className="font-mono text-muted-foreground">{getValue()}</span>
    ),
  }),
  helper.accessor('note', {
    header: 'Note',
    enableSorting: false,
    cell: ({ row }) => (
      <NoteInput id={row.original.id} note={row.original.note} />
    ),
  }),
  helper.accessor('status', {
    header: 'Status',
    sortFn: 'text',
    cell: ({ getValue }) => {
      const status = getValue()
      return status === 'ok' ? (
        <span className="flex items-center gap-1 text-muted-foreground">
          <IconCircleCheck className="size-3.5 text-success" aria-hidden />
          OK
        </span>
      ) : (
        <span className="flex items-center gap-1 text-warning">
          <IconAlertTriangle className="size-3.5" aria-hidden />
          {STATUS_LABEL[status]}
        </span>
      )
    },
  }),
  helper.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Remove mapping"
        onClick={(event) => {
          event.stopPropagation()
          removeMappings([row.original.id])
        }}
      >
        <IconX />
      </Button>
    ),
  }),
])

export function MappingsTable() {
  // Table v9 hides state reads behind builder methods.
  'use no memo'
  const workspace = useWorkspace()
  const { views } = useMappingCanvas()
  const selectedId = useSelector(mappingUi, (s) => s.selectedMappingId)
  const [filterInput, setFilterInput] = useState('')

  const data = useMemo<Array<MappingRow>>(
    () =>
      workspace.mappings.map((mapping) => {
        const status = workspace.mappingStatus.get(mapping.id)
        return {
          id: mapping.id,
          sourcePath: mapping.sourcePath,
          targetPath: mapping.targetPath,
          source: describePath(mapping.sourcePath),
          target: describePath(mapping.targetPath),
          sourceValue:
            samplePreview(workspace.sides.source, mapping.sourcePath) ?? '',
          targetValue:
            samplePreview(workspace.sides.target, mapping.targetPath) ?? '',
          note: mapping.note,
          status:
            status?.sourceMissing && status.targetMissing
              ? 'missing-both'
              : status?.sourceMissing
                ? 'missing-source'
                : status?.targetMissing
                  ? 'missing-target'
                  : 'ok',
        }
      }),
    [workspace.mappings, workspace.mappingStatus, workspace.sides],
  )

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    globalFilterFn: 'includesString',
    getColumnCanGlobalFilter: (column) =>
      column.id !== 'actions' && column.id !== 'arrow',
  })
  const applyFilter = useDebouncedCallback(
    (value: string) => table.setGlobalFilter(value),
    { wait: 150 },
  )

  const rows = table.getRowModel().rows

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-3 py-2">
        <InputGroup className="h-7 max-w-xs">
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Filter mappings"
            placeholder="Filter mappings"
            value={filterInput}
            onChange={(event) => {
              setFilterInput(event.target.value)
              applyFilter(event.target.value)
            }}
          />
        </InputGroup>
        <span className="text-xs text-muted-foreground tabular-nums">
          {rows.length === data.length
            ? `${data.length} total`
            : `${rows.length} of ${data.length}`}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                      className="h-8"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <IconSortAscending className="size-3.5" />
                          ) : sorted === 'desc' ? (
                            <IconSortDescending className="size-3.5" />
                          ) : (
                            <IconArrowsSort className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-20 text-center text-muted-foreground"
                >
                  {data.length === 0
                    ? 'No mappings yet. Drag from a dot on the left to a field on the right.'
                    : 'No mappings match the filter.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.id === selectedId ? 'selected' : undefined}
                  className="cursor-pointer data-[state=selected]:bg-highlight/10"
                  onPointerEnter={() => mappingUi.actions.hoverMapping(row.id)}
                  onPointerLeave={() => mappingUi.actions.hoverMapping(null)}
                  onClick={() => {
                    mappingUi.actions.selectMapping(row.id)
                    views.source.reveal(row.original.sourcePath)
                    views.target.reveal(row.original.targetPath)
                  }}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className="max-w-64 truncate py-1">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
