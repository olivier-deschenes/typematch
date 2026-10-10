import { Link } from '@tanstack/react-router'
import {
  IconAlertTriangle,
  IconChevronRight,
  IconCircleCheck,
} from '@tabler/icons-react'
import { useWorkspace } from '#/hooks/use-workspace'
import { cn } from '#/lib/utils'

const stepClass =
  'inline-flex h-7 items-center px-2 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground'

function RequiredProgress() {
  const { required, requiredSatisfied } = useWorkspace()
  if (required.length === 0) return null
  const complete = requiredSatisfied === required.length
  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      aria-label={`${requiredSatisfied} of ${required.length} required fields mapped`}
    >
      {complete ? (
        <IconCircleCheck className="size-4 text-success" aria-hidden />
      ) : (
        <IconAlertTriangle className="size-4 text-warning" aria-hidden />
      )}
      <span className="hidden text-muted-foreground sm:inline">Required</span>
      <span
        className={cn(
          'font-medium tabular-nums',
          !complete && 'text-foreground',
        )}
      >
        {requiredSatisfied}/{required.length}
      </span>
    </div>
  )
}

export function AppHeader({ actions }: { actions?: React.ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 sm:gap-3">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <Link
        to="/"
        className="mr-1 hidden text-sm font-semibold tracking-tight sm:mr-2 sm:inline"
      >
        Typematch
      </Link>
      <nav aria-label="Steps" className="flex items-center gap-0.5">
        <Link to="/" activeOptions={{ exact: true }} className={stepClass}>
          Sources
        </Link>
        <IconChevronRight
          className="size-3.5 text-muted-foreground"
          aria-hidden
        />
        <Link to="/map" className={stepClass}>
          Map
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <RequiredProgress />
        {actions}
      </div>
    </header>
  )
}
