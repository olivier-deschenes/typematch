import { rankItem, rankings } from '@tanstack/match-sorter-utils'
import { walkTree } from './tree'
import { formatPrimitive } from './resolve'
import type { FieldNode } from './types'

export type Range = readonly [start: number, end: number]

export interface MatchInfo {
  label?: Range
  value?: Range
}

export interface TreeFilter {
  /** Paths to render; everything else is hidden */
  visible: Set<string>
  /** Ancestors of matches, expanded regardless of the user's collapse state */
  forceExpanded: Set<string>
  matches: Map<string, MatchInfo>
  matchCount: number
}

function substring(text: string, query: string): Range | undefined {
  const start = text.toLowerCase().indexOf(query.toLowerCase())
  return start === -1 ? undefined : [start, start + query.length]
}

function valueText(node: FieldNode) {
  return node.samples.map(formatPrimitive).join(' ')
}

function textMatch(node: FieldNode, query: string): MatchInfo | undefined {
  const labelRank = rankItem(node.label, query, { threshold: rankings.ACRONYM })
  const value = valueText(node)
  const valueRank = value
    ? rankItem(value, query, { threshold: rankings.CONTAINS })
    : undefined
  const pathRank = rankItem(node.path, query, { threshold: rankings.CONTAINS })
  if (!labelRank.passed && !valueRank?.passed && !pathRank.passed) {
    return undefined
  }
  return {
    label: substring(node.label, query),
    value: node.samples.length
      ? substring(formatPrimitive(node.samples[0]), query)
      : undefined,
  }
}

/**
 * Filters a tree by a search query and/or a predicate. Matching nodes stay
 * visible together with their ancestors; containers matched by the query
 * keep their whole subtree. Returns null when nothing filters.
 */
export function filterTree(
  root: FieldNode,
  query: string,
  predicate?: (node: FieldNode) => boolean,
): TreeFilter | null {
  const q = query.trim()
  if (!q && !predicate) return null

  const parents = new Map<string, string | undefined>()
  const visible = new Set<string>([root.path])
  const forceExpanded = new Set<string>([root.path])
  const matches = new Map<string, MatchInfo>()

  const includeSubtree = (node: FieldNode) => {
    for (const child of walkTree(node)) visible.add(child.path)
  }

  for (const node of walkTree(root)) {
    parents.set(node.path, node.parentPath)
    if (node.role === 'root') continue
    const match = q ? textMatch(node, q) : {}
    if (!match || (predicate && !predicate(node))) continue

    matches.set(node.path, match)
    visible.add(node.path)
    if (q && !predicate && match.label && node.children.length) {
      includeSubtree(node)
    }
    let parent = node.parentPath
    while (parent !== undefined && !forceExpanded.has(parent)) {
      visible.add(parent)
      forceExpanded.add(parent)
      parent = parents.get(parent)
    }
  }

  return { visible, forceExpanded, matches, matchCount: matches.size }
}
