// Persist the tldraw store to localStorage on changes. Hydrate on mount.

import type { Editor } from 'tldraw'

const STORAGE_KEY = 'tldraw-ui-builder:store-v2'
const DEBOUNCE_MS = 400

export function loadSavedSnapshot(): unknown | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.warn('[persistence] failed to read saved snapshot', err)
    return null
  }
}

export function installPersistence(editor: Editor): () => void {
  let timer: number | null = null
  const flush = () => {
    timer = null
    try {
      const snapshot = editor.store.getStoreSnapshot()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch (err) {
      console.warn('[persistence] failed to save snapshot', err)
    }
  }
  const off = editor.store.listen(
    () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(flush, DEBOUNCE_MS)
    },
    { scope: 'document', source: 'user' },
  )
  return () => {
    if (timer !== null) window.clearTimeout(timer)
    off()
  }
}

/** Clear persisted state (for dev / when schema changes incompatibly). */
export function clearPersistedSnapshot() {
  localStorage.removeItem(STORAGE_KEY)
}
