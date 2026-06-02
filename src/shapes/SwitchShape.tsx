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

export type SwitchShape = TLBaseShape<
  'ui-switch',
  { w: number; h: number; label: string; checked: boolean; disabled: boolean }
>

export const switchShapeProps: RecordProps<SwitchShape> = {
  w: T.number,
  h: T.number,
  label: T.string,
  checked: T.boolean,
  disabled: T.boolean,
}

const DEFAULTS: SwitchShape['props'] = {
  w: 220,
  h: 24,
  label: 'Notifications',
  checked: false,
  disabled: false,
}

export class SwitchShapeUtil extends BaseBoxShapeUtil<SwitchShape> {
  static override type = 'ui-switch' as const
  static override props = switchShapeProps

  override hideRotateHandle = () => true

  override getDefaultProps(): SwitchShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: SwitchShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: SwitchShape, info: TLResizeInfo<SwitchShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: SwitchShape) {
    return <SwitchBody shape={shape} />
  }

  override getIndicatorPath(shape: SwitchShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function SwitchBody({ shape }: { shape: SwitchShape }) {
  const { label, checked, disabled, w, h } = shape.props
  const previewState = useValue('switch preview', () => getPreviewState(shape.id), [shape.id])
  const trackBase = 'inline-flex items-center w-9 h-5 rounded-full relative transition-colors flex-shrink-0'
  const trackColor = checked ? 'bg-brand' : 'bg-fg/20'
  const trackFocus = previewState === 'focus' ? ' ring-2 ring-brand/40 ring-offset-1' : ''
  return (
    <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
      <div
        className={
          'w-full h-full flex items-center gap-2 pointer-events-none select-none ' +
          (disabled ? 'opacity-50' : '')
        }
        data-preview-state={previewState}
      >
        <span className={`${trackBase} ${trackColor}${trackFocus}`}>
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow transition-all"
            style={{ left: checked ? 18 : 2 }}
          />
        </span>
        <span className="text-sm text-fg truncate">{label}</span>
      </div>
    </HTMLContainer>
  )
}

registerComponent({
  type: 'ui-switch',
  label: 'Switch',
  category: 'form',
  icon: 'ToggleRight',
  initialSize: { w: 220, h: 24 },
  hasStates: true,
  defaults: { ...DEFAULTS },
  schema: {
    label: { kind: 'string', label: 'Label' },
    checked: { kind: 'boolean', label: 'Checked' },
    disabled: { kind: 'boolean', label: 'Disabled' },
  },
})
