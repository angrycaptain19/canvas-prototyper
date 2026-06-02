// Single source of truth for design tokens. Used by:
// - the live runtime (themeStore writes them to documentElement.style)
// - the emitter (theme.css + tailwind.preset.ts)
// - the Theme panel editor (form fields with grouping)

/** RGB color stored as a space-separated triple ("59 130 246") so it works
 *  with Tailwind's `rgb(var(--ui-x) / <alpha-value>)` pattern. */
export type RgbTriple = string

export interface ThemeTokens {
  // ─── Surface scale ───
  bg: RgbTriple
  surface: RgbTriple
  fg: RgbTriple
  muted: RgbTriple
  border: RgbTriple
  // ─── Brand ───
  brand: RgbTriple
  brandFg: RgbTriple
  // ─── Status ───
  success: RgbTriple
  successFg: RgbTriple
  warning: RgbTriple
  warningFg: RgbTriple
  danger: RgbTriple
  dangerFg: RgbTriple
  info: RgbTriple
  infoFg: RgbTriple
  // ─── Geometry ───
  radius: number
  radiusSm: number
  radiusLg: number
  // ─── Typography ───
  fontSans: string
}

export const DEFAULT_TOKENS: ThemeTokens = {
  bg: '250 250 252',
  surface: '255 255 255',
  fg: '17 24 39',
  muted: '107 114 128',
  border: '229 231 235',
  brand: '59 130 246',
  brandFg: '255 255 255',
  success: '16 185 129',
  successFg: '255 255 255',
  warning: '245 158 11',
  warningFg: '255 255 255',
  danger: '239 68 68',
  dangerFg: '255 255 255',
  info: '14 165 233',
  infoFg: '255 255 255',
  radius: 8,
  radiusSm: 4,
  radiusLg: 14,
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

/** CSS variable name a token writes to on the document root. */
export const CSS_VAR_NAME: Record<keyof ThemeTokens, string> = {
  bg: '--ui-bg',
  surface: '--ui-surface',
  fg: '--ui-fg',
  muted: '--ui-muted',
  border: '--ui-border',
  brand: '--ui-brand',
  brandFg: '--ui-brand-fg',
  success: '--ui-success',
  successFg: '--ui-success-fg',
  warning: '--ui-warning',
  warningFg: '--ui-warning-fg',
  danger: '--ui-danger',
  dangerFg: '--ui-danger-fg',
  info: '--ui-info',
  infoFg: '--ui-info-fg',
  radius: '--ui-radius',
  radiusSm: '--ui-radius-sm',
  radiusLg: '--ui-radius-lg',
  fontSans: '--ui-font-sans',
}

/** Group definitions for the Theme panel UI. */
export interface TokenGroup {
  label: string
  fields: Array<{ key: keyof ThemeTokens; label: string; kind: 'color' | 'number' | 'string' }>
}

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    label: 'Surface',
    fields: [
      { key: 'bg', label: 'Page background', kind: 'color' },
      { key: 'surface', label: 'Surface', kind: 'color' },
      { key: 'border', label: 'Border', kind: 'color' },
    ],
  },
  {
    label: 'Text',
    fields: [
      { key: 'fg', label: 'Body', kind: 'color' },
      { key: 'muted', label: 'Muted', kind: 'color' },
    ],
  },
  {
    label: 'Brand',
    fields: [
      { key: 'brand', label: 'Brand', kind: 'color' },
      { key: 'brandFg', label: 'Brand text', kind: 'color' },
    ],
  },
  {
    label: 'Status',
    fields: [
      { key: 'success', label: 'Success', kind: 'color' },
      { key: 'successFg', label: 'Success text', kind: 'color' },
      { key: 'warning', label: 'Warning', kind: 'color' },
      { key: 'warningFg', label: 'Warning text', kind: 'color' },
      { key: 'danger', label: 'Danger', kind: 'color' },
      { key: 'dangerFg', label: 'Danger text', kind: 'color' },
      { key: 'info', label: 'Info', kind: 'color' },
      { key: 'infoFg', label: 'Info text', kind: 'color' },
    ],
  },
  {
    label: 'Radii',
    fields: [
      { key: 'radiusSm', label: 'Small', kind: 'number' },
      { key: 'radius', label: 'Default', kind: 'number' },
      { key: 'radiusLg', label: 'Large', kind: 'number' },
    ],
  },
  {
    label: 'Typography',
    fields: [{ key: 'fontSans', label: 'Sans font stack', kind: 'string' }],
  },
]

// ─── Hex / RGB conversion ─────────────────────────────────────────────────────

export function tripleToHex(triple: RgbTriple): string {
  const parts = triple.split(/\s+/).map(n => Math.max(0, Math.min(255, parseInt(n, 10) || 0)))
  const [r, g, b] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function hexToTriple(hex: string): RgbTriple {
  const m = hex.replace(/^#/, '').match(/^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/)
  if (!m) return '0 0 0'
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].join(' ')
}
