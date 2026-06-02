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
import { X } from 'lucide-react'
import { registerComponent } from '@/lib/registry'

// Tag is similar in spirit to Badge but reads as content (selectable label,
// optionally removable) rather than a status pill — rectangular corners
// instead of fully rounded, slightly bigger type, an optional × at the end.

export type TagShape = TLBaseShape<
  'ui-tag',
  {
    w: number
    h: number
    label: string
    tone: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
    removable: boolean
  }
>

export const tagShapeProps: RecordProps<TagShape> = {
  w: T.number,
  h: T.number,
  label: T.string,
  tone: T.literalEnum('neutral', 'brand', 'success', 'warning', 'danger'),
  removable: T.boolean,
}

const DEFAULTS: TagShape['props'] = {
  w: 80,
  h: 28,
  label: 'tag',
  tone: 'neutral',
  removable: false,
}

const TONE: Record<TagShape['props']['tone'], string> = {
  neutral: 'bg-bg text-fg border-border',
  brand: 'bg-brand/10 text-brand border-brand/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
}

export class TagShapeUtil extends BaseBoxShapeUtil<TagShape> {
  static override type = 'ui-tag' as const
  static override props = tagShapeProps

  override hideRotateHandle = () => true

  override getDefaultProps(): TagShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: TagShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: TagShape, info: TLResizeInfo<TagShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: TagShape) {
    return <TagBody shape={shape} />
  }

  override getIndicatorPath(shape: TagShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function TagBody({ shape }: { shape: TagShape }) {
  const { label, tone, removable, w, h } = shape.props
  const editor = useEditor()
  const measureRef = useRef<HTMLSpanElement>(null)
  const userSized = (shape.meta as { userSized?: boolean })?.userSized === true

  // Auto-fit width to text + padding (and the × if removable). Skipped if
  // the user manually resized or this is a synthetic preview shape.
  useEffect(() => {
    if (userSized) return
    if (typeof shape.id === 'string' && shape.id.startsWith('synth:')) return
    const el = measureRef.current
    if (!el) return
    const measured = Math.ceil(el.scrollWidth)
    if (measured <= 0) return
    const extra = removable ? 18 : 0
    const target = Math.max(40, Math.min(240, measured + extra))
    if (target !== w) {
      editor.updateShape({ id: shape.id, type: shape.type, props: { w: target } } as never)
    }
  }, [label, removable, w, userSized, editor, shape.id, shape.type])

  return (
    <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
      <span
        className={
          'w-full h-full inline-flex items-center justify-center gap-1 rounded-token border px-2 text-[11px] font-medium pointer-events-none select-none whitespace-nowrap ' +
          TONE[tone]
        }
      >
        {label}
        {removable && <X className="w-3 h-3 opacity-60" />}
      </span>
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

registerComponent({
  type: 'ui-tag',
  label: 'Tag',
  category: 'display',
  icon: 'Hash',
  initialSize: { w: 80, h: 28 },
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
    removable: { kind: 'boolean', label: 'Removable' },
  },
})
