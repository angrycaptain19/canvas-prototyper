// Generate a markdown description of every registered shape — used as part
// of the AI system prompt so the model knows what types it can emit and
// which props each one accepts.
//
// User-defined components (ComponentDef records) are appended dynamically
// so the AI can emit `<MyPricingTile tier="pro" />` style references
// instead of redrawing the design from primitives.

import type { ComponentDef } from '@/lib/componentDef'
import { flattenSchema, type PropDef } from '@/lib/propSchema'
import { listRegistrations, type ComponentRegistration } from '@/lib/registry'

function propLine(name: string, def: PropDef, defaultVal: unknown): string {
  const dv = defaultVal === undefined ? '' : ` (default: ${JSON.stringify(defaultVal)})`
  switch (def.kind) {
    case 'string':
      return `- \`${name}\`: string${dv}`
    case 'number': {
      const range = def.min !== undefined || def.max !== undefined
        ? ` (${def.min ?? '-'}…${def.max ?? '-'}${def.unit ? ` ${def.unit}` : ''})`
        : ''
      return `- \`${name}\`: number${range}${dv}`
    }
    case 'boolean':
      return `- \`${name}\`: boolean${dv}`
    case 'enum':
      return `- \`${name}\`: ${def.options.map(o => `'${o.value}'`).join(' | ')}${dv}`
    case 'color':
      return `- \`${name}\`: color${dv}`
    default:
      return `- \`${name}\`: ${(def as { kind: string }).kind}`
  }
}

function describeOne(reg: ComponentRegistration): string {
  const lines: string[] = []
  lines.push(`### \`${reg.type}\` — ${reg.label} (${reg.category})`)
  const flat = flattenSchema(reg.schema)
  if (flat.length > 0) {
    for (const { key, def } of flat) {
      const dv = (reg.defaults as Record<string, unknown>)[key]
      lines.push(propLine(key, def, dv))
    }
  } else {
    lines.push('- (no editable props)')
  }
  // Container hints
  if (reg.category === 'layout') {
    lines.push('- *container — accepts children*')
  }
  return lines.join('\n')
}

function describeUserDef(def: ComponentDef): string {
  const lines: string[] = []
  lines.push(`### \`${def.name}\` (saved component)`)
  lines.push(`Reference this with type \`ui-component-instance\` and these exact props:`)
  lines.push(`- \`defId\`: "${def.id}"`)
  lines.push(`- \`w\`: ${def.templateBounds.w}`)
  lines.push(`- \`h\`: ${def.templateBounds.h}`)
  if (def.variants && def.variants.length > 0) {
    lines.push(`- \`variantChoices\`: object with these axes:`)
    for (const axis of def.variants) {
      const values = axis.values.map(v => `'${v}'`).join(' | ')
      lines.push(`  - \`${axis.name}\`: ${values} (default: '${axis.default}')`)
    }
  } else {
    lines.push(`- \`variantChoices\`: {} (no variant axes)`)
  }
  return lines.join('\n')
}

export interface BuildCatalogOptions {
  /** User-defined component definitions to include in the catalog. */
  userDefs?: ComponentDef[]
}

export function buildShapeCatalog(opts: BuildCatalogOptions = {}): string {
  const regs = listRegistrations()
  // Hide internal types from the AI:
  //   - ui-component-instance is exposed via the user-defs section, not as
  //     a primitive (AI shouldn't emit raw instance refs to unknown defs)
  const HIDDEN = new Set<string>(['ui-component-instance'])
  const visible = regs.filter(r => !HIDDEN.has(r.type))
  // Order: layout first, then form, primitive, display
  const order: Array<ComponentRegistration['category']> = [
    'layout',
    'form',
    'primitive',
    'display',
  ]
  const grouped = order.flatMap(cat =>
    visible.filter(r => r.category === cat),
  )

  // Lead with saved components — the user already invested time designing
  // these and the agent should prefer them over re-drawing from scratch.
  // Putting them first (before the wall of primitives) makes them part of
  // the agent's mental model of "what this project is" rather than a
  // footnote it scans after deciding to build everything by hand.
  const sections: string[] = []
  const userDefs = opts.userDefs ?? []
  if (userDefs.length > 0) {
    const names = userDefs.map(d => `\`${d.name}\``).join(', ')
    sections.push(
      `# Saved components in this project (PREFER THESE)`,
      '',
      `This project already has these custom components: ${names}.`,
      '',
      `**Before designing anything, scan this list for matches.** If the user's request maps to one of these even partially, USE the component via \`ui-component-instance\` — don't re-create the same content from primitives. Examples:`,
      `- "Pricing page with three tiers" → if a \`PricingTile\` with a \`tier\` axis exists, emit three \`ui-component-instance\` references with \`variantChoices: { tier: "free" / "pro" / "enterprise" }\`. Do NOT build three Cards by hand.`,
      `- "User profile section" → if a \`ProfileCard\` exists, use it. Don't recreate avatar+name+title from primitives.`,
      `- "Team page with 4 members" → use the saved component four times. The user can edit the def afterwards if they want per-instance variation.`,
      '',
      `If a component is *close but missing something* (e.g. PricingTile has no feature list, but the user wants feature lists), you should STILL use the component — the user can extend the def, not duplicate the design. Use it, then note the gap in your finish summary.`,
      '',
      `If NONE of the saved components fit the request, build from primitives — that's fine.`,
      '',
      '## Component reference',
      '',
    )
    for (const def of userDefs) sections.push(describeUserDef(def))
    sections.push('')
  }

  sections.push(
    '# Available primitive shape types',
    '',
    'Every node in the template tree has the form:',
    '```',
    '{ "type": "<shape-type>", "x": 0, "y": 0, "w": 120, "h": 40, "props": {...}, "children": [...] }',
    '```',
    '',
    "Root node sits at (0,0). Children's x/y/w/h are typically ignored by container layout — the parent stack/form/list flexes them. Always include w and h in props for shapes that have them.",
    '',
    ...grouped.map(describeOne),
  )

  return sections.join('\n\n')
}
