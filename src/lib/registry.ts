// Central registry of components available in the builder. Used by:
// - The component library panel (what users can drag onto the canvas)
// - The codegen (mapping shape type → JSX emitter)
// - The inspector (prop schemas)

import type { PropSchema } from './propSchema'

export interface ComponentRegistration {
  /** tldraw shape type id */
  type: string
  /** human-readable display name in the library panel */
  label: string
  /** category for grouping in the library panel */
  category: 'layout' | 'primitive' | 'form' | 'display'
  /** lucide icon name for the library tile */
  icon: string
  /** default props for a freshly inserted shape (excluding w/h) */
  defaults: Record<string, unknown>
  /** prop schema for the inspector */
  schema: PropSchema
  /** initial size when inserted */
  initialSize: { w: number; h: number }
  /** whether this component renders meaningfully different in hover/active/focus states */
  hasStates?: boolean
}

const registry = new Map<string, ComponentRegistration>()

export function registerComponent(reg: ComponentRegistration) {
  registry.set(reg.type, reg)
}

export function getRegistration(type: string): ComponentRegistration | undefined {
  return registry.get(type)
}

export function listRegistrations(): ComponentRegistration[] {
  return [...registry.values()]
}

export function listByCategory(): Record<string, ComponentRegistration[]> {
  const grouped: Record<string, ComponentRegistration[]> = {}
  for (const r of registry.values()) {
    ;(grouped[r.category] ??= []).push(r)
  }
  return grouped
}
