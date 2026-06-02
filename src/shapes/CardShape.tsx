import {
  BaseFrameLikeShapeUtil,
  Group2d,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
} from 'tldraw'
import { registerComponent } from '@/lib/registry'
import { ContainerChrome } from './ContainerChrome'

export type CardShape = TLBaseShape<
  'ui-card',
  {
    w: number
    h: number
    shadow: 'none' | 'sm' | 'md' | 'lg'
    borderRadius: number
    border: boolean
    padding: number
  }
>

export const cardShapeProps: RecordProps<CardShape> = {
  w: T.number,
  h: T.number,
  shadow: T.literalEnum('none', 'sm', 'md', 'lg'),
  borderRadius: T.number,
  border: T.boolean,
  padding: T.number,
}

const DEFAULTS: CardShape['props'] = {
  w: 360,
  h: 240,
  shadow: 'md',
  borderRadius: 12,
  border: true,
  padding: 24,
}

const SHADOW: Record<CardShape['props']['shadow'], string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-lg',
}

export class CardShapeUtil extends BaseFrameLikeShapeUtil<CardShape> {
  static override type = 'ui-card' as const
  static override props = cardShapeProps

  override hideRotateHandle = () => true

  override getClipPath() {
    return undefined
  }

  override getDefaultProps(): CardShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: CardShape) {
    return new Group2d({
      children: [
        new Rectangle2d({
          width: shape.props.w,
          height: shape.props.h,
          isFilled: true,
        }),
      ],
    })
  }

  override onResize(shape: CardShape, info: TLResizeInfo<CardShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: CardShape) {
    const { shadow, borderRadius, border, w, h } = shape.props
    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
        <div
          className={[
            'group relative w-full h-full bg-surface',
            SHADOW[shadow],
            border ? 'border border-border' : '',
          ].join(' ')}
          style={{ borderRadius }}
        >
          <ContainerChrome shapeId={shape.id} label="Card" color="violet" />
        </div>
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: CardShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

registerComponent({
  type: 'ui-card',
  label: 'Card',
  category: 'layout',
  icon: 'Square',
  initialSize: { w: 360, h: 240 },
  defaults: { ...DEFAULTS },
  schema: {
    style: {
      group: 'Style',
      props: {
        shadow: {
          kind: 'enum',
          label: 'Shadow',
          options: [
            { value: 'none', label: 'None' },
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
          ],
        },
        borderRadius: { kind: 'number', label: 'Radius', min: 0, max: 32, step: 1, unit: 'px' },
        border: { kind: 'boolean', label: 'Border' },
        padding: { kind: 'number', label: 'Padding', min: 0, max: 64, step: 1, unit: 'px' },
      },
    },
  },
})
