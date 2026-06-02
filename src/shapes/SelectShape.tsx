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
import { ChevronDown } from 'lucide-react'
import { registerComponent } from '@/lib/registry'
import { getPreviewState } from '@/lib/previewState'

export type SelectShape = TLBaseShape<
  'ui-select',
  {
    w: number
    h: number
    label: string
    placeholder: string
    value: string
    disabled: boolean
    /** Comma-separated option list (e.g. "United States, Canada, Mexico"). */
    options: string
  }
>

export const selectShapeProps: RecordProps<SelectShape> = {
  w: T.number,
  h: T.number,
  label: T.string,
  placeholder: T.string,
  value: T.string,
  disabled: T.boolean,
  options: T.string,
}

const DEFAULTS: SelectShape['props'] = {
  w: 280,
  h: 68,
  label: 'Country',
  placeholder: 'Select a country',
  value: '',
  disabled: false,
  options: 'United States, Canada, Mexico, United Kingdom',
}

export class SelectShapeUtil extends BaseBoxShapeUtil<SelectShape> {
  static override type = 'ui-select' as const
  static override props = selectShapeProps

  override hideRotateHandle = () => true

  override getDefaultProps(): SelectShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: SelectShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: SelectShape, info: TLResizeInfo<SelectShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: SelectShape) {
    return <SelectShapeBody shape={shape} />
  }

  override getIndicatorPath(shape: SelectShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function SelectShapeBody({ shape }: { shape: SelectShape }) {
  const { label, placeholder, value, disabled, w, h } = shape.props
  const previewState = useValue('select preview', () => getPreviewState(shape.id), [shape.id])

  let triggerCls = 'border-border bg-surface'
  if (previewState === 'hover') triggerCls = 'border-fg/40 bg-surface'
  if (previewState === 'active' || previewState === 'focus') {
    triggerCls = 'border-brand bg-surface ring-2 ring-brand/40'
  }

  return (
    <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
      <div
        className={
          'w-full h-full flex flex-col gap-1.5 pointer-events-none select-none ' +
          (disabled ? 'opacity-50' : '')
        }
        data-preview-state={previewState}
      >
        {label && <label className="text-xs font-medium text-fg">{label}</label>}
        <div
          className={
            'flex-1 min-h-0 flex items-center justify-between px-3 rounded-token border transition-colors ' +
            triggerCls
          }
        >
          <span className={'text-sm ' + (value ? 'text-fg' : 'text-muted')}>
            {value || placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-muted" />
        </div>
      </div>
    </HTMLContainer>
  )
}

registerComponent({
  type: 'ui-select',
  label: 'Select',
  category: 'form',
  icon: 'ChevronsUpDown',
  initialSize: { w: 280, h: 68 },
  hasStates: true,
  defaults: { ...DEFAULTS },
  schema: {
    label: { kind: 'string', label: 'Label' },
    placeholder: { kind: 'string', label: 'Placeholder' },
    value: { kind: 'string', label: 'Value' },
    options: {
      kind: 'string',
      label: 'Options',
      placeholder: 'Comma-separated, e.g. "US, Canada, Mexico"',
    },
    disabled: { kind: 'boolean', label: 'Disabled' },
  },
})
