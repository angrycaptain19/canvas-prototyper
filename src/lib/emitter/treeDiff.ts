// Compare template snapshots against the default to extract per-prop
// overrides. When all snapshots are structurally identical to the default,
// we can emit a single JSX tree with conditional expressions instead of N
// separate trees.

import type { TemplateNode, VariantAxis } from '@/lib/componentDef'
import { SUPPORTED_OVERRIDES } from './shapeEmitters'
import { camel } from './utils'

/** Are these two trees structurally identical (same shape types + child
 *  counts at every position)? Doesn't compare prop values. */
export function structurallyEqual(a: TemplateNode, b: TemplateNode): boolean {
  if (a.type !== b.type) return false
  const aChildren = a.children ?? []
  const bChildren = b.children ?? []
  if (aChildren.length !== bChildren.length) return false
  for (let i = 0; i < aChildren.length; i++) {
    if (!structurallyEqual(aChildren[i], bChildren[i])) return false
  }
  return true
}

/** Map from prop key to map from combo key to override value. */
export type PropOverrides = Map<string, Map<string, unknown>>

/** Map from node path ('', '0', '0.1', etc.) to its prop overrides. */
export type TreeOverrides = Map<string, PropOverrides>

function deepEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Walk default + each snapshot in parallel; collect every (path, propKey)
 *  where any snapshot's value differs from the default. Assumes all inputs
 *  are structurallyEqual (caller's responsibility). */
export function collectOverrides(
  defaultTree: TemplateNode,
  snapshots: Record<string, TemplateNode>,
): TreeOverrides {
  const out: TreeOverrides = new Map()

  function walk(
    defNode: TemplateNode,
    varNodes: Array<{ combo: string; node: TemplateNode }>,
    path: string,
  ) {
    const propOverrides: PropOverrides = new Map()
    for (const { combo, node } of varNodes) {
      // Union of keys: account for props that exist on variant but not default.
      const allKeys = new Set([
        ...Object.keys(defNode.props),
        ...Object.keys(node.props),
      ])
      for (const key of allKeys) {
        const defVal = (defNode.props as Record<string, unknown>)[key]
        const varVal = (node.props as Record<string, unknown>)[key]
        if (deepEq(defVal, varVal)) continue
        let perCombo = propOverrides.get(key)
        if (!perCombo) {
          perCombo = new Map()
          propOverrides.set(key, perCombo)
        }
        perCombo.set(combo, varVal)
      }
    }
    if (propOverrides.size > 0) out.set(path, propOverrides)

    const defChildren = defNode.children ?? []
    for (let i = 0; i < defChildren.length; i++) {
      const childVarNodes = varNodes.map(({ combo, node }) => ({
        combo,
        node: (node.children ?? [])[i],
      }))
      walk(defChildren[i], childVarNodes, path === '' ? String(i) : `${path}.${i}`)
    }
  }

  const entries = Object.entries(snapshots).map(([combo, node]) => ({ combo, node }))
  walk(defaultTree, entries, '')
  return out
}

/** Translate a combo key (e.g. "tier=pro|state=hover") into a JS boolean
 *  expression usable inside the emitted component body. */
export function comboToCondition(combo: string, _axes: VariantAxis[]): string {
  if (!combo) return 'true'
  const parts = combo.split('|').map(p => {
    const eq = p.indexOf('=')
    if (eq < 0) return 'true'
    const axisName = p.slice(0, eq)
    const value = p.slice(eq + 1)
    return `${camel(axisName)} === '${value}'`
  })
  return parts.length === 1 ? parts[0] : parts.join(' && ')
}

/** Whether the def's snapshots can be diff-emitted. Two requirements:
 *  1. All snapshots are structurally equal to the default template.
 *  2. Every override is on a prop we know how to emit conditionally
 *     (per SUPPORTED_OVERRIDES). */
export function canDiffEmit(
  defaultTree: TemplateNode,
  snapshots: Record<string, TemplateNode> | undefined,
): boolean {
  if (!snapshots) return true
  for (const tree of Object.values(snapshots)) {
    if (!structurallyEqual(defaultTree, tree)) return false
  }
  // Check every override is on a supported prop.
  const overrides = collectOverrides(defaultTree, snapshots)
  for (const [path, propOverrides] of overrides.entries()) {
    const node = nodeAtPath(defaultTree, path)
    if (!node) return false
    const supported = SUPPORTED_OVERRIDES[node.type]
    if (!supported) return false
    for (const propKey of propOverrides.keys()) {
      if (!supported.has(propKey)) return false
    }
  }
  return true
}

function nodeAtPath(root: TemplateNode, path: string): TemplateNode | undefined {
  if (path === '') return root
  const indices = path.split('.').map(s => Number(s))
  let cur: TemplateNode | undefined = root
  for (const i of indices) {
    cur = (cur?.children ?? [])[i]
    if (!cur) return undefined
  }
  return cur
}
