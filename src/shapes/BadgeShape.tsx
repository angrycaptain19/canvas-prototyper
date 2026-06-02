import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
  useEditor,
} from 'tldraw'
import { useEffect, useRef } from 'react'
import { registerComponent } from '@/lib/registry'

export type BadgeShape = TLBaseShape<
  'ui-badge',
  {
    w: number
    h: number
    label: string
    tone: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
    variant: 'solid' | 'subtle' | 'outline'
  }
>

export const badgeShapeProps: RecordProps<BadgeShape> = {
  w: T.number,
  h: T.number,
  label: T.string,
  tone: T.literalEnum('neutral', 'brand', 'success', 'warning', 'danger'),
  variant: T.literalEnum('solid', 'subtle', 'outline'),
}

const DEFAULTS: BadgeShape['props'] = {
  w: 64,
  h: 22,
  label: 'New',
  tone: 'brand',
  variant: 'subtle',
}

const TONE_SOLID: Record<BadgeShape['props']['tone'], string> = {
  neutral: 'bg-fg text-bg',
  brand: 'bg-brand text-brand-fg',
  success: 'bg-success text-success-fg',
  warning: 'bg-warning text-warning-fg',
  danger: 'bg-danger text-danger-fg',
}

const TONE_SUBTLE: Record<BadgeShape['props']['tone'], string> = {
  neutral: 'bg-bg text-fg',
  brand: 'bg-brand/15 text-brand',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
}

const TONE_OUTLINE: Record<BadgeShape['props']['tone'], string> = {
  neutral: 'border border-border text-fg',
  brand: 'border border-brand text-brand',
  success: 'border border-success text-success',
  warning: 'border border-warning text-warning',
  danger: 'border border-danger text-danger',
}

export class BadgeShapeUtil extends BaseBoxShapeUtil<BadgeShape> {
  static override type = 'ui-badge' as const
  static override props = badgeShapeProps

  override hideRotateHandle = () => true

  override getDefaultProps(): BadgeShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: BadgeShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: BadgeShape, info: TLResizeInfo<BadgeShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: BadgeShape) {
    const { label, tone, variant, w, h } = shape.props
    const cls =
      variant === 'solid' ? TONE_SOLID[tone] : variant === 'outline' ? TONE_OUTLINE[tone] : TONE_SUBTLE[tone]
    const editor = useEditor()
    const measureRef = useRef<HTMLSpanElement>(null)
    const userSized = (shape.meta as { userSized?: boolean })?.userSized === true

    // Auto-fit width to the rendered text — measured from the offscreen
    // sibling so it never reads truncated content. Skipped if the user has
    // manually resized the badge, or if this is a synthetic preview shape
    // inside a Component Instance (the id wouldn't resolve in the store).
    useEffect(() => {
      if (userSized) return
      if (typeof shape.id === 'string' && shape.id.startsWith('synth:')) return
      const el = measureRef.current
      if (!el) return
      const measured = Math.ceil(el.scrollWidth)
      if (measured <= 0) return
      const target = Math.max(24, Math.min(240, measured))
      if (target !== w) {
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { w: target },
        } as never)
      }
    }, [label, w, userSized, editor, shape.id, shape.type])

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
        <span
          className={
            'w-full h-full inline-flex items-center justify-center rounded-full px-2 ' +
            'text-[11px] font-medium pointer-events-none select-none whitespace-nowrap ' +
            cls
          }
        >
          {label}
        </span>
        {/* Offscreen measurement node — same font/padding as the visible
            chip so scrollWidth reports the true rendered width. */}
        <span
          ref={measureRef}
          aria-hidden
          className="absolute -left-[9999px] top-0 inline-flex items-center px-2 text-[11px] font-medium whitespace-nowrap pointer-events-none"
        >
          {label}
        </span>
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: BadgeShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

registerComponent({
  type: 'ui-badge',
  label: 'Badge',
  category: 'display',
  icon: 'Tag',
  initialSize: { w: 64, h: 22 },
  defaults: { ...DEFAULTS },
  schema: {
    label: { kind: 'string', label: 'Label' },
    tone: {
      kind: 'enum',
      label: 'Tone',
      options: [
        { value: 'neutral', label: 'Neutral' },
        { value: 'brand', label: 'Brand' },
        { value: 'success', label: 'Success' },
        { value: 'warning', label: 'Warning' },
        { value: 'danger', label: 'Danger' },
      ],
    },
    variant: {
      kind: 'enum',
      label: 'Variant',
      options: [
        { value: 'solid', label: 'Solid' },
        { value: 'subtle', label: 'Subtle' },
        { value: 'outline', label: 'Outline' },
      ],
    },
  },
})
