// Tool definitions for the agent loop. Each tool has:
//   - a JSON Schema input shape (what Anthropic validates against)
//   - a dispatcher (run on the live editor, return a string for the model)
//
// The dispatcher returns strings so we can stuff them into `tool_result`
// blocks verbatim — no per-tool serialization to worry about.

import type Anthropic from '@anthropic-ai/sdk'
import type { Editor, TLParentId, TLShapeId } from 'tldraw'
import type { TemplateNode } from '@/lib/componentDef'
import { flattenSchema, type PropDef } from '@/lib/propSchema'
import { getRegistration, listRegistrations } from '@/lib/registry'
import { relayoutSubtree } from '@/lib/layoutSync'
import { getPreviewMode, setPreviewMode } from '@/lib/previewMode'
import { materializeTemplate } from '@/lib/templateMaterializer'
import { serializeCanvas } from './canvasSerializer'
import { normalizeTemplate } from './normalizeTemplate'
import { formatValidationErrors, validateTemplate } from './validateTemplate'

export interface AgentContext {
  editor: Editor
  /** Resolved when the agent calls `finish`. */
  finishedWith: { summary: string } | null
  /** Ids of every shape the agent has created via add_subtree, used to
   *  drive post-run layout sweeps. */
  createdRootIds: TLShapeId[]
  /** Saved user component defs — passed to validateTemplate so
   *  ui-component-instance references can be checked against real defs. */
  userDefs: import('@/lib/componentDef').ComponentDef[]
}

export const FINISH_TOOL_NAME = 'finish'

export function buildAgentTools(): Anthropic.Messages.Tool[] {
  const types = listRegistrations().map(r => r.type)
  const nodeSchema = {
    type: 'object',
    required: ['type', 'x', 'y', 'w', 'h', 'props'],
    properties: {
      type: { enum: types },
      x: { type: 'number' },
      y: { type: 'number' },
      w: { type: 'number', minimum: 1 },
      h: { type: 'number', minimum: 1 },
      props: { type: 'object' },
      children: { type: 'array', items: { type: 'object' } },
    },
  }

  return [
    {
      name: 'add_subtree',
      description:
        'Materialize a UI subtree on the canvas. Use this for every primitive structural addition — root pages, sections, individual components. Returns the created root shape id (and ids of every descendant). Call multiple times to build complex pages in pieces.',
      input_schema: {
        type: 'object',
        required: ['parent_id', 'x', 'y', 'tree'],
        properties: {
          parent_id: {
            type: 'string',
            description:
              'Where to attach this subtree. Pass the literal "page" to attach to the current page root, or any shape id returned from a previous add_subtree / get_canvas_state call to nest inside that shape.',
          },
          x: { type: 'number', description: 'X position in parent-local coords.' },
          y: { type: 'number', description: 'Y position in parent-local coords.' },
          tree: nodeSchema,
        },
      },
    } as unknown as Anthropic.Messages.Tool,
    {
      name: 'update_shape',
      description:
        "Patch one shape's props in place. Use this to refine content (change text, swap a variant, recolor, resize) on a shape you've already created. Only include the props you want to change; everything else stays as-is.",
      input_schema: {
        type: 'object',
        required: ['id', 'props'],
        properties: {
          id: { type: 'string', description: 'Shape id (from add_subtree or get_canvas_state).' },
          props: {
            type: 'object',
            description: 'Partial props object — only changed keys.',
          },
        },
      },
    } as unknown as Anthropic.Messages.Tool,
    {
      name: 'delete_shape',
      description: 'Delete a shape and all of its descendants. Use when you want to remove something you built and try a different approach.',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    } as unknown as Anthropic.Messages.Tool,
    {
      name: 'get_canvas_state',
      description:
        "Return a text dump of shapes on the canvas — every shape's id, type, position, size, and key props. Use this to look up shape ids you need to target with update_shape / delete_shape.",
      input_schema: {
        type: 'object',
        properties: {
          scope: {
            enum: ['page', 'subtree'],
            description: "'page' = everything on the current page; 'subtree' = a single shape and its descendants.",
          },
          root_id: {
            type: 'string',
            description: 'Required when scope = subtree.',
          },
        },
      },
    } as unknown as Anthropic.Messages.Tool,
    {
      name: 'screenshot',
      description:
        "Render a shape and its descendants to an image and return it so you can see how the UI actually looks. THIS IS YOUR VISUAL FEEDBACK LOOP — text dumps can't reveal truncated text, badges that don't fit, overlapping siblings, or empty whitespace inside containers. **Always call screenshot before finish** to verify the rendered design looks correct.",
      input_schema: {
        type: 'object',
        required: ['root_id'],
        properties: {
          root_id: {
            type: 'string',
            description: 'The shape id whose subtree should be rendered (typically your workspace root).',
          },
        },
      },
    } as unknown as Anthropic.Messages.Tool,
    {
      name: FINISH_TOOL_NAME,
      description:
        "Signal that the design is complete. Call this AFTER you've inspected the canvas with get_canvas_state and fixed any issues. Include a one-sentence summary of what you built.",
      input_schema: {
        type: 'object',
        required: ['summary'],
        properties: {
          summary: { type: 'string' },
        },
      },
    } as unknown as Anthropic.Messages.Tool,
  ]
}

// ─── Dispatcher ────────────────────────────────────────────────────────────

/** A tool result is one or more content blocks. The `screenshot` tool
 *  returns text + an image; everything else returns plain text. */
export type ResultBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image'
      source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg'; data: string }
    }

export interface DispatchResult {
  content: ResultBlock[]
  isError: boolean
}

function textResult(text: string, isError = false): DispatchResult {
  return { content: [{ type: 'text', text }], isError }
}

export async function dispatchTool(
  name: string,
  input: unknown,
  ctx: AgentContext,
): Promise<DispatchResult> {
  try {
    switch (name) {
      case 'add_subtree':
        return runAddSubtree(input as AddSubtreeInput, ctx)
      case 'update_shape':
        return runUpdateShape(input as UpdateShapeInput, ctx)
      case 'delete_shape':
        return runDeleteShape(input as DeleteShapeInput, ctx)
      case 'get_canvas_state':
        return runGetCanvasState(input as GetCanvasStateInput, ctx)
      case 'screenshot':
        return await runScreenshot(input as ScreenshotInput, ctx)
      case FINISH_TOOL_NAME:
        return runFinish(input as FinishInput, ctx)
      default:
        return textResult(`Unknown tool "${name}".`, true)
    }
  } catch (err) {
    return textResult(`Tool error: ${(err as Error).message}`, true)
  }
}

// ─── Per-tool implementations ──────────────────────────────────────────────

interface AddSubtreeInput {
  parent_id: string
  x: number
  y: number
  tree: TemplateNode
}

function resolveParentId(editor: Editor, parentRef: string): TLParentId | null {
  if (parentRef === 'page') return editor.getCurrentPageId()
  if (parentRef.startsWith('shape:')) {
    const shape = editor.getShape(parentRef as TLShapeId)
    return shape ? (shape.id as TLParentId) : null
  }
  return null
}

function runAddSubtree(input: AddSubtreeInput, ctx: AgentContext): DispatchResult {
  if (!input.tree) return textResult('tree is required', true)
  const parentId = resolveParentId(ctx.editor, input.parent_id)
  if (!parentId) {
    return textResult(
      `parent_id "${input.parent_id}" did not resolve to a shape. Use "page" for the page root or a shape id from a previous tool result.`,
      true,
    )
  }
  // Validate before mutating the canvas — same checks we ran in single-shot.
  // userDefs flow through so ui-component-instance refs can be validated
  // against the user's real saved components.
  const errors = validateTemplate(input.tree, '', ctx.userDefs)
  if (errors.length > 0) {
    return textResult(
      `Validation errors — fix and try again:\n${formatValidationErrors(errors)}`,
      true,
    )
  }
  normalizeTemplate(input.tree)

  const { rootId, allIds } = materializeTemplate(ctx.editor, input.tree, {
    parentId,
    rootX: input.x,
    rootY: input.y,
  })
  // Layout sweep on the new subtree so the agent sees post-hug positions
  // when it inspects the canvas afterwards.
  relayoutSubtree(ctx.editor, rootId)
  ctx.createdRootIds.push(rootId)

  // Echo back the new shape ids so the agent can target them later.
  const dump = serializeCanvas(ctx.editor, { scope: 'subtree', rootId })
  return textResult(
    `Created subtree with root ${rootId} (${allIds.length} shape${allIds.length === 1 ? '' : 's'}).\n` +
      `Layout settled. Current state of the subtree:\n${dump}`,
  )
}

interface UpdateShapeInput {
  id: string
  props: Record<string, unknown>
}

function runUpdateShape(input: UpdateShapeInput, ctx: AgentContext): DispatchResult {
  const shape = ctx.editor.getShape(input.id as TLShapeId)
  if (!shape) return textResult(`No shape with id ${input.id}`, true)

  const cur = shape.props as Record<string, unknown>
  const reg = getRegistration(shape.type)
  // Build per-key def map so we can validate values, not just keys. Without
  // this an enum prop like `tone: 'success'` on a ui-text (whose tone enum
  // is default|muted|brand|danger) sails past the key allowlist and blows
  // up at tldraw's store validation.
  const defByKey = new Map<string, PropDef>()
  if (reg) {
    for (const { key, def } of flattenSchema(reg.schema)) defByKey.set(key, def)
  }

  const patch: Record<string, unknown> = {}
  const skipped: string[] = []
  const valueErrors: string[] = []
  for (const [k, v] of Object.entries(input.props ?? {})) {
    if (k === 'w' || k === 'h') {
      // w/h are universal and not in schema — only basic type check.
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
        valueErrors.push(`${k} must be a positive number, got ${JSON.stringify(v)}`)
        continue
      }
      patch[k] = v
      continue
    }
    if (!(k in cur)) {
      skipped.push(k)
      continue
    }
    const def = defByKey.get(k)
    if (def) {
      const err = checkPropValue(v, def)
      if (err) {
        valueErrors.push(`${k}: ${err}`)
        continue
      }
    }
    patch[k] = v
  }

  if (valueErrors.length > 0) {
    return textResult(
      `Invalid values — fix and try again:\n${valueErrors.map(e => `  - ${e}`).join('\n')}`,
      true,
    )
  }
  if (Object.keys(patch).length === 0) {
    return textResult(
      `No applicable props. Skipped: ${skipped.join(', ')}. Valid keys for ${shape.type}: ${[...Object.keys(cur), 'w', 'h'].join(', ')}.`,
      true,
    )
  }
  ctx.editor.updateShape({
    id: shape.id,
    type: shape.type,
    props: { ...cur, ...patch },
  } as never)
  const skippedMsg = skipped.length > 0 ? ` (skipped unknown props: ${skipped.join(', ')})` : ''
  return textResult(`Updated ${shape.id}${skippedMsg}.`)
}

/** Same enum/string/number/bool checks as validateTemplate's checkProp,
 *  inlined here so update_shape can reject bad values instead of letting
 *  tldraw's store throw at write time. */
function checkPropValue(value: unknown, def: PropDef): string | null {
  switch (def.kind) {
    case 'string':
      return typeof value === 'string' ? null : `expected string, got ${typeof value}`
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return `expected number, got ${typeof value}`
      }
      if (def.min !== undefined && value < def.min) return `value ${value} below min ${def.min}`
      if (def.max !== undefined && value > def.max) return `value ${value} above max ${def.max}`
      return null
    case 'boolean':
      return typeof value === 'boolean' ? null : `expected boolean, got ${typeof value}`
    case 'enum': {
      const valid = def.options.map(o => o.value)
      if (typeof value !== 'string' || !valid.includes(value)) {
        return `invalid value ${JSON.stringify(value)}; valid: ${valid.map(v => `'${v}'`).join(', ')}`
      }
      return null
    }
    case 'color':
      return typeof value === 'string' ? null : `expected color string, got ${typeof value}`
  }
}

interface DeleteShapeInput {
  id: string
}

function runDeleteShape(input: DeleteShapeInput, ctx: AgentContext): DispatchResult {
  const shape = ctx.editor.getShape(input.id as TLShapeId)
  if (!shape) return textResult(`No shape with id ${input.id}`, true)
  const ids = [...ctx.editor.getShapeAndDescendantIds([shape.id])]
  ctx.editor.deleteShapes(ids)
  // Drop from createdRootIds if present.
  ctx.createdRootIds = ctx.createdRootIds.filter(r => r !== shape.id)
  return textResult(`Deleted ${ids.length} shape${ids.length === 1 ? '' : 's'}.`)
}

interface GetCanvasStateInput {
  scope?: 'page' | 'subtree'
  root_id?: string
}

function runGetCanvasState(input: GetCanvasStateInput, ctx: AgentContext): DispatchResult {
  const scope = input.scope ?? 'page'
  const text = serializeCanvas(ctx.editor, {
    scope,
    rootId: input.root_id as TLShapeId | undefined,
  })
  return textResult(text)
}

interface ScreenshotInput {
  root_id: string
}

async function runScreenshot(
  input: ScreenshotInput,
  ctx: AgentContext,
): Promise<DispatchResult> {
  const rootId = input.root_id as TLShapeId | undefined
  if (!rootId) {
    return textResult('root_id is required (the shape id of the area to screenshot).', true)
  }
  const root = ctx.editor.getShape(rootId)
  if (!root) return textResult(`No shape with id ${rootId}`, true)

  const ids = [...ctx.editor.getShapeAndDescendantIds([rootId])]

  // Render with preview mode forced on so the agent sees the FINISHED look
  // (no LIST/FORM badges, no PageFrame header strip) rather than editor
  // chrome it can't act on. Restore the user's setting afterwards so the
  // canvas state visible to them is unchanged.
  const previousPreview = getPreviewMode()
  setPreviewMode(true)
  let base64: string
  try {
    // PNG @ scale=0.5 keeps base64 payload small while still being legible.
    const { blob } = await ctx.editor.toImage(ids, {
      format: 'png',
      scale: 0.5,
      background: true,
      padding: 32,
    })
    base64 = await blobToBase64(blob)
  } finally {
    setPreviewMode(previousPreview)
  }

  return {
    content: [
      {
        type: 'text',
        text: `Screenshot of ${rootId} (PNG, rendered in preview mode so no editor chrome appears). Look for: text that wraps or truncates, overlapping siblings, gaps inside containers, badges or labels that don't fit, awkward whitespace. If anything looks broken, fix it with update_shape / delete_shape / add_subtree.`,
      },
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: base64 },
      },
    ],
    isError: false,
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  // Chunk to avoid blowing the call-stack on large images.
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

interface FinishInput {
  summary: string
}

function runFinish(input: FinishInput, ctx: AgentContext): DispatchResult {
  ctx.finishedWith = { summary: input.summary ?? '' }
  return textResult('Acknowledged.')
}
