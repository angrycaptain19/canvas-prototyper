// Convert a selected shape (and its descendants) into a serializable
// TemplateNode tree suitable for storing inside a ComponentDef record.

import type { Editor, TLShapeId } from 'tldraw'
import type { TemplateNode } from './componentDef'

/** Strips `undefined` values, function refs, and non-plain prototypes — what
 *  tldraw's T.jsonValue validator requires. */
function safeClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

function serializeShape(editor: Editor, id: TLShapeId, isRoot: boolean): TemplateNode {
  const shape = editor.getShape(id)
  if (!shape) throw new Error(`shape not found: ${id}`)

  const props = shape.props as Record<string, unknown>
  const w = typeof props.w === 'number' ? props.w : 100
  const h = typeof props.h === 'number' ? props.h : 40

  const childIds = editor.getSortedChildIdsForParent(id)

  const node: TemplateNode = {
    type: shape.type,
    // Root sits at (0,0) of the template's local coord space; descendants keep
    // their parent-relative positions as stored in tldraw.
    x: isRoot ? 0 : shape.x,
    y: isRoot ? 0 : shape.y,
    w,
    h,
    props: safeClone(props),
  }
  if (shape.meta && Object.keys(shape.meta).length) {
    node.meta = safeClone(shape.meta)
  }
  if (childIds.length > 0) {
    node.children = childIds.map(cid => serializeShape(editor, cid, false))
  }
  return node
}

export interface SerializeResult {
  template: TemplateNode
  templateBounds: { w: number; h: number }
}

/** Serialize a single selected shape (with its descendants) into a template. */
export function serializeSelection(editor: Editor, rootId: TLShapeId): SerializeResult {
  const template = serializeShape(editor, rootId, true)
  return {
    template,
    templateBounds: { w: template.w, h: template.h },
  }
}
