// Helpers for emitting prop values that may have variant overrides. Each
// helper returns a string suitable for inline use in emitted JSX/code.

import type { EmitContext } from './emitTree'
import { comboToCondition } from './treeDiff'

/** Returns a JS expression for a text/string prop value. Either a quoted
 *  string literal (no overrides) or a ternary chain (most-specific first). */
export function textExpr(
  ctx: EmitContext,
  path: string,
  propKey: string,
  defaultValue: string,
): string {
  const overrides = ctx.overrides?.get(path)?.get(propKey)
  if (!overrides || overrides.size === 0) {
    return JSON.stringify(defaultValue)
  }
  // Most-specific (more axes) first so JS short-circuit picks correctly.
  const entries = [...overrides.entries()].sort(
    (a, b) => b[0].split('|').length - a[0].split('|').length,
  )
  let expr = JSON.stringify(defaultValue)
  for (const [combo, val] of entries.slice().reverse()) {
    const cond = comboToCondition(combo, ctx.axes ?? [])
    expr = `(${cond} ? ${JSON.stringify(String(val))} : ${expr})`
  }
  return expr
}

/** Returns a JS expression for a boolean prop. */
export function boolExpr(
  ctx: EmitContext,
  path: string,
  propKey: string,
  defaultValue: boolean,
): string {
  const overrides = ctx.overrides?.get(path)?.get(propKey)
  if (!overrides || overrides.size === 0) return defaultValue ? 'true' : 'false'
  const entries = [...overrides.entries()].sort(
    (a, b) => b[0].split('|').length - a[0].split('|').length,
  )
  let expr = defaultValue ? 'true' : 'false'
  for (const [combo, val] of entries.slice().reverse()) {
    const cond = comboToCondition(combo, ctx.axes ?? [])
    expr = `(${cond} ? ${val ? 'true' : 'false'} : ${expr})`
  }
  return expr
}

/** Returns a JS expression for a className segment that depends on the value
 *  of a discrete prop (variant, size, tone, …). The classMap maps each
 *  possible value to its class string. */
export function classMapExpr(
  ctx: EmitContext,
  path: string,
  propKey: string,
  defaultValue: string,
  classMap: Record<string, string>,
): string {
  const overrides = ctx.overrides?.get(path)?.get(propKey)
  const defaultClasses = classMap[defaultValue] ?? ''
  if (!overrides || overrides.size === 0) return JSON.stringify(defaultClasses)
  const entries = [...overrides.entries()].sort(
    (a, b) => b[0].split('|').length - a[0].split('|').length,
  )
  let expr = JSON.stringify(defaultClasses)
  for (const [combo, val] of entries.slice().reverse()) {
    const cond = comboToCondition(combo, ctx.axes ?? [])
    const classes = classMap[String(val)] ?? ''
    expr = `(${cond} ? ${JSON.stringify(classes)} : ${expr})`
  }
  return expr
}

/** Whether ANY prop on this path has an override — used to decide whether to
 *  emit `className={cn(...)}` vs `className="..."`. */
export function hasAnyOverride(ctx: EmitContext, path: string): boolean {
  const m = ctx.overrides?.get(path)
  return !!m && m.size > 0
}

/** Whether a specific prop key has overrides at this path. */
export function hasOverride(ctx: EmitContext, path: string, propKey: string): boolean {
  return !!ctx.overrides?.get(path)?.get(propKey)?.size
}

/** Wrap a text expression appropriately for JSX text-content position:
 *  - literal "..."  → unquoted text (raw)
 *  - any other expr → wrapped in `{expr}` */
export function asJsxText(expr: string): string {
  // A trivial string literal (no template literal needed) gets unwrapped.
  // Match `"text"` exactly — JSON.stringify always uses double quotes.
  const m = expr.match(/^"((?:[^"\\]|\\.)*)"$/)
  if (m) {
    // Unescape JSON escapes (we only care about \" and \\)
    return m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return `{${expr}}`
}
