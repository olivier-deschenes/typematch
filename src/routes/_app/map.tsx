import { Link, createFileRoute } from '@tanstack/react-router'
import { IconArrowLeft } from '@tabler/icons-react'
import { MappingCanvas } from '#/components/mapping/mapping-canvas'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import { Kbd } from '#/components/ui/kbd'
import { useWorkspace } from '#/hooks/use-workspace'

export const Route = createFileRoute('/_app/map')({
  component: MapPage,
})

function MapPage() {
  const { sides, mappings } = useWorkspace()
  const ready = !!(sides.source.tree && sides.target.tree)

  if (!ready) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>Both documents need to be valid</EmptyTitle>
          <EmptyDescription>
            Load a source and a target without syntax errors, then come back to
            map their fields.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link to="/">
              <IconArrowLeft data-icon="inline-start" />
              Go to sources
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b px-4 py-3">
        <h1 className="text-base font-semibold tracking-tight">Map fields</h1>
        <p className="text-xs text-muted-foreground tabular-nums">
          {mappings.length} {mappings.length === 1 ? 'mapping' : 'mappings'}
        </p>
        <p className="ml-auto hidden text-xs text-muted-foreground md:block">
          Drag from a dot to a field on the other side, or press{' '}
          <Kbd>Enter</Kbd> on one field then the other. <Kbd>M</Kbd> map to…,{' '}
          <Kbd>R</Kbd> required.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <MappingCanvas />
      </div>
    </div>
  )
}
