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

export type ProgressShape = TLBaseShape<
  'ui-progress',
  {
    w: number
    h: number
    value: number
    max: number
    tone: 'brand' | 'success' | 'warning' | 'danger'
    showLabel: boolean
  }
>

export const progressShapeProps: RecordProps<ProgressShape> = {
  w: T.number,
  h: T.number,
  value: T.number,
  max: T.number,
  tone: T.literalEnum('brand', 'success', 'warning', 'danger'),
  showLabel: T.boolean,
}

const DEFAULTS: ProgressShape['props'] = {
  w: 240,
  h: 8,
  value: 60,
  max: 100,
  tone: 'brand',
  showLabel: false,
}

const FILL_TONE: Record<ProgressShape['props']['tone'], string> = {
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

export class ProgressShapeUtil extends BaseBoxShapeUtil<ProgressShape> {
  static override type = 'ui-progress' as const
  static override props = progressShapeProps

  override hideRotateHandle = () => true

  override getDefaultProps(): ProgressShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: ProgressShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: ProgressShape, info: TLResizeInfo<ProgressShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: ProgressShape) {
    const { value, max, tone, showLabel, w, h } = shape.props
    const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
        <div className="w-full h-full flex items-center gap-2 pointer-events-none select-none">
          <div className="flex-1 h-full bg-fg/10 rounded-full overflow-hidden">
            <div
              className={'h-full rounded-full transition-all ' + FILL_TONE[tone]}
              style={{ width: `${pct}%` }}
            />
          </div>
          {showLabel && (
            <span className="text-[10px] font-medium text-fg/70 tabular-nums">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: ProgressShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

registerComponent({
  type: 'ui-progress',
  label: 'Progress',
  category: 'display',
  icon: 'LoaderCircle',
  initialSize: { w: 240, h: 8 },
  defaults: { ...DEFAULTS },
  schema: {
    value: { kind: 'number', label: 'Value', min: 0, max: 9999, step: 1 },
    max: { kind: 'number', label: 'Max', min: 1, max: 9999, step: 1 },
    tone: {
      kind: 'enum',
      label: 'Tone',
      options: [
        { value: 'brand', label: 'Brand' },
        { value: 'success', label: 'Success' },
        { value: 'warning', label: 'Warning' },
        { value: 'danger', label: 'Danger' },
      ],
    },
    showLabel: { kind: 'boolean', label: 'Show %' },
  },
})
