// Hierarchical tree of every shape on the current page. Click a row to
// select that shape on the canvas; click the caret to collapse/expand its
// subtree. Keeps selection in sync with the canvas via store subscriptions.

import { useState } from 'react'
import { useValue } from '@tldraw/state-react'
import * as Icons from 'lucide-react'
import type { Editor, TLShape, TLShapeId } from 'tldraw'
import { useEditorRef } from '@/lib/editorContext'
import { getRegistration } from '@/lib/registry'

interface TreeNode {
  id: TLShapeId
  shape: TLShape
  children: TreeNode[]
}

function buildTree(editor: Editor): TreeNode[] {
  const pageId = editor.getCurrentPageId()
  return collectChildren(editor, pageId)
}

function collectChildren(editor: Editor, parentId: string): TreeNode[] {
  const childIds = editor.getSortedChildIdsForParent(parentId as never)
  const out: TreeNode[] = []
  for (const id of childIds) {
    const shape = editor.getShape(id)
    if (!shape) continue
    if (!getRegistration(shape.type)) continue // hide arrows/draw/etc.
    out.push({
      id: shape.id as TLShapeId,
      shape,
      children: collectChildren(editor, shape.id),
    })
  }
  return out
}

function shapeDisplay(shape: TLShape): { label: string; detail: string | null; iconName: string } {
  const reg = getRegistration(shape.type)
  const baseLabel = reg?.label ?? shape.type
  const iconName = reg?.icon ?? 'Square'
  const props = shape.props as Record<string, unknown>

  if (shape.type === 'ui-page') {
    const name = String(props.name ?? '')
    return { label: name || 'Page', detail: null, iconName: 'AppWindow' }
  }
  if (shape.type === 'ui-text') {
    const text = String(props.content ?? props.text ?? '').trim()
    return { label: baseLabel, detail: text ? truncate(text, 32) : null, iconName }
  }
  if (shape.type === 'ui-button') {
    const text = String(props.label ?? '').trim()
    return { label: baseLabel, detail: text ? truncate(text, 32) : null, iconName }
  }
  if (shape.type === 'ui-input' || shape.type === 'ui-select') {
    const placeholder = String(props.label ?? props.placeholder ?? '').trim()
    return { label: baseLabel, detail: placeholder ? truncate(placeholder, 32) : null, iconName }
  }
  if (shape.type === 'ui-checkbox' || shape.type === 'ui-switch' || shape.type === 'ui-radio') {
    const text = String(props.label ?? '').trim()
    return { label: baseLabel, detail: text ? truncate(text, 32) : null, iconName }
  }
  if (shape.type === 'ui-badge' || shape.type === 'ui-tag') {
    const text = String(props.label ?? '').trim()
    return { label: baseLabel, detail: text ? truncate(text, 32) : null, iconName }
  }
  if (shape.type === 'ui-alert') {
    const text = String(props.title ?? '').trim()
    return { label: baseLabel, detail: text ? truncate(text, 32) : null, iconName }
  }
  if (shape.type === 'ui-component-instance') {
    return { label: 'Instance', detail: null, iconName: 'Component' }
  }
  return { label: baseLabel, detail: null, iconName }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function LayersPanel() {
  const editor = useEditorRef()
  const tree = useValue<TreeNode[]>(
    'layers-tree',
    () => (editor ? buildTree(editor) : []),
    [editor],
  )
  const selectedIds = useValue<Set<TLShapeId>>(
    'layers-selection',
    () => new Set(editor?.getSelectedShapeIds() ?? []),
    [editor],
  )
  const [collapsed, setCollapsed] = useState<Set<TLShapeId>>(new Set())

  if (!editor) return null
  if (tree.length === 0) {
    return (
      <div className="p-4 text-xs text-zinc-500">
        Drop a shape on the canvas to see it here.
      </div>
    )
  }

  return (
    <div className="py-2">
      {tree.map(node => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          selectedIds={selectedIds}
          collapsed={collapsed}
          toggleCollapsed={id =>
            setCollapsed(prev => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          editor={editor}
        />
      ))}
    </div>
  )
}

interface TreeRowProps {
  node: TreeNode
  depth: number
  selectedIds: Set<TLShapeId>
  collapsed: Set<TLShapeId>
  toggleCollapsed: (id: TLShapeId) => void
  editor: Editor
}

function TreeRow({ node, depth, selectedIds, collapsed, toggleCollapsed, editor }: TreeRowProps) {
  const { label, detail, iconName } = shapeDisplay(node.shape)
  const Icon = (Icons as Record<string, unknown>)[iconName] as
    | React.ComponentType<{ className?: string }>
    | undefined
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsed.has(node.id)
  const isSelected = selectedIds.has(node.id)

  return (
    <>
      <div
        role="button"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
          if (e.shiftKey || e.metaKey || e.ctrlKey) {
            const next = new Set(selectedIds)
            if (next.has(node.id)) next.delete(node.id)
            else next.add(node.id)
            editor.setSelectedShapes([...next])
          } else {
            editor.select(node.id)
          }
        }}
        className={
          'flex items-center gap-1 px-2 py-1 text-[11px] cursor-default transition-colors ' +
          (isSelected
            ? 'bg-[#0a0a0a]/[0.06] text-[#0a0a0a] font-medium'
            : 'text-zinc-700 hover:bg-[#f5f5f5]')
        }
        style={{ paddingLeft: 6 + depth * 12 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              toggleCollapsed(node.id)
            }}
            className="w-3 h-3 inline-flex items-center justify-center text-zinc-400 hover:text-zinc-700"
          >
            {isCollapsed ? (
              <Icons.ChevronRight className="w-3 h-3" />
            ) : (
              <Icons.ChevronDown className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-3 h-3" />
        )}
        {Icon && <Icon className="w-3 h-3 flex-shrink-0 text-zinc-400" />}
        <span className="font-medium truncate">{label}</span>
        {detail && <span className="text-zinc-400 truncate">— {detail}</span>}
      </div>
      {!isCollapsed &&
        node.children.map(child => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedIds={selectedIds}
            collapsed={collapsed}
            toggleCollapsed={toggleCollapsed}
            editor={editor}
          />
        ))}
    </>
  )
}
