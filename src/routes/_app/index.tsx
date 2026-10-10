import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { IconArrowRight } from '@tabler/icons-react'
import { SourcePanel } from '#/components/sources/source-panel'
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
import { saveSourceDoc } from '#/db/actions'
import { useWorkspace } from '#/hooks/use-workspace'
import { sampleSource, sampleTarget } from '#/lib/samples'

export const Route = createFileRoute('/_app/')({
  component: SourcesPage,
})

function loadExample() {
  saveSourceDoc({ id: 'source', ...sampleSource })
  saveSourceDoc({ id: 'target', ...sampleTarget })
}

function SourcesPage() {
  const { sides } = useWorkspace()
  const [confirming, setConfirming] = useState(false)
  const hasContent = !!(sides.source.doc?.raw || sides.target.doc?.raw)
  const bothValid = !!(sides.source.tree && sides.target.tree)

  return (
    <div className="flex h-full flex-col overflow-auto lg:overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 pt-5 pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            Load the two documents to match
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Paste, drop or open a JSON or XML file on each side. Fields from the
            source are mapped onto the target.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => (hasContent ? setConfirming(true) : loadExample())}
          >
            Load example
          </Button>
          {bothValid ? (
            <Button asChild>
              <Link to="/map">
                Map fields
                <IconArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          ) : (
            <Button disabled>
              Map fields
              <IconArrowRight data-icon="inline-end" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 px-4 pb-4 lg:grid-cols-2">
        <SourcePanel side="source" />
        <SourcePanel side="target" />
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace both documents?</AlertDialogTitle>
            <AlertDialogDescription>
              The example order and shipment replace the current source and
              target. Existing mappings are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={loadExample}>
              Load example
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
