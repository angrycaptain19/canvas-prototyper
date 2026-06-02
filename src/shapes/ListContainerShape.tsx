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
} from 'tldraw'
import type { AlignItems, JustifyContent, StackDirection } from '@/lib/layout'
import { registerComponent } from '@/lib/registry'
import { ContainerChrome } from './ContainerChrome'

export type ListContainerShape = TLBaseShape<
  'ui-list',
  {
    w: number
    h: number
    direction: StackDirection
    gap: number
    padding: number
    alignItems: AlignItems
    justifyContent: JustifyContent
    background: 'none' | 'surface' | 'muted'
    borderRadius: number
    border: boolean
    /** List-specific: HTML element to emit + visual separator between items. */
    as: 'ul' | 'ol' | 'div'
    separator: 'none' | 'border' | 'divider'
  }
>

export const listContainerShapeProps: RecordProps<ListContainerShape> = {
  w: T.number,
  h: T.number,
  direction: T.literalEnum('horizontal', 'vertical'),
  gap: T.number,
  padding: T.number,
  alignItems: T.literalEnum('start', 'center', 'end', 'stretch'),
  justifyContent: T.literalEnum('start', 'center', 'end', 'space-between', 'space-around'),
  background: T.literalEnum('none', 'surface', 'muted'),
  borderRadius: T.number,
  border: T.boolean,
  as: T.literalEnum('ul', 'ol', 'div'),
  separator: T.literalEnum('none', 'border', 'divider'),
}

const DEFAULTS: ListContainerShape['props'] = {
  w: 320,
  h: 240,
  direction: 'vertical',
  gap: 8,
  padding: 12,
  alignItems: 'stretch',
  justifyContent: 'start',
  background: 'surface',
  borderRadius: 8,
  // Default off — ContainerChrome handles visibility in edit mode.
  border: false,
  as: 'ul',
  separator: 'divider',
}

const BG_CLASSES: Record<ListContainerShape['props']['background'], string> = {
  none: 'bg-transparent',
  surface: 'bg-surface',
  muted: 'bg-bg',
}

export class ListContainerShapeUtil extends BaseFrameLikeShapeUtil<ListContainerShape> {
  static override type = 'ui-list' as const
  static override props = listContainerShapeProps

  override canEdit = () => false
  override hideRotateHandle = () => true

  override getClipPath() {
    return undefined
  }

  override getDefaultProps(): ListContainerShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: ListContainerShape) {
    return new Group2d({
      children: [
        new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true }),
      ],
    })
  }

  override onResize(shape: ListContainerShape, info: TLResizeInfo<ListContainerShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: ListContainerShape) {
    const { background, borderRadius, w, h } = shape.props
    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
        <div
          className={[
            'group w-full h-full relative transition-colors',
            BG_CLASSES[background],
          ].join(' ')}
          style={{ borderRadius }}
        >
          <ContainerChrome shapeId={shape.id} label="List" color="emerald" />
        </div>
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: ListContainerShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

registerComponent({
  type: 'ui-list',
  label: 'List',
  category: 'layout',
  icon: 'List',
  initialSize: { w: 320, h: 240 },
  defaults: { ...DEFAULTS },
  schema: {
    layout: {
      group: 'Layout',
      props: {
        direction: {
          kind: 'enum',
          label: 'Direction',
          options: [
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical', label: 'Vertical' },
          ],
        },
        gap: { kind: 'number', label: 'Gap', min: 0, max: 64, step: 1, unit: 'px' },
        padding: { kind: 'number', label: 'Padding', min: 0, max: 64, step: 1, unit: 'px' },
        alignItems: {
          kind: 'enum',
          label: 'Align items',
          options: [
            { value: 'start', label: 'Start' },
            { value: 'center', label: 'Center' },
            { value: 'end', label: 'End' },
            { value: 'stretch', label: 'Stretch' },
          ],
        },
      },
    },
    list: {
      group: 'List',
      props: {
        as: {
          kind: 'enum',
          label: 'Element',
          options: [
            { value: 'ul', label: 'ul' },
            { value: 'ol', label: 'ol' },
            { value: 'div', label: 'div' },
          ],
        },
        separator: {
          kind: 'enum',
          label: 'Separator',
          options: [
            { value: 'none', label: 'None' },
            { value: 'border', label: 'Border' },
            { value: 'divider', label: 'Divider' },
          ],
        },
      },
    },
    style: {
      group: 'Style',
      props: {
        background: {
          kind: 'enum',
          label: 'Background',
          options: [
            { value: 'none', label: 'None' },
            { value: 'surface', label: 'Surface' },
            { value: 'muted', label: 'Muted' },
          ],
        },
        borderRadius: { kind: 'number', label: 'Radius', min: 0, max: 32, step: 1, unit: 'px' },
        border: { kind: 'boolean', label: 'Border' },
      },
    },
  },
})
