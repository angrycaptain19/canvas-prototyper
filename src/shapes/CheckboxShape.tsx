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
import { Check } from 'lucide-react'
import { registerComponent } from '@/lib/registry'
import { getPreviewState } from '@/lib/previewState'

export type CheckboxShape = TLBaseShape<
  'ui-checkbox',
  { w: number; h: number; label: string; checked: boolean; disabled: boolean }
>

export const checkboxShapeProps: RecordProps<CheckboxShape> = {
  w: T.number,
  h: T.number,
  label: T.string,
  checked: T.boolean,
  disabled: T.boolean,
}

const DEFAULTS: CheckboxShape['props'] = {
  w: 200,
  h: 24,
  label: 'I agree to the terms',
  checked: false,
  disabled: false,
}

export class CheckboxShapeUtil extends BaseBoxShapeUtil<CheckboxShape> {
  static override type = 'ui-checkbox' as const
  static override props = checkboxShapeProps

  override hideRotateHandle = () => true

  override getDefaultProps(): CheckboxShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: CheckboxShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: CheckboxShape, info: TLResizeInfo<CheckboxShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: CheckboxShape) {
    return <CheckboxShapeBody shape={shape} />
  }

  override getIndicatorPath(shape: CheckboxShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function CheckboxShapeBody({ shape }: { shape: CheckboxShape }) {
  const { label, checked, disabled, w, h } = shape.props
  const previewState = useValue('checkbox preview', () => getPreviewState(shape.id), [shape.id])

  let boxClass = checked
    ? 'bg-brand border-brand text-brand-fg'
    : 'bg-surface border-border'
  if (previewState === 'hover' && !checked) boxClass = 'bg-surface border-fg/50'
  if (previewState === 'active' && !checked) boxClass = 'bg-bg border-brand'
  if (previewState === 'focus') boxClass += ' ring-2 ring-brand/40 ring-offset-1'

  return (
    <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
      <div
        className={
          'w-full h-full flex items-center gap-2 pointer-events-none select-none ' +
          (disabled ? 'opacity-50' : '')
        }
        data-preview-state={previewState}
      >
        <span className={'inline-flex items-center justify-center w-4 h-4 rounded border ' + boxClass}>
          {checked && <Check className="w-3 h-3" strokeWidth={3} />}
        </span>
        <span className="text-sm text-fg truncate">{label}</span>
      </div>
    </HTMLContainer>
  )
}

registerComponent({
  type: 'ui-checkbox',
  label: 'Checkbox',
  category: 'form',
  icon: 'CheckSquare',
  initialSize: { w: 200, h: 24 },
  hasStates: true,
  defaults: { ...DEFAULTS },
  schema: {
    label: { kind: 'string', label: 'Label' },
    checked: { kind: 'boolean', label: 'Checked' },
    disabled: { kind: 'boolean', label: 'Disabled' },
  },
})
