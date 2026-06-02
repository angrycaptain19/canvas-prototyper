import { PageRecordType, type Editor, type TLPageId, type TLShapeId } from 'tldraw'
import { type ComponentDef, type ComponentDefId, type TemplateNode } from '@/lib/componentDef'
import { comboKey, withDefaults } from '@/lib/comboKey'
import { materializeTemplate } from '@/lib/templateMaterializer'
import { serializeSelection } from '@/lib/templateSerializer'
import { fallbackCombosFor, resolveTemplate } from '@/lib/variantResolution'

export interface EditPageMeta extends Record<string, unknown> {
  isComponentEdit: true
  defId: string
  fromPageId: string
  /** Current combo being edited. Per-axis choice; missing axes = axis default.
   *  Empty (or all-defaults) = the def's main `template`. */
  variantChoices: Record<string, string>
}

// ─── Pending-edit buffer ──────────────────────────────────────────────────────
// Edits in edit mode go here, NOT directly to the def's record. Save flushes
// the buffer to the def; Cancel discards it. Variant structure changes (axes,
// values, rename, delete) write directly — only template content is buffered.

interface EditBuffer {
  defId: ComponentDefId
  /** Pending default-combo template (only set if user edited the default combo) */
  defaultTemplate?: TemplateNode
  defaultBounds?: { w: number; h: number }
  /** Pending non-default combo snapshots */
  snapshots: Record<string, TemplateNode>
}

const buffersByEditPage = new Map<TLPageId, EditBuffer>()

function getOrCreateBuffer(pageId: TLPageId, defId: ComponentDefId): EditBuffer {
  let buf = buffersByEditPage.get(pageId)
  if (!buf) {
    buf = { defId, snapshots: {} }
    buffersByEditPage.set(pageId, buf)
  }
  return buf
}

const EDIT_PAGE_ORIGIN_X = 100
const EDIT_PAGE_ORIGIN_Y = 100

export function enterEditMode(editor: Editor, defId: ComponentDefId) {
  const def = editor.store.get(defId as any) as ComponentDef | undefined
  if (!def) return

  const fromPageId = editor.getCurrentPageId()
  const newPageId = PageRecordType.createId()
  const initialChoices = withDefaults(def, {})

  editor.run(() => {
    editor.createPage({
      id: newPageId,
      name: `Editing: ${def.name}`,
      meta: {
        isComponentEdit: true,
        defId: def.id,
        fromPageId,
        variantChoices: initialChoices,
      } satisfies EditPageMeta,
    })
    editor.setCurrentPage(newPageId)

    const { rootId } = materializeTemplate(editor, resolveTemplate(def, initialChoices), {
      parentId: newPageId,
      rootX: EDIT_PAGE_ORIGIN_X,
      rootY: EDIT_PAGE_ORIGIN_Y,
    })
    editor.select(rootId)
    editor.zoomToFit({ animation: { duration: 250 } })
  })
}

/** Read the edit-page meta off the current page, if we're on one. */
export function getCurrentEditMeta(editor: Editor): EditPageMeta | null {
  const page = editor.getCurrentPage()
  const meta = page?.meta as Partial<EditPageMeta> | undefined
  if (meta?.isComponentEdit && meta.defId && meta.fromPageId) {
    return meta as EditPageMeta
  }
  return null
}

/** Find the root shape of the template on the edit page. We materialize one
 *  root at known origin so the first child of the page is it. */
function findEditRoot(editor: Editor): string | null {
  const ids = editor.getSortedChildIdsForParent(editor.getCurrentPageId())
  return ids[0] ?? null
}

/** Serialize the current edit page's shapes and write them into the buffer
 *  (NOT the def's record). Buffer is flushed on Save or discarded on Cancel. */
function bufferCurrentPage(editor: Editor): void {
  const meta = getCurrentEditMeta(editor)
  if (!meta) return
  const rootId = findEditRoot(editor)
  if (!rootId) return
  const def = editor.store.get(meta.defId as any) as ComponentDef | undefined
  if (!def) return

  const editPageId = editor.getCurrentPageId()
  const buf = getOrCreateBuffer(editPageId, def.id as ComponentDefId)

  const { template, templateBounds } = serializeSelection(editor, rootId as TLShapeId)
  const key = comboKey(def, meta.variantChoices)
  if (key === '') {
    buf.defaultTemplate = template
    buf.defaultBounds = templateBounds
  } else {
    buf.snapshots[key] = template
  }
}

/** Look up the template for a given combo, walking the same fallback chain
 *  resolveTemplate uses but checking the buffer first at each level. This is
 *  what makes "edit pro, then add a new axis, then click pro|hover" inherit
 *  from the buffered pro state instead of falling back to the default. */
function resolveTemplateWithBuffer(
  buf: EditBuffer | undefined,
  def: ComponentDef,
  choices: Record<string, string>,
): TemplateNode {
  const exact = comboKey(def, choices)
  if (exact === '') return buf?.defaultTemplate ?? def.template
  if (buf?.snapshots[exact]) return buf.snapshots[exact]
  if (def.variantSnapshots?.[exact]) return def.variantSnapshots[exact]
  for (const key of fallbackCombosFor(def, choices)) {
    if (key === '') return buf?.defaultTemplate ?? def.template
    if (buf?.snapshots[key]) return buf.snapshots[key]
    if (def.variantSnapshots?.[key]) return def.variantSnapshots[key]
  }
  return buf?.defaultTemplate ?? def.template
}

/** Flush the entire buffer to the def in one store.put() call. */
function flushBufferToDef(editor: Editor): void {
  const editPageId = editor.getCurrentPageId()
  const buf = buffersByEditPage.get(editPageId)
  if (!buf) return
  const def = editor.store.get(buf.defId as any) as ComponentDef | undefined
  if (!def) return

  const next: ComponentDef = { ...def }
  if (buf.defaultTemplate) {
    next.template = buf.defaultTemplate
    if (buf.defaultBounds) next.templateBounds = buf.defaultBounds
  }
  if (Object.keys(buf.snapshots).length > 0) {
    next.variantSnapshots = { ...(def.variantSnapshots ?? {}), ...buf.snapshots }
  }
  editor.store.put([next])
}

export function exitEditMode(editor: Editor, save: boolean) {
  const meta = getCurrentEditMeta(editor)
  if (!meta) return
  const editPageId = editor.getCurrentPageId()

  editor.run(() => {
    if (save) {
      bufferCurrentPage(editor)
      flushBufferToDef(editor)
    }
    buffersByEditPage.delete(editPageId)
    editor.setCurrentPage(meta.fromPageId as TLPageId)
    editor.deletePage(editPageId)
  })
}

/** Switch one axis of the editing combo. Auto-buffers the current canvas to
 *  its current combo slot, clears the page, materializes the new combo's
 *  template (preferring the buffer over the def's stored snapshot), and
 *  updates the page meta. NOTHING is written to the def's record until Save. */
export function switchEditingVariant(editor: Editor, axisName: string, nextValue: string) {
  const meta = getCurrentEditMeta(editor)
  if (!meta) return
  if (meta.variantChoices[axisName] === nextValue) return

  editor.run(() => {
    bufferCurrentPage(editor)

    const def = editor.store.get(meta.defId as any) as ComponentDef | undefined
    if (!def) return

    const pageId = editor.getCurrentPageId()
    const buf = buffersByEditPage.get(pageId)

    // Clear current contents
    const childIds = editor.getSortedChildIdsForParent(pageId)
    if (childIds.length > 0) editor.deleteShapes(childIds)

    const nextChoices = withDefaults(def, {
      ...meta.variantChoices,
      [axisName]: nextValue,
    })

    const nextTemplate = resolveTemplateWithBuffer(buf, def, nextChoices)
    const { rootId } = materializeTemplate(editor, nextTemplate, {
      parentId: pageId,
      rootX: EDIT_PAGE_ORIGIN_X,
      rootY: EDIT_PAGE_ORIGIN_Y,
    })

    editor.updatePage({
      id: pageId,
      meta: { ...meta, variantChoices: nextChoices },
    })

    editor.select(rootId)
  })
}
