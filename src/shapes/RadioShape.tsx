import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
  useValue,
} from 'tldraw'
import { registerComponent } from '@/lib/registry'
import { getPreviewState } from '@/lib/previewState'

export type RadioShape = TLBaseShape<
  'ui-radio',
  {
    w: number
    h: number
    label: string
    checked: boolean
    disabled: boolean
    /** Form name — radios in the same group share a name. */
    name: string
  }
>

export const radioShapeProps: RecordProps<RadioShape> = {
  w: T.number,
  h: T.number,
  label: T.string,
  checked: T.boolean,
  disabled: T.boolean,
  name: T.string,
}

const DEFAULTS: RadioShape['props'] = {
  w: 220,
  h: 24,
  label: 'Option',
  checked: false,
  disabled: false,
  name: 'group',
}

export class RadioShapeUtil extends BaseBoxShapeUtil<RadioShape> {
  static override type = 'ui-radio' as const
  static override props = radioShapeProps

  override hideRotateHandle = () => true

  override getDefaultProps(): RadioShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: RadioShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: RadioShape, info: TLResizeInfo<RadioShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: RadioShape) {
    return <RadioBody shape={shape} />
  }

  override getIndicatorPath(shape: RadioShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function RadioBody({ shape }: { shape: RadioShape }) {
  const { label, checked, disabled, w, h } = shape.props
  const previewState = useValue('radio preview', () => getPreviewState(shape.id), [shape.id])
  let circleClass = checked ? 'border-brand' : 'border-border'
  if (previewState === 'hover' && !checked) circleClass = 'border-fg/50'
  if (previewState === 'focus') circleClass += ' ring-2 ring-brand/40 ring-offset-1'
  return (
    <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
      <div
        className={
          'w-full h-full flex items-center gap-2 pointer-events-none select-none ' +
          (disabled ? 'opacity-50' : '')
        }
        data-preview-state={previewState}
      >
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border bg-surface ${circleClass}`}>
          {checked && <span className="w-2 h-2 rounded-full bg-brand" />}
        </span>
        <span className="text-sm text-fg truncate">{label}</span>
      </div>
    </HTMLContainer>
  )
}

registerComponent({
  type: 'ui-radio',
  label: 'Radio',
  category: 'form',
  icon: 'CircleDot',
  initialSize: { w: 220, h: 24 },
  hasStates: true,
  defaults: { ...DEFAULTS },
  schema: {
    label: { kind: 'string', label: 'Label' },
    name: { kind: 'string', label: 'Group name', placeholder: 'options' },
    checked: { kind: 'boolean', label: 'Checked' },
    disabled: { kind: 'boolean', label: 'Disabled' },
  },
})
