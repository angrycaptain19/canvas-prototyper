// Pick the right template snapshot for a given instance variant choice.

import { comboKey } from './comboKey'
import type { ComponentDef, TemplateNode } from './componentDef'

/** Yields combo keys in order of decreasing specificity for the given choices,
 *  ending with '' (the all-defaults combo). Used by both rendering and edit-
 *  mode resolution to fall back when an exact combo isn't stored. */
export function fallbackCombosFor(
  def: ComponentDef,
  choices: Record<string, string>,
): string[] {
  if (!def.variants?.length) return ['']
  const sorted = [...def.variants].sort((a, b) => a.name.localeCompare(b.name))
  const nonDefault = sorted.filter(axis => {
    const v = choices[axis.name] || axis.default
    return v !== axis.default && axis.values.includes(v)
  })

  // All non-empty subsets of nonDefault, longest first; then '' at the end.
  const subsets: string[][] = [[]]
  for (const axis of nonDefault) {
    const len = subsets.length
    for (let i = 0; i < len; i++) {
      subsets.push([...subsets[i], axis.name])
    }
  }
  subsets.sort((a, b) => b.length - a.length)

  return subsets.map(subset =>
    subset.length === 0
      ? ''
      : subset
          .map(name => `${name}=${choices[name] || def.variants!.find(a => a.name === name)!.default}`)
          .join('|'),
  )
}

/** Returns the template tree to render for an instance. Tries the exact combo
 *  first, then progressively less-specific combos, finally the default. */
export function resolveTemplate(
  def: ComponentDef,
  choices: Record<string, string>,
): TemplateNode {
  if (!def.variants?.length) return def.template
  const exact = comboKey(def, choices)
  if (exact === '') return def.template
  if (def.variantSnapshots?.[exact]) return def.variantSnapshots[exact]
  for (const key of fallbackCombosFor(def, choices)) {
    if (key === '') return def.template
    if (def.variantSnapshots?.[key]) return def.variantSnapshots[key]
  }
  return def.template
}
