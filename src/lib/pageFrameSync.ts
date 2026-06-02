// Reactive sync for PageFrame breakpoint changes — when the user switches
// between mobile/desktop in the Inspector, the frame width updates to a
// canonical size for that breakpoint, preserving the user's prior desktop
// width on the shape's meta.

import type { Editor } from 'tldraw'
import type { PageFrameShape } from '@/shapes/PageFrameShape'

const MOBILE_WIDTH = 375
const DEFAULT_DESKTOP_WIDTH = 1024

function isPageFrame(shape: { type: string } | undefined): shape is PageFrameShape {
  return shape?.type === 'ui-page'
}

export function installPageFrameSync(editor: Editor): () => void {
  return editor.sideEffects.registerAfterChangeHandler('shape', (prev, next) => {
    if (!isPageFrame(next)) return
    const prevPage = prev as PageFrameShape
    if (prevPage.props.breakpoint === next.props.breakpoint) return

    if (next.props.breakpoint === 'mobile' && prevPage.props.breakpoint === 'desktop') {
      // Going desktop → mobile: remember the desktop width, set mobile width
      editor.run(
        () => {
          editor.updateShape({
            id: next.id,
            type: 'ui-page',
            meta: { ...(next.meta ?? {}), desktopWidth: prevPage.props.w },
            props: { w: MOBILE_WIDTH },
          })
        },
        { history: 'record-preserveRedoStack', ignoreShapeLock: true },
      )
      return
    }

    if (next.props.breakpoint === 'desktop' && prevPage.props.breakpoint === 'mobile') {
      // Going mobile → desktop: restore prior desktop width if we have one
      const remembered = (next.meta as { desktopWidth?: number } | undefined)?.desktopWidth
      const target = typeof remembered === 'number' ? remembered : DEFAULT_DESKTOP_WIDTH
      editor.run(
        () => {
          editor.updateShape({
            id: next.id,
            type: 'ui-page',
            props: { w: target },
          })
        },
        { history: 'record-preserveRedoStack', ignoreShapeLock: true },
      )
    }
  })
}
