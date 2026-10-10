import { useRef, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useSelector } from '@tanstack/react-store'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '#/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { removeMappings } from '#/db/actions'
import { useMediaQuery } from '#/hooks/use-media-query'
import { useWorkspace } from '#/hooks/use-workspace'
import { mappingUi } from '#/stores/mapping-ui'
import type { FieldRef } from '#/stores/mapping-ui'
import { MappingCanvasContext } from './canvas-context'
import type { MappingCanvasApi } from './canvas-context'
import { ConnectorLayer } from './connector-layer'
import { FieldTree } from './field-tree'
import { MapToDialog } from './map-to-dialog'
import { MappingsTable } from './mappings-table'
import { RequiredList } from './required-list'
import { useConnection } from './use-connection'
import { useTreeView } from './use-tree-view'

function BottomPanel() {
  const { mappings, required, requiredSatisfied } = useWorkspace()
  return (
    <Tabs
      defaultValue="mappings"
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <TabsList
        variant="line"
        className="h-9 w-full justify-start border-b px-2"
      >
        <TabsTrigger value="mappings" className="flex-none px-2">
          Mappings
          <span className="text-muted-foreground tabular-nums">
            {mappings.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="required" className="flex-none px-2">
          Required
          <span className="text-muted-foreground tabular-nums">
            {requiredSatisfied}/{required.length}
          </span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="mappings" className="min-h-0">
        <MappingsTable />
      </TabsContent>
      <TabsContent value="required" className="min-h-0">
        <RequiredList />
      </TabsContent>
    </Tabs>
  )
}

export function MappingCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const source = useTreeView('source')
  const target = useTreeView('target')
  const { mappings } = useWorkspace()
  const connection = useConnection(canvasRef)
  const [mapTo, setMapTo] = useState<FieldRef | null>(null)
  const wide = useMediaQuery('(min-width: 768px)')

  const hoveredField = useSelector(mappingUi, (s) => s.hoveredField)
  const selectedId = useSelector(mappingUi, (s) => s.selectedMappingId)
  const hoveredId = useSelector(mappingUi, (s) => s.hoveredMappingId)
  const pending = useSelector(mappingUi, (s) => s.pending)

  const activeMappingIds = new Set<string>()
  if (selectedId) activeMappingIds.add(selectedId)
  if (hoveredId) activeMappingIds.add(hoveredId)
  if (hoveredField && !pending) {
    for (const m of mappings) {
      const path = hoveredField.side === 'source' ? m.sourcePath : m.targetPath
      if (path === hoveredField.path) activeMappingIds.add(m.id)
    }
  }
  const activePaths = {
    source: new Set<string>(),
    target: new Set<string>(),
  }
  for (const m of mappings) {
    if (!activeMappingIds.has(m.id)) continue
    activePaths.source.add(m.sourcePath)
    activePaths.target.add(m.targetPath)
  }

  useHotkey('Escape', () => {
    if (mappingUi.state.pending) mappingUi.actions.cancelConnection()
    else mappingUi.actions.selectMapping(null)
  })
  const removeSelected = () => {
    const id = mappingUi.state.selectedMappingId
    if (!id) return
    removeMappings([id])
    mappingUi.actions.selectMapping(null)
    mappingUi.actions.hoverMapping(null)
  }
  useHotkey('Delete', removeSelected, { enabled: !!selectedId })
  useHotkey('Backspace', removeSelected, { enabled: !!selectedId })
  useHotkey('/', () => source.searchRef.current?.focus())

  const api: MappingCanvasApi = {
    views: { source, target },
    activeMappingIds,
    activePaths,
    beginDrag: connection.beginDrag,
    toggleConnect: connection.toggleConnect,
    activateRow: connection.activateRow,
    openMapTo: setMapTo,
  }

  return (
    <MappingCanvasContext value={api}>
      {wide ? (
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize="68" minSize="30">
            <div
              ref={canvasRef}
              className="relative grid h-full min-h-0 grid-cols-[minmax(0,1fr)_clamp(64px,10vw,160px)_minmax(0,1fr)]"
              onPointerMove={connection.onCanvasPointerMove}
              onPointerDown={(event) => {
                const element = event.target as Element
                if (element.closest('[data-keep-selection]')) return
                mappingUi.actions.selectMapping(null)
              }}
            >
              <FieldTree side="source" />
              <div
                aria-hidden
                className="border-x"
                onClick={() => mappingUi.actions.cancelConnection()}
              />
              <FieldTree side="target" />
              <ConnectorLayer canvasRef={canvasRef} />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="32" minSize="12">
            <BottomPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <Tabs
          defaultValue="source"
          className="flex h-full min-h-0 flex-col gap-0"
        >
          <TabsList className="mx-2 mt-2 w-[calc(100%-1rem)]">
            <TabsTrigger value="source" className="flex-1">
              Source
            </TabsTrigger>
            <TabsTrigger value="target" className="flex-1">
              Target
            </TabsTrigger>
            <TabsTrigger value="mappings" className="flex-1">
              Mappings
            </TabsTrigger>
          </TabsList>
          <TabsContent value="source" className="flex min-h-0 flex-col">
            <FieldTree side="source" />
          </TabsContent>
          <TabsContent value="target" className="flex min-h-0 flex-col">
            <FieldTree side="target" />
          </TabsContent>
          <TabsContent value="mappings" className="min-h-0">
            <BottomPanel />
          </TabsContent>
        </Tabs>
      )}
      <MapToDialog field={mapTo} onClose={() => setMapTo(null)} />
    </MappingCanvasContext>
  )
}
