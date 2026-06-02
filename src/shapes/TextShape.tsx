import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
} from 'tldraw'
import { registerComponent } from '@/lib/registry'
import { cn } from '@/lib/utils'

export type UITextShape = TLBaseShape<
  'ui-text',
  {
    w: number
    h: number
    content: string
    role: 'heading' | 'subheading' | 'body' | 'caption'
    align: 'left' | 'center' | 'right'
    weight: 'normal' | 'medium' | 'semibold' | 'bold'
    tone: 'default' | 'muted' | 'brand' | 'danger'
  }
>

export const textShapeProps: RecordProps<UITextShape> = {
  w: T.number,
  h: T.number,
  content: T.string,
  role: T.literalEnum('heading', 'subheading', 'body', 'caption'),
  align: T.literalEnum('left', 'center', 'right'),
  weight: T.literalEnum('normal', 'medium', 'semibold', 'bold'),
  tone: T.literalEnum('default', 'muted', 'brand', 'danger'),
}

const DEFAULTS: UITextShape['props'] = {
  w: 280,
  h: 32,
  content: 'Sign in to your account',
  role: 'heading',
  align: 'left',
  // weight 'normal' instead of 'semibold' so captions and body text don't
  // inherit a heavy weight just because they were dragged in as the
  // heading-default Text and re-roled later. Headings still read as
  // headings via `text-2xl leading-tight`; users can bump to semibold per
  // shape in the inspector when they want extra emphasis.
  weight: 'normal',
  tone: 'default',
}

const ROLE: Record<UITextShape['props']['role'], string> = {
  heading: 'text-2xl leading-tight',
  subheading: 'text-lg leading-snug',
  body: 'text-sm leading-normal',
  caption: 'text-xs leading-normal',
}

const TONE: Record<UITextShape['props']['tone'], string> = {
  default: 'text-fg',
  muted: 'text-muted',
  brand: 'text-brand',
  danger: 'text-danger',
}

const WEIGHT: Record<UITextShape['props']['weight'], string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
}

export class TextShapeUtil extends BaseBoxShapeUtil<UITextShape> {
  static override type = 'ui-text' as const
  static override props = textShapeProps

  override canResize = () => true
  override hideRotateHandle = () => true

  override getDefaultProps(): UITextShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: UITextShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: UITextShape, info: TLResizeInfo<UITextShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: UITextShape) {
    const { content, role, align, weight, tone, w, h } = shape.props
    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
        <div
          className={cn(
            'w-full h-full flex items-center pointer-events-none select-none',
            align === 'center' && 'justify-center text-center',
            align === 'right' && 'justify-end text-right',
            align === 'left' && 'justify-start text-left',
          )}
        >
          <span className={cn(ROLE[role], WEIGHT[weight], TONE[tone], 'truncate')}>{content}</span>
        </div>
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: UITextShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

registerComponent({
  type: 'ui-text',
  label: 'Text',
  category: 'display',
  icon: 'Type',
  initialSize: { w: 280, h: 32 },
  defaults: { ...DEFAULTS },
  schema: {
    content: { kind: 'string', label: 'Content', multiline: true },
    role: {
      kind: 'enum',
      label: 'Role',
      options: [
        { value: 'heading', label: 'Heading' },
        { value: 'subheading', label: 'Subheading' },
        { value: 'body', label: 'Body' },
        { value: 'caption', label: 'Caption' },
      ],
    },
    weight: {
      kind: 'enum',
      label: 'Weight',
      options: [
        { value: 'normal', label: 'Normal' },
        { value: 'medium', label: 'Medium' },
        { value: 'semibold', label: 'Semibold' },
        { value: 'bold', label: 'Bold' },
      ],
    },
    align: {
      kind: 'enum',
      label: 'Align',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ],
    },
    tone: {
      kind: 'enum',
      label: 'Tone',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'muted', label: 'Muted' },
        { value: 'brand', label: 'Brand' },
        { value: 'danger', label: 'Danger' },
      ],
    },
  },
})
