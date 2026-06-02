// Post-process AI-generated trees: clamp heights/widths to sane values,
// drop unknown props, fill missing defaults, wrap non-layout containers
// that hold multiple children in a Stack so content actually flows.

import type { TemplateNode } from '@/lib/componentDef'
import { flattenSchema } from '@/lib/propSchema'
import { getRegistration } from '@/lib/registry'

const TEXT_HEIGHTS: Record<string, number> = {
  heading: 36,
  subheading: 28,
  body: 24,
  caption: 20,
}

const FIXED_HEIGHTS: Record<string, number> = {
  'ui-input': 68,
  'ui-button': 40,
  'ui-checkbox': 24,
  'ui-select': 68,
  'ui-badge': 22,
  'ui-switch': 24,
  'ui-radio': 24,
  'ui-tag': 28,
  'ui-progress': 8,
}

/** Hard ceilings on leaf width — catches AI hallucinations like w=4000. */
const MAX_WIDTHS: Record<string, number> = {
  'ui-button': 480,
  'ui-input': 480,
  'ui-checkbox': 480,
  'ui-select': 480,
  'ui-badge': 200,
  'ui-avatar': 96,
  'ui-text': 720,
  'ui-switch': 320,
  'ui-radio': 320,
  'ui-tag': 240,
  'ui-progress': 720,
  'ui-alert': 720,
}

const SQUARE_LEAVES = new Set(['ui-avatar'])
const STACK_LIKE_TYPES = new Set(['ui-stack', 'ui-form', 'ui-list'])
/** Frame-like surfaces that don't auto-layout their children — direct
 *  multiple children would overlap at (0,0). We auto-wrap them in a Stack. */
const NON_LAYOUT_FRAME_TYPES = new Set(['ui-card', 'ui-page'])

function wrapMultiChildSurface(node: TemplateNode): void {
  if (!NON_LAYOUT_FRAME_TYPES.has(node.type)) return
  if (!node.children || node.children.length < 2) return
  const props = node.props as Record<string, unknown>
  const padding = typeof props.padding === 'number' ? props.padding : 16
  const innerW = Math.max(0, node.w - padding * 2)
  const innerH = Math.max(0, node.h - padding * 2)
  const stackChild: TemplateNode = {
    type: 'ui-stack',
    x: padding,
    y: padding,
    w: innerW,
    h: innerH,
    props: {
      w: innerW,
      h: innerH,
      direction: 'vertical',
      gap: 12,
      padding: 0,
      alignItems: 'stretch',
      justifyContent: 'start',
      background: 'transparent',
    },
    children: node.children,
  }
  node.children = [stackChild]
}

export function normalizeTemplate(node: TemplateNode): void {
  const props = node.props as Record<string, unknown>

  if (node.type === 'ui-text') {
    const role = String(props.role ?? 'body')
    const h = TEXT_HEIGHTS[role] ?? 24
    node.h = h
    props.h = h
  } else if (FIXED_HEIGHTS[node.type] !== undefined) {
    const h = FIXED_HEIGHTS[node.type]
    node.h = h
    props.h = h
  }

  const maxW = MAX_WIDTHS[node.type]
  if (maxW !== undefined) {
    if (typeof node.w !== 'number' || node.w < 32) {
      node.w = Math.min(120, maxW)
    } else if (node.w > maxW) {
      node.w = maxW
    }
    props.w = node.w
  }

  if (SQUARE_LEAVES.has(node.type)) {
    const size = Math.max(node.w, node.h)
    node.w = size
    node.h = size
    props.w = size
    props.h = size
  }

  // Badge / Tag: estimate width from label so the first paint isn't a
  // too-narrow chip that wraps text. The component runs a real DOM
  // measurement on mount and refines.
  if (node.type === 'ui-badge') {
    const label = String(props.label ?? '')
    const estimated = Math.ceil(label.length * 6.2 + 16)
    node.w = Math.max(24, Math.min(240, estimated))
    props.w = node.w
  }
  if (node.type === 'ui-tag') {
    const label = String(props.label ?? '')
    const removable = !!props.removable
    // Tag has slightly more padding (4px each side) + optional × icon (18px).
    const estimated = Math.ceil(label.length * 6.2 + 20 + (removable ? 18 : 0))
    node.w = Math.max(40, Math.min(240, estimated))
    props.w = node.w
  }

  // Horizontal stacks must not use stretch — would equalize child heights.
  if (
    STACK_LIKE_TYPES.has(node.type) &&
    props.direction === 'horizontal' &&
    props.alignItems === 'stretch'
  ) {
    props.alignItems = 'start'
  }

  // Drop unknown props + fill missing defaults from the registry.
  const reg = getRegistration(node.type)
  if (reg) {
    const flat = flattenSchema(reg.schema)
    const allowed = new Set<string>(flat.map(({ key }) => key))
    allowed.add('w')
    allowed.add('h')
    for (const key of Object.keys(props)) {
      if (!allowed.has(key)) delete props[key]
    }
    for (const [key, defaultVal] of Object.entries(reg.defaults)) {
      if (!(key in props)) props[key] = defaultVal
    }
  }

  // Structural fix BEFORE recursing — once wrapped, the new Stack child
  // gets normalized like any other.
  wrapMultiChildSurface(node)

  if (node.children) {
    for (const c of node.children) normalizeTemplate(c)
  }
}
