import type { Editor } from 'tldraw'
import { type ComponentDef } from '@/lib/componentDef'
import { materializeTemplate } from '@/lib/templateMaterializer'
import { resolveTemplate } from '@/lib/variantResolution'
import type { ComponentInstanceShape } from '@/shapes/ComponentInstanceShape'

/** Convert a ComponentInstanceShape back into real tldraw shapes. The shapes
 *  produced match what the instance was actually rendering — i.e. the active
 *  variant combo, with smart fallback applied — not the def's default. */
export function detachInstance(editor: Editor, instance: ComponentInstanceShape) {
  const def = editor.store.get(instance.props.defId as any) as ComponentDef | undefined
  if (!def) return

  const template = resolveTemplate(def, instance.props.variantChoices)
  const sx = instance.props.w / Math.max(1, template.w)
  const sy = instance.props.h / Math.max(1, template.h)

  editor.run(() => {
    const { rootId } = materializeTemplate(editor, template, {
      parentId: instance.parentId,
      rootX: instance.x,
      rootY: instance.y,
      scaleX: sx,
      scaleY: sy,
    })
    editor.deleteShape(instance.id)
    editor.select(rootId)
  })
}
