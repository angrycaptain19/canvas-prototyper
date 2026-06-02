// Serializes a portion of the canvas into a compact text dump the AI agent
// can read via `get_canvas_state`. Each line:
//
//   [shape_id] type @ (x,y) WxH parent=parent_id
//     props: key=value key=value …
//
// Children are indented under their parent. Only shapes registered in our
// component registry are emitted (the agent doesn't need to see arrows,
// draw shapes, etc.).

import type { Editor, TLShape, TLShapeId, TLParentId } from 'tldraw'
import { getRegistration } from '@/lib/registry'

const MAX_VALUE_LEN = 80

function fmtValue(v: unknown): string {
  if (typeof v === 'string') {
    const trimmed = v.length > MAX_VALUE_LEN ? v.slice(0, MAX_VALUE_LEN - 1) + '…' : v
    return JSON.stringify(trimmed)
  }
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (v === null || v === undefined) return 'null'
  return JSON.stringify(v).slice(0, MAX_VALUE_LEN)
}

function fmtShape(shape: TLShape, depth: number): string {
  const props = shape.props as Record<string, unknown>
  const w = typeof props.w === 'number' ? Math.round(props.w) : '?'
  const h = typeof props.h === 'number' ? Math.round(props.h) : '?'
  const x = Math.round(shape.x)
  const y = Math.round(shape.y)
  const parentLabel = typeof shape.parentId === 'string' && shape.parentId.startsWith('page:')
    ? 'page'
    : shape.parentId
  const indent = '  '.repeat(depth)
  const head = `${indent}[${shape.id}] ${shape.type} @ (${x},${y}) ${w}x${h} parent=${parentLabel}`

  // Only the props we care about — skip w/h (already in header) and very
  // long values. Keeps the dump compact even for big trees.
  const propParts: string[] = []
  for (const [key, value] of Object.entries(props)) {
    if (key === 'w' || key === 'h') continue
    propParts.push(`${key}=${fmtValue(value)}`)
  }
  return propParts.length > 0
    ? `${head}\n${indent}  props: ${propParts.join(' ')}`
    : head
}

function walk(editor: Editor, parentId: TLParentId, depth: number, out: string[]): void {
  const childIds = editor.getSortedChildIdsForParent(parentId)
  for (const id of childIds) {
    const shape = editor.getShape(id)
    if (!shape) continue
    // Skip shapes we don't manage (so the agent doesn't see arrows, etc.)
    if (!getRegistration(shape.type)) continue
    out.push(fmtShape(shape, depth))
    walk(editor, shape.id, depth + 1, out)
  }
}

export interface SerializeOptions {
  /** 'page' = walk the current page's roots; 'subtree' = walk descendants
   *  of rootId only (including rootId itself). */
  scope: 'page' | 'subtree'
  rootId?: TLShapeId
}

export function serializeCanvas(editor: Editor, opts: SerializeOptions): string {
  const out: string[] = []
  if (opts.scope === 'subtree') {
    if (!opts.rootId) return '(error: subtree scope requires rootId)'
    const root = editor.getShape(opts.rootId)
    if (!root) return `(no shape found with id ${opts.rootId})`
    out.push(fmtShape(root, 0))
    walk(editor, root.id, 1, out)
  } else {
    walk(editor, editor.getCurrentPageId(), 0, out)
  }
  if (out.length === 0) return '(empty)'
  return out.join('\n')
}
