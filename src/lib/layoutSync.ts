// Runs flex layout when a Stack-like container's props/size change or when
// its children change. Writes computed x/y/w/h back to children, in their
// parent's local coords.
//
// "Stack-like" means: ui-stack (the base) + ui-form + ui-list (Phase 4
// typed containers). All three share the same layout props.

import type { Editor, TLShape, TLShapeId } from 'tldraw'
import { computeStackRequiredSize, layoutStack } from './layout'
import type { StackShape } from '@/shapes/StackShape'
import type { FormContainerShape } from '@/shapes/FormContainerShape'
import type { ListContainerShape } from '@/shapes/ListContainerShape'

const STACK_LIKE_TYPES = new Set(['ui-stack', 'ui-form', 'ui-list'])
type StackLikeShape = StackShape | FormContainerShape | ListContainerShape

function isStack(shape: TLShape | undefined): shape is StackLikeShape {
  return !!shape && STACK_LIKE_TYPES.has(shape.type)
}

function isCard(shape: TLShape | undefined): shape is TLShape & { type: 'ui-card' } {
  return !!shape && shape.type === 'ui-card'
}

/** Card doesn't layout its children, but it should still GROW to contain
 *  them — pick the bounding extent of all children, add the Card's own
 *  padding, and grow the Card to fit if needed.
 *
 *  Unlike Stacks, Cards never auto-shrink. Shrinking on every child edit
 *  ("Card auto-resize too aggressively") feels jumpy while you're iterating
 *  on a design — you delete a row and the Card snaps inward, you add it
 *  back and the Card grows out. Cards are visual surfaces, not layout
 *  containers; if you want a smaller card, grab the resize handle. */
function relayoutCard(editor: Editor, cardId: TLShapeId) {
  const card = editor.getShape(cardId)
  if (!isCard(card)) return
  const childIds = editor.getSortedChildIdsForParent(cardId)
  if (childIds.length === 0) return

  let maxRight = 0
  let maxBottom = 0
  for (const id of childIds) {
    const child = editor.getShape(id)
    if (!child) continue
    const cw = (child.props as { w?: number }).w ?? 0
    const ch = (child.props as { h?: number }).h ?? 0
    maxRight = Math.max(maxRight, child.x + cw)
    maxBottom = Math.max(maxBottom, child.y + ch)
  }

  const cardProps = card.props as { w: number; h: number; padding?: number }
  const padding = typeof cardProps.padding === 'number' ? cardProps.padding : 0
  const requiredW = Math.ceil(maxRight + padding)
  const requiredH = Math.ceil(maxBottom + padding)

  // Grow-only — never shrink, regardless of userSized flag.
  const targetW = Math.max(cardProps.w, requiredW)
  const targetH = Math.max(cardProps.h, requiredH)

  if (targetW === cardProps.w && targetH === cardProps.h) return

  editor.run(
    () => {
      editor.updateShape({
        id: cardId,
        type: card.type,
        props: { w: targetW, h: targetH },
      } as never)
    },
    { history: 'ignore', ignoreShapeLock: true },
  )
}

function hashStackInputs(stack: StackLikeShape, children: TLShape[]): string {
  return [
    stack.props.w,
    stack.props.h,
    stack.props.direction,
    stack.props.gap,
    stack.props.padding,
    stack.props.alignItems,
    stack.props.justifyContent,
    // Include the userSized flag so toggling it via "Fit to content" triggers
    // a relayout (the hash would otherwise be unchanged).
    (stack.meta as { userSized?: boolean })?.userSized ? 'u' : 'h',
    children
      .map(
        c =>
          `${c.id}:${(c.props as any).w ?? 0}x${(c.props as any).h ?? 0}:${
            (c.meta as { userSized?: boolean })?.userSized ? 'u' : 'h'
          }`,
      )
      .join('|'),
  ].join(';')
}

const lastHashByStack = new Map<TLShapeId, string>()

function relayoutStack(editor: Editor, stackId: TLShapeId) {
  const stack = editor.getShape(stackId)
  if (!isStack(stack)) return
  const childIds = editor.getSortedChildIdsForParent(stackId)
  const children = childIds
    .map(id => editor.getShape(id))
    .filter((s): s is TLShape => !!s)

  if (children.length === 0) {
    const hash = hashStackInputs(stack, children)
    lastHashByStack.set(stackId, hash)
    return
  }

  // Hug-contents by default. If the user has manually resized this container
  // (onResize sets meta.userSized = true), only grow — never shrink — so we
  // don't undo their drag. Either way: never crop content.
  const childSizes = children.map(c => ({
    w: (c.props as any).w ?? 100,
    h: (c.props as any).h ?? 40,
  }))
  const required = computeStackRequiredSize(
    {
      direction: stack.props.direction,
      gap: stack.props.gap,
      padding: stack.props.padding,
    },
    childSizes,
  )
  const userSized = (stack.meta as { userSized?: boolean })?.userSized === true
  const targetW = userSized ? Math.max(stack.props.w, required.w) : required.w
  const targetH = userSized ? Math.max(stack.props.h, required.h) : required.h
  const needsResize = targetW !== stack.props.w || targetH !== stack.props.h

  // Hash uses the post-resize size so we dedupe stably after the grow.
  const effectiveStack = needsResize
    ? ({ ...stack, props: { ...stack.props, w: targetW, h: targetH } } as typeof stack)
    : stack
  const hash = hashStackInputs(effectiveStack, children)
  if (lastHashByStack.get(stackId) === hash) return
  lastHashByStack.set(stackId, hash)

  const results = layoutStack(
    {
      width: targetW,
      height: targetH,
      direction: stack.props.direction,
      gap: stack.props.gap,
      padding: stack.props.padding,
      alignItems: stack.props.alignItems,
      justifyContent: stack.props.justifyContent,
    },
    children.map((c, i) => ({
      id: c.id,
      w: childSizes[i].w,
      h: childSizes[i].h,
      userSized: (c.meta as { userSized?: boolean })?.userSized === true,
    })),
  )

  editor.run(
    () => {
      if (needsResize) {
        editor.updateShape({
          id: stack.id,
          type: stack.type,
          props: { w: targetW, h: targetH },
        } as any)
      }
      editor.updateShapes(
        results.map(r => {
          const child = editor.getShape(r.id as TLShapeId)!
          const next: any = { id: r.id as TLShapeId, type: child.type, x: r.x, y: r.y }
          // Only write w/h to children whose schema actually declares them —
          // tldraw's built-in `text` shape, for instance, has no `h` prop and
          // will fail validation if we try to set one.
          const cur = child.props as Record<string, unknown>
          const props: Record<string, number> = {}
          if ('w' in cur && cur.w !== r.w) props.w = r.w
          if ('h' in cur && cur.h !== r.h) props.h = r.h
          if (Object.keys(props).length > 0) next.props = props
          return next
        }),
      )
    },
    { history: 'ignore', ignoreShapeLock: true },
  )
}

/** Explicitly run layout for every Stack on the current page. Useful after
 * batch operations (like seeding) where the side-effect handlers may not
 * see every change in the order we expect. */
export function relayoutAllStacks(editor: Editor) {
  const stacks = editor
    .getCurrentPageShapes()
    .filter((s): s is StackLikeShape => STACK_LIKE_TYPES.has(s.type))
  for (const s of stacks) {
    // Force re-run by clearing the hash cache for this stack.
    lastHashByStack.delete(s.id)
    relayoutStack(editor, s.id)
  }
}

/** Walk the subtree under `rootId` and run layout on every Stack-like
 *  shape found, deepest-first so parents see correct child sizes when they
 *  flow. Use this after materializing a template inside a frame parent
 *  (e.g. PageFrame) where the side-effect handlers can miss ordering. */
export function relayoutSubtree(editor: Editor, rootId: TLShapeId) {
  // Collect both stack-like and card shapes in deepest-first order so a
  // child stack hugs first, then its Card parent hugs around the new stack
  // size, then the grandparent stack flows around the new card size, etc.
  const stacks: TLShapeId[] = []
  const cards: TLShapeId[] = []
  function walk(id: TLShapeId) {
    const shape = editor.getShape(id)
    if (!shape) return
    const childIds = editor.getSortedChildIdsForParent(id)
    for (const c of childIds) walk(c)
    if (STACK_LIKE_TYPES.has(shape.type)) stacks.push(id)
    else if (shape.type === 'ui-card') cards.push(id)
  }
  walk(rootId)
  // Pass 1: hug stacks bottom-up.
  for (const id of stacks) {
    lastHashByStack.delete(id)
    relayoutStack(editor, id)
  }
  // Pass 2: hug cards bottom-up.
  for (const id of cards) {
    relayoutCard(editor, id)
  }
  // Pass 3: stacks again — Card resizes from pass 2 may have triggered
  // grandparent stack relayouts that the change handler queued but didn't
  // dedup-flush. Cheap belt-and-suspenders.
  for (const id of stacks) {
    lastHashByStack.delete(id)
    relayoutStack(editor, id)
  }
}

export function installLayoutSync(editor: Editor): () => void {
  // Helper — when a child gets created/changed/deleted, walk up and hug
  // the parent (if it's a Card) and re-layout its Stack ancestor (if any).
  function refreshParent(parentId: TLShapeId | string | undefined) {
    if (!parentId) return
    const parent = editor.getShape(parentId as TLShapeId)
    if (!parent) return
    if (isStack(parent)) relayoutStack(editor, parent.id)
    else if (isCard(parent)) relayoutCard(editor, parent.id)
  }

  // After shape create
  const offCreate = editor.sideEffects.registerAfterCreateHandler('shape', shape => {
    if (isStack(shape)) relayoutStack(editor, shape.id)
    else refreshParent(shape.parentId)
  })

  // After shape change
  const offChange = editor.sideEffects.registerAfterChangeHandler('shape', (prev, next) => {
    if (isStack(next)) {
      const prevStack = prev as StackLikeShape
      const prevUserSized = (prevStack.meta as { userSized?: boolean })?.userSized === true
      const nextUserSized = (next.meta as { userSized?: boolean })?.userSized === true
      const sizeOrPropsChanged =
        prevStack.props.w !== next.props.w ||
        prevStack.props.h !== next.props.h ||
        prevStack.props.direction !== next.props.direction ||
        prevStack.props.gap !== next.props.gap ||
        prevStack.props.padding !== next.props.padding ||
        prevStack.props.alignItems !== next.props.alignItems ||
        prevStack.props.justifyContent !== next.props.justifyContent ||
        prevUserSized !== nextUserSized
      if (sizeOrPropsChanged) {
        relayoutStack(editor, next.id)
        // Stack size may have changed during relayout — let any Card parent
        // re-hug. (refreshParent picks the right kind.)
        refreshParent(next.parentId)
      }
      return
    }
    // Parent change: refresh both old + new parents.
    if (next.parentId !== prev.parentId) {
      refreshParent(prev.parentId)
      refreshParent(next.parentId)
      return
    }
    // Same parent — react if the child's intrinsic size changed.
    const prevW = (prev.props as { w?: number }).w
    const prevH = (prev.props as { h?: number }).h
    const nextW = (next.props as { w?: number }).w
    const nextH = (next.props as { h?: number }).h
    if (prevW !== nextW || prevH !== nextH) refreshParent(next.parentId)
  })

  // After shape delete
  const offDelete = editor.sideEffects.registerAfterDeleteHandler('shape', shape => {
    if (isStack(shape)) {
      lastHashByStack.delete(shape.id)
      return
    }
    refreshParent(shape.parentId)
  })

  return () => {
    offCreate()
    offChange()
    offDelete()
  }
}
