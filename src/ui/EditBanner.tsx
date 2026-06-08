import { useValue } from '@tldraw/state-react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import type { Editor } from 'tldraw'
import type { ComponentDef, VariantAxis } from '@/lib/componentDef'
import {
  exitEditMode,
  getCurrentEditMeta,
  switchEditingVariant,
} from '@/lib/commands/editComponent'
import {
  deleteAxis,
  deleteValue,
  renameAxis,
  renameValue,
} from '@/lib/variantMigrations'
import { useEditorRef } from '@/lib/editorContext'
import { AddVariantControl } from '@/ui/AddVariantControl'

/** Sticky top banner visible only when the current page is a component-edit
 *  page. Provides the only path out of edit mode: Save commits the page's
 *  shapes back to the def; Cancel discards changes. */
export function EditBanner() {
  const editor = useEditorRef()

  const meta = useValue(
    'edit-page-meta',
    () => (editor ? getCurrentEditMeta(editor) : null),
    [editor],
  )

  const def = useValue<ComponentDef | null>(
    'edit-page-def',
    () => {
      if (!editor || !meta) return null
      return (editor.store.get(meta.defId as any) as ComponentDef | undefined) ?? null
    },
    [editor, meta?.defId],
  )

  if (!editor || !meta) return null

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-3 z-20 flex flex-col items-stretch gap-1.5 pointer-events-auto">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0a0a] text-white shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
        <span className="text-[11px] uppercase tracking-[0.08em] text-white/45">Editing</span>
        <span className="text-sm font-semibold">{def?.name ?? '(missing)'}</span>
        <button
          type="button"
          onClick={() => exitEditMode(editor, false)}
          className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          type="button"
          onClick={() => exitEditMode(editor, true)}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-white text-[#0a0a0a] hover:bg-white/90 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Save
        </button>
      </div>
      <div className="flex flex-col items-stretch gap-1 px-3 py-2 rounded-lg bg-white border border-[#ebebeb] shadow-[0_4px_16px_rgba(0,0,0,0.08)] min-w-[300px]">
        {def?.variants?.length ? (
          <>
            {def.variants.map(axis => (
              <AxisRow
                key={axis.name}
                editor={editor}
                def={def}
                axis={axis}
                current={meta.variantChoices[axis.name] ?? axis.default}
              />
            ))}
            <div className="pt-1 border-t border-[#ebebeb]">
              <AddVariantControl editor={editor} def={def} mode="axis" />
            </div>
          </>
        ) : (
          def && <AddVariantControl editor={editor} def={def} mode="axis" />
        )}
      </div>
    </div>
  )
}

function AxisRow({
  editor,
  def,
  axis,
  current,
}: {
  editor: Editor
  def: ComponentDef
  axis: VariantAxis
  current: string
}) {
  const onRenameAxis = () => {
    const name = window.prompt(`Rename axis "${axis.name}" to?`, axis.name)?.trim()
    if (!name || name === axis.name) return
    renameAxis(editor, def, axis.name, name)
  }
  const onDeleteAxis = () => {
    if (!window.confirm(`Delete axis "${axis.name}" and all its snapshots?`)) return
    deleteAxis(editor, def, axis.name)
  }
  const onRenameValue = (v: string) => {
    const next = window.prompt(`Rename value "${v}" on axis "${axis.name}" to?`, v)?.trim()
    if (!next || next === v) return
    renameValue(editor, def, axis.name, v, next)
  }
  const onDeleteValue = (v: string) => {
    if (!window.confirm(`Delete value "${v}" from axis "${axis.name}"?`)) return
    deleteValue(editor, def, axis.name, v)
  }
  return (
    <div className="flex items-center gap-2 group/row">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500 min-w-[3.5rem]">
        {axis.name}
      </span>
      <div className="flex items-center gap-1 flex-1 flex-wrap">
        {axis.values.map(v => (
          <div key={v} className="group/chip relative">
            <button
              type="button"
              onClick={() => switchEditingVariant(editor, axis.name, v)}
              onDoubleClick={() => onRenameValue(v)}
              className={
                'text-xs rounded px-2 py-1 transition-colors ' +
                (current === v ? 'bg-[#0a0a0a] text-white' : 'text-zinc-900 hover:bg-[#f5f5f5]')
              }
            >
              {v}
              {axis.default === v && <span className="ml-1 opacity-50 text-[9px]">·</span>}
            </button>
            <button
              type="button"
              onClick={() => onDeleteValue(v)}
              title={`Delete "${v}"`}
              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#0a0a0a] text-white text-[9px] inline-flex items-center justify-center opacity-0 group-hover/chip:opacity-100 transition-opacity"
            >
              ×
            </button>
          </div>
        ))}
        <AddVariantControl editor={editor} def={def} mode="value" axisName={axis.name} />
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onRenameAxis}
          title="Rename axis"
          className="inline-flex items-center justify-center w-6 h-6 rounded text-zinc-500 hover:text-zinc-900 hover:bg-[#f5f5f5] transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onDeleteAxis}
          title="Delete axis"
          className="inline-flex items-center justify-center w-6 h-6 rounded text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
