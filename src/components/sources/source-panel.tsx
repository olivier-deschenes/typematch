import { useEffect, useRef, useState } from 'react'
import { useDebouncer } from '@tanstack/react-pacer'
import {
  IconAlertTriangle,
  IconArrowsMinimize,
  IconCircleCheck,
  IconFileUpload,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { CodeEditor } from '#/components/code-editor'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { updateSourceDoc } from '#/db/actions'
import { useWorkspace } from '#/hooks/use-workspace'
import { detectFormat, getFormat, listFormats } from '#/lib/formats'
import type { Side } from '#/lib/model/types'
import { cn } from '#/lib/utils'

const SIDE_LABEL: Record<Side, string> = { source: 'Source', target: 'Target' }

export function SourcePanel({ side }: { side: Side }) {
  const workspace = useWorkspace()
  const state = workspace.sides[side]
  const doc = state.doc
  const formatId = doc?.formatId ?? 'json'

  const [draft, setDraft] = useState(doc?.raw ?? '')
  const lastSaved = useRef(doc?.raw ?? '')
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Pick up changes made elsewhere (example data, import, reset).
  useEffect(() => {
    const raw = doc?.raw ?? ''
    if (raw !== lastSaved.current) {
      lastSaved.current = raw
      setDraft(raw)
    }
  }, [doc?.raw])

  // Persist edits once typing pauses; flush on unmount so nothing is lost.
  const persist = useDebouncer(
    (raw: string) => {
      lastSaved.current = raw
      updateSourceDoc(side, { raw })
    },
    { wait: 300, onUnmount: (debouncer) => debouncer.flush() },
  )

  const commit = (
    raw: string,
    patch: { name?: string; formatId?: string } = {},
  ) => {
    persist.cancel()
    lastSaved.current = raw
    setDraft(raw)
    updateSourceDoc(side, { raw, ...patch })
  }

  const onEdit = (raw: string) => {
    setDraft(raw)
    const current = getFormat(formatId)
    if (raw.trim() && current && current.sniff(raw) === 0) {
      const detected = detectFormat({ raw })
      if (detected && detected.id !== formatId) {
        commit(raw, { formatId: detected.id })
        toast.info(
          `Switched ${SIDE_LABEL[side].toLowerCase()} to ${detected.label}`,
        )
        return
      }
    }
    persist.maybeExecute(raw)
  }

  const loadFile = async (file: File) => {
    const raw = await file.text()
    const detected = detectFormat({
      fileName: file.name,
      mimeType: file.type,
      raw,
    })
    commit(raw, { name: file.name, formatId: detected?.id ?? formatId })
  }

  const transform = (kind: 'format' | 'minify') => {
    const format = getFormat(formatId)
    const fn = kind === 'format' ? format?.format : format?.minify
    if (!fn) return
    try {
      commit(fn(draft))
    } catch (error) {
      toast.error(`Can't ${kind} invalid ${format?.label ?? ''}`, {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const fieldCount = state.fields.length
  const parsed = state.parsed

  return (
    <section
      aria-labelledby={`${side}-heading`}
      className={cn(
        'relative flex min-h-[420px] min-w-0 flex-col border bg-background lg:min-h-0',
        dragging && 'border-primary',
      )}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        const file = event.dataTransfer.files[0] as File | undefined
        if (file) void loadFile(file)
      }}
    >
      <header
        className={cn(
          'flex flex-wrap items-center gap-2 border-b px-3 py-2',
          side === 'source' ? 'bg-source-accent/5' : 'bg-target-accent/5',
        )}
      >
        <h2
          id={`${side}-heading`}
          className={cn(
            'text-sm font-medium',
            side === 'source' ? 'text-source-accent' : 'text-target-accent',
          )}
        >
          {SIDE_LABEL[side]}
        </h2>
        <Input
          aria-label={`${SIDE_LABEL[side]} name`}
          placeholder={side === 'source' ? 'order.json' : 'shipment.xml'}
          value={doc?.name ?? ''}
          onChange={(event) =>
            updateSourceDoc(side, { name: event.target.value })
          }
          className="h-7 w-40 min-w-0 flex-1 border-transparent bg-transparent px-1.5 font-mono text-xs text-muted-foreground shadow-none hover:border-input focus-visible:text-foreground sm:flex-none"
        />
        <div className="ml-auto flex items-center gap-1">
          <Select
            value={formatId}
            onValueChange={(value) =>
              updateSourceDoc(side, { formatId: value })
            }
          >
            <SelectTrigger size="sm" aria-label="Format" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {listFormats().map((format) => (
                <SelectItem key={format.id} value={format.id}>
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open file"
                onClick={() => fileInput.current?.click()}
              >
                <IconFileUpload />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open file</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Format document"
                disabled={!draft.trim()}
                onClick={() => transform('format')}
              >
                <IconSparkles />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Format</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Minify document"
                disabled={!draft.trim()}
                onClick={() => transform('minify')}
              >
                <IconArrowsMinimize />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Minify</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear document"
                disabled={!draft}
                onClick={() => commit('')}
              >
                <IconTrash />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear</TooltipContent>
          </Tooltip>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.xml,application/json,application/xml,text/xml"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void loadFile(file)
              event.target.value = ''
            }}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <CodeEditor
          value={draft}
          onChange={onEdit}
          formatId={formatId}
          aria-label={`${SIDE_LABEL[side]} document`}
          placeholder="Paste JSON or XML, or drop a file"
        />
      </div>

      <footer
        className="flex min-h-9 items-center gap-2 border-t px-3 py-2 text-xs"
        aria-live="polite"
      >
        {!parsed ? (
          <span className="text-muted-foreground">No document yet</span>
        ) : parsed.ok ? (
          <>
            <IconCircleCheck className="size-4 text-success" aria-hidden />
            <span className="text-success">
              Valid {state.format?.label}
              <span className="text-muted-foreground">
                {' · '}
                <span className="tabular-nums">{fieldCount}</span>{' '}
                {fieldCount === 1 ? 'field' : 'fields'}
              </span>
            </span>
          </>
        ) : (
          <>
            <IconAlertTriangle
              className="size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <span className="min-w-0 truncate">
              <span className="font-medium text-destructive">
                Line {parsed.error.line}, column {parsed.error.column}:
              </span>{' '}
              {parsed.error.message}
            </span>
          </>
        )}
      </footer>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/90 text-sm font-medium text-accent-foreground">
          Drop to load into {SIDE_LABEL[side].toLowerCase()}
        </div>
      )}
    </section>
  )
}
