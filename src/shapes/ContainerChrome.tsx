// Editor chrome shown on every layout container (Stack / Card / Form / List).
//
// - A faint dashed outline is always visible in edit mode so the user can
//   see container bounds even when no real border / background is set.
// - On hover, a small type-label badge fades in at the top-left. The badge
//   is the selection handle: clicking it selects the shape, which is often
//   the only reliable way to grab a container whose interior is filled by
//   children.
// - Both the outline and the badge disappear entirely in preview mode.

import { useValue } from '@tldraw/state-react'
import { useEditor, type TLShapeId } from 'tldraw'
import { previewModeAtom } from '@/lib/previewMode'

export type ChromeColor = 'zinc' | 'violet' | 'blue' | 'emerald'

// All class strings spelled out statically so Tailwind's JIT can pick them
// up. Tailwind does not parse interpolated class names.
const COLOR_STYLES: Record<
  ChromeColor,
  { outlineRest: string; outlineHover: string; badge: string }
> = {
  zinc: {
    outlineRest: 'outline-zinc-400/40',
    outlineHover: 'group-hover:outline-zinc-500',
    badge: 'bg-zinc-700 hover:bg-zinc-900',
  },
  violet: {
    outlineRest: 'outline-violet-400/40',
    outlineHover: 'group-hover:outline-violet-500',
    badge: 'bg-violet-600 hover:bg-violet-700',
  },
  blue: {
    outlineRest: 'outline-blue-400/40',
    outlineHover: 'group-hover:outline-blue-500',
    badge: 'bg-blue-500 hover:bg-blue-600',
  },
  emerald: {
    outlineRest: 'outline-emerald-400/40',
    outlineHover: 'group-hover:outline-emerald-500',
    badge: 'bg-emerald-600 hover:bg-emerald-700',
  },
}

export interface ContainerChromeProps {
  shapeId: TLShapeId
  label: string
  color: ChromeColor
}

export function ContainerChrome({ shapeId, label, color }: ContainerChromeProps) {
  const editor = useEditor()
  const previewMode = useValue('preview-mode', () => previewModeAtom.get(), [])
  if (previewMode) return null
  // Don't render chrome for synthetic shapes (rendered inside a Component
  // Instance preview). They're a structural visualization, not editable
  // shapes — adding chrome that tries to select a non-existent id breaks.
  if (typeof shapeId === 'string' && shapeId.startsWith('synth:')) return null
  const cls = COLOR_STYLES[color]
  return (
    <>
      <div
        className={[
          'absolute inset-0 rounded-[inherit] pointer-events-none transition-[outline-color]',
          'outline-dashed outline-1 outline-offset-[-1px]',
          cls.outlineRest,
          cls.outlineHover,
        ].join(' ')}
      />
      <button
        type="button"
        title={`Select ${label}`}
        onPointerDown={e => {
          e.stopPropagation()
          editor.select(shapeId)
        }}
        className={[
          'absolute -top-5 left-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded',
          'text-white text-[9px] font-semibold uppercase tracking-wide select-none cursor-pointer',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          cls.badge,
        ].join(' ')}
      >
        {label}
      </button>
    </>
  )
}
