import { createContext, useContext } from 'react'
import type { CodePreviewTarget } from './CodePreview'

export const CodePreviewContext = createContext<{
  open: (target: CodePreviewTarget) => void
}>({ open: () => {} })

export function useOpenCodePreview() {
  return useContext(CodePreviewContext).open
}
