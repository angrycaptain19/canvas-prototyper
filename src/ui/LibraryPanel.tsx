import { useState } from 'react'
import * as Icons from 'lucide-react'
import { useValue } from '@tldraw/state-react'
import { createShapeId } from 'tldraw'
import { useEditorRef } from '@/lib/editorContext'
import { listByCategory, type ComponentRegistration } from '@/lib/registry'
import type { ComponentDef } from '@/lib/componentDef'
import { downloadProjectSnapshot } from '@/lib/projectExport'
import { LayersPanel } from '@/ui/LayersPanel'
import { ThemePanel } from '@/ui/ThemePanel'

/** dataTransfer key for inserting a built-in component */
export const DRAG_MIME = 'application/x-ui-component'
/** dataTransfer key for inserting a ComponentInstance of a user-defined def */
export const DRAG_DEF_MIME = 'application/x-ui-component-def'

const CATEGORY_ORDER: Array<ComponentRegistration['category']> = [
  'layout',
  'form',
  'primitive',
  'display',
]

const CATEGORY_LABEL: Record<ComponentRegistration['category'], string> = {
  layout: 'Layout',
  primitive: 'Primitives',
  form: 'Form',
  display: 'Display',
}

export function LibraryPanel() {
  const editor = useEditorRef()
  const byCategory = listByCategory()
  const [themeOpen, setThemeOpen] = useState(false)
  const [tab, setTab] = useState<'library' | 'layers'>('library')

  const defs = useValue<ComponentDef[]>(
    'componentDefs',
    () => {
      if (!editor) return []
      const all = editor.store.allRecords()
      return all.filter(
        (r: { typeName: string }) => r.typeName === 'componentDef',
      ) as ComponentDef[]
    },
    [editor],
  )

  const insert = (reg: ComponentRegistration) => {
    if (!editor) return
    const viewport = editor.getViewportPageBounds()
    const center = viewport.center
    editor.createShape({
      id: createShapeId(),
      type: reg.type,
      x: center.x - reg.initialSize.w / 2,
      y: center.y - reg.initialSize.h / 2,
      props: { ...reg.defaults, w: reg.initialSize.w, h: reg.initialSize.h },
    } as any)
  }

  const insertDef = (def: ComponentDef) => {
    if (!editor) return
    const viewport = editor.getViewportPageBounds()
    const center = viewport.center
    const { w, h } = def.templateBounds
    editor.createShape({
      id: createShapeId(),
      type: 'ui-component-instance',
      x: center.x - w / 2,
      y: center.y - h / 2,
      props: { w, h, defId: def.id },
    } as any)
  }

  return (
    <div className="ui-library w-60 h-full overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-[#ebebeb] space-y-2">
        <button
          type="button"
          onClick={() => {
            // Synthesize the Cmd+K event the palette listens for.
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
          }}
          className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium h-8 rounded-md bg-[#0a0a0a] text-white hover:bg-[#262626] transition-colors"
          title="Cmd/Ctrl + K"
        >
          <Icons.Sparkles className="w-3.5 h-3.5" />
          Generate with AI
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 text-[12px] font-medium h-8 rounded-md border border-[#ebebeb] bg-white hover:bg-[#f5f5f5] text-[#0a0a0a] transition-colors"
          >
            <Icons.Palette className="w-3.5 h-3.5" />
            Theme
          </button>
          <button
            type="button"
            onClick={() => editor && downloadProjectSnapshot(editor)}
            disabled={!editor}
            className="inline-flex items-center justify-center gap-1.5 text-[12px] font-medium h-8 rounded-md border border-[#ebebeb] bg-white hover:bg-[#f5f5f5] text-[#0a0a0a] transition-colors disabled:opacity-50"
            title="Download project.json — feed it to `npm run sync`"
          >
            <Icons.Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>
      <div className="flex px-3 gap-4 border-b border-[#ebebeb]">
        {(['library', 'layers'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              'relative py-2.5 text-[12px] font-medium transition-colors ' +
              (tab === t
                ? 'text-[#0a0a0a] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:bg-[#0a0a0a]'
                : 'text-[#8f8f8f] hover:text-[#0a0a0a]')
            }
          >
            {t === 'library' ? 'Components' : 'Layers'}
          </button>
        ))}
      </div>
      {tab === 'layers' && <LayersPanel />}
      {tab === 'library' && defs.length > 0 && (
        <div className="p-3 border-b border-[#ebebeb]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8f8f8f] mb-2 px-0.5">
            My components
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {defs.map(def => {
              const Icon = (Icons as Record<string, any>)[def.icon] ?? Icons.Box
              const handleDelete = (e: React.MouseEvent) => {
                e.stopPropagation()
                if (!editor) return
                if (!window.confirm(`Delete component "${def.name}"?\n\nExisting instances will show "missing component" until removed.`)) return
                editor.store.remove([def.id as any])
              }
              return (
                <div key={def.id} className="relative group">
                  <button
                    type="button"
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData(DRAG_DEF_MIME, def.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => insertDef(def)}
                    className="w-full flex flex-col items-center gap-1.5 px-2 py-2.5 text-[11px] rounded-lg border border-[#ebebeb] bg-white hover:border-[#0a0a0a] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-[#0a0a0a] transition-all cursor-grab active:cursor-grabbing active:opacity-60"
                  >
                    <Icon className="w-4 h-4 text-[#0a0a0a]" />
                    <span className="truncate w-full text-center" title={def.name}>
                      {def.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    title={`Delete "${def.name}"`}
                    className="absolute top-1 right-1 p-0.5 rounded text-[#8f8f8f] opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-600 transition-opacity"
                  >
                    <Icons.Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {tab === 'library' && CATEGORY_ORDER.map(cat => {
        const items = byCategory[cat]
        if (!items?.length) return null
        return (
          <div key={cat} className="p-3 border-b border-[#ebebeb]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8f8f8f] mb-2 px-0.5">
              {CATEGORY_LABEL[cat]}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map(reg => {
                const Icon = (Icons as Record<string, any>)[reg.icon] ?? Icons.Square
                return (
                  <button
                    key={reg.type}
                    type="button"
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData(DRAG_MIME, reg.type)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => insert(reg)}
                    className="flex flex-col items-center gap-1.5 px-2 py-2.5 text-[11px] rounded-lg border border-[#ebebeb] bg-white hover:border-[#d4d4d4] hover:bg-[#fafafa] text-[#525252] hover:text-[#0a0a0a] transition-all cursor-grab active:cursor-grabbing active:opacity-60"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{reg.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <ThemePanel open={themeOpen} onClose={() => setThemeOpen(false)} />
    </div>
  )
}
