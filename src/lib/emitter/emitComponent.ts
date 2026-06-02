// Emit a full React component file for a ComponentDef. Handles:
//  - typed variant props (axes → literal-union types)
//  - combo-key computation matching the canvas
//  - switch over stored snapshots; default = the base template

import type { ComponentDef, VariantAxis } from '@/lib/componentDef'
import { emitTree, type EmitContext, type LiftedProp } from './emitTree'
import {
  countNodesOfType,
  EXTRACT_THRESHOLD,
  FIELD_SUBCOMPONENT_SOURCE,
  FIELD_SUBCOMPONENT_SOURCE_SHADCN,
} from './subComponents'
import { canDiffEmit, collectOverrides } from './treeDiff'
import { camel, findFormSubmitButtonPaths, indent, mergeRootClassName, pascal } from './utils'

export interface EmitComponentResult {
  filename: string
  componentName: string
  code: string
  /** Other defs referenced inside this one's templates. */
  uses: ComponentDef[]
}

/** Walk a template, recording the `label` prop (or equivalent) at each
 *  path so the case-based variant emit can keep lifted prop names stable.
 *  Only shapes that lift label-derived props are included. */
function buildBaseLabelMap(node: import('@/lib/componentDef').TemplateNode): Map<string, string> {
  const map = new Map<string, string>()
  function walk(n: import('@/lib/componentDef').TemplateNode, path: string) {
    const props = n.props as Record<string, unknown>
    if (
      n.type === 'ui-button' ||
      n.type === 'ui-checkbox' ||
      n.type === 'ui-switch' ||
      n.type === 'ui-radio' ||
      n.type === 'ui-badge' ||
      n.type === 'ui-tag'
    ) {
      const label = props.label
      if (typeof label === 'string' && label.length > 0) map.set(path, label)
    } else if (n.type === 'ui-input' || n.type === 'ui-select') {
      const label = props.label
      if (typeof label === 'string' && label.length > 0) map.set(path, label)
    }
    if (n.children) {
      for (let i = 0; i < n.children.length; i++) {
        walk(n.children[i], path === '' ? String(i) : `${path}.${i}`)
      }
    }
  }
  walk(node, '')
  return map
}

function emitTypes(name: string, axes: VariantAxis[]): string {
  const types = axes.map(
    axis =>
      `export type ${name}${pascal(axis.name)} = ${axis.values.map(v => `'${v}'`).join(' | ')}`,
  )
  return types.join('\n')
}

function emitProps(name: string, axes: VariantAxis[], lifted: LiftedProp[]): string {
  const fields = axes.map(
    axis => `  ${camel(axis.name)}?: ${name}${pascal(axis.name)}`,
  )
  for (const prop of lifted) {
    const optional = prop.optional === false ? '' : '?'
    fields.push(`  ${prop.name}${optional}: ${prop.type}`)
  }
  fields.push(`  className?: string`)
  return `export interface ${name}Props {\n${fields.join('\n')}\n}`
}

function emitCombo(axes: VariantAxis[]): string {
  // Emit the canvas's comboKey logic inline:
  //   sort by axis name; include name=value only if value !== default; join with '|'
  const sorted = [...axes].sort((a, b) => a.name.localeCompare(b.name))
  const parts = sorted
    .map(axis => `    ${camel(axis.name)} !== '${axis.default}' ? \`${axis.name}=\${${camel(axis.name)}}\` : null,`)
    .join('\n')
  return `  const combo = [\n${parts}\n  ].filter(Boolean).join('|')`
}

function emitSwitch(
  def: ComponentDef,
  ctx: EmitContext,
): string {
  // Collect (comboKey → template) pairs, then emit a case per stored snapshot
  // plus a default that uses def.template. Each case's JSX root gets the
  // user's className prop merged in.
  const cases: string[] = []
  if (def.variantSnapshots) {
    const keys = Object.keys(def.variantSnapshots).sort(
      (a, b) => b.length - a.length,
    )
    for (const key of keys) {
      const tmpl = def.variantSnapshots[key]
      const jsx = mergeRootClassName(emitTree(tmpl, ctx), 'className')
      cases.push(`    case '${key}':\n      return (\n${indent(jsx, 4)}\n      )`)
    }
  }
  const defaultJsx = mergeRootClassName(emitTree(def.template, ctx), 'className')
  cases.push(`    default:\n      return (\n${indent(defaultJsx, 4)}\n      )`)
  return `  switch (combo) {\n${cases.join('\n')}\n  }`
}

export interface EmitComponentOptions {
  mode?: 'default' | 'shadcn'
}

export function emitComponent(
  def: ComponentDef,
  getDef: (id: string) => ComponentDef | undefined,
  opts: EmitComponentOptions = {},
): EmitComponentResult {
  const mode: 'default' | 'shadcn' = opts.mode ?? 'default'
  const componentName = pascal(def.name)
  const uses: ComponentDef[] = []
  const seenUseIds = new Set<string>()
  const externalImports = new Map<string, Set<string>>() // module → names
  let hasInteractive = false
  let hasIds = false
  const ctx: EmitContext = {
    mode,
    noteImport: (name, mod) => {
      let set = externalImports.get(mod)
      if (!set) {
        set = new Set()
        externalImports.set(mod, set)
      }
      set.add(name)
    },
    getDef,
    noteUsedDef: d => {
      if (seenUseIds.has(d.id)) return
      seenUseIds.add(d.id)
      uses.push(d)
    },
    noteInteractive: () => {
      hasInteractive = true
    },
    noteNeedsId: () => {
      hasIds = true
    },
    noteLiftedProp: p => {
      if (liftedByName.has(p.name)) return
      liftedByName.set(p.name, p)
      lifted.push(p)
    },
    noteUsedSubComponent: name => usedSubComponents.add(name),
  }

  const lifted: LiftedProp[] = []
  const liftedByName = new Map<string, LiftedProp>()
  const usedSubComponents = new Set<string>()
  const axes = def.variants ?? []

  // Pre-walk: if 3+ inputs anywhere in the tree (default + all variants),
  // enable field extraction so each input emits as a one-line <Field /> call.
  const inputCount = [def.template, ...Object.values(def.variantSnapshots ?? {})]
    .reduce((a, t) => a + countNodesOfType(t, 'ui-input'), 0)
  if (inputCount >= EXTRACT_THRESHOLD) {
    ctx.extractFields = true
    usedSubComponents.add('Field')
    // In shadcn mode the Field sub-component uses Label + Input from shadcn,
    // so we must surface those imports manually since the Input emitter
    // short-circuits to a <Field /> call and never calls noteImport itself.
    if (mode === 'shadcn') {
      ctx.noteImport?.('Label', '@/components/ui/label')
      ctx.noteImport?.('Input', '@/components/ui/input')
    }
  }

  // Decide between diff-emit (single tree with conditional props) and the
  // case-based switch emit.
  const useDiffEmit = axes.length > 0 && canDiffEmit(def.template, def.variantSnapshots)
  if (useDiffEmit && def.variantSnapshots) {
    ctx.overrides = collectOverrides(def.template, def.variantSnapshots)
    ctx.axes = axes
  }

  // Pre-walk the base template to record the canonical "label" at each path
  // for shapes that have one (Button / Tag / Badge / Switch / Radio / Input).
  // The case-based switch emit reuses these so lifted prop names stay stable
  // across variants whose snapshots change the label text.
  if (axes.length > 0) {
    ctx.baseLabelsByPath = buildBaseLabelMap(def.template)
  }
  // Pre-walk for Form > last Button so the button emitter emits `type="submit"`
  // and skips lifting an onClick (the Form lifts its own onSubmit).
  ctx.submitButtonPaths = findFormSubmitButtonPaths(def.template)

  // Body — emit first so signals populate before header is built.
  const body: string[] = []
  body.push(`export function ${componentName}(props: ${componentName}Props) {`)

  let switchOrReturn: string
  if (axes.length > 0) {
    if (useDiffEmit) {
      // Single tree with overrides resolved via conditionals.
      const jsx = mergeRootClassName(emitTree(def.template, ctx), 'className')
      switchOrReturn = `  return (\n${indent(jsx, 2)}\n  )`
    } else {
      switchOrReturn = emitCombo(axes) + '\n' + emitSwitch(def, ctx)
    }
  } else {
    const jsx = mergeRootClassName(emitTree(def.template, ctx), 'className')
    switchOrReturn = `  return (\n${indent(jsx, 2)}\n  )`
  }

  for (const axis of axes) {
    body.push(
      `  const ${camel(axis.name)} = props.${camel(axis.name)} ?? '${axis.default}'`,
    )
  }
  // Destructure className + any lifted props so the emitted JSX can reference
  // them directly (e.g. `onSubmit={onSubmit}` rather than `props.onSubmit`).
  const destructure = ['className', ...lifted.map(l => l.name)].join(', ')
  body.push(`  const { ${destructure} } = props`)
  if (hasIds) {
    body.push(`  const _id = useId()`)
  }
  body.push(switchOrReturn)
  body.push(`}`)

  // Header: 'use client' (if any interactive children), React import (if
  // useId needed), then component imports, types, props.
  const header: string[] = []
  if (hasInteractive || hasIds) {
    header.push(`'use client'`)
    header.push(``)
  }
  header.push(
    `// Generated by tldraw-ui-builder. Edits will be overwritten on next sync.`,
  )
  header.push(``)
  if (hasIds) {
    header.push(`import { useId } from 'react'`)
  }
  // If any lifted prop's type mentions React.* we need React in scope as a
  // type. Use a type-only import so it doesn't add to the runtime bundle.
  const needsReactType = lifted.some(l => /\bReact\./.test(l.type))
  if (needsReactType) {
    header.push(`import type * as React from 'react'`)
  }
  // cn — sourced from the project's shared utils. Default mode uses the
  // _lib.tsx we emit alongside the components; shadcn mode uses the
  // project's existing `@/lib/utils` (shadcn convention).
  header.push(
    mode === 'shadcn'
      ? `import { cn } from '@/lib/utils'`
      : `import { cn } from './_lib'`,
  )
  // External imports collected during emit (e.g. shadcn primitives).
  for (const [mod, names] of externalImports) {
    const sorted = [...names].sort()
    header.push(`import { ${sorted.join(', ')} } from '${mod}'`)
  }
  for (const used of uses) {
    const name = pascal(used.name)
    header.push(`import { ${name} } from './${name}'`)
  }
  header.push(``)

  if (axes.length > 0) {
    header.push(emitTypes(componentName, axes))
    header.push(``)
  }
  header.push(emitProps(componentName, axes, lifted))
  header.push(``)

  // Append used sub-component definitions at the bottom of the file.
  const tail: string[] = []
  if (usedSubComponents.has('Field')) {
    tail.push('')
    tail.push(
      mode === 'shadcn'
        ? FIELD_SUBCOMPONENT_SOURCE_SHADCN
        : FIELD_SUBCOMPONENT_SOURCE,
    )
  }

  return {
    filename: `${componentName}.tsx`,
    componentName,
    code: [...header, ...body, ...tail].join('\n') + '\n',
    uses,
  }
}
