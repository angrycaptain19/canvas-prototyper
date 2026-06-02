// Live theme state. Persisted to localStorage, applied to documentElement
// as inline CSS variables so the canvas + everything else updates the moment
// you tweak a token.

import { atom } from '@tldraw/state'
import { ensureFontLoaded, FONT_OPTIONS } from './fonts'
import type { ThemePreset } from './presets'
import { CSS_VAR_NAME, DEFAULT_TOKENS, type ThemeTokens } from './tokens'

const STORAGE_KEY = 'tldraw-ui-builder:theme-v1'

function loadFromStorage(): ThemeTokens {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_TOKENS }
    const parsed = JSON.parse(raw) as Partial<ThemeTokens>
    return { ...DEFAULT_TOKENS, ...parsed }
  } catch {
    return { ...DEFAULT_TOKENS }
  }
}

const themeAtom = atom<ThemeTokens>('theme', loadFromStorage())

function applyToDocument(tokens: ThemeTokens) {
  const root = document.documentElement.style
  for (const [key, varName] of Object.entries(CSS_VAR_NAME) as Array<
    [keyof ThemeTokens, string]
  >) {
    const value = tokens[key]
    let cssValue: string
    if (typeof value === 'number') cssValue = `${value}px`
    else cssValue = String(value)
    root.setProperty(varName, cssValue)
  }
}

function persist(tokens: ThemeTokens) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch {
    // ignore
  }
}

// Apply once on module load so the page reflects the saved state immediately.
if (typeof document !== 'undefined') {
  applyToDocument(themeAtom.get())
}

export function getThemeAtom() {
  return themeAtom
}

export function getTheme(): ThemeTokens {
  return themeAtom.get()
}

export function setToken<K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K]) {
  const next = { ...themeAtom.get(), [key]: value }
  themeAtom.set(next)
  applyToDocument(next)
  persist(next)
}

export function resetTheme() {
  themeAtom.set({ ...DEFAULT_TOKENS })
  applyToDocument(DEFAULT_TOKENS)
  persist(DEFAULT_TOKENS)
}

/** Swap all 18 tokens + font in one atomic write. The whole canvas
 *  re-renders once instead of 18 times, and any Google font the preset
 *  depends on is ensured-loaded before tokens apply so we don't flash
 *  the previous family. */
export function applyThemePreset(preset: ThemePreset) {
  const font = FONT_OPTIONS.find(f => f.id === preset.fontId)
  if (font) ensureFontLoaded(font)
  themeAtom.set({ ...preset.tokens })
  applyToDocument(preset.tokens)
  persist(preset.tokens)
}
