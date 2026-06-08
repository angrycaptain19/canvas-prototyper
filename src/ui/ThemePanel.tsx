import { useState } from 'react'
import { useValue } from '@tldraw/state-react'
import { Check, Copy, RotateCcw, X } from 'lucide-react'
import { emitTheme } from '@/lib/emitter/emitTheme'
import {
  applyThemePreset,
  getThemeAtom,
  resetTheme,
  setToken,
} from '@/lib/theme/themeStore'
import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/presets'
import {
  hexToTriple,
  TOKEN_GROUPS,
  tripleToHex,
  type ThemeTokens,
} from '@/lib/theme/tokens'
import {
  ensureFontLoaded,
  FONT_OPTIONS,
  findFontByFamily,
  type FontOption,
} from '@/lib/theme/fonts'
import { evaluateContrast } from '@/lib/theme/contrast'

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = 'edit' | 'code'

export function ThemePanel({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('edit')
  const tokens = useValue('theme tokens', () => getThemeAtom().get(), [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-xl border border-[#ebebeb] shadow-[0_16px_48px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebebeb]">
          <div className="flex items-center gap-3">
            <div className="text-base font-semibold text-zinc-900">Theme</div>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setTab('edit')}
                className={
                  'px-2 py-1 rounded ' +
                  (tab === 'edit' ? 'bg-zinc-100 text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900')
                }
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setTab('code')}
                className={
                  'px-2 py-1 rounded ' +
                  (tab === 'code' ? 'bg-zinc-100 text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900')
                }
              >
                Code
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all theme tokens to defaults?')) resetTheme()
              }}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 hover:bg-[#f5f5f5] px-2 py-1 rounded transition-colors"
              title="Restore defaults"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-900 hover:bg-[#f5f5f5] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <PresetRow tokens={tokens} />

        {tab === 'edit' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {TOKEN_GROUPS.map(group => (
              <section key={group.label}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  {group.label}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.fields.map(field => (
                    <Field key={field.key} field={field} tokens={tokens} />
                  ))}
                </div>
              </section>
            ))}
            <ContrastReport tokens={tokens} />
          </div>
        ) : (
          <ThemeCodeView />
        )}

        <div className="border-t border-[#ebebeb] px-4 py-2 text-[11px] text-zinc-500">
          Changes apply live to the canvas. They're persisted in this browser; export them via the Code tab.
        </div>
      </div>
    </div>
  )
}

function Field({
  field,
  tokens,
}: {
  field: { key: keyof ThemeTokens; label: string; kind: 'color' | 'number' | 'string' }
  tokens: ThemeTokens
}) {
  const value = tokens[field.key]
  if (field.kind === 'color') {
    const hex = tripleToHex(value as string)
    return (
      <label className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-[#f5f5f5]/50 transition-colors">
        <input
          type="color"
          value={hex}
          onChange={e => setToken(field.key, hexToTriple(e.target.value) as never)}
          className="w-7 h-7 rounded cursor-pointer"
          style={{ padding: 0, border: '1px solid rgb(var(--ui-border))' }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-zinc-900 truncate">{field.label}</div>
          <div className="text-[10px] font-mono text-zinc-500 truncate">{hex}</div>
        </div>
      </label>
    )
  }
  if (field.kind === 'number') {
    return (
      <label className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-[#f5f5f5]/50 transition-colors">
        <input
          type="number"
          value={value as number}
          min={0}
          max={48}
          onChange={e => {
            const n = Number(e.target.value)
            if (!Number.isNaN(n)) setToken(field.key, n as never)
          }}
          className="w-16 text-xs bg-white border border-[#ebebeb] rounded-md px-2 py-1 text-zinc-900 focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10"
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-zinc-900 truncate">{field.label}</div>
          <div className="text-[10px] text-zinc-500">px</div>
        </div>
      </label>
    )
  }
  // The only 'string' field today is `fontSans` — render the proper picker.
  if (field.key === 'fontSans') {
    return <FontPicker label={field.label} value={value as string} />
  }
  return (
    <label className="flex flex-col gap-1 py-1.5 px-2 col-span-2 rounded hover:bg-[#f5f5f5]/50 transition-colors">
      <div className="text-xs text-zinc-900">{field.label}</div>
      <input
        type="text"
        value={value as string}
        onChange={e => setToken(field.key, e.target.value as never)}
        className="w-full text-xs bg-white border border-[#ebebeb] rounded-md px-2 py-1 text-zinc-900 font-mono focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10"
      />
    </label>
  )
}

function ContrastReport({ tokens }: { tokens: ThemeTokens }) {
  // Pairs the user is likely to care about: every status color with its fg,
  // plus body/muted text on surface + page bg.
  const PAIRS: Array<{ label: string; fg: keyof ThemeTokens; bg: keyof ThemeTokens }> = [
    { label: 'Brand · text on brand', fg: 'brandFg', bg: 'brand' },
    { label: 'Success · text on success', fg: 'successFg', bg: 'success' },
    { label: 'Warning · text on warning', fg: 'warningFg', bg: 'warning' },
    { label: 'Danger · text on danger', fg: 'dangerFg', bg: 'danger' },
    { label: 'Info · text on info', fg: 'infoFg', bg: 'info' },
    { label: 'Body · fg on surface', fg: 'fg', bg: 'surface' },
    { label: 'Body · fg on page', fg: 'fg', bg: 'bg' },
    { label: 'Muted · muted on surface', fg: 'muted', bg: 'surface' },
  ]
  return (
    <section>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
        Contrast (WCAG)
      </div>
      <div className="space-y-1">
        {PAIRS.map(pair => (
          <ContrastRow
            key={pair.label}
            label={pair.label}
            fg={tokens[pair.fg] as string}
            bg={tokens[pair.bg] as string}
          />
        ))}
      </div>
    </section>
  )
}

function ContrastRow({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  const { ratio, grade, passes } = evaluateContrast(fg, bg)
  const badgeCls =
    grade === 'AAA'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : grade === 'AA'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : grade === 'AA-large'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-red-50 text-red-700 border-red-200'
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#f5f5f5]/50 transition-colors">
      <span
        className="w-7 h-7 rounded-md border border-[#ebebeb] flex-shrink-0 inline-flex items-center justify-center text-[10px] font-semibold"
        style={{
          backgroundColor: `rgb(${bg})`,
          color: `rgb(${fg})`,
        }}
      >
        Aa
      </span>
      <div className="flex-1 min-w-0 text-xs text-zinc-900 truncate">{label}</div>
      <div
        className={
          'text-[10px] font-mono px-1.5 py-0.5 rounded border ' + badgeCls
        }
        title={passes ? 'Passes WCAG AA' : 'Below WCAG AA — text may be hard to read'}
      >
        {ratio.toFixed(2)}:1 · {grade}
      </div>
    </div>
  )
}

function FontPicker({ label, value }: { label: string; value: string }) {
  const current: FontOption =
    findFontByFamily(value) ?? FONT_OPTIONS[0]

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const font = FONT_OPTIONS.find(f => f.id === e.target.value)
    if (!font) return
    ensureFontLoaded(font)
    setToken('fontSans', font.family)
  }

  // Preload all Google fonts on first render so the dropdown options can
  // preview in their own face. Cheap (link tags dedupe).
  for (const f of FONT_OPTIONS) ensureFontLoaded(f)

  const grouped: Record<FontOption['category'], FontOption[]> = {
    system: [],
    sans: [],
    serif: [],
    mono: [],
  }
  for (const f of FONT_OPTIONS) grouped[f.category].push(f)
  const labels: Record<FontOption['category'], string> = {
    system: 'System',
    sans: 'Sans-serif',
    serif: 'Serif',
    mono: 'Mono',
  }

  return (
    <label className="flex flex-col gap-2 py-1.5 px-2 col-span-2 rounded hover:bg-[#f5f5f5]/50 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-900">{label}</span>
        <span className="text-[10px] text-zinc-500 truncate">{current.label}</span>
      </div>
      <select
        value={current.id}
        onChange={onChange}
        className="w-full text-xs bg-white border border-[#ebebeb] rounded-md px-2 py-1.5 text-zinc-900 focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10"
      >
        {(['system', 'sans', 'serif', 'mono'] as const).map(cat => (
          <optgroup key={cat} label={labels[cat]}>
            {grouped[cat].map(f => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div
        className="text-base text-zinc-900 px-2 py-2 rounded bg-zinc-50 border border-[#ebebeb]"
        style={{ fontFamily: current.family }}
      >
        The quick brown fox jumps over the lazy dog.
        <div className="text-xs text-zinc-500 mt-1">0123456789 — AaBbCc</div>
      </div>
    </label>
  )
}

function ThemeCodeView() {
  const files = emitTheme()
  const [activeIdx, setActiveIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const file = files[activeIdx]
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(file.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[#ebebeb] bg-zinc-100/50">
        {files.map((f, i) => (
          <button
            key={f.filename}
            type="button"
            onClick={() => setActiveIdx(i)}
            className={
              'text-[11px] font-mono px-2 py-1 rounded transition-colors ' +
              (i === activeIdx
                ? 'bg-white text-zinc-900 border border-[#ebebeb]'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-white')
            }
          >
            {f.filename}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCopy}
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
      </div>
      <pre className="flex-1 overflow-auto px-4 py-3 m-0 text-[12px] leading-relaxed font-mono text-zinc-900 whitespace-pre">
{file.code}
      </pre>
    </div>
  )
}

// ─── Preset row ────────────────────────────────────────────────────────────

function PresetRow({ tokens }: { tokens: ThemeTokens }) {
  return (
    <div className="px-4 py-2 border-b border-[#ebebeb] flex items-center gap-1.5 overflow-x-auto">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold mr-1 flex-shrink-0">
        Preset
      </div>
      {THEME_PRESETS.map(preset => {
        const active = isPresetMatch(preset, tokens)
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyThemePreset(preset)}
            title={preset.description}
            className={
              'inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border transition-colors flex-shrink-0 ' +
              (active
                ? 'border-[#0a0a0a] bg-[#0a0a0a]/[0.06] text-[#0a0a0a]'
                : 'border-[#ebebeb] bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50')
            }
          >
            <PresetSwatch preset={preset} />
            {preset.label}
          </button>
        )
      })}
    </div>
  )
}

function PresetSwatch({ preset }: { preset: ThemePreset }) {
  return (
    <span
      className="inline-flex w-3.5 h-3.5 rounded-full border"
      style={{
        backgroundColor: `rgb(${preset.tokens.brand})`,
        borderColor: `rgb(${preset.tokens.border})`,
      }}
    />
  )
}

/** Compare brand + surface + radius + font as a cheap "is this preset
 *  currently active" check. The user might have tweaked a single token
 *  after applying — in that case no chip is highlighted, which is fine. */
function isPresetMatch(preset: ThemePreset, tokens: ThemeTokens): boolean {
  return (
    preset.tokens.brand === tokens.brand &&
    preset.tokens.surface === tokens.surface &&
    preset.tokens.fg === tokens.fg &&
    preset.tokens.radius === tokens.radius &&
    preset.tokens.fontSans === tokens.fontSans
  )
}
