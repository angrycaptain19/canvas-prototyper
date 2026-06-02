// Collects everything codegen needs from the live tldraw store into a single
// JSON payload. The CLI consumes this directly — no Editor required at sync
// time.

import type { Editor, TLShape, TLShapeId } from 'tldraw'
import type { ComponentDef, TemplateNode } from '@/lib/componentDef'
import { serializeSelection } from '@/lib/templateSerializer'

export interface ProjectSnapshotPage {
  name: string
  template: TemplateNode
  bounds: { w: number; h: number }
}

export interface ProjectSnapshot {
  version: 1
  exportedAt: string
  defs: ComponentDef[]
  pages: ProjectSnapshotPage[]
}

function isComponentDef(r: { typeName: string }): r is { typeName: string } & ComponentDef {
  return r.typeName === 'componentDef'
}

function isPageFrame(s: TLShape): boolean {
  return s.type === 'ui-page'
}

export function buildProjectSnapshot(editor: Editor): ProjectSnapshot {
  const allRecords = editor.store.allRecords() as Array<{ typeName: string }>
  const defs = allRecords.filter(isComponentDef) as unknown as ComponentDef[]

  // Pages: every ui-page shape on every tldraw page (filter out edit pages,
  // which are tagged via meta in editComponent.ts).
  const pages: ProjectSnapshotPage[] = []
  for (const pageRecord of editor.getPages()) {
    if ((pageRecord.meta as { isComponentEdit?: boolean })?.isComponentEdit) continue
    const pageShapes = editor
      .getCurrentPageShapes()
      .filter(s => s.parentId === pageRecord.id || s.parentId === undefined)
    // ↑ We need the shapes for THIS page, not the current one. Use store query:
  }

  // Walk every shape in the store, find ui-page shapes, serialize each.
  const pageShapeRecords = allRecords
    .filter(r => r.typeName === 'shape') as unknown as TLShape[]
  for (const shape of pageShapeRecords) {
    if (!isPageFrame(shape)) continue
    const { template } = serializeSelection(editor, shape.id as TLShapeId)
    pages.push({
      name: String((shape.props as any).name ?? 'Page'),
      template,
      bounds: {
        w: (shape.props as any).w ?? template.w,
        h: (shape.props as any).h ?? template.h,
      },
    })
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    defs,
    pages,
  }
}

/** Trigger a browser download of the snapshot as project.json. */
export function downloadProjectSnapshot(editor: Editor, filename = 'project.json') {
  const snapshot = buildProjectSnapshot(editor)
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
