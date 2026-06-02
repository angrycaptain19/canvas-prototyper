import './types' // augments tldraw's TLShape with our custom types
import { AlertShapeUtil } from './AlertShape'
import { AvatarShapeUtil } from './AvatarShape'
import { BadgeShapeUtil } from './BadgeShape'
import { ButtonShapeUtil } from './ButtonShape'
import { CardShapeUtil } from './CardShape'
import { CheckboxShapeUtil } from './CheckboxShape'
import { ComponentInstanceShapeUtil } from './ComponentInstanceShape'
import { DividerShapeUtil } from './DividerShape'
import { FormContainerShapeUtil } from './FormContainerShape'
import { InputShapeUtil } from './InputShape'
import { ListContainerShapeUtil } from './ListContainerShape'
import { PageFrameShapeUtil } from './PageFrameShape'
import { ProgressShapeUtil } from './ProgressShape'
import { RadioShapeUtil } from './RadioShape'
import { SelectShapeUtil } from './SelectShape'
import { SlotShapeUtil } from './SlotShape'
import { StackShapeUtil } from './StackShape'
import { SwitchShapeUtil } from './SwitchShape'
import { TabsShapeUtil } from './TabsShape'
import { TagShapeUtil } from './TagShape'
import { TextShapeUtil } from './TextShape'

export const customShapeUtils = [
  PageFrameShapeUtil,
  StackShapeUtil,
  FormContainerShapeUtil,
  ListContainerShapeUtil,
  CardShapeUtil,
  SlotShapeUtil,
  TabsShapeUtil,
  ButtonShapeUtil,
  InputShapeUtil,
  SelectShapeUtil,
  CheckboxShapeUtil,
  SwitchShapeUtil,
  RadioShapeUtil,
  TextShapeUtil,
  BadgeShapeUtil,
  TagShapeUtil,
  AvatarShapeUtil,
  AlertShapeUtil,
  ProgressShapeUtil,
  DividerShapeUtil,
  ComponentInstanceShapeUtil,
]

export type {
  ButtonShape,
} from './ButtonShape'
export type {
  CardShape,
} from './CardShape'
export type {
  InputShape,
} from './InputShape'
export type {
  PageFrameShape,
} from './PageFrameShape'
export type {
  StackShape,
} from './StackShape'
export type {
  UITextShape,
} from './TextShape'
