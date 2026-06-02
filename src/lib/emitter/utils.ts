// Codegen helpers — string formatting, Tailwind value conversion, identifier
// sanitization.

/** Convert a px value to a Tailwind spacing token. Multiples of 4 use the
 *  scale; other values use arbitrary-value syntax `[16px]`. */
export function tw(px: number): string {
  if (!Number.isFinite(px)) return '0'
  if (px % 4 === 0 && px >= 0) {
    const n = px / 4
    return n.toString()
  }
  return `[${Math.round(px)}px]`
}

/** PascalCase identifier from an arbitrary name.
 *  Handles already-Pascal/camelCase input by splitting on case boundaries
 *  rather than lowercasing the body of each token. So:
 *    "ActionButton"   → "ActionButton"  (was "Actionbutton")
 *    "place_order"    → "PlaceOrder"
 *    "page 1"         → "Page1"
 *    "MAX_RETRIES"    → "MaxRetries"
 */
export function pascal(name: string): string {
  // Normalize separators to a space, then introduce a space before each
  // capital that follows a lowercase letter or digit. This splits
  // "ActionButton" → ["Action", "Button"] without losing internal caps.
  const withSpaces = name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // "MAXRetries" → "MAX Retries"
    .trim()
  const parts = withSpaces.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Untitled'
  const id = parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('')
  return /^[A-Z]/.test(id) ? id : `C${id}`
}

/** camelCase identifier from an arbitrary name. */
export function camel(name: string): string {
  const p = pascal(name)
  return p.charAt(0).toLowerCase() + p.slice(1)
}

/** Escape `{}<>"\` in a string so it's safe inside JSX text or attribute. */
export function jsxText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
}

/** Join non-empty class strings with a single space. */
export function cls(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.length > 0).join(' ')
}

/** Render a JSX attribute. Strings → `attr="val"`, other → `attr={JSON}`. */
export function attr(name: string, value: unknown): string {
  if (value === undefined || value === null || value === false) return ''
  if (value === true) return name
  if (typeof value === 'string') {
    return `${name}="${value.replace(/"/g, '&quot;')}"`
  }
  return `${name}={${JSON.stringify(value)}}`
}

export function indent(s: string, n: number): string {
  const pad = '  '.repeat(n)
  return s
    .split('\n')
    .map(line => (line.length > 0 ? pad + line : line))
    .join('\n')
}

/** Take a JSX string and rewrite its outermost element's className so it
 *  merges in the user's `className` prop. Handles three cases:
 *   1. `className="..."` literal       → `className={cn("...", className)}`
 *   2. `className={cn("...")}` already → `className={cn("...", className)}`
 *   3. no className on the root tag    → injects `className={className}` */
export function mergeRootClassName(jsx: string, varName: string): string {
  // Match `className="..."` on the first occurrence
  const literalMatch = jsx.match(/className="([^"]*)"/)
  if (literalMatch && jsx.indexOf(literalMatch[0]) === jsx.indexOf('className')) {
    return jsx.replace(literalMatch[0], `className={cn("${literalMatch[1]}", ${varName})}`)
  }
  // Match `className={cn("...")}`
  const cnMatch = jsx.match(/className=\{cn\(([^)]+)\)\}/)
  if (cnMatch && jsx.indexOf(cnMatch[0]) === jsx.indexOf('className')) {
    return jsx.replace(cnMatch[0], `className={cn(${cnMatch[1]}, ${varName})}`)
  }
  // No className on root — inject one
  return jsx.replace(/^(<\w+)/, `$1 className={${varName}}`)
}

/** `cn` helper source used in the shared `_lib.tsx`. */
export const CN_HELPER_SOURCE = `function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}`

/** Walk a template and return the set of paths where a Button is the last
 *  Button child of a Form. The Button emitter consults this to emit
 *  `type="submit"` (no onClick lifted) since the Form handles the submit
 *  via its own onSubmit prop. */
export function findFormSubmitButtonPaths(
  node: import('@/lib/componentDef').TemplateNode,
): Set<string> {
  const out = new Set<string>()
  function walk(n: import('@/lib/componentDef').TemplateNode, path: string) {
    if (n.children) {
      // For a Form, find the last Button among its children.
      if (n.type === 'ui-form') {
        for (let i = n.children.length - 1; i >= 0; i--) {
          if (n.children[i].type === 'ui-button') {
            const childPath = path === '' ? String(i) : `${path}.${i}`
            out.add(childPath)
            break
          }
        }
      }
      for (let i = 0; i < n.children.length; i++) {
        walk(n.children[i], path === '' ? String(i) : `${path}.${i}`)
      }
    }
  }
  walk(node, '')
  return out
}
