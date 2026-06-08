import { useEffect, useRef, useState } from 'react'
import { useValue } from '@tldraw/state-react'
import { AlertCircle, Check, Pencil, Plus, RotateCcw, Sparkles, Settings as SettingsIcon, Trash2, X, Loader2 } from 'lucide-react'
import type { Editor, TLShape, TLShapeId } from 'tldraw'
import {
  GenerateError,
  editSelection,
  generateDesignVariants,
  type VariantResult,
} from '@/lib/ai/generate'
import { getApiKey, hasApiKey, setApiKey } from '@/lib/ai/apiKey'
import {
  addVariant,
  deleteVariant,
  getActiveVariantPresets,
  MAX_VARIANTS,
  resetVariants,
  toggleVariant,
  updateVariant,
  variantPresetsAtom,
  type VariantPreset,
} from '@/lib/ai/variantConfig'
import type { ComponentDef } from '@/lib/componentDef'
import { useEditorRef } from '@/lib/editorContext'

function collectUserDefs(editor: Editor): ComponentDef[] {
  const all = editor.store.allRecords() as Array<{ typeName: string }>
  return all.filter(r => r.typeName === 'componentDef') as unknown as ComponentDef[]
}

const CREATE_SUGGESTIONS = [
  'Sign-in form with email and password',
  'Pricing card with three tiers',
  'Settings sidebar with profile, notifications, sign out',
  'Empty state with icon, heading, body, and CTA',
]

const EDIT_SUGGESTIONS = [
  'Use the brand color for the primary action',
  'Make the headings bigger and bolder',
  'Add a fourth row with the same style',
  'Tighten the spacing and reduce padding',
]

function describeSelection(editor: Editor, ids: TLShapeId[]): string {
  if (ids.length === 0) return 'nothing selected'
  if (ids.length === 1) {
    const shape = editor.getShape(ids[0])
    if (!shape) return '1 shape'
    return shapeTypeLabel(shape)
  }
  return `${ids.length} shapes`
}

function shapeTypeLabel(shape: TLShape): string {
  const t = shape.type
  if (t === 'ui-page') return 'this Page'
  if (t === 'ui-card') return 'this Card'
  if (t === 'ui-form') return 'this Form'
  if (t === 'ui-stack') return 'this Stack'
  if (t === 'ui-list') return 'this List'
  if (t === 'ui-button') return 'this Button'
  if (t === 'ui-input') return 'this Input'
  if (t === 'ui-text') return 'this Text'
  if (t.startsWith('ui-')) return `this ${t.slice(3)}`
  return `this ${t}`
}

type VariantStatus =
  | { state: 'idle' }
  | { state: 'working'; iteration: number; toolCalls: number; lastTool: string | null }
  | { state: 'ok'; toolCalls: number; iterations: number }
  | { state: 'error'; message: string }

export function CmdKPalette() {
  const editor = useEditorRef()
  const presets = useValue<VariantPreset[]>(
    'variant-presets',
    () => variantPresetsAtom.get(),
    [],
  )
  const activePresets = presets.filter(p => p.enabled)
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<VariantStatus[]>(
    activePresets.map(() => ({ state: 'idle' as const })),
  )
  // Captured selection at open time — pinned so user typing/canvas changes
  // don't move the goalposts mid-flight.
  const [editTargets, setEditTargets] = useState<TLShapeId[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const mode: 'create' | 'edit' = editTargets.length > 0 ? 'edit' : 'create'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (isCmdK) {
        e.preventDefault()
        setOpen(o => {
          if (!o && editor) {
            // Snapshot selection at the moment the palette opens.
            const ids = editor.getSelectedShapeIds()
            setEditTargets(ids)
          }
          return !o
        })
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, editor])

  useEffect(() => {
    if (open) {
      // Autofocus when opened
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setError(null)
      setStatuses(getActiveVariantPresets().map(() => ({ state: 'idle' as const })))
      setEditTargets([])
    }
  }, [open])

  const submit = async () => {
    if (!editor) return
    if (!prompt.trim()) return
    if (!hasApiKey()) {
      setShowSettings(true)
      return
    }
    setLoading(true)
    setError(null)

    if (mode === 'edit') {
      // Single-agent edit run against the snapshotted selection.
      setStatuses([
        { state: 'working', iteration: 0, toolCalls: 0, lastTool: null },
      ])
      const result = await editSelection(editor, prompt, editTargets, {
        userDefs: collectUserDefs(editor),
        onProgress: ev => {
          setStatuses(prev => {
            const cur = prev[0] ?? { state: 'idle' as const }
            if (ev.kind === 'iteration_finished') {
              if (cur.state !== 'working') return prev
              return [{ ...cur, iteration: ev.iteration + 1 }]
            }
            if (cur.state !== 'working') return prev
            return [
              {
                state: 'working',
                iteration: ev.iteration ?? cur.iteration,
                toolCalls: ev.kind === 'tool_used' ? cur.toolCalls + 1 : cur.toolCalls,
                lastTool: ev.kind === 'tool_used' ? ev.name : cur.lastTool,
              },
            ]
          })
        },
      })
      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      // Keep the original selection — gives the user a clean "now look at
      // what changed" beat.
      editor.select(...editTargets)
      setLoading(false)
      setOpen(false)
      setPrompt('')
      return
    }

    // Create mode — parallel variants per the user's enabled presets.
    setStatuses(
      activePresets.map(() => ({
        state: 'working' as const,
        iteration: 0,
        toolCalls: 0,
        lastTool: null,
      })),
    )

    let results: VariantResult[]
    try {
      results = await generateDesignVariants(editor, prompt, {
        userDefs: collectUserDefs(editor),
        onProgress: ev => {
          setStatuses(prev => {
            const next = prev.slice()
            const cur = next[ev.index]
            if (ev.kind === 'error') {
              next[ev.index] = { state: 'error', message: shortError(ev.message ?? 'unknown error') }
            } else if (ev.kind === 'done') {
              if (cur.state === 'working') {
                next[ev.index] = {
                  state: 'ok',
                  toolCalls: cur.toolCalls,
                  iterations: (ev.iteration ?? 0) + 1,
                }
              }
            } else if (cur.state === 'working') {
              next[ev.index] = {
                state: 'working',
                iteration: ev.iteration ?? cur.iteration,
                toolCalls: ev.kind === 'tool_used' ? cur.toolCalls + 1 : cur.toolCalls,
                lastTool: ev.kind === 'tool_used' ? (ev.toolName ?? cur.lastTool) : cur.lastTool,
              }
            }
            return next
          })
        },
      })
    } catch (err) {
      const msg = err instanceof GenerateError ? err.message : (err as Error).message
      setError(msg)
      setLoading(false)
      return
    }

    const successes = results.filter(r => r.rootIds.length > 0 && r.pageId)
    if (successes.length === 0) {
      setError(
        `All ${results.length} variants failed:\n` +
          results.map(r => `• ${r.label}: ${shortError(r.error ?? 'unknown error')}`).join('\n'),
      )
      setLoading(false)
      return
    }

    // Select the new PageFrames so they're easy to inspect.
    editor.select(...successes.map(s => s.pageId!))
    editor.zoomToSelectionIfOffscreen?.()
    setLoading(false)
    setOpen(false)
    setPrompt('')
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 pt-[18vh]"
          onClick={e => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="bg-white w-full max-w-xl rounded-xl border border-[#ebebeb] shadow-[0_16px_48px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#ebebeb]">
              {mode === 'edit' ? (
                <Pencil className="w-4 h-4 text-amber-600" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#0a0a0a]" />
              )}
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {mode === 'edit'
                  ? `Edit ${describeSelection(editor!, editTargets)}`
                  : 'Generate UI'}
              </div>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-900 hover:bg-[#f5f5f5] transition-colors"
                title="Settings"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-900 hover:bg-[#f5f5f5] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder={
                mode === 'edit'
                  ? 'Describe the change… (Cmd/Ctrl + Enter to apply, Shift+Enter for newline)'
                  : 'Describe a UI… (Cmd/Ctrl + Enter to generate, Shift+Enter for newline)'
              }
              rows={3}
              disabled={loading}
              className="px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 bg-transparent border-0 outline-none resize-none disabled:opacity-50"
            />
            {mode === 'create' && !loading && (
              <div className="border-t border-[#ebebeb] px-3 py-2 flex items-center gap-1.5 flex-wrap">
                {presets.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleVariant(p.id)}
                    title={p.hint}
                    className={
                      'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ' +
                      (p.enabled
                        ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] hover:bg-[#262626]'
                        : 'bg-white text-zinc-500 border-[#ebebeb] hover:border-zinc-400 hover:text-zinc-900')
                    }
                  >
                    {p.enabled && <Check className="w-2.5 h-2.5" />}
                    {p.label}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="text-[11px] text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Customize…
                </button>
              </div>
            )}
            {loading && (
              <div className="border-t border-[#ebebeb] px-3 py-2 space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold px-1">
                  {mode === 'edit'
                    ? 'Editing selection'
                    : `Generating ${activePresets.length} variant${activePresets.length === 1 ? '' : 's'}`}
                </div>
                {mode === 'edit' ? (
                  <VariantRow label="Editing" status={statuses[0] ?? { state: 'idle' }} />
                ) : (
                  activePresets.map((p, i) => (
                    <VariantRow key={p.id} label={p.label} status={statuses[i]} />
                  ))
                )}
              </div>
            )}
            {error && (
              <div className="px-4 py-2 border-t border-red-500/20 bg-red-500/5 text-xs text-red-600 whitespace-pre-wrap">
                {error}
              </div>
            )}
            {!loading && !error && prompt.length === 0 && (
              <div className="border-t border-[#ebebeb] px-2 py-2 space-y-0.5">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">
                  Try
                </div>
                {(mode === 'edit' ? EDIT_SUGGESTIONS : CREATE_SUGGESTIONS).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPrompt(s)}
                    className="w-full text-left px-2 py-1.5 text-xs text-zinc-900 hover:bg-[#f5f5f5] rounded transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[#ebebeb]">
              <div className="flex-1 text-[10px] text-zinc-500">
                {hasApiKey() ? 'Sonnet 4.6' : 'No API key set'}
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={loading || !prompt.trim()}
                className={
                  'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
                  (mode === 'edit'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-[#0a0a0a] hover:bg-[#262626]')
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {mode === 'edit' ? 'Editing…' : 'Generating…'}
                  </>
                ) : mode === 'edit' ? (
                  <>
                    <Pencil className="w-3.5 h-3.5" />
                    Apply edit
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate {activePresets.length} variant{activePresets.length === 1 ? '' : 's'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  )
}

function VariantRow({ label, status }: { label: string; status: VariantStatus }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1 text-xs">
      <span className="w-5 flex items-center justify-center">
        {status.state === 'working' && (
          <Loader2 className="w-3 h-3 animate-spin text-[#0a0a0a]" />
        )}
        {status.state === 'ok' && <Check className="w-3 h-3 text-emerald-500" />}
        {status.state === 'error' && (
          <AlertCircle className="w-3 h-3 text-red-500" />
        )}
      </span>
      <span className="font-medium text-zinc-900 w-20">{label}</span>
      <span className="flex-1 text-[11px] text-zinc-500 truncate">
        {status.state === 'working' &&
          (status.lastTool
            ? `${describeTool(status.lastTool)} · step ${status.iteration + 1}, ${status.toolCalls} ${status.toolCalls === 1 ? 'call' : 'calls'}`
            : 'Thinking…')}
        {status.state === 'ok' &&
          `Ready (${status.iterations} ${status.iterations === 1 ? 'step' : 'steps'}, ${status.toolCalls} ${status.toolCalls === 1 ? 'call' : 'calls'})`}
        {status.state === 'error' && status.message}
      </span>
    </div>
  )
}

function describeTool(name: string): string {
  switch (name) {
    case 'add_subtree':
      return 'Building…'
    case 'update_shape':
      return 'Refining…'
    case 'delete_shape':
      return 'Removing…'
    case 'get_canvas_state':
      return 'Inspecting…'
    case 'screenshot':
      return 'Reviewing render…'
    case 'finish':
      return 'Finishing…'
    default:
      return name
  }
}

function shortError(msg: string): string {
  // Validation errors can be paragraphs long — keep the first line for the row.
  const firstLine = msg.split('\n')[0].trim()
  return firstLine.length > 120 ? firstLine.slice(0, 117) + '…' : firstLine
}

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [key, setKey] = useState('')
  const presets = useValue<VariantPreset[]>(
    'variant-presets',
    () => variantPresetsAtom.get(),
    [],
  )
  useEffect(() => {
    if (open) setKey(getApiKey() ?? '')
  }, [open])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white w-full max-w-lg rounded-md border border-[#ebebeb] shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebebeb]">
          <div className="text-base font-semibold text-zinc-900">AI settings</div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-900 hover:bg-[#f5f5f5] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto">
          <div className="p-4 space-y-3 border-b border-[#ebebeb]">
            <div>
              <label className="text-xs font-medium text-zinc-900">Anthropic API key</label>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Stored locally in this browser. Get one at{' '}
                <span className="text-[#0a0a0a] underline underline-offset-2">console.anthropic.com</span>.
              </p>
              <input
                type="password"
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder="sk-ant-…"
                className="mt-2 w-full text-xs bg-white border border-[#ebebeb] rounded-md px-2 py-1.5 text-zinc-900 focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10 font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setApiKey('')
                  setKey('')
                }}
                className="text-xs px-2 py-1 rounded text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setApiKey(key)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#0a0a0a] text-white hover:bg-[#262626] transition-colors"
              >
                Save key
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-xs font-medium text-zinc-900">Generation variants</div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Each enabled variant runs as its own parallel agent with the style hint appended to your prompt.
                </p>
              </div>
              <button
                type="button"
                onClick={resetVariants}
                className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
            <div className="space-y-2">
              {presets.map(p => (
                <VariantPresetRow key={p.id} preset={p} canDelete={presets.length > 1} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => addVariant()}
              disabled={presets.length >= MAX_VARIANTS}
              className="w-full inline-flex items-center justify-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-md border border-dashed border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" />
              {presets.length >= MAX_VARIANTS
                ? `Max ${MAX_VARIANTS} variants`
                : 'Add variant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function VariantPresetRow({ preset, canDelete }: { preset: VariantPreset; canDelete: boolean }) {
  return (
    <div
      className={
        'rounded-md border p-2.5 transition-colors ' +
        (preset.enabled
          ? 'border-[#0a0a0a]/30 bg-[#0a0a0a]/[0.02]'
          : 'border-[#ebebeb] bg-white')
      }
    >
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={preset.enabled}
            onChange={() => toggleVariant(preset.id)}
            className="w-3.5 h-3.5 accent-[#0a0a0a]"
          />
        </label>
        <input
          type="text"
          value={preset.label}
          onChange={e => updateVariant(preset.id, { label: e.target.value })}
          placeholder="Label"
          className="flex-1 text-xs font-medium bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-[#ebebeb] rounded px-1 py-0.5 text-zinc-900"
        />
        {canDelete && (
          <button
            type="button"
            onClick={() => deleteVariant(preset.id)}
            title="Delete variant"
            className="inline-flex items-center justify-center w-6 h-6 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      <textarea
        value={preset.hint}
        onChange={e => updateVariant(preset.id, { hint: e.target.value })}
        placeholder="Style direction appended to the prompt…"
        rows={2}
        className="mt-1.5 w-full text-[11px] bg-white border border-[#ebebeb] rounded px-2 py-1 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:border-[#0a0a0a] focus:ring-1 focus:ring-[#0a0a0a]/10 resize-none"
      />
    </div>
  )
}
