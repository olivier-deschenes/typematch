import { fieldKey, mappingKey } from '#/lib/keys'
import type { ArrayView, Side } from '#/lib/model/types'
import {
  arrayViewsCollection,
  fieldRulesCollection,
  mappingsCollection,
  sourcesCollection,
} from './collections'
import type {
  ArrayViewRecord,
  FieldRule,
  Mapping,
  SourceDoc,
} from './collections'

export { fieldKey, mappingKey }

export function saveSourceDoc(doc: SourceDoc) {
  if (sourcesCollection.has(doc.id)) {
    sourcesCollection.update(doc.id, (draft) => {
      draft.name = doc.name
      draft.formatId = doc.formatId
      draft.raw = doc.raw
    })
  } else {
    sourcesCollection.insert(doc)
  }
}

export function updateSourceDoc(
  side: Side,
  patch: Partial<Omit<SourceDoc, 'id'>>,
) {
  if (!sourcesCollection.has(side)) {
    saveSourceDoc({ id: side, name: '', formatId: 'json', raw: '', ...patch })
    return
  }
  sourcesCollection.update(side, (draft) => Object.assign(draft, patch))
}

/** Returns false when the pair is already mapped. */
export function addMapping(sourcePath: string, targetPath: string): boolean {
  const id = mappingKey(sourcePath, targetPath)
  if (mappingsCollection.has(id)) return false
  mappingsCollection.insert({
    id,
    sourcePath,
    targetPath,
    note: '',
    createdAt: Date.now(),
  })
  return true
}

export function removeMappings(ids: Array<string>) {
  const existing = ids.filter((id) => mappingsCollection.has(id))
  if (existing.length) mappingsCollection.delete(existing)
}

export function setMappingNote(id: string, note: string) {
  mappingsCollection.update(id, (draft) => {
    draft.note = note
  })
}

export function setRequired(side: Side, path: string, required: boolean) {
  const id = fieldKey(side, path)
  if (!required) {
    if (fieldRulesCollection.has(id)) fieldRulesCollection.delete(id)
    return
  }
  if (!fieldRulesCollection.has(id)) {
    fieldRulesCollection.insert({ id, side, path, required: true })
  }
}

export function setArrayView(side: Side, path: string, view: ArrayView) {
  const id = fieldKey(side, path)
  if (view.mode === 'all') {
    if (arrayViewsCollection.has(id)) arrayViewsCollection.delete(id)
    return
  }
  const record: ArrayViewRecord = { id, side, path, ...view }
  if (arrayViewsCollection.has(id)) {
    arrayViewsCollection.update(id, (draft) => {
      draft.mode = view.mode
      draft.groupBy = view.groupBy
    })
  } else {
    arrayViewsCollection.insert(record)
  }
}

function clear(collection: {
  toArray: Array<{ id: string }>
  delete: (keys: Array<string>) => unknown
}) {
  const keys = collection.toArray.map((item) => item.id)
  if (keys.length) collection.delete(keys)
}

export function clearMappings() {
  clear(mappingsCollection)
}

/** Replaces mappings, rules and array views (used by import). */
export function replaceWorkspace(data: {
  mappings: Array<Mapping>
  rules: Array<FieldRule>
  views: Array<ArrayViewRecord>
  sources?: Array<SourceDoc>
}) {
  clear(mappingsCollection)
  clear(fieldRulesCollection)
  clear(arrayViewsCollection)
  if (data.mappings.length) mappingsCollection.insert(data.mappings)
  if (data.rules.length) fieldRulesCollection.insert(data.rules)
  if (data.views.length) arrayViewsCollection.insert(data.views)
  for (const doc of data.sources ?? []) saveSourceDoc(doc)
}

export function resetWorkspace() {
  clear(mappingsCollection)
  clear(fieldRulesCollection)
  clear(arrayViewsCollection)
  const docs = sourcesCollection.toArray.map((doc) => doc.id)
  if (docs.length) sourcesCollection.delete(docs)
}
