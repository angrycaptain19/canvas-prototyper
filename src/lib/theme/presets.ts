// Named theme presets. Each preset is a complete ThemeTokens snapshot plus
// the FontOption id to ensure-load before applying. Clicking a preset in
// the Theme panel swaps every token in one atomic write, so the entire
// canvas re-skins instantly — that's the demo's headline moment.

import { FONT_OPTIONS } from './fonts'
import type { ThemeTokens } from './tokens'

export interface ThemePreset {
  id: string
  label: string
  /** Optional one-liner shown as a tooltip. */
  description?: string
  /** FontOption.id — needed so we can call ensureFontLoaded() for Google
   *  fonts. The font's CSS `family` is baked into tokens.fontSans below. */
  fontId: string
  tokens: ThemeTokens
}

function fontFamily(id: string): string {
  const f = FONT_OPTIONS.find(o => o.id === id)
  if (!f) throw new Error(`Unknown font id: ${id}`)
  return f.family
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'A friendly cool-blue brand on neutral grays.',
    fontId: 'system',
    tokens: {
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
      fontSans: fontFamily('system'),
    },
  },
  {
    id: 'stripe',
    label: 'Stripe',
    description: 'Indigo brand on a polished surface, generous rounding.',
    fontId: 'inter',
    tokens: {
      bg: '247 247 252',
      surface: '255 255 255',
      fg: '26 26 35',
      muted: '110 113 145',
      border: '230 230 242',
      brand: '99 91 255',
      brandFg: '255 255 255',
      success: '24 198 131',
      successFg: '255 255 255',
      warning: '255 162 0',
      warningFg: '23 23 23',
      danger: '235 70 90',
      dangerFg: '255 255 255',
      info: '0 132 255',
      infoFg: '255 255 255',
      radius: 8,
      radiusSm: 6,
      radiusLg: 12,
      fontSans: fontFamily('inter'),
    },
  },
  {
    id: 'linear',
    label: 'Linear',
    description: 'Violet on near-black, tighter radii, dense layouts.',
    fontId: 'plex-sans',
    tokens: {
      bg: '251 251 252',
      surface: '255 255 255',
      fg: '11 14 20',
      muted: '95 99 112',
      border: '230 230 232',
      brand: '94 106 210',
      brandFg: '255 255 255',
      success: '46 160 95',
      successFg: '255 255 255',
      warning: '226 152 14',
      warningFg: '23 23 23',
      danger: '224 36 36',
      dangerFg: '255 255 255',
      info: '14 165 233',
      infoFg: '255 255 255',
      radius: 6,
      radiusSm: 4,
      radiusLg: 8,
      fontSans: fontFamily('plex-sans'),
    },
  },
  {
    id: 'vercel',
    label: 'Vercel',
    description: 'Pure black brand, ultra-minimal monochrome, sharp corners.',
    fontId: 'inter',
    tokens: {
      bg: '250 250 250',
      surface: '255 255 255',
      fg: '23 23 23',
      muted: '102 102 102',
      border: '234 234 234',
      brand: '0 0 0',
      brandFg: '255 255 255',
      success: '50 215 75',
      successFg: '23 23 23',
      warning: '245 184 0',
      warningFg: '23 23 23',
      danger: '232 50 50',
      dangerFg: '255 255 255',
      info: '0 112 243',
      infoFg: '255 255 255',
      radius: 6,
      radiusSm: 4,
      radiusLg: 8,
      fontSans: fontFamily('inter'),
    },
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Warm cream paper, dark serif type, ochre accents.',
    fontId: 'merriweather',
    tokens: {
      bg: '249 245 235',
      surface: '255 252 247',
      fg: '39 32 24',
      muted: '120 105 87',
      border: '232 222 205',
      brand: '186 110 41',
      brandFg: '255 250 240',
      success: '94 122 68',
      successFg: '255 252 247',
      warning: '198 132 51',
      warningFg: '39 32 24',
      danger: '186 67 53',
      dangerFg: '255 252 247',
      info: '79 113 144',
      infoFg: '255 252 247',
      radius: 4,
      radiusSm: 2,
      radiusLg: 8,
      fontSans: fontFamily('merriweather'),
    },
  },
]

export function getPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find(p => p.id === id)
}
