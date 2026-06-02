// Walk a TemplateNode tree, dispatch to per-shape emitters, return JSX string.

import type { ComponentDef, TemplateNode, VariantAxis } from '@/lib/componentDef'
import { camel, pascal } from './utils'
import { getEmitter } from './shapeEmitters'
import type { PropOverrides, TreeOverrides } from './treeDiff'

export interface LiftedProp {
  name: string
  /** TS type as a string, e.g. "React.MouseEventHandler<HTMLButtonElement>" */
  type: string
  /** Optional default value expression for destructuring */
  defaultExpr?: string
  /** Whether the prop is optional (default true) */
  optional?: boolean
}

export interface EmitContext {
  /** Resolves a ComponentInstance's def by id, so the tree walker can emit a
   *  `<ComponentName />` call and the caller can collect referenced defs. */
  getDef(id: string): ComponentDef | undefined
  /** Called when the walker encounters a ComponentInstance — caller can use
   *  this to track which defs need their own emitted files. */
  noteUsedDef?: (def: ComponentDef) => void
  /** Called when an interactive shape (button/input/checkbox/select/tabs) is
   *  emitted, so the file can be flagged 'use client'. */
  noteInteractive?: () => void
  /** Called when a form element needs a stable id — triggers a useId() hook
   *  at the top of the component. */
  noteNeedsId?: () => void
  /** Called when an emitter wants to lift a prop to the component signature
   *  (e.g. onSubmit, onClick, value). Dedup by name; first declaration wins. */
  noteLiftedProp?: (prop: LiftedProp) => void
  /** When true, emitters of repeating patterns (e.g. Input) emit a call to a
   *  shared sub-component (`<Field ... />`) instead of full inline JSX. The
   *  sub-component definition is emitted once at the bottom of the file by
   *  emitComponent/emitPage. */
  extractFields?: boolean
  /** Emitters mark themselves here so the caller knows which sub-component
   *  definitions to append. */
  noteUsedSubComponent?: (name: string) => void
  /** Output flavor: 'default' = raw HTML with our Tailwind tokens; 'shadcn'
   *  = compose with shadcn/ui primitives (Button, Input, Label, Checkbox). */
  mode?: 'default' | 'shadcn'
  /** Called when an emitter wants to import something from an external
   *  module (e.g. shadcn primitives). emitComponent/emitPage collects these
   *  and emits import statements. */
  noteImport?: (importName: string, fromModule: string) => void
  /** Variant-diff mode: when present, shape emitters consult this to find
   *  per-prop conditional overrides for the node being emitted. */
  overrides?: TreeOverrides
  /** Variant axes — needed to translate combo keys to JS conditions. */
  axes?: VariantAxis[]
  /** Map of `path → label` from the BASE template, used to keep lifted
   *  prop names stable across variants. Without this a Button at path
   *  "1.0.3" with label "Cancel" in the base but "Save" in a variant
   *  would lift two different handler names (`onCancelClick` AND
   *  `onSaveClick`), inflating the API surface. */
  baseLabelsByPath?: Map<string, string>
  /** Paths of buttons that should emit as `type="submit"` and NOT lift an
   *  `onClick` (the enclosing Form's `onSubmit` handles the action). */
  submitButtonPaths?: Set<string>
}

/** Lookup helper: get the override map for a prop at the current node path. */
export function getOverridesAt(
  ctx: EmitContext,
  path: string,
): PropOverrides | undefined {
  return ctx.overrides?.get(path)
}

export function emitTree(node: TemplateNode, ctx: EmitContext, path = ''): string {
  // ComponentInstance is special — it doesn't have a regular emitter; we emit
  // a JSX call to the referenced def's component.
  if (node.type === 'ui-component-instance') {
    const defId = String((node.props as Record<string, unknown>).defId ?? '')
    const def = ctx.getDef(defId)
    if (!def) {
      return `{/* missing component ref ${defId} */}`
    }
    ctx.noteUsedDef?.(def)
    const choices =
      ((node.props as Record<string, unknown>).variantChoices as Record<string, string> | undefined) ?? {}
    const componentName = pascal(def.name)
    const propAttrs = Object.entries(choices)
      .filter(([axis, value]) => {
        const ax = def.variants?.find(a => a.name === axis)
        return ax && value !== ax.default && ax.values.includes(value)
      })
      .map(([axis, value]) => `${camel(axis)}="${value}"`)
      .join(' ')
    return `<${componentName}${propAttrs ? ' ' + propAttrs : ''} />`
  }

  // Emit children first, threading per-child paths so emitters can look up
  // overrides at the right position in the tree.
  const childNodes = node.children ?? []
  const childJsxs = childNodes.map((c, i) =>
    emitTree(c, ctx, path === '' ? String(i) : `${path}.${i}`),
  )
  const childrenJsx = childJsxs.join('\n')

  const emitter = getEmitter(node.type)
  if (!emitter) {
    return `{/* unsupported shape: ${node.type} */}`
  }
  return emitter(node, childrenJsx, ctx, path, childJsxs, childNodes)
}
