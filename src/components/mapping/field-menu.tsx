import { IconDotsVertical } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { removeMappings, setArrayView, setRequired } from '#/db/actions'
import { useWorkspace } from '#/hooks/use-workspace'
import { formatPrimitive } from '#/lib/model/resolve'
import type { FieldNode, Side } from '#/lib/model/types'
import { useMappingCanvas } from './canvas-context'

export function FieldMenu({
  node,
  side,
  required,
  open,
  onOpenChange,
}: {
  node: FieldNode
  side: Side
  required: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { openMapTo } = useMappingCanvas()
  const { mappings } = useWorkspace()
  const linked = mappings.filter((m) =>
    side === 'source' ? m.sourcePath === node.path : m.targetPath === node.path,
  )
  const viewValue =
    node.view?.mode === 'group' ? `group:${node.view.groupBy}` : node.view?.mode
  const candidates = node.discriminators ?? []
  const suggested = candidates.filter((c) => c.suggested)
  const others = candidates.filter((c) => !c.suggested)

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          // The tree handles keyboard focus; keep rows to one tab stop.
          tabIndex={-1}
          aria-label={`Actions for ${node.label}`}
          className="opacity-0 group-hover/row:opacity-100 group-aria-selected/row:opacity-100 data-[state=open]:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          <IconDotsVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={side === 'source' ? 'end' : 'start'}
        className="w-56"
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuLabel className="truncate font-mono">
          {node.label}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => openMapTo({ side, path: node.path })}>
          Map to…
          <DropdownMenuShortcut>M</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setRequired(side, node.path, !required)}
        >
          {required ? 'Mark as optional' : 'Mark as required'}
          <DropdownMenuShortcut>R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard.writeText(node.path)
            toast.success('Path copied', { description: node.path })
          }}
        >
          Copy path
        </DropdownMenuItem>

        {node.kind === 'array' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Show items</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60">
                <DropdownMenuRadioGroup
                  value={viewValue}
                  onValueChange={(value) => {
                    if (value === 'all' || value === 'index') {
                      setArrayView(side, node.path, { mode: value })
                    } else {
                      setArrayView(side, node.path, {
                        mode: 'group',
                        groupBy: value.slice('group:'.length),
                      })
                    }
                  }}
                >
                  <DropdownMenuRadioItem value="all">
                    All items together
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="index">
                    Each item by position
                  </DropdownMenuRadioItem>
                  {candidates.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-muted-foreground">
                        Group by field
                      </DropdownMenuLabel>
                      {[...suggested, ...others].map((candidate) => (
                        <DropdownMenuRadioItem
                          key={candidate.field}
                          value={`group:${candidate.field}`}
                          className="flex-col items-start gap-0"
                        >
                          <span className="font-mono">
                            {candidate.field}
                            {candidate.suggested && (
                              <span className="ml-1.5 font-sans text-muted-foreground">
                                suggested
                              </span>
                            )}
                          </span>
                          <span className="w-full truncate text-muted-foreground">
                            {candidate.values.map(formatPrimitive).join(', ')}
                          </span>
                        </DropdownMenuRadioItem>
                      ))}
                    </>
                  )}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        {linked.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => removeMappings(linked.map((m) => m.id))}
            >
              Remove{' '}
              {linked.length === 1 ? 'mapping' : `${linked.length} mappings`}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
