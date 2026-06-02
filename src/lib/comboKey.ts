// Combo keys identify a specific variant combination. Format:
//   sorted by axis name, axes at their default value are omitted,
//   joined as "axis=value|axis=value".
// The empty string represents the all-defaults combo (uses def.template).

import type { ComponentDef } from './componentDef'

/** Build the canonical combo key from a (possibly partial) choices map. */
export function comboKey(def: ComponentDef, choices: Record<string, string>): string {
  if (!def.variants?.length) return ''
  const parts: string[] = []
  const axes = [...def.variants].sort((a, b) => a.name.localeCompare(b.name))
  for (const axis of axes) {
    const value = choices[axis.name] || axis.default
    if (value === axis.default) continue
    if (!axis.values.includes(value)) continue
    parts.push(`${axis.name}=${value}`)
  }
  return parts.join('|')
}

/** Fill in defaults for any axis missing from the input choices. */
export function withDefaults(
  def: ComponentDef,
  choices: Record<string, string>,
): Record<string, string> {
  if (!def.variants?.length) return {}
  const out: Record<string, string> = {}
  for (const axis of def.variants) {
    out[axis.name] = choices[axis.name] && axis.values.includes(choices[axis.name])
      ? choices[axis.name]
      : axis.default
  }
  return out
}
