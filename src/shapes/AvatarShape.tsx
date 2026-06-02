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

export type AvatarShape = TLBaseShape<
  'ui-avatar',
  {
    w: number
    h: number
    src: string
    initials: string
    shape: 'circle' | 'square'
  }
>

export const avatarShapeProps: RecordProps<AvatarShape> = {
  w: T.number,
  h: T.number,
  src: T.string,
  initials: T.string,
  shape: T.literalEnum('circle', 'square'),
}

const DEFAULTS: AvatarShape['props'] = {
  w: 40,
  h: 40,
  src: '',
  initials: 'TG',
  shape: 'circle',
}

function hueFromInitials(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

export class AvatarShapeUtil extends BaseBoxShapeUtil<AvatarShape> {
  static override type = 'ui-avatar' as const
  static override props = avatarShapeProps

  override hideRotateHandle = () => true
  override isAspectRatioLocked = () => true

  override getDefaultProps(): AvatarShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: AvatarShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: AvatarShape, info: TLResizeInfo<AvatarShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: AvatarShape) {
    const { src, initials, shape: s, w, h } = shape.props
    const radius = s === 'circle' ? '9999px' : 'var(--ui-radius)'
    const hue = hueFromInitials(initials || 'A')
    const size = Math.max(10, Math.min(w, h) * 0.4)

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
        {src ? (
          <img
            src={src}
            alt={initials}
            draggable={false}
            className="w-full h-full object-cover pointer-events-none select-none"
            style={{ borderRadius: radius }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-semibold pointer-events-none select-none"
            style={{
              borderRadius: radius,
              background: `hsl(${hue}, 70%, 92%)`,
              color: `hsl(${hue}, 50%, 32%)`,
              fontSize: size,
            }}
          >
            {initials}
          </div>
        )}
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: AvatarShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

registerComponent({
  type: 'ui-avatar',
  label: 'Avatar',
  category: 'display',
  icon: 'User',
  initialSize: { w: 40, h: 40 },
  defaults: { ...DEFAULTS },
  schema: {
    initials: { kind: 'string', label: 'Initials' },
    src: { kind: 'string', label: 'Image URL', placeholder: 'https://…' },
    shape: {
      kind: 'enum',
      label: 'Shape',
      options: [
        { value: 'circle', label: 'Circle' },
        { value: 'square', label: 'Square' },
      ],
    },
  },
})
