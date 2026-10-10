import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { linter, lintGutter } from '@codemirror/lint'
import type { Diagnostic } from '@codemirror/lint'
import { tags as t } from '@lezer/highlight'
import { cn } from '#/lib/utils'
import { getFormat, lineColumnToOffset } from '#/lib/formats'

const highlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'var(--syntax-key)' },
  { tag: [t.string, t.attributeValue], color: 'var(--syntax-string)' },
  { tag: t.number, color: 'var(--syntax-number)' },
  { tag: [t.bool, t.null, t.atom], color: 'var(--syntax-atom)' },
  { tag: t.tagName, color: 'var(--syntax-tag)' },
  { tag: t.attributeName, color: 'var(--syntax-attr)' },
  {
    tag: [t.comment, t.processingInstruction, t.documentMeta],
    color: 'var(--syntax-comment)',
    fontStyle: 'italic',
  },
  {
    tag: [t.punctuation, t.separator, t.angleBracket, t.brace, t.squareBracket],
    color: 'var(--syntax-punct)',
  },
  { tag: t.invalid, color: 'var(--destructive)' },
])

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12.5px',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
  },
  '.cm-content': { caretColor: 'var(--foreground)', padding: '8px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-gutters': {
    backgroundColor: 'var(--background)',
    color: 'var(--muted-foreground)',
    border: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in oklch, var(--muted) 60%, transparent)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
    {
      backgroundColor:
        'color-mix(in oklch, var(--info) 22%, transparent) !important',
    },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--muted)',
    border: 'none',
    color: 'var(--muted-foreground)',
  },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
  },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--destructive)' },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--destructive)',
    textUnderlineOffset: '3px',
  },
  '.cm-panels': { backgroundColor: 'var(--muted)', color: 'var(--foreground)' },
  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in oklch, var(--warning) 30%, transparent)',
  },
})

function formatLinter(formatId: string) {
  return linter(
    (view) => {
      const format = getFormat(formatId)
      const raw = view.state.doc.toString()
      if (!format || !raw.trim()) return []
      const result = format.parse(raw)
      if (result.ok) return []
      const from = lineColumnToOffset(
        raw,
        result.error.line,
        result.error.column,
      )
      const diagnostic: Diagnostic = {
        from,
        to: Math.min(raw.length, from + 1),
        severity: 'error',
        message: result.error.message,
      }
      return [diagnostic]
    },
    { delay: 300 },
  )
}

export function CodeEditor({
  value,
  onChange,
  formatId,
  readOnly,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange?: (value: string) => void
  formatId: string
  readOnly?: boolean
  placeholder?: string
  className?: string
  'aria-label'?: string
}) {
  const extensions = useMemo(() => {
    const format = getFormat(formatId)
    return [
      syntaxHighlighting(highlight),
      ...(format ? [format.language()] : []),
      ...(readOnly ? [] : [formatLinter(formatId), lintGutter()]),
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel ?? 'Editor' }),
    ]
  }, [formatId, readOnly, ariaLabel])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={theme}
      readOnly={readOnly}
      editable={!readOnly}
      placeholder={placeholder}
      height="100%"
      className={cn('h-full min-h-0 overflow-hidden', className)}
      basicSetup={{
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        foldGutter: true,
        autocompletion: false,
      }}
    />
  )
}
