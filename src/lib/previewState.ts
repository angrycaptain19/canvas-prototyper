// Per-shape state preview — pure visual override that shows what hover/active/
// focus look like without requiring real interactivity on the canvas.

import { atom } from '@tldraw/state'
import type { TLShapeId } from 'tldraw'

export type PreviewState = 'default' | 'hover' | 'active' | 'focus'

export const PREVIEW_STATES: PreviewState[] = ['default', 'hover', 'active', 'focus']

const previewStateAtom = atom<Map<TLShapeId, PreviewState>>(
  'previewState',
  new Map(),
)

export function getPreviewState(id: TLShapeId): PreviewState {
  return previewStateAtom.get().get(id) ?? 'default'
}

export function setPreviewState(id: TLShapeId, state: PreviewState) {
  const current = previewStateAtom.get()
  const next = new Map(current)
  if (state === 'default') {
    next.delete(id)
  } else {
    next.set(id, state)
  }
  previewStateAtom.set(next)
}

export function getPreviewStateAtom() {
  return previewStateAtom
}
