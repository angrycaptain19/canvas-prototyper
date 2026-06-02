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
import { Label } from '@radix-ui/react-label'
import { registerComponent } from '@/lib/registry'
import { cn } from '@/lib/utils'
import { getPreviewState } from '@/lib/previewState'

export type InputShape = TLBaseShape<
  'ui-input',
  {
    w: number
    h: number
    label: string
    placeholder: string
    type: 'text' | 'email' | 'password' | 'number'
    required: boolean
  }
>

export const inputShapeProps: RecordProps<InputShape> = {
  w: T.number,
  h: T.number,
  label: T.string,
  placeholder: T.string,
  type: T.literalEnum('text', 'email', 'password', 'number'),
  required: T.boolean,
}

const DEFAULTS: InputShape['props'] = {
  w: 280,
  h: 68,
  label: 'Email',
  placeholder: 'you@example.com',
  type: 'email',
  required: false,
}

export class InputShapeUtil extends BaseBoxShapeUtil<InputShape> {
  static override type = 'ui-input' as const
  static override props = inputShapeProps

  override canResize = () => true
  override hideRotateHandle = () => true

  override getDefaultProps(): InputShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: InputShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: InputShape, info: TLResizeInfo<InputShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: InputShape) {
    return <InputShapeBody shape={shape} />
  }

  override getIndicatorPath(shape: InputShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function InputShapeBody({ shape }: { shape: InputShape }) {
  const { label, placeholder, type, required, w, h } = shape.props
  const previewState = useValue('input preview', () => getPreviewState(shape.id), [shape.id])
  return (
    <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
      <div
        className="w-full h-full flex flex-col gap-1.5 pointer-events-none select-none"
        data-preview-state={previewState}
      >
        {label && (
          <Label className="text-xs font-medium text-fg">
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
          </Label>
        )}
        <input
          type={type}
          placeholder={placeholder}
          disabled
          className={cn(
            'flex-1 min-h-0 px-3 rounded-token border bg-surface',
            'text-sm text-fg placeholder:text-muted',
            previewState === 'focus' && 'border-brand ring-2 ring-brand/40',
            previewState === 'hover' && 'border-fg/40',
            previewState === 'active' && 'border-brand',
            previewState === 'default' && 'border-border',
          )}
        />
      </div>
    </HTMLContainer>
  )
}

registerComponent({
  type: 'ui-input',
  label: 'Input',
  category: 'form',
  icon: 'TextCursorInput',
  initialSize: { w: 280, h: 68 },
  hasStates: true,
  defaults: { ...DEFAULTS },
  schema: {
    label: { kind: 'string', label: 'Label' },
    placeholder: { kind: 'string', label: 'Placeholder' },
    type: {
      kind: 'enum',
      label: 'Type',
      options: [
        { value: 'text', label: 'Text' },
        { value: 'email', label: 'Email' },
        { value: 'password', label: 'Password' },
        { value: 'number', label: 'Number' },
      ],
    },
    required: { kind: 'boolean', label: 'Required' },
  },
})
