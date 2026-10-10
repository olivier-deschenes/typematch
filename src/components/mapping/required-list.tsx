import {
  IconAlertTriangle,
  IconCircleCheck,
  IconQuestionMark,
  IconX,
} from '@tabler/icons-react'
import { Button } from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { setRequired } from '#/db/actions'
import { useWorkspace } from '#/hooks/use-workspace'
import { describePath } from '#/lib/model/path'
import { useMappingCanvas } from './canvas-context'

export function RequiredList() {
  const { required } = useWorkspace()
  const { views, openMapTo } = useMappingCanvas()
  const sorted = [...required].sort(
    (a, b) =>
      Number(a.satisfied) - Number(b.satisfied) ||
      a.rule.side.localeCompare(b.rule.side) ||
      a.rule.path.localeCompare(b.rule.path),
  )

  if (sorted.length === 0) {
    return (
      <p className="p-4 text-xs text-muted-foreground">
        No required fields. Open a field’s menu or press <kbd>R</kbd> on it to
        require a mapping.
      </p>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <Table className="text-xs">
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className="h-8">Side</TableHead>
            <TableHead className="h-8">Field</TableHead>
            <TableHead className="h-8">Status</TableHead>
            <TableHead className="h-8">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(({ rule, satisfied, exists }) => (
            <TableRow
              key={rule.id}
              className="cursor-pointer"
              onClick={() => views[rule.side].reveal(rule.path)}
            >
              <TableCell className="py-1 capitalize">{rule.side}</TableCell>
              <TableCell className="py-1 font-mono" title={rule.path}>
                {describePath(rule.path)}
              </TableCell>
              <TableCell className="py-1">
                {!exists ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <IconQuestionMark className="size-3.5" aria-hidden />
                    Not in document
                  </span>
                ) : satisfied ? (
                  <span className="flex items-center gap-1 text-success">
                    <IconCircleCheck
                      className="size-3.5 text-success"
                      aria-hidden
                    />
                    Mapped
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-medium text-warning">
                    <IconAlertTriangle className="size-3.5" aria-hidden />
                    Needs a mapping
                  </span>
                )}
              </TableCell>
              <TableCell className="py-1 text-right">
                <div className="flex justify-end gap-1">
                  {!satisfied && exists && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(event) => {
                        event.stopPropagation()
                        openMapTo({ side: rule.side, path: rule.path })
                      }}
                    >
                      Map to…
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Make optional"
                    onClick={(event) => {
                      event.stopPropagation()
                      setRequired(rule.side, rule.path, false)
                    }}
                  >
                    <IconX />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
