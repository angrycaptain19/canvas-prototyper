import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Editor } from 'tldraw'

// useEditor() from tldraw only works inside <Tldraw />. Our sibling panels
// (LibraryPanel, Inspector) live outside that tree, so we mirror the editor
// reference via React context after onMount.

const EditorRefCtx = createContext<Editor | null>(null)

export function EditorRefProvider({
  editor,
  children,
}: {
  editor: Editor | null
  children: ReactNode
}) {
  return <EditorRefCtx.Provider value={editor}>{children}</EditorRefCtx.Provider>
}

export function useEditorRef(): Editor | null {
  return useContext(EditorRefCtx)
}

/** Subscribe-style hook that re-renders when an editor signal changes. */
export function useEditorValue<T>(name: string, compute: (editor: Editor) => T): T | null {
  const editor = useEditorRef()
  const [value, setValue] = useState<T | null>(() => (editor ? compute(editor) : null))

  useEffect(() => {
    if (!editor) return
    // Initial sync
    setValue(compute(editor))
    // Re-run on any store change. Coarse but fine for inspector/library.
    const unsub = editor.store.listen(
      () => {
        setValue(compute(editor))
      },
      { scope: 'document', source: 'user' },
    )
    const unsub2 = editor.store.listen(
      () => {
        setValue(compute(editor))
      },
      { scope: 'session', source: 'user' },
    )
    return () => {
      unsub()
      unsub2()
    }
    // compute is captured by closure — caller is expected to keep it stable or wrap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, name])

  return value
}
