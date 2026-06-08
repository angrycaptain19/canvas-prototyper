import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import type { Editor, TLShape } from 'tldraw'
import type { ComponentDef } from '@/lib/componentDef'
import { emitComponent, emitPageFromShape, emitTheme, type EmitThemeFile } from '@/lib/emitter'

export type CodePreviewTarget =
  | { kind: 'def'; defId: string }
  | { kind: 'page'; shape: TLShape }
  | { kind: 'theme' }
  | null

interface Props {
  editor: Editor
  target: CodePreviewTarget
  onClose: () => void
}

interface PreviewFile {
  filename: string
  code: string
  language?: string
}

interface PreviewPayload {
  title: string
  files: PreviewFile[]
  uses: ComponentDef[]
  /** Note shown in the footer (e.g. theme requirement reminder). */
  footerNote?: string
}

function build(editor: Editor, target: NonNullable<CodePreviewTarget>): PreviewPayload {
  const getDef = (id: string) =>
    (editor.store.get(id as any) as ComponentDef | undefined) ?? undefined

  if (target.kind === 'theme') {
    const files: EmitThemeFile[] = emitTheme()
    return {
      title: 'Theme',
      files,
      uses: [],
      footerNote:
        'Drop these into a real project to make generated components work out of the box.',
    }
  }

  if (target.kind === 'def') {
    const def = getDef(target.defId)
    if (!def) {
      return {
        title: 'missing component',
        files: [{ filename: 'error.tsx', code: `// component def ${target.defId} not found` }],
        uses: [],
      }
    }
    const result = emitComponent(def, getDef)
    return {
      title: result.componentName,
      files: [{ filename: result.filename, code: result.code, language: 'typescript' }],
      uses: result.uses,
      footerNote: 'Requires the sibling `_lib.tsx` (for `cn`) + the theme deliverable to resolve. Run `npm run sync` for the full project.',
    }
  }

  // page
  const result = emitPageFromShape(editor, target.shape, getDef)
  return {
    title: result.componentName,
    files: [{ filename: result.filename, code: result.code, language: 'typescript' }],
    uses: result.uses,
    footerNote: 'Requires the theme deliverable for `bg-blue-500`, `text-zinc-900`, etc. to resolve.',
  }
}

export function CodePreview({ editor, target, onClose }: Props) {
  const [activeFile, setActiveFile] = useState(0)
  if (!target) return null

  let payload: PreviewPayload
  try {
    payload = build(editor, target)
  } catch (err) {
    payload = {
      title: 'emit error',
      files: [
        {
          filename: 'error',
          code: `// codegen failed: ${(err as Error).message}\n// ${(err as Error).stack ?? ''}`,
        },
      ],
      uses: [],
    }
  }

  const idx = Math.min(activeFile, payload.files.length - 1)
  const file = payload.files[idx]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-xl border border-[#ebebeb] shadow-[0_16px_48px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebebeb]">
          <div className="flex items-baseline gap-3">
            <div className="text-base font-semibold text-zinc-900">{payload.title}</div>
            {payload.uses.length > 0 && (
              <div className="text-[11px] text-zinc-500">
                uses: {payload.uses.map(u => u.name).join(', ')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CopyButton text={file.code} />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-900 hover:bg-[#f5f5f5] transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {payload.files.length > 1 && (
          <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[#ebebeb] bg-zinc-100/50">
            {payload.files.map((f, i) => (
              <button
                key={f.filename}
                type="button"
                onClick={() => setActiveFile(i)}
                className={
                  'text-[11px] font-mono px-2 py-1 rounded transition-colors ' +
                  (i === idx
                    ? 'bg-white text-zinc-900 border border-[#ebebeb]'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-white')
                }
              >
                {f.filename}
              </button>
            ))}
          </div>
        )}
        <pre className="flex-1 overflow-auto px-4 py-3 m-0 text-[12px] leading-relaxed font-mono text-zinc-900 whitespace-pre">
{file.code}
        </pre>
        {payload.footerNote && (
          <div className="border-t border-[#ebebeb] px-4 py-2 text-[11px] text-zinc-500">
            {payload.footerNote}
          </div>
        )}
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors ' +
        (copied
          ? 'bg-[#0a0a0a] text-white'
          : 'border border-[#ebebeb] bg-white text-zinc-900 hover:bg-[#f5f5f5]')
      }
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
