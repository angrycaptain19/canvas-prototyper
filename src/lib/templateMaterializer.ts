// Walk a TemplateNode tree and create real tldraw shapes. Shared by both
// detach (one-shot expand) and Edit Component mode (round-trip edit).

import { createShapeId, type Editor, type TLParentId, type TLShapeId } from 'tldraw'
import type { TemplateNode } from './componentDef'

export interface MaterializeOptions {
  /** Page or shape under which the root is created. */
  parentId: TLParentId
  /** Page-space (or parent-local) origin for the root. */
  rootX: number
  rootY: number
  /** Optional uniform/non-uniform scaling applied to all sizes + child offsets. */
  scaleX?: number
  scaleY?: number
}

export interface MaterializeResult {
  rootId: TLShapeId
  allIds: TLShapeId[]
}

export function materializeTemplate(
  editor: Editor,
  template: TemplateNode,
  opts: MaterializeOptions,
): MaterializeResult {
  const sx = opts.scaleX ?? 1
  const sy = opts.scaleY ?? 1
  const allIds: TLShapeId[] = []
  let rootId: TLShapeId | null = null

  function instantiate(node: TemplateNode, parentId: TLParentId, isRoot: boolean) {
    const id = createShapeId()
    allIds.push(id)
    if (isRoot) rootId = id

    const x = isRoot ? opts.rootX : node.x * sx
    const y = isRoot ? opts.rootY : node.y * sy
    const w = node.w * sx
    const h = node.h * sy

    // Only write w/h into props if the source shape's schema actually has them.
    // (e.g. tldraw's built-in `text` shape has w but no h — writing h fails
    // validation.)
    const props: Record<string, unknown> = { ...node.props }
    if ('w' in node.props) props.w = w
    if ('h' in node.props) props.h = h

    editor.createShape({
      id,
      type: node.type as any,
      parentId,
      x,
      y,
      props,
      meta: node.meta ?? {},
    } as any)

    if (node.children) {
      for (const child of node.children) {
        instantiate(child, id, false)
      }
    }
  }

  editor.run(() => {
    instantiate(template, opts.parentId, true)
  })

  if (!rootId) throw new Error('materializeTemplate: no root created')
  return { rootId, allIds }
}
