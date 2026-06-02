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

export type DividerShape = TLBaseShape<
  'ui-divider',
  {
    w: number
    h: number
    orientation: 'horizontal' | 'vertical'
    tone: 'border' | 'muted' | 'strong'
    thickness: number
  }
>

export const dividerShapeProps: RecordProps<DividerShape> = {
  w: T.number,
  h: T.number,
  orientation: T.literalEnum('horizontal', 'vertical'),
  tone: T.literalEnum('border', 'muted', 'strong'),
  thickness: T.number,
}

const DEFAULTS: DividerShape['props'] = {
  w: 240,
  h: 1,
  orientation: 'horizontal',
  tone: 'border',
  thickness: 1,
}

const TONE_CLASSES: Record<DividerShape['props']['tone'], string> = {
  border: 'bg-border',
  muted: 'bg-fg/10',
  strong: 'bg-fg/30',
}

export class DividerShapeUtil extends BaseBoxShapeUtil<DividerShape> {
  static override type = 'ui-divider' as const
  static override props = dividerShapeProps

  override hideRotateHandle = () => true

  override getDefaultProps(): DividerShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: DividerShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: DividerShape, info: TLResizeInfo<DividerShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: DividerShape) {
    const { orientation, tone, thickness, w, h } = shape.props
    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
        <div
          className={'pointer-events-none ' + TONE_CLASSES[tone]}
          style={
            orientation === 'horizontal'
              ? { width: '100%', height: thickness, marginTop: (h - thickness) / 2 }
              : { width: thickness, height: '100%', marginLeft: (w - thickness) / 2 }
          }
        />
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: DividerShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

registerComponent({
  type: 'ui-divider',
  label: 'Divider',
  category: 'display',
  icon: 'Minus',
  initialSize: { w: 240, h: 1 },
  defaults: { ...DEFAULTS },
  schema: {
    orientation: {
      kind: 'enum',
      label: 'Orientation',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
      ],
    },
    tone: {
      kind: 'enum',
      label: 'Tone',
      options: [
        { value: 'border', label: 'Border' },
        { value: 'muted', label: 'Muted' },
        { value: 'strong', label: 'Strong' },
      ],
    },
    thickness: { kind: 'number', label: 'Thickness', min: 1, max: 8, step: 1, unit: 'px' },
  },
})
