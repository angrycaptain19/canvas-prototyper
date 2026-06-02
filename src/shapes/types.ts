// Module augmentation: registers all custom shape types with tldraw's schema
// so TLShape includes them. Without this, BaseBoxShapeUtil<MyShape> rejects
// our shapes because TLBaseBoxShape is `Extract<TLShape, {props:{w,h}}>` and
// TLShape is otherwise closed to built-in types.

import type { ComponentDef } from '@/lib/componentDef'
import type { AlertShape } from './AlertShape'
import type { AvatarShape } from './AvatarShape'
import type { BadgeShape } from './BadgeShape'
import type { ButtonShape } from './ButtonShape'
import type { CardShape } from './CardShape'
import type { CheckboxShape } from './CheckboxShape'
import type { ComponentInstanceShape } from './ComponentInstanceShape'
import type { DividerShape } from './DividerShape'
import type { FormContainerShape } from './FormContainerShape'
import type { InputShape } from './InputShape'
import type { ListContainerShape } from './ListContainerShape'
import type { PageFrameShape } from './PageFrameShape'
import type { ProgressShape } from './ProgressShape'
import type { RadioShape } from './RadioShape'
import type { SelectShape } from './SelectShape'
import type { SlotShape } from './SlotShape'
import type { StackShape } from './StackShape'
import type { SwitchShape } from './SwitchShape'
import type { TabsShape } from './TabsShape'
import type { TagShape } from './TagShape'
import type { UITextShape } from './TextShape'

declare module '@tldraw/tlschema' {
  interface TLGlobalRecordPropsMap {
    componentDef: ComponentDef
  }
  interface TLGlobalShapePropsMap {
    'ui-alert': AlertShape['props']
    'ui-avatar': AvatarShape['props']
    'ui-badge': BadgeShape['props']
    'ui-button': ButtonShape['props']
    'ui-card': CardShape['props']
    'ui-checkbox': CheckboxShape['props']
    'ui-component-instance': ComponentInstanceShape['props']
    'ui-divider': DividerShape['props']
    'ui-form': FormContainerShape['props']
    'ui-input': InputShape['props']
    'ui-list': ListContainerShape['props']
    'ui-page': PageFrameShape['props']
    'ui-progress': ProgressShape['props']
    'ui-radio': RadioShape['props']
    'ui-select': SelectShape['props']
    'ui-slot': SlotShape['props']
    'ui-stack': StackShape['props']
    'ui-switch': SwitchShape['props']
    'ui-tabs': TabsShape['props']
    'ui-tag': TagShape['props']
    'ui-text': UITextShape['props']
  }
}

export {}
