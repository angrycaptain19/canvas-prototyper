// Multi-turn agent loop. Each iteration: ask the model to take an action
// (or many in parallel), execute tool calls on the editor, feed results
// back. Stops when the model returns no tool calls, calls `finish`, or we
// hit the iteration cap.

import Anthropic from '@anthropic-ai/sdk'
import type { Editor, TLShapeId } from 'tldraw'
import type { ComponentDef } from '@/lib/componentDef'
import { getApiKey } from './apiKey'
import {
  buildAgentTools,
  dispatchTool,
  FINISH_TOOL_NAME,
  type AgentContext,
} from './agentTools'
import { serializeCanvas } from './canvasSerializer'
import { buildShapeCatalog } from './shapeCatalog'
import { buildThemePrompt } from '@/lib/theme/themePrompt'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS_PER_TURN = 16384
const DEFAULT_MAX_ITERATIONS = 12

const EDIT_PROMPT_HEADER = `You are a UI designer working interactively on an infinite canvas. The user has selected one or more existing shapes and asked you to modify them.

Available tools:
- \`update_shape(id, props)\` — patch one shape's props in place. Use for content edits (change text), style edits (colors, sizes), variant swaps.
- \`add_subtree(parent_id, x, y, tree)\` — add new content. Typically as a child of one of the selected shapes (or a child of a child).
- \`delete_shape(id)\` — remove a shape and its descendants.
- \`get_canvas_state({ scope, root_id? })\` — read back a text dump of shapes.
- \`screenshot({ root_id })\` — **render to PNG to see how it looks.** Required before finish so you can verify your edits.
- \`finish(summary)\` — signal you're done. Call this last.

How to edit — IMPORTANT:
1. **Read the request literally.** The user already designed this; they want a specific change, not a redesign. "Make the prices bigger" means: \`update_shape\` on the price text shapes, increase their role/size. NOT: delete + rebuild the whole card.
2. **Reach for \`update_shape\` first.** It's the lightest tool. Only delete + add_subtree if the structure itself is wrong for what they asked.
3. **Targets are the selected shapes (listed at the end of this prompt) and any of their descendants.** Don't touch unrelated shapes elsewhere on the canvas.
4. **If you need to add new content, check saved components first.** The "Saved components in this project" section at the top of the catalog lists what's available. If "add a fourth pricing tier" and a \`PricingTile\` exists, add an instance ref — don't hand-build the card.
5. **REQUIRED: screenshot before finish.** Pick one of the selected shape ids (a top-level one if multiple) and screenshot to verify. If the edit looks broken, fix it with another update / add / delete.
6. **finish** with one sentence describing the change.

`

const CREATE_PROMPT_HEADER = `You are a UI designer working interactively on an infinite canvas. The user describes a UI in natural language; you build it by calling tools.

Available tools:
- \`add_subtree(parent_id, x, y, tree)\` — drop a subtree (a TemplateNode) onto the canvas. Parent_id is a shape id you got from a previous tool result, or "page" for the page root.
- \`update_shape(id, props)\` — patch one shape's props in place. Use to refine text, colors, sizes after creating.
- \`delete_shape(id)\` — remove a shape and its descendants.
- \`get_canvas_state({ scope, root_id? })\` — read back a text dump of shapes (ids, sizes, props). Use to look up shape ids.
- \`screenshot({ root_id })\` — **render the design to a PNG and return it as an image.** This is your visual feedback loop. Text dumps can't show you wrapped/truncated text, overflowing badges, ugly gaps, or visual misalignment — only the screenshot can.
- \`finish(summary)\` — signal you're done. Call this last.

How to work — IMPORTANT:
0. **CHECK SAVED COMPONENTS FIRST.** Before drafting any tree, scan the "Saved components in this project" section at the top of the catalog (if it exists). If the user's request maps to a saved component even partially, USE the component via \`ui-component-instance\` — don't re-draw it from primitives. A pricing page where a \`PricingTile\` exists should be 3 instance references, not 3 hand-built cards. A profile section where \`ProfileCard\` exists should be an instance, not a Stack of Avatar+Text+Text. This is the single biggest correctness check in this workflow — most of the time the user already designed the building blocks they're asking you to compose. If the saved component is close but missing something (e.g. PricingTile lacks a feature list), use it anyway and note the gap in your finish summary; the user will extend the def.
1. **Build it.** Place your design with one or a few \`add_subtree\` calls. Don't over-fragment; a coherent page can often be one call. If saved components apply (step 0), prefer instance refs.
2. **REQUIRED: take a screenshot.** Before you call finish, you MUST call \`screenshot\` on your workspace root and look at the rendered image. This is non-negotiable — the text dump lies about visual quality.
3. **Critique the screenshot.** Look for: text that wraps onto multiple lines when it shouldn't (especially in badges, buttons, small text), text that gets truncated with "…", siblings overlapping each other, containers that are way taller than their content (empty whitespace at the bottom), labels misaligned with their values, inconsistent widths across sibling cards, brand color used too sparingly or too aggressively.
4. **Fix what you see.** Use \`update_shape\` to widen a badge that wrapped, \`update_shape\` to shrink a container with empty bottom space, \`delete_shape\` + \`add_subtree\` to redo a section that's structurally wrong. Then screenshot again to verify.
5. **Only call finish when the screenshot looks like a real, polished UI.** Include a one-sentence description. If you used saved components, mention which ones (and any gaps that should be added to the def later).

`

const SHARED_RULES = `Sizing rules — IMPORTANT:
- **Containers (Stack/Form/List/Card) size to match their content**, not the screen. Pick the widest child's width, add padding, that's the container's width.
- Typical sensible widths: forms/sidebars/cards 280–400 wide. Wider toolbars/headers up to 720. Never go above 800 unless explicitly designing a wide page.
- Heights typically grow naturally from children. Pick a height that fits the visible content (40 for a button, 68 for an input field, 32 for a heading line, etc).
- Children inside a Stack with \`alignItems: 'stretch'\` will stretch to the Stack's cross-axis. Use \`alignItems: 'start'\` if you don't want stretching.
- **For horizontal stacks containing form fields, use \`alignItems: 'start'\` — NOT 'stretch'.** Stretch equalizes heights and makes short fields look comically tall.
- **Leaf widths must be reasonable.** Button max ~480, Input/Select max ~480, Badge max ~200, Avatar 40–80 (square).

Structural rules:
- Wrap groups of related shapes in a Stack (or Form/List) — never emit floating siblings at the root.
- For forms, prefer the Form container over Stack.
- **All action buttons that belong to a form (Submit, Cancel, Save) go INSIDE the Form's children array.**
- For repeating items (nav links, menu items, settings rows), prefer the List container.
- **Card is a visual surface, not a layout container.** Card NEVER directly holds multiple children — put a Stack inside the Card. \`Card > Stack > [content]\`.
- **Never wrap a single child in a container.** Form/List/Stack only make sense with 2+ items.
- Don't invent shape types or props that aren't in the catalog.

Content rules — your output MUST look like a real, finished UI, not a wireframe:
- **No placeholder text.** Don't write "Lorem ipsum", "Title here", "Card heading", "Description text". Use specific, plausible content.
- **Fill containers with real content.** A list needs 4-6 concrete rows. A pricing section needs 3 tiers with real names and numbers. An empty container with just a heading above it is a failure.
- **Heading + body + CTA, not just heading.** Pair headings with at least one supporting element.
- **No unexplained empty space.** Containers must size to their content.

Gap and density (very important):
- Horizontal nav / tabs: gap 16-24.
- Vertical forms: gap 12-16 between fields.
- List rows of homogeneous items: gap 8-12.
- Tight inline groups (icon + label, avatar + name): gap 4-8.
- Don't use gap > 32 unless the layout is genuinely sparse.

`

export class AgentError extends Error {}

export type AgentMode = 'create' | 'edit'

export interface AgentOptions {
  mode?: AgentMode
  /** Create mode: where the agent should anchor new content. */
  rootParentId?: string // 'page' or a shape id
  /** Create mode: initial x/y for the agent's first add_subtree. */
  rootX?: number
  rootY?: number
  /** Edit mode: the shapes the user selected. Their subtree dumps are
   *  injected into the system prompt as context. */
  targetIds?: TLShapeId[]
  /** User's saved components — appears in the system prompt. */
  userDefs?: ComponentDef[]
  /** Style hint appended to the user message. */
  styleHint?: string
  /** Hard cap on iterations. */
  maxIterations?: number
  /** Per-iteration progress reporter for UI. */
  onProgress?: (event: AgentProgressEvent) => void
}

export type AgentProgressEvent =
  | { kind: 'iteration_started'; iteration: number }
  | { kind: 'tool_used'; name: string; iteration: number }
  | { kind: 'iteration_finished'; iteration: number; toolCount: number }

export interface AgentRunResult {
  iterations: number
  summary: string
  createdRootIds: TLShapeId[]
  totalToolCalls: number
}

export async function runAgent(
  editor: Editor,
  userPrompt: string,
  opts: AgentOptions,
): Promise<AgentRunResult> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new AgentError(
      'No Anthropic API key set. Click the settings (⚙) button in the library to add one.',
    )
  }
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS
  const mode: AgentMode = opts.mode ?? 'create'

  const catalog = buildShapeCatalog({ userDefs: opts.userDefs })
  const theme = buildThemePrompt()

  let system: string
  if (mode === 'edit') {
    const targetIds = opts.targetIds ?? []
    if (targetIds.length === 0) {
      throw new AgentError('edit mode requires at least one targetId.')
    }
    const dumps = targetIds
      .map(id => serializeCanvas(editor, { scope: 'subtree', rootId: id }))
      .join('\n\n---\n\n')
    system =
      EDIT_PROMPT_HEADER +
      SHARED_RULES +
      `\n\n${theme}\n\n` +
      `## Selected shapes (your edit targets)\n\n` +
      `${targetIds.length === 1 ? 'There is 1 shape' : `There are ${targetIds.length} shapes`} selected. ` +
      `You can target them (and any of their descendants) with update_shape / delete_shape, or add new children with add_subtree.\n\n` +
      dumps +
      `\n\n` +
      catalog
  } else {
    if (!opts.rootParentId) {
      throw new AgentError('create mode requires rootParentId.')
    }
    system =
      CREATE_PROMPT_HEADER +
      SHARED_RULES +
      `\n\n${theme}\n\n` +
      `For this session, start by placing content under parent_id="${opts.rootParentId}" at roughly (x=${opts.rootX ?? 0}, y=${opts.rootY ?? 0}). That's your anchor point.\n\n` +
      catalog
  }

  // Build user message. If saved components exist, prepend a short
  // forcing-function reminder ABOVE the user's prompt so it's the first
  // thing the model reads, not buried in the system prompt. Models pay
  // more attention to user-message content than system-prompt rules.
  let userText = userPrompt
  if (opts.styleHint) userText += `\n\n${opts.styleHint}`
  if (opts.userDefs && opts.userDefs.length > 0) {
    const list = opts.userDefs
      .map(d => {
        const variants =
          d.variants && d.variants.length > 0
            ? ` (variants: ${d.variants.map(v => `${v.name}=${v.values.join('|')}`).join('; ')})`
            : ''
        return `- \`${d.name}\`${variants}`
      })
      .join('\n')
    userText =
      `**Saved components available in this project — CHECK FIRST:**\n${list}\n\n` +
      `If any of these match the request below, use them via \`ui-component-instance\` ` +
      `(don't rebuild from primitives). Use the component even if it's close-but-incomplete — ` +
      `note any gaps in your finish summary so the user can extend the def. If none apply, ` +
      `build from primitives.\n\n---\n\n` +
      userText
  }

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: userText },
  ]

  const tools = buildAgentTools()
  const ctx: AgentContext = {
    editor,
    finishedWith: null,
    createdRootIds: [],
    userDefs: opts.userDefs ?? [],
  }

  // ─── Debug logging ──────────────────────────────────────────────────────
  // Builds a structured per-run log object, POSTed to the Vite dev server
  // at /__agent_log at end-of-run. The server appends to ./agent.log in
  // the project root (newline-delimited JSON, one run per line) so we can
  // read it from outside the browser.
  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const runStartedAt = new Date().toISOString()
  const userDefSummary = (opts.userDefs ?? []).map(d => ({
    id: d.id,
    name: d.name,
    variants: d.variants?.map(v => ({ name: v.name, values: v.values, default: v.default })),
  }))
  const savedComponentsSectionMatch = system.match(
    /# Saved components in this project[\s\S]*?(?=\n# |$)/,
  )
  const runRecord: Record<string, unknown> = {
    runId,
    runStartedAt,
    mode,
    userPrompt,
    styleHint: opts.styleHint ?? null,
    userDefs: userDefSummary,
    systemPromptLength: system.length,
    systemPromptHasSavedComponentsSection: !!savedComponentsSectionMatch,
    systemPromptSavedComponentsSection: savedComponentsSectionMatch?.[0] ?? null,
    userMessage: userText,
    iterations: [] as Array<Record<string, unknown>>,
  }

  let totalToolCalls = 0
  let iteration = 0
  for (iteration = 0; iteration < maxIterations; iteration++) {
    opts.onProgress?.({ kind: 'iteration_started', iteration })

    const response = await client.messages
      .stream({
        model: MODEL,
        max_tokens: MAX_TOKENS_PER_TURN,
        system,
        tools,
        messages,
      })
      .finalMessage()

    // Collect tool_use blocks (model may parallelize within one turn).
    const toolUses: Anthropic.Messages.ToolUseBlock[] = []
    const assistantTextBlocks: string[] = []
    for (const block of response.content) {
      if (block.type === 'tool_use') toolUses.push(block)
      else if (block.type === 'text') assistantTextBlocks.push(block.text)
    }
    const assistantText = assistantTextBlocks.join('\n').trim()

    const userDefNames = (opts.userDefs ?? []).map(d => d.name)
    const mentioned = userDefNames.filter(n =>
      assistantText.toLowerCase().includes(n.toLowerCase()),
    )
    const iterRecord: Record<string, unknown> = {
      iteration: iteration + 1,
      stopReason: response.stop_reason,
      assistantText,
      mentionedSavedComponents: mentioned,
      didNotMentionSavedComponents: userDefNames.length > 0 && mentioned.length === 0,
      toolCalls: [] as Array<Record<string, unknown>>,
    }
    ;(runRecord.iterations as Array<Record<string, unknown>>).push(iterRecord)

    // If the model returned no tool calls, it's done (or refused).
    if (toolUses.length === 0) {
      iterRecord.note = 'no tool calls — breaking'
      break
    }

    // Echo assistant turn and dispatch each tool call.
    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      opts.onProgress?.({ kind: 'tool_used', name: tu.name, iteration })
      totalToolCalls++
      const result = await dispatchTool(tu.name, tu.input, ctx)
      const toolRecord = summarizeToolCall(tu, result)
      ;(iterRecord.toolCalls as Array<Record<string, unknown>>).push(toolRecord)
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        is_error: result.isError,
        content: result.content as never,
      })
    }
    messages.push({ role: 'user', content: toolResults })

    opts.onProgress?.({
      kind: 'iteration_finished',
      iteration,
      toolCount: toolUses.length,
    })

    if (ctx.finishedWith) break
  }

  if (mode === 'create') {
    const census = censusSubtree(editor, ctx.createdRootIds)
    runRecord.census = census
    runRecord.savedComponentsUsed = census.instanceCount > 0
  }
  runRecord.summary = ctx.finishedWith?.summary ?? '(no finish call)'
  runRecord.totalToolCalls = totalToolCalls
  runRecord.runEndedAt = new Date().toISOString()

  // Fire-and-forget POST to the Vite middleware. Failure shouldn't block
  // the run — we still return results to the caller. The middleware
  // appends one JSON line per call to ./agent.log in the project root.
  try {
    await fetch('/__agent_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runRecord),
    })
  } catch (err) {
    console.warn('[agent log] failed to POST to /__agent_log:', err)
  }

  if (mode === 'create' && ctx.createdRootIds.length === 0) {
    throw new AgentError(
      'Agent finished without creating any shapes. Try a different prompt.',
    )
  }

  return {
    iterations: iteration + 1,
    summary: ctx.finishedWith?.summary ?? '(agent stopped without calling finish)',
    createdRootIds: ctx.createdRootIds,
    totalToolCalls,
  }
}

// ─── Debug helpers ────────────────────────────────────────────────────────

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/** Walk a single subtree and surface what types of shapes the agent
 *  reached for. Used to assert whether saved components were actually
 *  composed (`ui-component-instance` count > 0) or whether the agent
 *  rebuilt everything from primitives (count = 0, but lots of ui-card /
 *  ui-text / ui-button). */
function censusSubtree(
  editor: Editor,
  rootIds: TLShapeId[],
): { total: number; byType: Record<string, number>; instanceCount: number } {
  const byType: Record<string, number> = {}
  let total = 0
  function walk(id: TLShapeId) {
    const shape = editor.getShape(id)
    if (!shape) return
    byType[shape.type] = (byType[shape.type] ?? 0) + 1
    total++
    for (const c of editor.getSortedChildIdsForParent(id)) walk(c)
  }
  for (const r of rootIds) walk(r)
  return { total, byType, instanceCount: byType['ui-component-instance'] ?? 0 }
}

/** Build a JSON-friendly record of a single tool call + its result.
 *  add_subtree gets a full tree-shape summary so we can answer the
 *  question "did this subtree use ui-component-instance or rebuild from
 *  primitives" without re-walking the entire input on the consumer side.
 *  Image bytes from screenshot results are dropped — log files don't need
 *  base64 PNGs. */
function summarizeToolCall(
  tu: Anthropic.Messages.ToolUseBlock,
  result: { content: unknown[]; isError: boolean },
): Record<string, unknown> {
  const input = tu.input as Record<string, unknown> | undefined
  const record: Record<string, unknown> = {
    tool: tu.name,
    isError: result.isError,
  }

  if (tu.name === 'add_subtree') {
    const tree = input?.tree as { type?: string; children?: unknown[] } | undefined
    const summary = treeShapeSummary(tree)
    record.parent_id = input?.parent_id
    record.x = input?.x
    record.y = input?.y
    record.treeShapeCounts = summary.byType
    record.treeUsesComponentInstance = summary.usesInstance
    record.treeInstanceDefIds = summary.instanceDefIds
    record.tree = tree
  } else if (tu.name === 'update_shape') {
    record.id = input?.id
    record.props = input?.props
  } else if (tu.name === 'delete_shape') {
    record.id = input?.id
  } else if (tu.name === 'screenshot') {
    record.root_id = input?.root_id
  } else if (tu.name === 'finish') {
    record.summary = input?.summary
  } else {
    record.input = input
  }

  // Pull the text content from the result; drop image blocks.
  const textBlock = result.content.find(
    (b): b is { type: 'text'; text: string } =>
      (b as { type?: string }).type === 'text',
  )
  if (textBlock) {
    const t = textBlock.text.trim()
    record.resultText = t.length > 2000 ? t.slice(0, 2000) + '…' : t
  }
  const imageCount = result.content.filter(
    b => (b as { type?: string }).type === 'image',
  ).length
  if (imageCount > 0) record.resultImageBlocks = imageCount

  return record
}

function treeShapeSummary(tree: { type?: string; children?: unknown[] } | undefined): {
  label: string
  byType: Record<string, number>
  usesInstance: boolean
  instanceDefIds: string[]
} {
  if (!tree) return { label: '(empty)', byType: {}, usesInstance: false, instanceDefIds: [] }
  const counts: Record<string, number> = {}
  const defIds: string[] = []
  function walk(n: unknown) {
    if (!n || typeof n !== 'object') return
    const node = n as { type?: string; props?: { defId?: string }; children?: unknown[] }
    if (node.type) {
      counts[node.type] = (counts[node.type] ?? 0) + 1
      if (node.type === 'ui-component-instance' && node.props?.defId) {
        defIds.push(node.props.defId)
      }
    }
    if (Array.isArray(node.children)) for (const c of node.children) walk(c)
  }
  walk(tree)
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${n}×${t}`)
    .join(', ')
  return {
    label: parts,
    byType: counts,
    usesInstance: !!counts['ui-component-instance'],
    instanceDefIds: defIds,
  }
}
