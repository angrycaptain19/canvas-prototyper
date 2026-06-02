import {
  BaseFrameLikeShapeUtil,
  Group2d,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
  useEditor,
  useValue,
} from 'tldraw'
import { registerComponent } from '@/lib/registry'

export type SlotShape = TLBaseShape<
  'ui-slot',
  {
    w: number
    h: number
    name: string
    accepts: 'any' | 'text' | 'button' | 'input'
  }
>

export const slotShapeProps: RecordProps<SlotShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  accepts: T.literalEnum('any', 'text', 'button', 'input'),
}

const DEFAULTS: SlotShape['props'] = {
  w: 240,
  h: 60,
  name: 'children',
  accepts: 'any',
}

export class SlotShapeUtil extends BaseFrameLikeShapeUtil<SlotShape> {
  static override type = 'ui-slot' as const
  static override props = slotShapeProps

  override hideRotateHandle = () => true
  override canEdit = () => false

  override getDefaultProps(): SlotShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: SlotShape) {
    return new Group2d({
      children: [
        new Rectangle2d({
          width: shape.props.w,
          height: shape.props.h,
          isFilled: true,
        }),
      ],
    })
  }

  override onResize(shape: SlotShape, info: TLResizeInfo<SlotShape>) {
    return resizeBox(shape, info)
  }

  override component(shape: SlotShape) {
    return <SlotShapeBody shape={shape} />
  }

  override getIndicatorPath(shape: SlotShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function SlotShapeBody({ shape }: { shape: SlotShape }) {
  const editor = useEditor()
  const hasChildren = useValue(
    'slot has children',
    () => editor.getSortedChildIdsForParent(shape.id).length > 0,
    [editor, shape.id],
  )

  return (
    <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}>
      {hasChildren ? (
        // When filled, the slot is invisible — children render normally
        <div className="w-full h-full" />
      ) : (
        <div
          className="w-full h-full rounded-token border-2 border-dashed border-brand/40 bg-brand/[0.03] flex items-center justify-center pointer-events-none select-none"
          style={{ fontFamily: 'var(--ui-font-sans)' }}
        >
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-brand/70 font-semibold">
              Slot
            </div>
            <div className="text-sm text-brand/80 font-medium">{shape.props.name}</div>
            {shape.props.accepts !== 'any' && (
              <div className="text-[10px] text-brand/60 mt-0.5">accepts: {shape.props.accepts}</div>
            )}
          </div>
        </div>
      )}
    </HTMLContainer>
  )
}

registerComponent({
  type: 'ui-slot',
  label: 'Slot',
  category: 'layout',
  icon: 'SquareDashed',
  initialSize: { w: 240, h: 60 },
  defaults: { ...DEFAULTS },
  schema: {
    name: { kind: 'string', label: 'Name', placeholder: 'e.g. children, header' },
    accepts: {
      kind: 'enum',
      label: 'Accepts',
      options: [
        { value: 'any', label: 'Any' },
        { value: 'text', label: 'Text' },
        { value: 'button', label: 'Button' },
        { value: 'input', label: 'Input' },
      ],
    },
  },
})
