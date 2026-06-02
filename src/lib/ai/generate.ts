// Multi-variant generation orchestrator. Pre-creates one PageFrame per
// variant, runs an agent in parallel inside each, then re-fits each
// PageFrame to its actual content and lays them out side-by-side.

import { createShapeId, type Editor, type TLShapeId } from 'tldraw'
import type { ComponentDef } from '@/lib/componentDef'
import { runAgent, AgentError, type AgentProgressEvent } from './agent'
import { getActiveVariantPresets, type VariantPreset } from './variantConfig'

export class GenerateError extends Error {}

export interface VariantResult {
  index: number
  label: string
  pageId: TLShapeId | null
  rootIds: TLShapeId[]
  summary: string
  toolCalls: number
  iterations: number
  error: string | null
}

export interface VariantProgress {
  index: number
  label: string
  kind: 'iteration_started' | 'tool_used' | 'iteration_finished' | 'done' | 'error'
  toolName?: string
  iteration?: number
  toolCount?: number
  message?: string
}

export interface GenerateVariantsOptions {
  /** Saved user components made available to the agent. */
  userDefs?: ComponentDef[]
  /** Per-variant progress reporter. */
  onProgress?: (event: VariantProgress) => void
  /** Override which variants to run. If omitted, reads the active set from
   *  variantConfig (user's enabled presets). */
  presets?: VariantPreset[]
}

// Initial placeholder size for the per-variant PageFrame, before the agent
// fills it and we shrink to fit. Roomy enough that the AI never feels boxed
// in by a tiny canvas.
const INITIAL_PAGE_W = 600
const INITIAL_PAGE_H = 900
// Pre-layout, stash the variant PageFrames offscreen-ish so each agent
// can't see the others' work via get_canvas_state. We re-arrange them
// side-by-side at viewport center after everyone finishes.
const STAGING_Y_BASE = -10000
const STAGING_GAP = 200

const FINAL_PAD_X = 60
const FINAL_PAD_Y = 60
const FINAL_GAP = 80

/** Pre-create the PageFrames the agents will work inside. Returns their ids
 *  paired with their assigned variant index. */
function createStagingPages(
  editor: Editor,
  count: number,
  labels: readonly string[],
): TLShapeId[] {
  const ids: TLShapeId[] = []
  editor.run(() => {
    for (let i = 0; i < count; i++) {
      const id = createShapeId()
      editor.createShape({
        id,
        type: 'ui-page',
        // Park far off-screen so the user doesn't see the staging.
        x: 0,
        y: STAGING_Y_BASE + i * (INITIAL_PAGE_H + STAGING_GAP),
        props: {
          w: INITIAL_PAGE_W,
          h: INITIAL_PAGE_H,
          name: labels[i],
          breakpoint: 'desktop',
          background: 'surface',
        },
      })
      ids.push(id)
    }
  })
  return ids
}

/** Move each PageFrame from staging to its final side-by-side position,
 *  shrinking each to the bounds of its content. */
function finalizeLayout(
  editor: Editor,
  results: Array<{ pageId: TLShapeId; rootIds: TLShapeId[] }>,
): void {
  // First pass — compute target dimensions from each page's actual root child.
  const dims = results.map(r => {
    const root = r.rootIds[0] ? editor.getShape(r.rootIds[0]) : null
    const w = root ? ((root.props as any).w ?? 0) + FINAL_PAD_X * 2 : INITIAL_PAGE_W
    const h = root ? ((root.props as any).h ?? 0) + FINAL_PAD_Y * 2 : INITIAL_PAGE_H
    return { pageId: r.pageId, rootIds: r.rootIds, w, h }
  })
  const totalW = dims.reduce((sum, d) => sum + d.w, 0) + Math.max(0, dims.length - 1) * FINAL_GAP
  const maxH = dims.reduce((m, d) => Math.max(m, d.h), 0)
  const viewport = editor.getViewportPageBounds()
  const startX = viewport.center.x - totalW / 2
  const baseY = viewport.center.y - maxH / 2

  editor.run(
    () => {
      let cursorX = startX
      for (const d of dims) {
        editor.updateShape({
          id: d.pageId,
          type: 'ui-page',
          x: cursorX,
          y: baseY,
          props: { w: d.w, h: d.h },
        } as never)
        cursorX += d.w + FINAL_GAP
      }
    },
    { history: 'ignore' },
  )
}

export async function generateDesignVariants(
  editor: Editor,
  userPrompt: string,
  opts: GenerateVariantsOptions = {},
): Promise<VariantResult[]> {
  const hints = (opts.presets ?? getActiveVariantPresets()).map(p => ({
    label: p.label,
    hint: p.hint,
  }))
  if (hints.length === 0) {
    throw new GenerateError(
      'No variant presets enabled. Open Settings (⚙) to enable at least one.',
    )
  }
  const labels = hints.map(h => h.label)

  const pageIds = createStagingPages(editor, hints.length, labels)

  const tasks = hints.map(async (h, index): Promise<VariantResult> => {
    const pageId = pageIds[index]
    try {
      const result = await runAgent(editor, userPrompt, {
        rootParentId: pageId,
        rootX: FINAL_PAD_X,
        rootY: FINAL_PAD_Y,
        userDefs: opts.userDefs,
        styleHint: h.hint,
        onProgress: ev => {
          opts.onProgress?.({
            index,
            label: h.label,
            kind: ev.kind,
            iteration: ev.iteration,
            toolName: ev.kind === 'tool_used' ? ev.name : undefined,
            toolCount: ev.kind === 'iteration_finished' ? ev.toolCount : undefined,
          })
        },
      })
      opts.onProgress?.({ index, label: h.label, kind: 'done' })
      return {
        index,
        label: h.label,
        pageId,
        rootIds: result.createdRootIds,
        summary: result.summary,
        toolCalls: result.totalToolCalls,
        iterations: result.iterations,
        error: null,
      }
    } catch (err) {
      const message =
        err instanceof AgentError ? err.message : (err as Error).message ?? String(err)
      opts.onProgress?.({ index, label: h.label, kind: 'error', message })
      return {
        index,
        label: h.label,
        pageId,
        rootIds: [],
        summary: '',
        toolCalls: 0,
        iterations: 0,
        error: message,
      }
    }
  })

  const results = await Promise.all(tasks)

  // Clean up any variant that errored without producing content — leaving
  // an empty staging PageFrame on the canvas is worse than nothing.
  const failedEmpty = results.filter(r => r.error && r.rootIds.length === 0)
  if (failedEmpty.length > 0) {
    editor.run(
      () => {
        for (const r of failedEmpty) {
          if (r.pageId) editor.deleteShapes([r.pageId])
        }
      },
      { history: 'ignore' },
    )
  }

  // Lay out the surviving variants side-by-side at the viewport center.
  const survivors = results.filter(r => r.pageId && r.rootIds.length > 0) as Array<{
    pageId: TLShapeId
    rootIds: TLShapeId[]
  }>
  if (survivors.length > 0) finalizeLayout(editor, survivors)

  return results
}

// ─── Edit mode ─────────────────────────────────────────────────────────────

export interface EditResult {
  summary: string
  toolCalls: number
  iterations: number
  error: string | null
}

export interface EditOptions {
  userDefs?: ComponentDef[]
  onProgress?: (event: AgentProgressEvent) => void
}

/** Run a single agent against an existing selection. The agent sees the
 *  selected shapes (and their descendants) in its system prompt and can
 *  edit them in-place with update_shape, delete_shape, or add_subtree. */
export async function editSelection(
  editor: Editor,
  userPrompt: string,
  targetIds: TLShapeId[],
  opts: EditOptions = {},
): Promise<EditResult> {
  if (targetIds.length === 0) {
    return {
      summary: '',
      toolCalls: 0,
      iterations: 0,
      error: 'Nothing selected — pick at least one shape first.',
    }
  }
  try {
    const result = await runAgent(editor, userPrompt, {
      mode: 'edit',
      targetIds,
      userDefs: opts.userDefs,
      onProgress: opts.onProgress,
    })
    return {
      summary: result.summary,
      toolCalls: result.totalToolCalls,
      iterations: result.iterations,
      error: null,
    }
  } catch (err) {
    const message =
      err instanceof AgentError ? err.message : (err as Error).message ?? String(err)
    return { summary: '', toolCalls: 0, iterations: 0, error: message }
  }
}
