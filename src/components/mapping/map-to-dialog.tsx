import { rankItem, rankings } from '@tanstack/match-sorter-utils'
import { IconCheck } from '@tabler/icons-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { mappingKey } from '#/db/actions'
import { useWorkspace } from '#/hooks/use-workspace'
import { describePath } from '#/lib/model/path'
import { formatPrimitive } from '#/lib/model/resolve'
import { otherSide } from '#/lib/model/types'
import type { FieldRef } from '#/stores/mapping-ui'
import { connect } from './use-connection'

/** Same ranking as the tree search; stricter than cmdk's fuzzy default. */
function rankFilter(value: string, search: string) {
  const result = rankItem(value, search, { threshold: rankings.ACRONYM })
  return result.passed ? result.rank / rankings.CASE_SENSITIVE_EQUAL : 0
}

/** Keyboard-friendly alternative to drawing arrows. */
export function MapToDialog({
  field,
  onClose,
}: {
  field: FieldRef | null
  onClose: () => void
}) {
  const workspace = useWorkspace()
  const side = field ? otherSide(field.side) : 'target'
  const fields = workspace.sides[side].fields
  const mapped = new Set(workspace.mappings.map((m) => m.id))

  return (
    <CommandDialog
      open={!!field}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Map ${field ? describePath(field.path) : ''}`}
      description={`Choose a ${side} field to map to`}
    >
      <Command filter={rankFilter}>
        <CommandInput placeholder={`Search ${side} fields…`} />
        <CommandList>
          <CommandEmpty>No fields found.</CommandEmpty>
          {field && (
            <CommandGroup
              heading={`Map ${describePath(field.path)} to a ${side} field`}
            >
              {fields.map((node) => {
                const id =
                  field.side === 'source'
                    ? mappingKey(field.path, node.path)
                    : mappingKey(node.path, field.path)
                const sample = node.samples.length
                  ? formatPrimitive(node.samples[0])
                  : null
                return (
                  <CommandItem
                    key={node.path}
                    value={`${node.path} ${describePath(node.path)}`}
                    onSelect={() => {
                      connect(field, { side, path: node.path })
                      onClose()
                    }}
                    className="items-baseline"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono">
                      {describePath(node.path)}
                    </span>
                    {sample !== null && (
                      <span className="max-w-[40%] truncate font-mono text-muted-foreground">
                        {sample}
                      </span>
                    )}
                    {mapped.has(id) && (
                      <IconCheck className="size-3.5" aria-label="Mapped" />
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
