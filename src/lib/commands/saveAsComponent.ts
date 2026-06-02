import type { Editor, TLShape } from 'tldraw'
import {
  ComponentDefRecord,
  newComponentDefId,
  type ComponentDef,
} from '@/lib/componentDef'
import { getRegistration } from '@/lib/registry'
import { serializeSelection } from '@/lib/templateSerializer'

function findDefByName(editor: Editor, name: string): ComponentDef | null {
  const target = name.trim().toLowerCase()
  if (!target) return null
  const all = editor.store.allRecords() as Array<{ typeName: string }>
  for (const r of all) {
    if (r.typeName !== 'componentDef') continue
    const d = r as unknown as ComponentDef
    if (d.name.trim().toLowerCase() === target) return d
  }
  return null
}

/** Save a single selected shape (with its descendants) as a reusable component.
 *  If a def with the same name already exists, update it in place — all
 *  instances of that def will re-render with the new template. */
export function saveAsComponent(
  editor: Editor,
  shape: TLShape,
  name: string,
): ComponentDef {
  const { template, templateBounds } = serializeSelection(editor, shape.id)
  const reg = getRegistration(shape.type)

  const existing = findDefByName(editor, name)
  if (existing) {
    const updated: ComponentDef = { ...existing, template, templateBounds }
    editor.store.put([updated])
    return updated
  }

  const def: ComponentDef = ComponentDefRecord.create({
    id: newComponentDefId(),
    name,
    icon: reg?.icon ?? 'Box',
    category: 'custom',
    template,
    templateBounds,
    createdAt: Date.now(),
  } as Omit<ComponentDef, 'typeName'>) as ComponentDef
  editor.store.put([def])
  return def
}
