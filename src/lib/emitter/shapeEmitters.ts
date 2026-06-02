// Per-shape-type JSX emitters. Each takes a TemplateNode, already-emitted
// children string, and an EmitContext (for side-channel signals like
// noteInteractive/noteNeedsId). Returns a JSX string.
//
// These mirror each shape's component() but drop canvas-only concerns
// (pointer-events, preview state) and substitute layout-flow for absolute
// positioning when possible.

import { camel } from './utils'
import { attr, cls, indent, jsxText, tw } from './utils'
import {
  asJsxText,
  classMapExpr,
  hasAnyOverride,
  textExpr,
} from './overrideExpr'
import type { TemplateNode } from '@/lib/componentDef'
import type { EmitContext } from './emitTree'

export type ShapeEmitter = (
  node: TemplateNode,
  children: string,
  ctx: EmitContext,
  path: string,
  /** Per-child emitted JSX strings, in template order. Container emitters
   *  that need to wrap individual children (e.g. ListContainer → <li>) use
   *  this; emitters that just want the concatenated form use `children`. */
  childJsxs?: string[],
  /** Original child TemplateNodes — for emitters that need to inspect types
   *  or props of children (e.g. Form finding its last button to mark
   *  type="submit"). */
  childNodes?: TemplateNode[],
) => string

const Emitters: Record<string, ShapeEmitter> = {}

export function registerEmitter(type: string, fn: ShapeEmitter) {
  Emitters[type] = fn
}

export function getEmitter(type: string): ShapeEmitter | undefined {
  return Emitters[type]
}

/** Per-shape-type set of props for which we know how to emit override
 *  conditionals. The diff-emitter falls back to case-based emit if a variant
 *  overrides a prop not in this set (so we never silently lose information). */
export const SUPPORTED_OVERRIDES: Record<string, Set<string>> = {
  'ui-button': new Set(['variant', 'size', 'radius', 'label']),
  'ui-text': new Set(['content', 'weight', 'tone', 'align']),
  'ui-input': new Set(['label', 'placeholder']),
  'ui-checkbox': new Set(['label']),
  'ui-select': new Set(['label', 'placeholder', 'value']),
  'ui-badge': new Set(['label']),
  'ui-avatar': new Set(['initials', 'src']),
  // Containers don't currently diff-emit their props (gap, padding etc).
  'ui-stack': new Set(),
  'ui-card': new Set(),
  'ui-page': new Set(),
  'ui-slot': new Set(),
  'ui-tabs': new Set(),
  'ui-form': new Set(),
  'ui-list': new Set(),
  'ui-component-instance': new Set(['variantChoices']),
  'ui-switch': new Set(['label']),
  'ui-radio': new Set(['label']),
  'ui-tag': new Set(['label']),
  'ui-alert': new Set(['title', 'description']),
  'ui-progress': new Set(['value']),
  'ui-divider': new Set(),
}

// ─── Container shapes ─────────────────────────────────────────────────────────

registerEmitter('ui-stack', (node, children) => {
  const p = node.props as Record<string, unknown>
  const direction = p.direction === 'horizontal' ? 'flex-row' : 'flex-col'
  const alignMap: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }
  const justifyMap: Record<string, string> = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    'space-between': 'justify-between',
    'space-around': 'justify-around',
  }
  const bgMap: Record<string, string> = {
    none: '',
    surface: 'bg-surface',
    muted: 'bg-bg',
  }
  const cn = cls(
    'flex',
    direction,
    `gap-${tw(Number(p.gap) || 0)}`,
    `p-${tw(Number(p.padding) || 0)}`,
    alignMap[String(p.alignItems)] ?? '',
    justifyMap[String(p.justifyContent)] ?? '',
    bgMap[String(p.background)] ?? '',
    p.border ? 'border border-border' : '',
  )
  // Border radius only renders when something visible bounds the container
  // (border or filled background). Otherwise the inline style is dead.
  const hasBoundary = p.border || (String(p.background) !== 'none' && String(p.background) !== '')
  const radius = Number(p.borderRadius) || 0
  const style = hasBoundary && radius > 0 ? ` style={{ borderRadius: ${radius} }}` : ''
  return `<div className="${cn}"${style}>\n${indent(children, 1)}\n</div>`
})

// ─── FormContainer ────────────────────────────────────────────────────────────
// Emits a real <form> element with action + method baked in. Lifts onSubmit
// to a component prop, and rewrites the last child Button to type="submit".
registerEmitter('ui-form', (node, _children, ctx, _path, childJsxs, childNodes) => {
  const p = node.props as Record<string, unknown>
  const direction = p.direction === 'horizontal' ? 'flex-row' : 'flex-col'
  const alignMap: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }
  const bgMap: Record<string, string> = {
    none: '',
    surface: 'bg-surface',
    muted: 'bg-bg',
  }
  const cn = cls(
    'flex',
    direction,
    `gap-${tw(Number(p.gap) || 0)}`,
    `p-${tw(Number(p.padding) || 0)}`,
    alignMap[String(p.alignItems)] ?? '',
    bgMap[String(p.background)] ?? '',
    p.border ? 'border border-border' : '',
  )
  const hasBoundary = p.border || (String(p.background) !== 'none' && String(p.background) !== '')
  const radius = Number(p.borderRadius) || 0
  const style = hasBoundary && radius > 0 ? ` style={{ borderRadius: ${radius} }}` : ''
  const action = String(p.action ?? '')
  const method = String(p.method ?? 'POST').toLowerCase()
  const actionAttr = action ? ` action="${action}"` : ''
  const methodAttr = ` method="${method}"`

  // Lift onSubmit to a component prop.
  ctx.noteLiftedProp?.({
    name: 'onSubmit',
    type: 'React.FormEventHandler<HTMLFormElement>',
    optional: true,
  })

  // The submit button itself emits `type="submit"` and skips its onClick
  // lift — that's driven by ctx.submitButtonPaths set by the page/component
  // pre-walk, so no post-hoc string rewrite is needed here.
  void childNodes
  const childrenJoined = (childJsxs ?? []).join('\n')

  return `<form${actionAttr}${methodAttr} onSubmit={onSubmit} className="${cn}"${style}>\n${indent(childrenJoined, 1)}\n</form>`
})

// ─── ListContainer ────────────────────────────────────────────────────────────
// Emits as <ul>/<ol>/<div> with each child wrapped in <li> (when the tag
// supports it). Separator prop adds Tailwind divide-* classes.
registerEmitter('ui-list', (_node, _children, _ctx, _path, childJsxs) => {
  const p = _node.props as Record<string, unknown>
  const direction = p.direction === 'horizontal' ? 'flex-row' : 'flex-col'
  const alignMap: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }
  const bgMap: Record<string, string> = {
    none: '',
    surface: 'bg-surface',
    muted: 'bg-bg',
  }
  const sepMap: Record<string, string> = {
    none: '',
    divider: p.direction === 'horizontal' ? 'divide-x divide-border' : 'divide-y divide-border',
    border: '',
  }
  const tag = String(p.as ?? 'ul')
  const useLi = tag === 'ul' || tag === 'ol'
  const cn = cls(
    'flex',
    direction,
    sepMap[String(p.separator ?? 'none')] ?? '',
    // gap/padding don't combine well with divide-* so omit gap when divider is on
    p.separator === 'divider' ? '' : `gap-${tw(Number(p.gap) || 0)}`,
    `p-${tw(Number(p.padding) || 0)}`,
    alignMap[String(p.alignItems)] ?? '',
    bgMap[String(p.background)] ?? '',
    p.border ? 'border border-border' : '',
    useLi ? 'list-none' : '',
  )
  const hasBoundary = p.border || (String(p.background) !== 'none' && String(p.background) !== '')
  const radius = Number(p.borderRadius) || 0
  const style = hasBoundary && radius > 0 ? ` style={{ borderRadius: ${radius} }}` : ''
  const wrapped = useLi
    ? (childJsxs ?? []).map(c => `<li>\n${indent(c, 1)}\n</li>`).join('\n')
    : (childJsxs ?? []).join('\n')
  const role = useLi ? '' : ' role="list"'
  return `<${tag}${role} className="${cn}"${style}>\n${indent(wrapped, 1)}\n</${tag}>`
})

registerEmitter('ui-card', (node, children) => {
  const p = node.props as Record<string, unknown>
  const shadowMap: Record<string, string> = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow',
    lg: 'shadow-lg',
  }
  const cn = cls(
    'bg-surface',
    shadowMap[String(p.shadow)] ?? '',
    p.border ? 'border border-border' : '',
    `p-${tw(Number(p.padding) || 0)}`,
  )
  const radius = Number(p.borderRadius) || 0
  const style = radius > 0 ? ` style={{ borderRadius: ${radius} }}` : ''
  if (children.trim().length === 0) {
    return `<div className="${cn}"${style} />`
  }
  return `<div className="${cn}"${style}>\n${indent(children, 1)}\n</div>`
})

registerEmitter('ui-page', (node, children) => {
  // PageFrame emits as the page's root <div>. Background + min-height for the
  // page; child stacks/cards flow naturally inside.
  const p = node.props as Record<string, unknown>
  const bgMap: Record<string, string> = {
    surface: 'bg-surface',
    bg: 'bg-bg',
    transparent: '',
  }
  const cn = cls('min-h-screen w-full', bgMap[String(p.background)] ?? '')
  return `<div className="${cn}">\n${indent(children, 1)}\n</div>`
})

registerEmitter('ui-slot', (_node, children) => {
  // In emitted code, a slot just renders its children (the design-time
  // dropzone affordance is dropped).
  return children.trim().length > 0 ? children : '{children}'
})

// ─── Form / primitive shapes ──────────────────────────────────────────────────

const BUTTON_VARIANT_BASE: Record<string, string> = {
  primary: 'bg-brand text-brand-fg hover:bg-brand/90',
  secondary: 'bg-surface text-fg border border-border hover:bg-bg',
  ghost: 'bg-transparent text-fg hover:bg-bg',
  destructive: 'bg-danger text-danger-fg hover:bg-danger/90',
}
const BUTTON_SIZE: Record<string, string> = {
  sm: 'text-xs px-2 h-8',
  md: 'text-sm px-4 h-10',
  lg: 'text-base px-6 h-12',
}
const BUTTON_RADIUS: Record<string, string> = {
  default: 'rounded-token',
  sm: 'rounded-token-sm',
  square: 'rounded-none',
  pill: 'rounded-full',
}
// Note: rounded-* class is appended per-button so a `radius` prop override
// can change shape (pill / square) without disturbing the rest of the base.
const BUTTON_BASE =
  'inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

registerEmitter('ui-button', (node, _children, ctx, path) => {
  ctx.noteInteractive?.()
  const p = node.props as Record<string, unknown>

  // Lift a click handler + label override + loading state, all named after
  // the button's label.
  //   label "Place Order"
  //   → onPlaceOrderClick, placeOrderLabel, placeOrderLoading
  // For variant snapshots whose label differs from the base template, use
  // the BASE label so all snapshots share one handler instead of three
  // (`onCancelClick` / `onSaveClick` / `onDeleteClick`).
  const label = String(p.label ?? '')
  const baseLabel = ctx.baseLabelsByPath?.get(path) ?? label
  const slug = camel(baseLabel || 'button')
  const labelPropName = `${slug}Label`
  const loadingPropName = `${slug}Loading`

  // If this button is the Form's submit button, the enclosing Form lifts
  // `onSubmit` instead. Skip the click handler lift + emit type="submit".
  const isSubmit = !!ctx.submitButtonPaths?.has(path)
  const buttonType = isSubmit ? 'submit' : 'button'

  let handlerAttr = ''
  if (!isSubmit) {
    const handlerName = `on${slug.charAt(0).toUpperCase()}${slug.slice(1)}Click`
    ctx.noteLiftedProp?.({
      name: handlerName,
      type: 'React.MouseEventHandler<HTMLButtonElement>',
      optional: true,
    })
    handlerAttr = ` onClick={${handlerName}}`
  }
  ctx.noteLiftedProp?.({
    name: labelPropName,
    type: 'React.ReactNode',
    optional: true,
  })
  ctx.noteLiftedProp?.({
    name: loadingPropName,
    type: 'boolean',
    optional: true,
  })
  const bakedDisabled = !!p.disabled
  const bakedLoading = !!p.loading
  // disabled = (baked from canvas) || lifted-loading
  const disabledExpr = bakedDisabled
    ? `disabled={true}`
    : `disabled={${loadingPropName}${bakedLoading ? ' ?? true' : ''}}`
  const disabledAttr = ` ${disabledExpr}`
  const spinnerExpr = `${loadingPropName}${bakedLoading ? ' ?? true' : ''} && <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" /><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>`

  // shadcn-mode: emit <Button> composition. Variants map 1:1 to shadcn's.
  // type="button" by default; Form emitter rewrites the last button to
  // type="submit" (and that rewrite works on `<Button type="button"` too).
  if (ctx.mode === 'shadcn') {
    ctx.noteImport?.('Button', '@/components/ui/button')
    const shadcnVariant = String(p.variant) === 'primary' ? 'default' : String(p.variant)
    const sizeMap: Record<string, string> = { sm: 'sm', md: 'default', lg: 'lg' }
    const shadcnSize = sizeMap[String(p.size)] ?? 'default'
    const variantAttr = ` variant="${shadcnVariant}"`
    const sizeAttr = ` size="${shadcnSize}"`
    return `<Button type="${buttonType}"${variantAttr}${sizeAttr}${handlerAttr}${disabledAttr}>{${spinnerExpr}}{${labelPropName} ?? ${JSON.stringify(label)}}</Button>`
  }

  // Button base classes now include gap for spinner spacing.
  const baseWithGap = BUTTON_BASE + ' gap-1.5'

  const radiusKey = String(p.radius ?? 'default')
  const radiusCls = BUTTON_RADIUS[radiusKey] ?? BUTTON_RADIUS.default

  if (hasAnyOverride(ctx, path)) {
    // Diff-mode: emit conditional className + label via cn()/ternary.
    const variantExpr = classMapExpr(ctx, path, 'variant', String(p.variant), BUTTON_VARIANT_BASE)
    const sizeExpr = classMapExpr(ctx, path, 'size', String(p.size), BUTTON_SIZE)
    const radiusExpr = classMapExpr(ctx, path, 'radius', radiusKey, BUTTON_RADIUS)
    const labelExpr = textExpr(ctx, path, 'label', label)
    return `<button type="${buttonType}"${handlerAttr} className={cn(${JSON.stringify(baseWithGap)}, ${variantExpr}, ${sizeExpr}, ${radiusExpr})}${disabledAttr}>{${spinnerExpr}}{${labelPropName} ?? ${labelExpr}}</button>`
  }

  // Fast path: literal className when nothing varies.
  const variantKey = String(p.variant)
  const sizeKey = String(p.size)
  if (!(variantKey in BUTTON_VARIANT_BASE)) {
    console.warn(
      `[codegen] ui-button at "${path}" has unknown variant=${JSON.stringify(variantKey)}; falling back to "primary". Valid: ${Object.keys(BUTTON_VARIANT_BASE).join(', ')}.`,
    )
  }
  if (!(sizeKey in BUTTON_SIZE)) {
    console.warn(
      `[codegen] ui-button at "${path}" has unknown size=${JSON.stringify(sizeKey)}; falling back to "md". Valid: ${Object.keys(BUTTON_SIZE).join(', ')}.`,
    )
  }
  if (!(radiusKey in BUTTON_RADIUS)) {
    console.warn(
      `[codegen] ui-button at "${path}" has unknown radius=${JSON.stringify(radiusKey)}; falling back to "default". Valid: ${Object.keys(BUTTON_RADIUS).join(', ')}.`,
    )
  }
  const cn = cls(
    baseWithGap,
    radiusCls,
    BUTTON_VARIANT_BASE[variantKey] ?? BUTTON_VARIANT_BASE.primary,
    BUTTON_SIZE[sizeKey] ?? BUTTON_SIZE.md,
  )
  return `<button type="${buttonType}"${handlerAttr} className="${cn}"${disabledAttr}>{${spinnerExpr}}{${labelPropName} ?? ${JSON.stringify(label)}}</button>`
})

registerEmitter('ui-input', (node, _children, ctx, path) => {
  ctx.noteInteractive?.()
  ctx.noteNeedsId?.()
  const p = node.props as Record<string, unknown>
  const label = String(p.label ?? '')
  const required = !!p.required
  const placeholder = String(p.placeholder ?? '')
  const type = String(p.type ?? 'text')
  const labelText = hasAnyOverride(ctx, path)
    ? textExpr(ctx, path, 'label', label)
    : null
  const placeholderText = hasAnyOverride(ctx, path)
    ? textExpr(ctx, path, 'placeholder', placeholder)
    : null
  // Either label/placeholder may be conditional — handle each independently.
  const labelJsx = labelText === null ? jsxText(label) : asJsxText(labelText)
  const placeholderAttr = placeholderText === null
    ? (placeholder ? ` placeholder="${placeholder.replace(/"/g, '&quot;')}"` : '')
    : ` placeholder={${placeholderText}}`
  const inputCn = cls(
    'h-10 px-3 rounded-token border border-border bg-surface',
    'text-sm text-fg placeholder:text-muted',
    'focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand',
  )
  const idSuffix = camel(label || 'input')
  const idExpr = `\`\${_id}-${idSuffix}\``
  // Lift a defaultValue prop so callers can prefill the field.
  ctx.noteLiftedProp?.({
    name: idSuffix,
    type: 'string',
    optional: true,
  })

  // Extraction path: when 3+ inputs in this tree, emit a Field call instead
  // of full inline JSX.
  if (ctx.extractFields) {
    ctx.noteUsedSubComponent?.('Field')
    const propPairs: string[] = [
      `id={${idExpr}}`,
      `name="${idSuffix}"`,
      `label=${JSON.stringify(label)}`,
    ]
    if (type !== 'text') propPairs.push(`type="${type}"`)
    if (placeholder) propPairs.push(`placeholder=${JSON.stringify(placeholder)}`)
    if (required) propPairs.push('required')
    propPairs.push(`defaultValue={${idSuffix}}`)
    return `<Field ${propPairs.join(' ')} />`
  }

  // shadcn-mode inline: compose Label + Input from shadcn primitives.
  if (ctx.mode === 'shadcn') {
    ctx.noteImport?.('Input', '@/components/ui/input')
    ctx.noteImport?.('Label', '@/components/ui/label')
    const lines: string[] = []
    lines.push(`<div className="flex-1 flex flex-col gap-1.5">`)
    if (label) {
      lines.push(
        `  <Label htmlFor={${idExpr}}>${jsxText(label)}${
          required ? '<span className="text-destructive ml-0.5">*</span>' : ''
        }</Label>`,
      )
    }
    lines.push(
      `  <Input id={${idExpr}} name="${idSuffix}" ${attr('type', type)}${placeholderAttr} defaultValue={${idSuffix}}${
        required ? ' required' : ''
      } />`,
    )
    lines.push(`</div>`)
    return lines.join('\n')
  }

  const nameAttr = ` name="${idSuffix}"`
  const defaultValueAttr = ` defaultValue={${idSuffix}}`
  const lines: string[] = []
  lines.push(`<div className="flex-1 flex flex-col gap-1.5">`)
  if (label) {
    lines.push(
      `  <label htmlFor={${idExpr}} className="text-xs font-medium text-fg">${labelJsx}${
        required ? '<span className="text-danger ml-0.5">*</span>' : ''
      }</label>`,
    )
  }
  lines.push(
    `  <input id={${idExpr}}${nameAttr} ${attr('type', type)}${placeholderAttr}${defaultValueAttr}${
      required ? ' required' : ''
    } className="w-full ${inputCn}" />`,
  )
  lines.push(`</div>`)
  return lines.join('\n')
})

const TEXT_ROLE_MAP: Record<string, { tag: string; cls: string }> = {
  heading: { tag: 'h2', cls: 'text-2xl leading-tight' },
  subheading: { tag: 'h3', cls: 'text-lg leading-snug' },
  body: { tag: 'p', cls: 'text-sm leading-normal' },
  caption: { tag: 'span', cls: 'text-xs leading-normal' },
}
const TEXT_TONE: Record<string, string> = {
  default: 'text-fg',
  muted: 'text-muted',
  brand: 'text-brand',
  danger: 'text-danger',
}
const TEXT_WEIGHT: Record<string, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
}
const TEXT_ALIGN: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

registerEmitter('ui-text', (node, _children, ctx, path) => {
  const p = node.props as Record<string, unknown>
  const role = String(p.role ?? 'body')
  const meta = TEXT_ROLE_MAP[role] ?? TEXT_ROLE_MAP.body

  if (hasAnyOverride(ctx, path)) {
    const weightExpr = classMapExpr(ctx, path, 'weight', String(p.weight ?? 'normal'), TEXT_WEIGHT)
    const toneExpr = classMapExpr(ctx, path, 'tone', String(p.tone ?? 'default'), TEXT_TONE)
    const alignExpr = classMapExpr(ctx, path, 'align', String(p.align ?? 'left'), TEXT_ALIGN)
    const contentExpr = textExpr(ctx, path, 'content', String(p.content ?? ''))
    return `<${meta.tag} className={cn(${JSON.stringify(meta.cls)}, ${weightExpr}, ${toneExpr}, ${alignExpr})}>${asJsxText(contentExpr)}</${meta.tag}>`
  }

  const cn = cls(
    meta.cls,
    TEXT_WEIGHT[String(p.weight ?? 'normal')],
    TEXT_TONE[String(p.tone ?? 'default')],
    TEXT_ALIGN[String(p.align ?? 'left')],
  )
  return `<${meta.tag} className="${cn}">${jsxText(String(p.content ?? ''))}</${meta.tag}>`
})

const BADGE_BASE = 'inline-flex items-center justify-center rounded-full px-2 text-[11px] font-medium'
// Flatten (variant, tone) → class string. Keys are 'variant:tone'.
const BADGE_STYLES: Record<string, string> = {
  'solid:neutral': 'bg-fg text-bg',
  'solid:brand': 'bg-brand text-brand-fg',
  'solid:success': 'bg-success text-success-fg',
  'solid:warning': 'bg-warning text-warning-fg',
  'solid:danger': 'bg-danger text-danger-fg',
  'subtle:neutral': 'bg-bg text-fg',
  'subtle:brand': 'bg-brand/15 text-brand',
  'subtle:success': 'bg-success/15 text-success',
  'subtle:warning': 'bg-warning/15 text-warning',
  'subtle:danger': 'bg-danger/15 text-danger',
  'outline:neutral': 'border border-border text-fg',
  'outline:brand': 'border border-brand text-brand',
  'outline:success': 'border border-success text-success',
  'outline:warning': 'border border-warning text-warning',
  'outline:danger': 'border border-danger text-danger',
}

registerEmitter('ui-badge', (node, _children, ctx, path) => {
  const p = node.props as Record<string, unknown>
  const tone = String(p.tone ?? 'brand')
  const variant = String(p.variant ?? 'subtle')

  if (hasAnyOverride(ctx, path)) {
    // For badges, the (variant, tone) pair determines color classes. If either
    // varies, we'd need to enumerate combinations — skip for v1 and just
    // expand each axis independently (only variant or only tone change).
    const labelExpr = textExpr(ctx, path, 'label', String(p.label ?? ''))
    // Build a per-variant-tone class chooser using whichever varies
    // (gracefully degrades to literal classes if neither does).
    const styleKey = `${variant}:${tone}`
    const baseStyles = BADGE_STYLES[styleKey] ?? BADGE_STYLES['subtle:brand']
    // Conservative: emit current static class set + label conditional.
    return `<span className={cn(${JSON.stringify(BADGE_BASE)}, ${JSON.stringify(baseStyles)})}>${asJsxText(labelExpr)}</span>`
  }

  const styleKey = `${variant}:${tone}`
  const cn = cls(BADGE_BASE, BADGE_STYLES[styleKey] ?? BADGE_STYLES['subtle:brand'])
  return `<span className="${cn}">${jsxText(String(p.label ?? ''))}</span>`
})

registerEmitter('ui-avatar', node => {
  const p = node.props as Record<string, unknown>
  const src = String(p.src ?? '')
  const initials = String(p.initials ?? '')
  const shape = String(p.shape ?? 'circle')
  const w = Number(p.w ?? 40)
  const h = Number(p.h ?? 40)
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-token'
  if (src) {
    return `<img src="${src}" alt="${jsxText(initials)}" className="${radius} object-cover" style={{ width: ${w}, height: ${h} }} />`
  }
  return `<div className="${radius} inline-flex items-center justify-center font-semibold bg-bg text-fg" style={{ width: ${w}, height: ${h} }}>${jsxText(initials)}</div>`
})

registerEmitter('ui-checkbox', (node, _children, ctx, path) => {
  ctx.noteInteractive?.()
  ctx.noteNeedsId?.()
  const p = node.props as Record<string, unknown>
  const label = String(p.label ?? '')
  const checked = !!p.checked
  const disabled = !!p.disabled
  const idSuffix = camel(label || 'checkbox')
  const nameAttr = ` name="${idSuffix}"`
  const idExpr = `\`\${_id}-${idSuffix}\``
  const labelJsx = hasAnyOverride(ctx, path)
    ? asJsxText(textExpr(ctx, path, 'label', label))
    : jsxText(label)
  // Lift defaultChecked prop — initial state is `checked` from the canvas,
  // overridable by the caller.
  ctx.noteLiftedProp?.({
    name: idSuffix,
    type: 'boolean',
    optional: true,
  })
  const checkedExpr = `${idSuffix} ?? ${checked ? 'true' : 'false'}`

  // shadcn-mode: Checkbox + Label composition (no longer wrapping label).
  if (ctx.mode === 'shadcn') {
    ctx.noteImport?.('Checkbox', '@/components/ui/checkbox')
    ctx.noteImport?.('Label', '@/components/ui/label')
    return [
      `<div className="flex items-center gap-2${disabled ? ' opacity-50' : ''}">`,
      `  <Checkbox id={${idExpr}}${nameAttr} defaultChecked={${checkedExpr}}${disabled ? ' disabled' : ''} />`,
      `  <Label htmlFor={${idExpr}}>${labelJsx}</Label>`,
      `</div>`,
    ].join('\n')
  }

  return [
    `<label htmlFor={${idExpr}} className="flex items-center gap-2 text-sm text-fg${disabled ? ' opacity-50' : ''}">`,
    `  <input id={${idExpr}}${nameAttr} type="checkbox" defaultChecked={${checkedExpr}}${disabled ? ' disabled' : ''} className="w-4 h-4 rounded border-border accent-brand" />`,
    `  <span>${labelJsx}</span>`,
    `</label>`,
  ].join('\n')
})

registerEmitter('ui-select', (node, _children, ctx, path) => {
  ctx.noteInteractive?.()
  ctx.noteNeedsId?.()
  const p = node.props as Record<string, unknown>
  const label = String(p.label ?? '')
  const placeholder = String(p.placeholder ?? '')
  const idSuffix = camel(label || 'select')
  const nameAttr = ` name="${idSuffix}"`
  const idExpr = `\`\${_id}-${idSuffix}\``
  // Lift defaultValue
  ctx.noteLiftedProp?.({
    name: idSuffix,
    type: 'string',
    optional: true,
  })
  const labelJsx = hasAnyOverride(ctx, path)
    ? asJsxText(textExpr(ctx, path, 'label', label))
    : jsxText(label)
  const placeholderJsx = hasAnyOverride(ctx, path)
    ? asJsxText(textExpr(ctx, path, 'placeholder', placeholder))
    : jsxText(placeholder)
  // Options syntax: comma-separated, each item is either:
  //   "value"             → value is also the visible label
  //   "value|Label text"  → emit value="value">Label text</option>
  const optionsRaw = String(p.options ?? '')
  const optionsList = optionsRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(item => {
      const pipe = item.indexOf('|')
      if (pipe < 0) return { value: item, label: item }
      return { value: item.slice(0, pipe).trim(), label: item.slice(pipe + 1).trim() }
    })
  const lines: string[] = []
  lines.push(`<div className="flex-1 flex flex-col gap-1.5">`)
  if (label) {
    lines.push(`  <label htmlFor={${idExpr}} className="text-xs font-medium text-fg">${labelJsx}</label>`)
  }
  lines.push(
    `  <select id={${idExpr}}${nameAttr} defaultValue={${idSuffix} ?? "${String(p.value ?? '').replace(/"/g, '\\"')}"} className="w-full h-10 px-3 rounded-token border border-border bg-surface text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand/40">`,
  )
  lines.push(`    <option value="" disabled>${placeholderJsx}</option>`)
  for (const opt of optionsList) {
    const safeValue = opt.value.replace(/"/g, '&quot;')
    lines.push(`    <option value="${safeValue}">${jsxText(opt.label)}</option>`)
  }
  lines.push(`  </select>`)
  lines.push(`</div>`)
  return lines.join('\n')
})

registerEmitter('ui-tabs', node => {
  const p = node.props as Record<string, unknown>
  const tabs = String(p.tabs ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const active = Number(p.activeIndex ?? 0)
  const items = tabs
    .map(
      (label, i) =>
        `  <button type="button" className="${
          i === active
            ? 'px-4 h-10 text-sm font-medium text-fg border-b-2 border-brand -mb-px'
            : 'px-4 h-10 text-sm text-muted'
        }">${jsxText(label)}</button>`,
    )
    .join('\n')
  return `<div className="flex items-end border-b border-border">\n${items}\n</div>`
})

// ─── New library shapes ───────────────────────────────────────────────────

registerEmitter('ui-divider', node => {
  const p = node.props as Record<string, unknown>
  const orientation = String(p.orientation ?? 'horizontal')
  const tone = String(p.tone ?? 'border')
  const thickness = Number(p.thickness ?? 1)
  const toneCls =
    tone === 'muted' ? 'bg-fg/10' : tone === 'strong' ? 'bg-fg/30' : 'bg-border'
  if (orientation === 'vertical') {
    return `<div className="${toneCls}" style={{ width: ${thickness}, alignSelf: 'stretch' }} role="separator" aria-orientation="vertical" />`
  }
  return `<div className="${toneCls} w-full" style={{ height: ${thickness} }} role="separator" />`
})

const SWITCH_BASE =
  'inline-flex items-center w-9 h-5 rounded-full relative transition-colors flex-shrink-0'

registerEmitter('ui-switch', (node, _c, ctx, _path) => {
  ctx.noteInteractive?.()
  ctx.noteNeedsId?.()
  const p = node.props as Record<string, unknown>
  const label = String(p.label ?? '')
  const checked = !!p.checked
  const disabled = !!p.disabled
  const idSuffix = camel(label || 'switch')
  ctx.noteLiftedProp?.({ name: idSuffix, type: 'boolean', optional: true })
  const idExpr = `\`\${_id}-${idSuffix}\``
  // Use a real checkbox so the emitted UI is accessible + form-submittable,
  // and present it visually as a switch.
  return [
    `<label htmlFor={${idExpr}} className="inline-flex items-center gap-2 cursor-pointer${disabled ? ' opacity-50' : ''}">`,
    `  <span className="relative">`,
    `    <input type="checkbox" id={${idExpr}} name="${idSuffix}" defaultChecked={${idSuffix} ?? ${checked}} className="peer sr-only" />`,
    `    <span className="${SWITCH_BASE} bg-fg/20 peer-checked:bg-brand peer-focus:ring-2 peer-focus:ring-brand/40" />`,
    `    <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-4" />`,
    `  </span>`,
    `  ${label ? `<span className="text-sm text-fg">${jsxText(label)}</span>` : ''}`,
    `</label>`,
  ].join('\n')
})

registerEmitter('ui-radio', (node, _c, ctx, _path) => {
  ctx.noteInteractive?.()
  ctx.noteNeedsId?.()
  const p = node.props as Record<string, unknown>
  const label = String(p.label ?? '')
  const checked = !!p.checked
  const disabled = !!p.disabled
  const groupName = String(p.name ?? 'group')
  const idSuffix = camel(label || 'radio')
  const idExpr = `\`\${_id}-${idSuffix}\``
  return [
    `<label htmlFor={${idExpr}} className="inline-flex items-center gap-2 cursor-pointer${disabled ? ' opacity-50' : ''}">`,
    `  <input type="radio" id={${idExpr}} name="${groupName}" defaultChecked={${checked}} className="w-4 h-4 accent-brand" />`,
    `  ${label ? `<span className="text-sm text-fg">${jsxText(label)}</span>` : ''}`,
    `</label>`,
  ].join('\n')
})

const TAG_BASE =
  'inline-flex items-center justify-center gap-1 rounded-token border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap'
const TAG_TONE: Record<string, string> = {
  neutral: 'bg-bg text-fg border-border',
  brand: 'bg-brand/10 text-brand border-brand/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
}

registerEmitter('ui-tag', node => {
  const p = node.props as Record<string, unknown>
  const tone = String(p.tone ?? 'neutral')
  const label = String(p.label ?? '')
  const removable = !!p.removable
  const toneCls = TAG_TONE[tone] ?? TAG_TONE.neutral
  if (removable) {
    return [
      `<span className="${TAG_BASE} ${toneCls}">`,
      `  ${jsxText(label)}`,
      `  <button type="button" aria-label="Remove ${label.replace(/"/g, '&quot;')}" className="opacity-60 hover:opacity-100">`,
      `    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>`,
      `  </button>`,
      `</span>`,
    ].join('\n')
  }
  return `<span className="${TAG_BASE} ${toneCls}">${jsxText(label)}</span>`
})

const PROGRESS_TONE: Record<string, string> = {
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

registerEmitter('ui-progress', node => {
  const p = node.props as Record<string, unknown>
  const tone = String(p.tone ?? 'brand')
  const value = Number(p.value ?? 0)
  const max = Number(p.max ?? 100)
  const showLabel = !!p.showLabel
  const toneCls = PROGRESS_TONE[tone] ?? PROGRESS_TONE.brand
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
  const bar = [
    `<div className="flex-1 h-2 bg-fg/10 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={${max}} aria-valuenow={${value}}>`,
    `  <div className="h-full rounded-full ${toneCls}" style={{ width: \`${pct.toFixed(1)}%\` }} />`,
    `</div>`,
  ].join('\n')
  if (!showLabel) return bar
  return [
    `<div className="flex items-center gap-2">`,
    `  ${bar}`,
    `  <span className="text-xs font-medium text-fg/70 tabular-nums">${Math.round(pct)}%</span>`,
    `</div>`,
  ].join('\n')
})

const ALERT_VARIANTS = {
  subtle: {
    info: 'bg-brand/10 text-brand border-brand/30',
    success: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
  },
  solid: {
    info: 'bg-brand text-brand-fg border-brand',
    success: 'bg-success text-success-fg border-success',
    warning: 'bg-warning text-warning-fg border-warning',
    danger: 'bg-danger text-danger-fg border-danger',
  },
  outline: {
    info: 'bg-surface text-brand border-brand',
    success: 'bg-surface text-success border-success',
    warning: 'bg-surface text-warning border-warning',
    danger: 'bg-surface text-danger border-danger',
  },
} as const

registerEmitter('ui-alert', node => {
  const p = node.props as Record<string, unknown>
  const tone = String(p.tone ?? 'info') as keyof (typeof ALERT_VARIANTS)['subtle']
  const variant = String(p.variant ?? 'subtle') as keyof typeof ALERT_VARIANTS
  const title = String(p.title ?? '')
  const description = String(p.description ?? '')
  const styles = (ALERT_VARIANTS[variant] ?? ALERT_VARIANTS.subtle)[tone] ?? ''
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status'
  return [
    `<div role="${role}" className="w-full rounded-token border px-3 py-2 ${styles}">`,
    `  <div className="text-sm font-semibold leading-tight">${jsxText(title)}</div>`,
    description ? `  <div className="text-xs opacity-90 leading-snug mt-0.5">${jsxText(description)}</div>` : '',
    `</div>`,
  ]
    .filter(Boolean)
    .join('\n')
})
