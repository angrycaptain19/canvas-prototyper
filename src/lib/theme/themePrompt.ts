// Build a compact description of the loaded theme to stuff into the
// agent's system prompt. The agent picks tone-based variants (brand /
// success / warning / etc.) — exposing the actual hex values lets it
// reason about visual fit (don't write "the orange CTA" when brand is blue)
// and pick the right tone for status content.

import { tripleToHex, type ThemeTokens } from './tokens'
import { getTheme } from './themeStore'

function describeFont(stack: string): string {
  // First non-system, non-fallback name if any; otherwise note "system".
  const parts = stack
    .split(',')
    .map(s => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
  const systemPrefixes = ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui']
  const first = parts.find(p => !systemPrefixes.includes(p) && p !== 'sans-serif' && p !== 'serif')
  return first ? `${first} (custom)` : 'system fonts'
}

export function buildThemePrompt(tokens: ThemeTokens = getTheme()): string {
  const brand = tripleToHex(tokens.brand)
  const brandFg = tripleToHex(tokens.brandFg)
  const success = tripleToHex(tokens.success)
  const warning = tripleToHex(tokens.warning)
  const danger = tripleToHex(tokens.danger)
  const info = tripleToHex(tokens.info)
  const surface = tripleToHex(tokens.surface)
  const bg = tripleToHex(tokens.bg)
  const fg = tripleToHex(tokens.fg)
  const muted = tripleToHex(tokens.muted)
  const border = tripleToHex(tokens.border)
  const fontDesc = describeFont(tokens.fontSans)

  return [
    '## Loaded theme',
    '',
    "Match this aesthetic. You don't pick literal colors — you pick `tone` values on shapes (brand / success / warning / danger / neutral) which map to these tokens at render time.",
    '',
    `- **Brand**: ${brand} (text on brand: ${brandFg}) — use sparingly for the *primary* action on a screen (one button per section). Don't apply brand tone to everything.`,
    `- **Status**: success ${success}, warning ${warning}, danger ${danger}, info ${info} — pick the tone that semantically matches the content (a confirmation = success, a destructive action = danger).`,
    `- **Surface**: page bg ${bg}, card surface ${surface}, borders ${border}.`,
    `- **Text**: body ${fg}, muted ${muted}.`,
    `- **Radii**: small ${tokens.radiusSm}px, default ${tokens.radius}px, large ${tokens.radiusLg}px.`,
    `- **Font**: ${fontDesc}.`,
    '',
    'Guidance:',
    '- If copy or labels describe a color, match the theme (e.g. don\'t write "green CTA" when brand is blue).',
    '- For pricing/feature comparisons: highlight ONE tier with brand tone; leave others neutral.',
    '- For forms: only Submit/primary actions use brand; Cancel/Back/secondary actions use neutral or outline variants.',
    '- For alerts: pick the tone that matches the severity (use danger for errors, warning for caution, success for confirmations, info for neutral notices).',
  ].join('\n')
}
