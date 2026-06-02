// Curated font catalogue. System fonts load instantly; Google fonts are
// injected as <link rel="stylesheet"> tags on demand (idempotent).

export interface FontOption {
  id: string
  label: string
  category: 'system' | 'sans' | 'serif' | 'mono'
  /** Full CSS font-family value */
  family: string
  /** If present, this is a Google Font — load via fonts.googleapis.com */
  googleFont?: {
    /** URL slug, e.g. "Inter" or "JetBrains+Mono" */
    family: string
    /** Weight tuple — defaults to "400;500;600;700" if omitted */
    weights?: string
  }
}

export const FONT_OPTIONS: FontOption[] = [
  // ─── System ───
  {
    id: 'system',
    label: 'System default',
    category: 'system',
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    id: 'system-serif',
    label: 'System serif',
    category: 'system',
    family: "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
  },
  {
    id: 'system-mono',
    label: 'System mono',
    category: 'system',
    family:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Cascadia Code', monospace",
  },

  // ─── Sans-serif ───
  {
    id: 'inter',
    label: 'Inter',
    category: 'sans',
    family: "Inter, ui-sans-serif, system-ui, sans-serif",
    googleFont: { family: 'Inter', weights: '400;500;600;700' },
  },
  {
    id: 'roboto',
    label: 'Roboto',
    category: 'sans',
    family: "Roboto, ui-sans-serif, sans-serif",
    googleFont: { family: 'Roboto', weights: '400;500;700' },
  },
  {
    id: 'open-sans',
    label: 'Open Sans',
    category: 'sans',
    family: "'Open Sans', ui-sans-serif, sans-serif",
    googleFont: { family: 'Open+Sans', weights: '400;500;600;700' },
  },
  {
    id: 'lato',
    label: 'Lato',
    category: 'sans',
    family: "Lato, ui-sans-serif, sans-serif",
    googleFont: { family: 'Lato', weights: '400;700' },
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    category: 'sans',
    family: "Montserrat, ui-sans-serif, sans-serif",
    googleFont: { family: 'Montserrat', weights: '400;500;600;700' },
  },
  {
    id: 'poppins',
    label: 'Poppins',
    category: 'sans',
    family: "Poppins, ui-sans-serif, sans-serif",
    googleFont: { family: 'Poppins', weights: '400;500;600;700' },
  },
  {
    id: 'nunito',
    label: 'Nunito',
    category: 'sans',
    family: "Nunito, ui-sans-serif, sans-serif",
    googleFont: { family: 'Nunito', weights: '400;500;600;700' },
  },
  {
    id: 'plex-sans',
    label: 'IBM Plex Sans',
    category: 'sans',
    family: "'IBM Plex Sans', ui-sans-serif, sans-serif",
    googleFont: { family: 'IBM+Plex+Sans', weights: '400;500;600;700' },
  },
  {
    id: 'source-sans',
    label: 'Source Sans 3',
    category: 'sans',
    family: "'Source Sans 3', ui-sans-serif, sans-serif",
    googleFont: { family: 'Source+Sans+3', weights: '400;500;600;700' },
  },

  // ─── Serif ───
  {
    id: 'lora',
    label: 'Lora',
    category: 'serif',
    family: "Lora, ui-serif, serif",
    googleFont: { family: 'Lora', weights: '400;500;600;700' },
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    category: 'serif',
    family: "Merriweather, ui-serif, serif",
    googleFont: { family: 'Merriweather', weights: '400;700' },
  },
  {
    id: 'playfair',
    label: 'Playfair Display',
    category: 'serif',
    family: "'Playfair Display', ui-serif, serif",
    googleFont: { family: 'Playfair+Display', weights: '400;500;600;700' },
  },

  // ─── Mono ───
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    category: 'mono',
    family: "'JetBrains Mono', ui-monospace, monospace",
    googleFont: { family: 'JetBrains+Mono', weights: '400;500;700' },
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    category: 'mono',
    family: "'Fira Code', ui-monospace, monospace",
    googleFont: { family: 'Fira+Code', weights: '400;500;700' },
  },
  {
    id: 'source-code',
    label: 'Source Code Pro',
    category: 'mono',
    family: "'Source Code Pro', ui-monospace, monospace",
    googleFont: { family: 'Source+Code+Pro', weights: '400;500;700' },
  },
]

// ─── Loading ─────────────────────────────────────────────────────────────────

const loadedFontIds = new Set<string>()

export function ensureFontLoaded(font: FontOption) {
  if (!font.googleFont || loadedFontIds.has(font.id)) return
  if (typeof document === 'undefined') return
  const weights = font.googleFont.weights ?? '400;500;600;700'
  const href = `https://fonts.googleapis.com/css2?family=${font.googleFont.family}:wght@${weights}&display=swap`
  // De-dupe: don't add the link twice if it's somehow already there.
  const existing = document.head.querySelector(`link[data-tldraw-ui-font="${font.id}"]`)
  if (existing) {
    loadedFontIds.add(font.id)
    return
  }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.setAttribute('data-tldraw-ui-font', font.id)
  document.head.appendChild(link)
  loadedFontIds.add(font.id)
}

export function findFontByFamily(family: string): FontOption | undefined {
  return FONT_OPTIONS.find(f => f.family === family)
}
