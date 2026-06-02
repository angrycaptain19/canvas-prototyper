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
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { registerComponent } from '@/lib/registry'

export type AlertShape = TLBaseShape<
  'ui-alert',
  {
    w: number
    h: number
    title: string
    description: string
    tone: 'info' | 'success' | 'warning' | 'danger'
    variant: 'subtle' | 'solid' | 'outline'
  }
>

export const alertShapeProps: RecordProps<AlertShape> = {
  w: T.number,
  h: T.number,
  title: T.string,
  description: T.string,
  tone: T.literalEnum('info', 'success', 'warning', 'danger'),
  variant: T.literalEnum('subtle', 'solid', 'outline'),
}

const DEFAULTS: AlertShape['props'] = {
  w: 420,
  h: 72,
  title: 'Heads up',
  description: 'Something important happened.',
  tone: 'info',
  variant: 'subtle',
}

const SUBTLE: Record<AlertShape['props']['tone'], string> = {
  info: 'bg-brand/10 text-brand border-brand/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
}
const SOLID: Record<AlertShape['props']['tone'], string> = {
  info: 'bg-brand text-brand-fg border-brand',
  success: 'bg-success text-success-fg border-success',
  warning: 'bg-warning text-warning-fg border-warning',
  danger: 'bg-danger text-danger-fg border-danger',
}
const OUTLINE: Record<AlertShape['props']['tone'], string> = {
  info: 'bg-surface text-brand border-brand',
  success: 'bg-surface text-success border-success',
  warning: 'bg-surface text-warning border-warning',
  danger: 'bg-surface text-danger border-danger',
}

const ICON: Record<AlertShape['props']['tone'], typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
}

export class AlertShapeUtil extends BaseBoxShapeUtil<AlertShape> {
  static override type = 'ui-alert' as const
  static override props = alertShapeProps

  override hideRotateHandle = () => true

  override getDefaultProps(): AlertShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: AlertShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: AlertShape, info: TLResizeInfo<AlertShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: AlertShape) {
    const { title, description, tone, variant, w, h } = shape.props
    const styles =
      variant === 'solid' ? SOLID[tone] : variant === 'outline' ? OUTLINE[tone] : SUBTLE[tone]
    const Icon = ICON[tone]
    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
        <div
          className={
            'w-full h-full rounded-token border px-3 py-2 flex items-start gap-2 pointer-events-none select-none ' +
            styles
          }
        >
          <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">{title}</div>
            {description && (
              <div className="text-xs opacity-90 leading-snug mt-0.5">{description}</div>
            )}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: AlertShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

registerComponent({
  type: 'ui-alert',
  label: 'Alert',
  category: 'display',
  icon: 'TriangleAlert',
  initialSize: { w: 420, h: 72 },
  defaults: { ...DEFAULTS },
  schema: {
    title: { kind: 'string', label: 'Title' },
    description: { kind: 'string', label: 'Description', multiline: true },
    tone: {
      kind: 'enum',
      label: 'Tone',
      options: [
        { value: 'info', label: 'Info' },
        { value: 'success', label: 'Success' },
        { value: 'warning', label: 'Warning' },
        { value: 'danger', label: 'Danger' },
      ],
    },
    variant: {
      kind: 'enum',
      label: 'Variant',
      options: [
        { value: 'subtle', label: 'Subtle' },
        { value: 'solid', label: 'Solid' },
        { value: 'outline', label: 'Outline' },
      ],
    },
  },
})
