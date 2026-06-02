// WCAG relative-luminance + contrast ratio. Used by the Theme panel to warn
// when a foreground/background pair has poor accessibility.

function channelLum(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance(triple: string): number {
  const [r, g, b] = triple
    .split(/\s+/)
    .map(n => Math.max(0, Math.min(255, parseInt(n, 10) || 0)))
  return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b)
}

/** WCAG contrast ratio between two RGB-triple colors. Returns a number in
 *  [1, 21]. ≥4.5 passes WCAG AA for normal text; ≥3 passes for large text. */
export function contrastRatio(fg: string, bg: string): number {
  const lfg = luminance(fg)
  const lbg = luminance(bg)
  const light = Math.max(lfg, lbg)
  const dark = Math.min(lfg, lbg)
  return (light + 0.05) / (dark + 0.05)
}

export interface ContrastVerdict {
  ratio: number
  grade: 'AAA' | 'AA' | 'AA-large' | 'fail'
  passes: boolean
}

export function evaluateContrast(fg: string, bg: string): ContrastVerdict {
  const ratio = contrastRatio(fg, bg)
  let grade: ContrastVerdict['grade']
  if (ratio >= 7) grade = 'AAA'
  else if (ratio >= 4.5) grade = 'AA'
  else if (ratio >= 3) grade = 'AA-large'
  else grade = 'fail'
  return { ratio, grade, passes: ratio >= 4.5 }
}
