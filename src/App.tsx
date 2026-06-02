import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Tldraw,
  createShapeId,
  type Editor,
  type TLComponents,
  type TldrawOptions,
} from 'tldraw'
import { customShapeUtils } from '@/shapes'
import { installLayoutSync, relayoutAllStacks } from '@/lib/layoutSync'
import { installPageFrameSync } from '@/lib/pageFrameSync'
import { installPersistence } from '@/lib/persistence'
import { EditorRefProvider } from '@/lib/editorContext'
import { getRegistration } from '@/lib/registry'
import { makeStore } from '@/lib/store'
import { CmdKPalette } from '@/ui/CmdKPalette'
import { PreviewToggle } from '@/ui/PreviewToggle'
import { CodePreview, type CodePreviewTarget } from '@/ui/CodePreview'
import { CodePreviewContext } from '@/ui/codePreviewContext'
import { Inspector } from '@/ui/Inspector'
import { DRAG_DEF_MIME, DRAG_MIME, LibraryPanel } from '@/ui/LibraryPanel'
import { EditBanner } from '@/ui/EditBanner'
import type { ComponentDef } from '@/lib/componentDef'

const CONTAINER_TYPES = new Set([
  'ui-page',
  'ui-stack',
  'ui-form',
  'ui-list',
  'ui-card',
  'ui-slot',
])

const components: TLComponents = {
  // Hide tldraw's default style panel — we render our own Inspector on the right
  StylePanel: null,
  // Our app is single-page in concept (each PageFrame shape is a "page"); the
  // native multi-page menu just leaks the temporary "Editing: ..." pages.
  PageMenu: null,
}

function seedStarter(editor: Editor) {
  const pageId = createShapeId()
  const stackId = createShapeId()
  const headingId = createShapeId()
  const subId = createShapeId()
  const emailId = createShapeId()
  const passwordId = createShapeId()
  const buttonId = createShapeId()

  // 1. Page frame
  editor.createShape({
    id: pageId,
    type: 'ui-page',
    x: 0,
    y: 0,
    props: { w: 480, h: 640, name: 'Sign in', breakpoint: 'desktop', background: 'surface' },
  })

  // 2. Stack inside the page
  editor.createShape({
    id: stackId,
    type: 'ui-stack',
    parentId: pageId,
    x: 80,
    y: 120,
    props: {
      w: 320,
      h: 420,
      direction: 'vertical',
      gap: 16,
      padding: 24,
      alignItems: 'stretch',
      justifyContent: 'start',
      background: 'none',
      borderRadius: 12,
      border: false,
    },
  })

  // 3. Children of the stack — order matters
  editor.createShapes([
    {
      id: headingId,
      type: 'ui-text',
      parentId: stackId,
      x: 0,
      y: 0,
      props: {
        w: 272,
        h: 36,
        content: 'Sign in to Acme',
        role: 'heading',
        align: 'left',
        weight: 'semibold',
        tone: 'default',
      },
    },
    {
      id: subId,
      type: 'ui-text',
      parentId: stackId,
      x: 0,
      y: 0,
      props: {
        w: 272,
        h: 20,
        content: 'Enter your credentials to continue',
        role: 'caption',
        align: 'left',
        weight: 'normal',
        tone: 'muted',
      },
    },
    {
      id: emailId,
      type: 'ui-input',
      parentId: stackId,
      x: 0,
      y: 0,
      props: {
        w: 272,
        h: 68,
        label: 'Email',
        placeholder: 'you@example.com',
        type: 'email',
        required: true,
      },
    },
    {
      id: passwordId,
      type: 'ui-input',
      parentId: stackId,
      x: 0,
      y: 0,
      props: {
        w: 272,
        h: 68,
        label: 'Password',
        placeholder: '••••••••',
        type: 'password',
        required: true,
      },
    },
    {
      id: buttonId,
      type: 'ui-button',
      parentId: stackId,
      x: 0,
      y: 0,
      props: {
        w: 272,
        h: 44,
        label: 'Sign in',
        variant: 'primary',
        size: 'md',
        disabled: false,
      },
    },
  ])

  editor.zoomToFit({ animation: { duration: 400 } })
}

export default function App() {
  const installedRef = useRef(false)
  const editorRef = useRef<Editor | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  // Build the store once. It owns the custom shape utils + ComponentDef record.
  const [store] = useState(() => makeStore())
  const [codePreviewTarget, setCodePreviewTarget] = useState<CodePreviewTarget>(null)

  const handleMount = useCallback((ed: Editor) => {
    if (installedRef.current) return
    installedRef.current = true

    editorRef.current = ed
    installLayoutSync(ed)
    installPageFrameSync(ed)
    installPersistence(ed)

    const hasPage = ed.getCurrentPageShapes().some(s => s.type === 'ui-page')
    if (!hasPage) {
      seedStarter(ed)
      relayoutAllStacks(ed)
    }

    setEditor(ed)
  }, [])

  // tldraw cancels native drop events on its container and re-dispatches them
  // to .tl-canvas, so React onDrop on a wrapping div never fires. The official
  // hook is `experimental__onDropOnCanvas`, called from inside tldraw's own
  // drop handler with the page-space point pre-computed.
  const tldrawOptions = useMemo<Partial<TldrawOptions>>(
    () => ({
      experimental__onDropOnCanvas: ({ event, point }) => {
        const ed = editorRef.current
        if (!ed) return false

        // Path A: dropping a user-defined component instance
        const defId = event.dataTransfer?.getData(DRAG_DEF_MIME)
        if (defId) {
          const def = ed.store.get(defId as any) as ComponentDef | undefined
          if (!def) return true
          const { w, h } = def.templateBounds
          const container = findContainerAtPoint(ed, point, 'ui-component-instance')
          let x: number
          let y: number
          let parentId: string
          if (container) {
            const cb = ed.getShapePageBounds(container.id)!
            parentId = container.id
            x = point.x - cb.x - w / 2
            y = point.y - cb.y - h / 2
          } else {
            parentId = ed.getCurrentPageId()
            x = point.x - w / 2
            y = point.y - h / 2
          }
          ed.createShape({
            id: createShapeId(),
            type: 'ui-component-instance',
            x,
            y,
            parentId: parentId as any,
            props: { w, h, defId },
          } as any)
          return true
        }

        // Path B: dropping a built-in component
        const type = event.dataTransfer?.getData(DRAG_MIME)
        if (!type) return false
        const reg = getRegistration(type)
        if (!reg) return true

        const { w, h } = reg.initialSize
        const container = findContainerAtPoint(ed, point, type)

        let x: number
        let y: number
        let parentId: string
        if (container) {
          const containerBounds = ed.getShapePageBounds(container.id)!
          parentId = container.id
          x = point.x - containerBounds.x - w / 2
          y = point.y - containerBounds.y - h / 2
        } else {
          parentId = ed.getCurrentPageId()
          x = point.x - w / 2
          y = point.y - h / 2
        }

        ed.createShape({
          id: createShapeId(),
          type: reg.type,
          x,
          y,
          parentId: parentId as any,
          props: { ...reg.defaults, w, h },
        } as any)
        return true
      },
    }),
    [],
  )

  return (
    <EditorRefProvider editor={editor}>
      <CodePreviewContext.Provider value={{ open: setCodePreviewTarget }}>
        <div className="fixed inset-0 flex bg-zinc-100">
          <LibraryPanel />
          <div className="flex-1 relative">
            <Tldraw
              store={store}
              shapeUtils={customShapeUtils}
              components={components}
              options={tldrawOptions}
              onMount={handleMount}
            />
            <EditBanner />
            <PreviewToggle />
          </div>
          <Inspector />
        </div>
        {editor && (
          <CodePreview
            editor={editor}
            target={codePreviewTarget}
            onClose={() => setCodePreviewTarget(null)}
          />
        )}
        <CmdKPalette />
      </CodePreviewContext.Provider>
    </EditorRefProvider>
  )
}

/** Walk shapes back-to-front; pick the smallest container whose bounds contain
 *  the drop point. Skip the dragged-in type itself when nesting containers. */
function findContainerAtPoint(editor: Editor, pagePoint: { x: number; y: number }, droppingType: string) {
  const shapes = editor.getCurrentPageShapes()
  let best: { shape: (typeof shapes)[number]; area: number } | null = null
  for (const s of shapes) {
    if (!CONTAINER_TYPES.has(s.type)) continue
    // Don't drop a Page into another Page
    if (droppingType === 'ui-page' && s.type === 'ui-page') continue
    const b = editor.getShapePageBounds(s.id)
    if (!b) continue
    if (
      pagePoint.x < b.minX ||
      pagePoint.x > b.maxX ||
      pagePoint.y < b.minY ||
      pagePoint.y > b.maxY
    ) {
      continue
    }
    const area = b.w * b.h
    if (!best || area < best.area) best = { shape: s, area }
  }
  return best?.shape ?? null
}
