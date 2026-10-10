import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppHeader } from '#/components/app-header'
import { WorkspaceActions } from '#/components/export/workspace-actions'
import { WorkspaceProvider } from '#/hooks/use-workspace'

export const Route = createFileRoute('/_app')({
  // The workspace lives in localStorage, so render on the client only.
  ssr: false,
  component: AppLayout,
})

function AppLayout() {
  return (
    <WorkspaceProvider>
      <div className="flex h-dvh flex-col">
        <AppHeader actions={<WorkspaceActions />} />
        <main id="main" className="min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </WorkspaceProvider>
  )
}
