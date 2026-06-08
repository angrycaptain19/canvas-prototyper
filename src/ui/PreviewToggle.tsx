// Preview-mode toggle, rendered in the app header. Toggles preview mode
// (hides editor chrome like role badges) globally. `P` is the shortcut.

import { useValue } from '@tldraw/state-react'
import { Eye, EyeOff } from 'lucide-react'
import { useEffect } from 'react'
import { previewModeAtom, togglePreviewMode } from '@/lib/previewMode'

export function PreviewToggle() {
  const previewMode = useValue('preview-mode', () => previewModeAtom.get(), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // `P` toggles preview mode. Ignore when typing in a text field so it
      // doesn't get swallowed by the canvas/inspector.
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() !== 'p') return
      e.preventDefault()
      togglePreviewMode()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <button
      type="button"
      onClick={togglePreviewMode}
      title={previewMode ? 'Show editor chrome (P)' : 'Hide editor chrome (P)'}
      className={
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium border transition-colors ' +
        (previewMode
          ? 'bg-white text-[#0a0a0a] border-white hover:bg-white/90'
          : 'bg-white/[0.04] text-white/80 border-white/15 hover:bg-white/[0.1]')
      }
    >
      {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      {previewMode ? 'Preview' : 'Edit'}
    </button>
  )
}
