// Operations to evolve a ComponentDef's variant axes/values: rename, delete.
// All operations migrate the def's combo keys AND every ComponentInstance's
// variantChoices in lock-step so the store stays consistent.

import type { Editor } from 'tldraw'
import type { ComponentDef, TemplateNode } from './componentDef'
import type { ComponentInstanceShape } from '@/shapes/ComponentInstanceShape'

// ─── combo key (de)serialization ──────────────────────────────────────────────

function parseCombo(key: string): Array<{ axis: string; value: string }> {
  if (!key) return []
  return key
    .split('|')
    .map(part => {
      const eq = part.indexOf('=')
      if (eq < 0) return null
      return { axis: part.slice(0, eq), value: part.slice(eq + 1) }
    })
    .filter((p): p is { axis: string; value: string } => !!p)
}

function buildCombo(pairs: Array<{ axis: string; value: string }>): string {
  return [...pairs]
    .sort((a, b) => a.axis.localeCompare(b.axis))
    .map(p => `${p.axis}=${p.value}`)
    .join('|')
}

// ─── store helpers ────────────────────────────────────────────────────────────

function getInstancesForDef(editor: Editor, defId: string): ComponentInstanceShape[] {
  const out: ComponentInstanceShape[] = []
  for (const r of editor.store.allRecords()) {
    if ((r as { typeName: string }).typeName !== 'shape') continue
    const s = r as unknown as ComponentInstanceShape
    if (s.type === 'ui-component-instance' && s.props.defId === defId) out.push(s)
  }
  return out
}

function migrateSnapshots(
  snapshots: Record<string, TemplateNode> | undefined,
  transform: (pairs: Array<{ axis: string; value: string }>) => Array<{ axis: string; value: string }> | null,
): Record<string, TemplateNode> | undefined {
  if (!snapshots) return undefined
  const next: Record<string, TemplateNode> = {}
  for (const [key, tmpl] of Object.entries(snapshots)) {
    const pairs = transform(parseCombo(key))
    if (!pairs) continue // dropped
    const newKey = buildCombo(pairs)
    if (newKey === '') continue // becomes the default combo; default lives on def.template, not in snapshots
    next[newKey] = tmpl
  }
  return Object.keys(next).length > 0 ? next : undefined
}

// ─── operations ───────────────────────────────────────────────────────────────

export function renameAxis(editor: Editor, def: ComponentDef, oldName: string, newName: string) {
  if (!def.variants || oldName === newName) return
  if (def.variants.some(a => a.name === newName)) {
    window.alert(`Axis "${newName}" already exists.`)
    return
  }
  const variants = def.variants.map(a => (a.name === oldName ? { ...a, name: newName } : a))
  const variantSnapshots = migrateSnapshots(def.variantSnapshots, pairs =>
    pairs.map(p => (p.axis === oldName ? { ...p, axis: newName } : p)),
  )
  editor.run(() => {
    editor.store.put([{ ...def, variants, variantSnapshots }])
    for (const inst of getInstancesForDef(editor, def.id)) {
      if (!(oldName in inst.props.variantChoices)) continue
      const choices = { ...inst.props.variantChoices }
      choices[newName] = choices[oldName]
      delete choices[oldName]
      editor.updateShape({
        id: inst.id,
        type: 'ui-component-instance',
        props: { variantChoices: choices },
      } as any)
    }
  })
}

export function renameValue(
  editor: Editor,
  def: ComponentDef,
  axisName: string,
  oldValue: string,
  newValue: string,
) {
  if (!def.variants || oldValue === newValue) return
  const axis = def.variants.find(a => a.name === axisName)
  if (!axis) return
  if (axis.values.includes(newValue)) {
    window.alert(`Value "${newValue}" already exists on axis "${axisName}".`)
    return
  }
  const newValues = axis.values.map(v => (v === oldValue ? newValue : v))
  const newDefault = axis.default === oldValue ? newValue : axis.default
  const variants = def.variants.map(a =>
    a.name === axisName ? { ...a, values: newValues, default: newDefault } : a,
  )
  const variantSnapshots = migrateSnapshots(def.variantSnapshots, pairs =>
    pairs.map(p => (p.axis === axisName && p.value === oldValue ? { ...p, value: newValue } : p)),
  )
  editor.run(() => {
    editor.store.put([{ ...def, variants, variantSnapshots }])
    for (const inst of getInstancesForDef(editor, def.id)) {
      if (inst.props.variantChoices[axisName] !== oldValue) continue
      editor.updateShape({
        id: inst.id,
        type: 'ui-component-instance',
        props: {
          variantChoices: { ...inst.props.variantChoices, [axisName]: newValue },
        },
      } as any)
    }
  })
}

export function deleteAxis(editor: Editor, def: ComponentDef, axisName: string) {
  if (!def.variants) return
  const variants = def.variants.filter(a => a.name !== axisName)
  const variantSnapshots = migrateSnapshots(def.variantSnapshots, pairs =>
    pairs.filter(p => p.axis !== axisName),
  )
  editor.run(() => {
    editor.store.put([
      {
        ...def,
        variants: variants.length > 0 ? variants : undefined,
        variantSnapshots,
      },
    ])
    for (const inst of getInstancesForDef(editor, def.id)) {
      if (!(axisName in inst.props.variantChoices)) continue
      const choices = { ...inst.props.variantChoices }
      delete choices[axisName]
      editor.updateShape({
        id: inst.id,
        type: 'ui-component-instance',
        props: { variantChoices: choices },
      } as any)
    }
  })
}

export function deleteValue(
  editor: Editor,
  def: ComponentDef,
  axisName: string,
  value: string,
) {
  if (!def.variants) return
  const axis = def.variants.find(a => a.name === axisName)
  if (!axis) return
  if (axis.values.length <= 1) {
    window.alert('Cannot delete the only value. Delete the whole axis instead.')
    return
  }
  const remaining = axis.values.filter(v => v !== value)
  const newDefault = axis.default === value ? remaining[0] : axis.default
  const variants = def.variants.map(a =>
    a.name === axisName ? { ...a, values: remaining, default: newDefault } : a,
  )
  // Drop any snapshot that referenced this exact (axis, value) pair.
  const variantSnapshots = migrateSnapshots(def.variantSnapshots, pairs =>
    pairs.some(p => p.axis === axisName && p.value === value) ? null : pairs,
  )
  editor.run(() => {
    editor.store.put([{ ...def, variants, variantSnapshots }])
    for (const inst of getInstancesForDef(editor, def.id)) {
      if (inst.props.variantChoices[axisName] !== value) continue
      editor.updateShape({
        id: inst.id,
        type: 'ui-component-instance',
        props: {
          variantChoices: { ...inst.props.variantChoices, [axisName]: newDefault },
        },
      } as any)
    }
  })
}
