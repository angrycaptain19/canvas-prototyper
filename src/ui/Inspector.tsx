import { useEffect, useState } from 'react'
import { useValue } from '@tldraw/state-react'
import { ChevronRight, Code2, Minimize2, Pencil, Save, Unlink } from 'lucide-react'
import type { Editor, TLShape, TLShapeId } from 'tldraw'
import { useEditorRef } from '@/lib/editorContext'
import { getRegistration } from '@/lib/registry'
import { flattenSchema, type PropDef } from '@/lib/propSchema'
import {
  PREVIEW_STATES,
  getPreviewState,
  setPreviewState,
  type PreviewState,
} from '@/lib/previewState'
import { saveAsComponent } from '@/lib/commands/saveAsComponent'
import { detachInstance } from '@/lib/commands/detachInstance'
import { enterEditMode } from '@/lib/commands/editComponent'
import { useOpenCodePreview } from '@/ui/codePreviewContext'
import type { ComponentInstanceShape } from '@/shapes/ComponentInstanceShape'
import type { ComponentDef } from '@/lib/componentDef'

export function Inspector() {
  const editor = useEditorRef()
  const [selectedShape, setSelectedShape] = useState<TLShape | null>(null)

  useEffect(() => {
    if (!editor) return
    const sync = () => {
      const ids = editor.getSelectedShapeIds()
      if (ids.length !== 1) {
        setSelectedShape(null)
        return
      }
      setSelectedShape(editor.getShape(ids[0]) ?? null)
    }
    sync()
    const unsubDoc = editor.store.listen(sync, { scope: 'document' })
    const unsubSel = editor.store.listen(sync, { scope: 'session' })
    return () => {
      unsubDoc()
      unsubSel()
    }
  }, [editor])

  if (!editor || !selectedShape) {
    return (
      <div className="ui-inspector w-72 h-full p-4 text-sm text-zinc-500">
        <div className="font-semibold text-zinc-900 mb-1">Inspector</div>
        <div>Select a component to edit its props.</div>
      </div>
    )
  }

  // ComponentInstance has no static registry entry (it's a wrapper around a
  // user-defined def). Handle it specially before the registry lookup.
  if ((selectedShape.type as string) === 'ui-component-instance') {
    return (
      <div className="ui-inspector w-72 h-full overflow-y-auto">
        <Breadcrumb editor={editor} shape={selectedShape} />
        <div className="p-4 border-b border-[#ebebeb]">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Component</div>
          <div className="text-base font-semibold text-zinc-900">Instance</div>
        </div>
        <InstanceActionsSection
          editor={editor}
          shape={selectedShape as unknown as ComponentInstanceShape}
        />
      </div>
    )
  }

  const reg = getRegistration(selectedShape.type)
  if (!reg) {
    return (
      <div className="ui-inspector w-72 h-full p-4 text-sm text-zinc-500">
        <div className="font-semibold text-zinc-900 mb-1">Inspector</div>
        <div>{selectedShape.type}: no schema registered.</div>
      </div>
    )
  }

  const flat = flattenSchema(reg.schema)
  const groups: Record<string, typeof flat> = {}
  for (const entry of flat) {
    const g = entry.group ?? 'Props'
    ;(groups[g] ??= []).push(entry)
  }

  const update = (key: string, value: unknown) => {
    editor.updateShape({
      id: selectedShape.id,
      type: selectedShape.type,
      props: { [key]: value },
    } as any)
  }

  return (
    <div className="ui-inspector w-72 h-full overflow-y-auto">
      <Breadcrumb editor={editor} shape={selectedShape} />
      <div className="p-4 border-b border-[#ebebeb]">
        <div className="text-xs uppercase tracking-wide text-zinc-500">{reg.category}</div>
        <div className="text-base font-semibold text-zinc-900">{reg.label}</div>
      </div>
      <SaveAsComponentSection editor={editor} shape={selectedShape} />
      {reg.hasStates && <StatePreviewSection shapeId={selectedShape.id} />}
      {Object.entries(groups).map(([groupName, entries]) => (
        <div key={groupName} className="p-4 border-b border-[#ebebeb] space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {groupName}
          </div>
          {entries.map(({ key, def }) => (
            <PropEditor
              key={key}
              propKey={key}
              def={def}
              value={(selectedShape.props as Record<string, unknown>)[key]}
              onChange={v => update(key, v)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Breadcrumb ────────────────────────────────────────────────────────────

// Build the chain `[root, …, shape]` by walking up parentId until we hit a
// non-shape parent (the page id).
function buildAncestry(editor: Editor, shape: TLShape): TLShape[] {
  const chain: TLShape[] = [shape]
  let cursor: TLShape = shape
  while (
    typeof cursor.parentId === 'string' &&
    cursor.parentId.startsWith('shape:')
  ) {
    const next: TLShape | undefined = editor.getShape(cursor.parentId as TLShapeId)
    if (!next) break
    chain.unshift(next)
    cursor = next
  }
  return chain
}

function shapeBreadcrumbLabel(shape: TLShape): string {
  const t = shape.type as string
  if (t === 'ui-page') {
    const name = (shape.props as { name?: string }).name
    return name && name.trim().length > 0 ? name : 'Page'
  }
  if (t === 'ui-component-instance') return 'Instance'
  const reg = getRegistration(t)
  if (reg) return reg.label
  if (t.startsWith('ui-')) return t.slice(3).replace(/-/g, ' ')
  return t
}

function Breadcrumb({ editor, shape }: { editor: Editor; shape: TLShape }) {
  const chain = buildAncestry(editor, shape)
  if (chain.length <= 1) return null
  // Render ancestors only; the leaf is already shown in the inspector header.
  const ancestors = chain.slice(0, -1)
  return (
    <div className="px-4 py-2 border-b border-[#ebebeb] flex items-center flex-wrap gap-1 text-[11px] text-zinc-500">
      {ancestors.map((a, i) => (
        <span key={a.id} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.select(a.id)}
            className="px-1 py-0.5 rounded hover:bg-[#f5f5f5] hover:text-zinc-900 transition-colors"
            title={`Select ${shapeBreadcrumbLabel(a)}`}
          >
            {shapeBreadcrumbLabel(a)}
          </button>
          {i < ancestors.length - 1 && <ChevronRight className="w-3 h-3 text-zinc-400" />}
          {i === ancestors.length - 1 && <ChevronRight className="w-3 h-3 text-zinc-400" />}
        </span>
      ))}
      <span className="px-1 py-0.5 font-medium text-zinc-900">
        {shapeBreadcrumbLabel(shape)}
      </span>
    </div>
  )
}

function PropEditor({
  propKey,
  def,
  value,
  onChange,
}: {
  propKey: string
  def: PropDef
  value: unknown
  onChange: (v: unknown) => void
}) {
  switch (def.kind) {
    case 'string':
      return (
        <Field label={def.label}>
          {def.multiline ? (
            <textarea
              className={inputCls + ' h-20 resize-none py-1.5'}
              value={(value as string) ?? ''}
              placeholder={def.placeholder}
              onChange={e => onChange(e.target.value)}
            />
          ) : (
            <input
              className={inputCls}
              value={(value as string) ?? ''}
              placeholder={def.placeholder}
              onChange={e => onChange(e.target.value)}
            />
          )}
        </Field>
      )
    case 'number':
      return (
        <Field label={def.label} suffix={def.unit}>
          <input
            type="number"
            className={inputCls}
            value={Number(value ?? 0)}
            min={def.min}
            max={def.max}
            step={def.step ?? 1}
            onChange={e => {
              const n = Number(e.target.value)
              if (!Number.isNaN(n)) onChange(n)
            }}
          />
        </Field>
      )
    case 'boolean':
      return (
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-zinc-900">{def.label}</span>
          <input
            type="checkbox"
            className="accent-[#0a0a0a]"
            checked={Boolean(value)}
            onChange={e => onChange(e.target.checked)}
          />
        </label>
      )
    case 'enum':
      return (
        <Field label={def.label}>
          <div className="grid grid-cols-2 gap-1">
            {def.options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={
                  'text-xs rounded-md border px-2 py-1.5 transition-colors ' +
                  (value === opt.value
                    ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                    : 'border-[#ebebeb] bg-white text-[#0a0a0a] hover:bg-[#f5f5f5]')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>
      )
    default:
      return <div className="text-xs text-zinc-500">Unsupported: {(def as any).kind}</div>
  }
}

function Field({
  label,
  suffix,
  children,
}: {
  label: string
  suffix?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-900">{label}</span>
        {suffix && <span className="text-[10px] text-zinc-500">{suffix}</span>}
      </div>
      {children}
    </div>
  )
}

const inputCls =
  'w-full text-xs bg-white border border-[#ebebeb] rounded-md px-2 py-1.5 text-zinc-900 ' +
  'focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10 transition-colors'

const STACK_LIKE_TYPES_UI = new Set(['ui-stack', 'ui-form', 'ui-list'])

function SaveAsComponentSection({ editor, shape }: { editor: Editor; shape: TLShape }) {
  const openCodePreview = useOpenCodePreview()
  const handleSave = () => {
    const name = window.prompt('Component name?', 'My Component')?.trim()
    if (!name) return
    saveAsComponent(editor, shape, name)
  }
  const handleViewCode = () => {
    openCodePreview({ kind: 'page', shape })
  }
  const handleFitToContent = () => {
    // Clearing meta.userSized re-engages auto-hug; layoutSync runs and snaps
    // the container to its required size.
    editor.updateShape({
      id: shape.id,
      type: shape.type,
      meta: { ...(shape.meta ?? {}), userSized: false },
    } as any)
  }
  if ((shape.type as string) === 'ui-component-instance') return null
  const isStackLike = STACK_LIKE_TYPES_UI.has(shape.type)
  return (
    <div className="p-3 border-b border-[#ebebeb] space-y-2">
      {isStackLike && (
        <button
          type="button"
          onClick={handleFitToContent}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-2 rounded-md border border-[#ebebeb] bg-white hover:bg-[#f5f5f5] text-zinc-900 transition-colors"
          title="Snap this container's size to fit its children exactly."
        >
          <Minimize2 className="w-3.5 h-3.5" />
          Fit to content
        </button>
      )}
      <button
        type="button"
        onClick={handleSave}
        className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-2 rounded-md border border-[#ebebeb] bg-white hover:bg-[#f5f5f5] text-zinc-900 transition-colors"
      >
        <Save className="w-3.5 h-3.5" />
        Save as component
      </button>
      <button
        type="button"
        onClick={handleViewCode}
        className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-2 rounded-md border border-[#ebebeb] bg-white hover:bg-[#f5f5f5] text-zinc-900 transition-colors"
      >
        <Code2 className="w-3.5 h-3.5" />
        View code
      </button>
    </div>
  )
}

function InstanceActionsSection({
  editor,
  shape,
}: {
  editor: Editor
  shape: ComponentInstanceShape
}) {
  const def = useValue<ComponentDef | null>(
    'instance def name',
    () => (editor.store.get(shape.props.defId as any) as ComponentDef | undefined) ?? null,
    [editor, shape.props.defId],
  )
  const openCodePreview = useOpenCodePreview()
  const handleDetach = () => {
    detachInstance(editor, shape)
  }
  const handleEdit = () => {
    if (!def) return
    enterEditMode(editor, def.id)
  }
  const handleViewCode = () => {
    if (!def) return
    openCodePreview({ kind: 'def', defId: def.id })
  }
  const setAxisChoice = (axisName: string, value: string) => {
    editor.updateShape({
      id: shape.id,
      type: 'ui-component-instance',
      props: {
        variantChoices: { ...(shape.props.variantChoices ?? {}), [axisName]: value },
      },
    } as any)
  }
  const choiceFor = (axisName: string, axisDefault: string) =>
    shape.props.variantChoices?.[axisName] || axisDefault

  return (
    <>
      <div className="p-3 border-b border-[#ebebeb] space-y-2">
        <div className="text-[11px] text-zinc-500">
          Instance of <span className="text-zinc-900 font-medium">{def?.name ?? '(missing)'}</span>
        </div>
        <button
          type="button"
          onClick={handleEdit}
          disabled={!def}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-2 rounded-md bg-[#0a0a0a] text-white hover:bg-[#262626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit component
        </button>
        <button
          type="button"
          onClick={handleDetach}
          disabled={!def}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-2 rounded-md border border-[#ebebeb] bg-white hover:bg-[#f5f5f5] text-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Unlink className="w-3.5 h-3.5" />
          Detach
        </button>
        <button
          type="button"
          onClick={handleViewCode}
          disabled={!def}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-2 rounded-md border border-[#ebebeb] bg-white hover:bg-[#f5f5f5] text-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Code2 className="w-3.5 h-3.5" />
          View code
        </button>
      </div>
      {def?.variants?.map(axis => (
        <div key={axis.name} className="p-3 border-b border-[#ebebeb] space-y-1.5">
          <div className="text-xs font-medium text-zinc-900">{axis.name}</div>
          <div className="grid grid-cols-2 gap-1">
            {axis.values.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setAxisChoice(axis.name, v)}
                className={
                  'text-xs rounded-md border px-2 py-1.5 transition-colors ' +
                  (choiceFor(axis.name, axis.default) === v
                    ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                    : 'border-[#ebebeb] bg-white text-[#0a0a0a] hover:bg-[#f5f5f5]')
                }
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function StatePreviewSection({ shapeId }: { shapeId: TLShapeId }) {
  // useValue(name, fn, deps) subscribes to whatever signals fn reads —
  // works outside the Tldraw subtree because it only depends on the atom.
  const current = useValue<PreviewState>(
    'preview state for selected',
    () => getPreviewState(shapeId),
    [shapeId],
  )

  return (
    <div className="p-4 border-b border-[#ebebeb] space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">State preview</div>
      <div className="grid grid-cols-4 gap-1">
        {PREVIEW_STATES.map((s: PreviewState) => (
          <button
            key={s}
            type="button"
            onClick={() => setPreviewState(shapeId, s)}
            className={
              'text-[11px] capitalize rounded-md border px-1 py-1.5 transition-colors ' +
              (current === s
                ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                : 'border-[#ebebeb] bg-white text-[#0a0a0a] hover:bg-[#f5f5f5]')
            }
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
