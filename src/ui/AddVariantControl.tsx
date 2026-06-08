import { Plus } from 'lucide-react'
import type { Editor } from 'tldraw'
import type { ComponentDef, VariantAxis } from '@/lib/componentDef'

type AxisMode = { mode: 'axis' }
type ValueMode = { mode: 'value'; axisName: string }
type Props = (AxisMode | ValueMode) & { editor: Editor; def: ComponentDef }

function slugifyValue(v: string) {
  return v.trim().toLowerCase().replace(/\s+/g, '-')
}

export function AddVariantControl(props: Props) {
  const { editor, def } = props

  const onAddAxis = () => {
    const axisName = window.prompt('Variant axis name?', 'state')?.trim()
    if (!axisName) return
    if (def.variants?.some(a => a.name === axisName)) {
      window.alert(`Axis "${axisName}" already exists.`)
      return
    }
    const raw = window.prompt(
      `Values for "${axisName}" (comma-separated)? First value is the default.`,
      'default, hover, active',
    )
    if (!raw) return
    const values = raw.split(',').map(slugifyValue).filter(Boolean)
    if (values.length === 0) return
    const dedup = Array.from(new Set(values))
    const axis: VariantAxis = {
      name: axisName,
      values: dedup,
      default: dedup[0],
    }
    editor.store.put([{ ...def, variants: [...(def.variants ?? []), axis] }])
  }

  const onAddValue = () => {
    if (props.mode !== 'value') return
    const axis = def.variants?.find(a => a.name === props.axisName)
    if (!axis) return
    const value = window.prompt(`New value for "${axis.name}"?`)?.trim()
    if (!value) return
    const slug = slugifyValue(value)
    if (!slug || axis.values.includes(slug)) return
    const updated = (def.variants ?? []).map(a =>
      a.name === axis.name ? { ...a, values: [...a.values, slug] } : a,
    )
    editor.store.put([{ ...def, variants: updated }])
  }

  if (props.mode === 'axis') {
    return (
      <button
        type="button"
        onClick={onAddAxis}
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-zinc-900 hover:bg-[#f5f5f5] transition-colors"
      >
        <Plus className="w-3 h-3" /> Add variant
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onAddValue}
      title="Add value"
      className="inline-flex items-center justify-center w-6 h-6 rounded text-zinc-500 hover:text-zinc-900 hover:bg-[#f5f5f5] transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  )
}
