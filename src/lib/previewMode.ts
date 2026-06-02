// Global toggle for hiding all editor chrome (role badges, etc.) on the
// canvas. Useful for screenshots, demos, and any time you want to see what
// the finished UI looks like without the editing affordances.
//
// Persists to localStorage so it survives reloads.

import { atom } from '@tldraw/state'

const STORAGE_KEY = 'tldraw-ui-builder:preview-mode'

function loadFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const previewModeAtom = atom<boolean>('previewMode', loadFromStorage())

export function getPreviewMode(): boolean {
  return previewModeAtom.get()
}

export function setPreviewMode(value: boolean): void {
  previewModeAtom.set(value)
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // ignore
  }
}

export function togglePreviewMode(): void {
  setPreviewMode(!previewModeAtom.get())
}

// React hook — components subscribe via useValue.
export { previewModeAtom }
