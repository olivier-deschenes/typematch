import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/map')({
  component: MapPage,
})

function MapPage() {
  return <h1 className="p-4 text-xl font-semibold">Map fields</h1>
}
