# Typematch

Map fields between two documents (JSON or XML) and export the mapping.

1. **Sources**: paste, drop or open a document on each side. Editors
   highlight syntax, format/minify, and show errors with their line.
2. **Map**: both documents appear as field trees with their values. Drag
   from a field's dot to a field on the other side (or press <kbd>Enter</kbd>
   on one then the other, or <kbd>M</kbd> for a searchable "Map to…").
   Mark fields required with <kbd>R</kbd>; the header tracks progress.
3. **Export**: download a `typematch.mapping` JSON file. Import it later to
   restore mappings, required fields, array views and (optionally) the
   documents.

Work is saved in the browser (localStorage) as you go.

### Arrays

An array can be shown three ways from its row menu (**Show items**):

- **All items together**: one set of fields for every item
  (`$.order.items[*].sku`).
- **Each item by position**: `$.order.items[0].sku`.
- **Group by field**: split items by a discriminator, e.g. addresses by
  `type`, so the sender and receiver map separately
  (`$.order.addresses[?(@.type=='sender')].street`).

## Development

```bash
bun install
bun run dev        # http://localhost:3000
bun run test       # vitest
bun run typecheck
bun run lint
```

### Adding a document format

Formats are adapters in `src/lib/formats/`. Implement `FormatAdapter`
(`sniff`, `parse` to a plain JS value, `format`, optional `minify`, and a
CodeMirror `language`) and register it in `src/lib/formats/index.ts`.
Everything downstream (field tree, search, mapping, export) works on the
parsed value, so nothing else changes.

### Layout

| Path                       | What                                            |
| -------------------------- | ----------------------------------------------- |
| `src/lib/formats/`         | Format adapters and registry                    |
| `src/lib/model/`           | Paths, field tree, array views, search, flatten |
| `src/lib/export/`          | Mapping spec schema, build/parse                |
| `src/db/`                  | TanStack DB localStorage collections + actions  |
| `src/stores/mapping-ui.ts` | TanStack Store for interaction state            |
| `src/components/sources/`  | Source editors                                  |
| `src/components/mapping/`  | Trees, arrows, mappings table                   |
| `src/routes/_app/`         | Sources (`/`) and Map (`/map`) pages            |
