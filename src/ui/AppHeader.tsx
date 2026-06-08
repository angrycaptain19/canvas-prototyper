// The product top bar. A fixed monochrome header frames the whole app so it
// reads as a Vercel/Geist-style property rather than a bare tldraw canvas.
import { PreviewToggle } from '@/ui/PreviewToggle'

export function AppHeader() {
  return (
    <header className="flex items-center h-12 px-3 bg-[#0a0a0a] text-white select-none shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 pr-3">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white"
          aria-hidden
        >
          {/* Geometric mark — a notched square, monochrome */}
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 2H14V14H8L2 8V2Z" fill="#0a0a0a" />
          </svg>
        </span>
        <span className="text-[13px] font-semibold tracking-tight">UI&nbsp;Builder</span>
      </div>

      <div className="w-px h-4 bg-white/15" />

      {/* Project breadcrumb — purely cosmetic framing for now */}
      <div className="flex items-center gap-2 pl-3 text-[13px]">
        <span className="text-white/45">Workspace</span>
        <span className="text-white/25">/</span>
        <span className="text-white/90 font-medium">Untitled project</span>
      </div>

      <div className="flex-1" />

      {/* Right cluster */}
      <div className="flex items-center gap-2">
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 h-6 rounded-md border border-white/15 bg-white/[0.04] text-[11px] font-mono-chrome text-white/55">
          ⌘K
        </kbd>
        <span className="text-[11px] text-white/45 hidden sm:inline pr-1">to generate</span>
        <div className="w-px h-4 bg-white/15 mx-1" />
        <PreviewToggle />
      </div>
    </header>
  )
}
