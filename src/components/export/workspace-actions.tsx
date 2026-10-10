import { useRef, useState } from 'react'
import {
  IconAlertTriangle,
  IconCopy,
  IconDotsVertical,
  IconDownload,
  IconFileExport,
  IconFileImport,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { CodeEditor } from '#/components/code-editor'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { clearMappings, replaceWorkspace, resetWorkspace } from '#/db/actions'
import { samplePreview, useWorkspace } from '#/hooks/use-workspace'
import {
  buildMappingSpec,
  exportFileName,
  parseMappingSpec,
  specToWorkspace,
} from '#/lib/export/mapping-spec'
import type { MappingSpec } from '#/lib/export/mapping-spec'
import { describePath } from '#/lib/model/path'

function download(fileName: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const workspace = useWorkspace()
  const [includeDocuments, setIncludeDocuments] = useState(true)
  const unmapped = workspace.required.filter((r) => !r.satisfied)

  const spec = buildMappingSpec({
    documents: {
      source: workspace.sides.source.doc,
      target: workspace.sides.target.doc,
    },
    mappings: workspace.mappings,
    rules: [...workspace.rules.values()],
    views: [...workspace.views.values()],
    requiredUnmapped: unmapped.map((r) => r.rule),
    sample: (side, path) => samplePreview(workspace.sides[side], path),
    includeDocuments,
  })
  const json = JSON.stringify(spec, null, 2)
  const fileName = exportFileName(spec)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export mapping</DialogTitle>
          <DialogDescription>
            {spec.summary.mappingCount}{' '}
            {spec.summary.mappingCount === 1 ? 'mapping' : 'mappings'} and{' '}
            {spec.summary.requiredCount} required{' '}
            {spec.summary.requiredCount === 1 ? 'field' : 'fields'} as JSON.
            Import the file later to pick up where you left off.
          </DialogDescription>
        </DialogHeader>

        {unmapped.length > 0 && (
          <Alert>
            <IconAlertTriangle className="text-warning" />
            <AlertTitle>
              {unmapped.length} required{' '}
              {unmapped.length === 1 ? 'field has' : 'fields have'} no mapping
            </AlertTitle>
            <AlertDescription>
              <ul className="font-mono">
                {unmapped.slice(0, 4).map(({ rule }) => (
                  <li key={rule.id}>
                    {rule.side}: {describePath(rule.path)}
                  </li>
                ))}
                {unmapped.length > 4 && <li>+{unmapped.length - 4} more</li>}
              </ul>
              They are listed under summary.requiredUnmapped in the export.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Switch
            id="include-documents"
            checked={includeDocuments}
            onCheckedChange={setIncludeDocuments}
          />
          <Label htmlFor="include-documents" className="text-xs">
            Include source and target documents
          </Label>
        </div>

        <div className="h-80 min-h-0 border">
          <CodeEditor
            value={json}
            formatId="json"
            readOnly
            aria-label="Export preview"
          />
        </div>

        <DialogFooter>
          <span className="mr-auto self-center font-mono text-xs text-muted-foreground">
            {fileName}
          </span>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(json)
              toast.success('Mapping copied to clipboard')
            }}
          >
            <IconCopy data-icon="inline-start" />
            Copy
          </Button>
          <Button
            onClick={() => {
              download(fileName, json)
              toast.success(`Saved ${fileName}`)
            }}
          >
            <IconDownload data-icon="inline-start" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportConfirm({
  spec,
  onClose,
}: {
  spec: MappingSpec | null
  onClose: () => void
}) {
  const { mappings } = useWorkspace()
  const withDocuments =
    spec?.documents.source?.content !== undefined ||
    spec?.documents.target?.content !== undefined
  return (
    <AlertDialog open={!!spec} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace the current mapping?</AlertDialogTitle>
          <AlertDialogDescription>
            The file has {spec?.mappings.length ?? 0} mappings and{' '}
            {spec?.required.length ?? 0} required fields
            {withDocuments ? ', plus the documents they were made from' : ''}.
            Your {mappings.length} current mappings will be replaced.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!spec) return
              replaceWorkspace(specToWorkspace(spec))
              toast.success('Mapping imported')
              onClose()
            }}
          >
            Replace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type Confirm = 'clear' | 'reset' | null

/** Header actions: import, export, and workspace housekeeping. */
export function WorkspaceActions() {
  const { mappings } = useWorkspace()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState<MappingSpec | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const onFile = async (file: File) => {
    const parsed = parseMappingSpec(await file.text())
    if (parsed.ok) setImporting(parsed.spec)
    else toast.error("Couldn't import file", { description: parsed.error })
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInput.current?.click()}
      >
        <IconFileImport data-icon="inline-start" />
        Import
      </Button>
      <Button size="sm" onClick={() => setExporting(true)}>
        <IconFileExport data-icon="inline-start" />
        Export
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="More actions">
            <IconDotsVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            disabled={mappings.length === 0}
            onSelect={() => setConfirm('clear')}
          >
            Clear all mappings
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirm('reset')}
          >
            Reset workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void onFile(file)
          event.target.value = ''
        }}
      />

      <ExportDialog open={exporting} onOpenChange={setExporting} />
      <ImportConfirm spec={importing} onClose={() => setImporting(null)} />

      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'reset'
                ? 'Reset the workspace?'
                : 'Clear all mappings?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'reset'
                ? 'Both documents, all mappings, required fields and array views are removed. Export first if you want to keep them.'
                : `All ${mappings.length} mappings are removed. Documents and required fields stay.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirm === 'reset') resetWorkspace()
                else clearMappings()
                setConfirm(null)
              }}
            >
              {confirm === 'reset' ? 'Reset' : 'Clear mappings'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
