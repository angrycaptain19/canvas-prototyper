// User-provided Anthropic API key. Stored in localStorage (browser-side
// development convenience; in production you'd proxy through a backend).

const KEY = 'tldraw-ui-builder:anthropic-key'

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setApiKey(key: string) {
  try {
    if (key.trim().length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, key.trim())
  } catch {
    // ignore
  }
}

export function hasApiKey(): boolean {
  const k = getApiKey()
  return !!k && k.length > 0
}
