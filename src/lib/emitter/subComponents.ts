// Sub-component definitions that get appended to the emitted file when
// extraction is enabled (3+ instances of the same pattern in the tree).

import type { TemplateNode } from '@/lib/componentDef'

export function countNodesOfType(node: TemplateNode, type: string): number {
  let n = node.type === type ? 1 : 0
  for (const c of node.children ?? []) n += countNodesOfType(c, type)
  return n
}

/** Threshold: extract a sub-component when there are this many instances. */
export const EXTRACT_THRESHOLD = 3

export const FIELD_SUBCOMPONENT_SOURCE = `function Field(props: {
  id: string
  name: string
  label: string
  type?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
}) {
  return (
    <div className="flex-1 flex flex-col gap-1.5">
      <label htmlFor={props.id} className="text-xs font-medium text-fg">
        {props.label}
        {props.required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <input
        id={props.id}
        name={props.name}
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        defaultValue={props.defaultValue}
        required={props.required}
        className="w-full h-10 px-3 rounded-token border border-border bg-surface text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
      />
    </div>
  )
}`

export const FIELD_SUBCOMPONENT_SOURCE_SHADCN = `function Field(props: {
  id: string
  name: string
  label: string
  type?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
}) {
  return (
    <div className="flex-1 flex flex-col gap-1.5">
      <Label htmlFor={props.id}>
        {props.label}
        {props.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={props.id}
        name={props.name}
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        defaultValue={props.defaultValue}
        required={props.required}
      />
    </div>
  )
}`
