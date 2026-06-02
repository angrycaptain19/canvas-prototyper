// ComponentDef — a tldraw store record (not a shape) describing a reusable
// component template. Instances reference defs by id and render the template
// tree at runtime.

import { createRecordType, T, type RecordId } from 'tldraw'
import type { BaseRecord } from '@tldraw/store'

/** A serialized shape in the template tree — relative-coords, just data. */
export interface TemplateNode {
  type: string
  x: number
  y: number
  w: number
  h: number
  props: Record<string, unknown>
  meta?: Record<string, unknown>
  children?: TemplateNode[]
}

export interface VariantAxis {
  name: string
  values: string[]
  default: string
}

export interface ComponentDef extends BaseRecord<'componentDef', RecordId<ComponentDef>> {
  name: string
  icon: string
  category: 'layout' | 'primitive' | 'form' | 'display' | 'custom'
  /** Template for the default combo (all axes at their defaults). */
  template: TemplateNode
  templateBounds: { w: number; h: number }
  /** Zero or more variant axes (Figma-style component variants, composable). */
  variants?: VariantAxis[]
  /** Snapshots for non-default combos. Keys are combo keys: sorted by axis
   *  name, only non-default values included, joined with "|".
   *  Empty combo key = all defaults = the `template` field (not stored here). */
  variantSnapshots?: Record<string, TemplateNode>
  createdAt: number
}

export type ComponentDefId = RecordId<ComponentDef>

// JSON validator for the template tree — the structure is recursive so we
// keep validation coarse. Shape integrity is the schema's job once instantiated.
const templateNodeValidator = T.jsonValue as unknown as T.Validator<TemplateNode>

export const componentDefValidator: T.Validator<ComponentDef> = T.model(
  'componentDef',
  T.object({
    id: T.string as unknown as T.Validator<ComponentDefId>,
    typeName: T.literal('componentDef'),
    name: T.string,
    icon: T.string,
    category: T.literalEnum('layout', 'primitive', 'form', 'display', 'custom'),
    template: templateNodeValidator,
    templateBounds: T.object({ w: T.number, h: T.number }),
    variants: T.jsonValue.optional() as unknown as T.Validator<VariantAxis[] | undefined>,
    variantSnapshots: T.jsonValue.optional() as unknown as T.Validator<
      Record<string, TemplateNode> | undefined
    >,
    createdAt: T.number,
  }),
) as T.Validator<ComponentDef>

export const ComponentDefRecord = createRecordType<ComponentDef>('componentDef', {
  scope: 'document',
  validator: componentDefValidator,
})

export function newComponentDefId(): ComponentDefId {
  return ComponentDefRecord.createId() as ComponentDefId
}
