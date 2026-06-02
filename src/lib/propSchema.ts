// Lightweight prop schema descriptor. The Inspector reads this to render
// the appropriate editors for each shape's props.

export type EnumOption<V extends string = string> = { value: V; label: string }

export type PropDef =
  | { kind: 'string'; label: string; placeholder?: string; multiline?: boolean }
  | { kind: 'number'; label: string; min?: number; max?: number; step?: number; unit?: string }
  | { kind: 'boolean'; label: string }
  | { kind: 'enum'; label: string; options: EnumOption[] }
  | { kind: 'color'; label: string }

export type PropSchema = Record<string, PropDef | { group: string; props: Record<string, PropDef> }>

// Helper to flatten a schema into [key, PropDef, group?] tuples in declaration order.
export function flattenSchema(schema: PropSchema): Array<{
  key: string
  def: PropDef
  group?: string
}> {
  const out: Array<{ key: string; def: PropDef; group?: string }> = []
  for (const [topKey, value] of Object.entries(schema)) {
    if ('group' in value) {
      for (const [innerKey, def] of Object.entries(value.props)) {
        out.push({ key: innerKey, def, group: value.group })
      }
    } else {
      out.push({ key: topKey, def: value })
    }
  }
  return out
}
