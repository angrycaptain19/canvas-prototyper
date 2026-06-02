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
import { cn } from '@/lib/utils'
import { getPreviewState, getPreviewStateAtom } from '@/lib/previewState'

export type ButtonShape = TLBaseShape<
  'ui-button',
  {
    w: number
    h: number
    label: string
    variant: 'primary' | 'secondary' | 'ghost' | 'destructive'
    size: 'sm' | 'md' | 'lg'
    /** Corner style. 'default' uses the theme radius token so it follows
     *  preset swaps; other values override that for per-button shape. */
    radius: 'default' | 'sm' | 'square' | 'pill'
    disabled: boolean
    loading: boolean
  }
>

export const buttonShapeProps: RecordProps<ButtonShape> = {
  w: T.number,
  h: T.number,
  label: T.string,
  variant: T.literalEnum('primary', 'secondary', 'ghost', 'destructive'),
  size: T.literalEnum('sm', 'md', 'lg'),
  radius: T.literalEnum('default', 'sm', 'square', 'pill'),
  disabled: T.boolean,
  loading: T.boolean,
}

const DEFAULTS: ButtonShape['props'] = {
  w: 120,
  h: 40,
  label: 'Button',
  variant: 'primary',
  size: 'md',
  radius: 'default',
  disabled: false,
  loading: false,
}

const RADIUS: Record<ButtonShape['props']['radius'], string> = {
  default: 'rounded-token',
  sm: 'rounded-token-sm',
  square: 'rounded-none',
  pill: 'rounded-full',
}

type Variant = ButtonShape['props']['variant']

const VARIANT_BASE: Record<Variant, string> = {
  primary: 'bg-brand text-brand-fg',
  secondary: 'bg-surface text-fg border border-border',
  ghost: 'bg-transparent text-fg',
  destructive: 'bg-danger text-danger-fg',
}

const VARIANT_HOVER: Record<Variant, string> = {
  primary: 'bg-brand/90',
  secondary: 'bg-bg',
  ghost: 'bg-bg',
  destructive: 'bg-danger/90',
}

const VARIANT_ACTIVE: Record<Variant, string> = {
  primary: 'bg-brand/80',
  secondary: 'bg-bg/80 border-border',
  ghost: 'bg-bg/60',
  destructive: 'bg-danger/80',
}

const SIZE: Record<ButtonShape['props']['size'], string> = {
  sm: 'text-xs px-2',
  md: 'text-sm px-4',
  lg: 'text-base px-6',
}

export class ButtonShapeUtil extends BaseBoxShapeUtil<ButtonShape> {
  static override type = 'ui-button' as const
  static override props = buttonShapeProps

  override canResize = () => true
  override hideRotateHandle = () => true

  override getDefaultProps(): ButtonShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: ButtonShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: ButtonShape, info: TLResizeInfo<ButtonShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: ButtonShape) {
    return <ButtonShapeBody shape={shape} />
  }

  override getIndicatorPath(shape: ButtonShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function ButtonShapeBody({ shape }: { shape: ButtonShape }) {
  const { label, variant, size, radius, disabled, loading, w, h } = shape.props
  const previewState = useValue(
    'button preview state',
    () => getPreviewState(shape.id),
    [shape.id],
  )

  return (
    <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
      <button
        type="button"
        disabled={disabled || loading}
        data-preview-state={previewState}
        className={cn(
          'w-full h-full font-medium transition-colors',
          RADIUS[radius] ?? RADIUS.default,
          'inline-flex items-center justify-center gap-1.5',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'pointer-events-none select-none',
          VARIANT_BASE[variant],
          previewState === 'hover' && VARIANT_HOVER[variant],
          previewState === 'active' && VARIANT_ACTIVE[variant],
          previewState === 'focus' && 'ring-2 ring-offset-2 ring-brand/50',
          SIZE[size],
        )}
      >
        {loading && (
          <svg
            className="animate-spin w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.3"
            />
            <path
              d="M22 12a10 10 0 0 1-10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        )}
        {label}
      </button>
    </HTMLContainer>
  )
}

registerComponent({
  type: 'ui-button',
  label: 'Button',
  category: 'primitive',
  icon: 'MousePointerClick',
  initialSize: { w: 120, h: 40 },
  hasStates: true,
  defaults: { ...DEFAULTS },
  schema: {
    label: { kind: 'string', label: 'Label', placeholder: 'Button text' },
    variant: {
      kind: 'enum',
      label: 'Variant',
      options: [
        { value: 'primary', label: 'Primary' },
        { value: 'secondary', label: 'Secondary' },
        { value: 'ghost', label: 'Ghost' },
        { value: 'destructive', label: 'Destructive' },
      ],
    },
    size: {
      kind: 'enum',
      label: 'Size',
      options: [
        { value: 'sm', label: 'Small' },
        { value: 'md', label: 'Medium' },
        { value: 'lg', label: 'Large' },
      ],
    },
    radius: {
      kind: 'enum',
      label: 'Radius',
      options: [
        { value: 'default', label: 'Default (theme)' },
        { value: 'sm', label: 'Small' },
        { value: 'square', label: 'Square' },
        { value: 'pill', label: 'Pill' },
      ],
    },
    disabled: { kind: 'boolean', label: 'Disabled' },
    loading: { kind: 'boolean', label: 'Loading' },
  },
})
