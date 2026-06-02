// Configurable list of generation variants. Each variant has a label (shown
// on the chip in the palette + on the resulting PageFrame) and a hint
// string appended to the user's prompt to steer style.
//
// Persists to localStorage; the in-flight Cmd+K palette reads the active
// (enabled) ones at submit time, so toggling a chip mid-typing has effect
// on the next generation.

import { atom } from '@tldraw/state'

const STORAGE_KEY = 'tldraw-ui-builder:variant-presets-v1'
const MIN_VARIANTS = 1
const MAX_VARIANTS = 6

export interface VariantPreset {
  /** Stable id — used for keys and toggle/edit/delete operations. */
  id: string
  /** Short display name. Goes on the chip and on the PageFrame label. */
  label: string
  /** Style hint appended to the user prompt for this variant's agent run. */
  hint: string
  /** Whether this variant is included in the next generation. */
  enabled: boolean
}

export const DEFAULT_VARIANT_PRESETS: VariantPreset[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    hint: 'Style direction: minimal, lots of whitespace, restrained use of color.',
    enabled: true,
  },
  {
    id: 'bold',
    label: 'Bold',
    hint: 'Style direction: rich and confident — use brand color decisively, larger headings, denser content.',
    enabled: true,
  },
  {
    id: 'utilitarian',
    label: 'Utilitarian',
    hint: 'Style direction: utilitarian — compact rows, smaller text, function over decoration.',
    enabled: true,
  },
]

function loadFromStorage(): VariantPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_VARIANT_PRESETS.map(p => ({ ...p }))
    const parsed = JSON.parse(raw) as VariantPreset[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_VARIANT_PRESETS.map(p => ({ ...p }))
    }
    // Sanity-clean entries before trusting them.
    return parsed
      .filter(p => p && typeof p.id === 'string' && typeof p.label === 'string')
      .map(p => ({
        id: p.id,
        label: p.label,
        hint: typeof p.hint === 'string' ? p.hint : '',
        enabled: p.enabled !== false,
      }))
      .slice(0, MAX_VARIANTS)
  } catch {
    return DEFAULT_VARIANT_PRESETS.map(p => ({ ...p }))
  }
}

const variantPresetsAtom = atom<VariantPreset[]>('variantPresets', loadFromStorage())

function persist(presets: VariantPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {
    // ignore
  }
}

function set(next: VariantPreset[]) {
  variantPresetsAtom.set(next)
  persist(next)
}

export { variantPresetsAtom }

export function getVariantPresets(): VariantPreset[] {
  return variantPresetsAtom.get()
}

/** Just the enabled ones, in their current order. */
export function getActiveVariantPresets(): VariantPreset[] {
  return variantPresetsAtom.get().filter(p => p.enabled)
}

export function toggleVariant(id: string): void {
  const cur = variantPresetsAtom.get()
  const next = cur.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
  // Enforce min-1 enabled — if turning off the last one, leave it on.
  if (next.filter(p => p.enabled).length === 0) return
  set(next)
}

export function updateVariant(id: string, patch: Partial<Omit<VariantPreset, 'id'>>): void {
  const cur = variantPresetsAtom.get()
  set(cur.map(p => (p.id === id ? { ...p, ...patch } : p)))
}

export function deleteVariant(id: string): void {
  const cur = variantPresetsAtom.get()
  if (cur.length <= MIN_VARIANTS) return
  const next = cur.filter(p => p.id !== id)
  // If we just dropped the last enabled one, enable the first remaining.
  if (next.filter(p => p.enabled).length === 0 && next.length > 0) {
    next[0] = { ...next[0], enabled: true }
  }
  set(next)
}

export function addVariant(): VariantPreset | null {
  const cur = variantPresetsAtom.get()
  if (cur.length >= MAX_VARIANTS) return null
  const newPreset: VariantPreset = {
    id: `custom-${Date.now().toString(36)}`,
    label: 'Custom',
    hint: 'Style direction: …',
    enabled: true,
  }
  set([...cur, newPreset])
  return newPreset
}

export function resetVariants(): void {
  set(DEFAULT_VARIANT_PRESETS.map(p => ({ ...p })))
}

export { MIN_VARIANTS, MAX_VARIANTS }
