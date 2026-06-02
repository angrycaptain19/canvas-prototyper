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
import { useValue } from '@tldraw/state-react'
import { previewModeAtom } from '@/lib/previewMode'
import { registerComponent } from '@/lib/registry'

export type PageFrameShape = TLBaseShape<
  'ui-page',
  {
    w: number
    h: number
    name: string
    breakpoint: 'mobile' | 'desktop'
    background: 'surface' | 'bg' | 'transparent'
  }
>

export const pageFrameShapeProps: RecordProps<PageFrameShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  breakpoint: T.literalEnum('mobile', 'desktop'),
  background: T.literalEnum('surface', 'bg', 'transparent'),
}

const PAGE_DEFAULTS: PageFrameShape['props'] = {
  w: 1024,
  h: 720,
  name: 'Untitled Page',
  breakpoint: 'desktop',
  background: 'surface',
}

const BG_MAP: Record<PageFrameShape['props']['background'], string> = {
  transparent: 'bg-transparent',
  surface: 'bg-surface',
  bg: 'bg-bg',
}

export class PageFrameShapeUtil extends BaseFrameLikeShapeUtil<PageFrameShape> {
  static override type = 'ui-page' as const
  static override props = pageFrameShapeProps

  override hideRotateHandle = () => true

  // Don't clip children. If content overflows the page's bounds, the user
  // should see it (and fix the layout or resize the page) — not have it
  // mysteriously disappear at the edge.
  override getClipPath() {
    return undefined
  }

  override getDefaultProps(): PageFrameShape['props'] {
    return { ...PAGE_DEFAULTS }
  }

  override getGeometry(shape: PageFrameShape) {
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

  override onResize(shape: PageFrameShape, info: TLResizeInfo<PageFrameShape>) {
    return resizeBox(shape, info)
  }

  override component(shape: PageFrameShape) {
    const previewMode = useValue('preview-mode', () => previewModeAtom.get(), [])
    return (
      <HTMLContainer
        style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
      >
        {/* Header strip — page name + breakpoint chip. Editor chrome only;
            hidden in preview mode so the canvas reads as the finished UI. */}
        {!previewMode && (
          <div
            className="absolute left-0 -top-7 flex items-center gap-2 text-xs font-medium text-fg/70 pointer-events-none select-none"
            style={{ fontFamily: 'var(--ui-font-sans)' }}
          >
            <span className="px-2 py-0.5 rounded bg-surface border border-border">
              {shape.props.name}
            </span>
            <span className="text-muted">
              {shape.props.breakpoint === 'mobile' ? '375px' : `${shape.props.w}px`}
            </span>
          </div>
        )}
        <div
          className={[
            'w-full h-full',
            previewMode ? '' : 'shadow-sm border border-border',
            BG_MAP[shape.props.background],
          ].join(' ')}
        />
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: PageFrameShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

registerComponent({
  type: 'ui-page',
  label: 'Page',
  category: 'layout',
  icon: 'AppWindow',
  initialSize: { w: 1024, h: 720 },
  defaults: { ...PAGE_DEFAULTS },
  schema: {
    info: {
      group: 'Page',
      props: {
        name: { kind: 'string', label: 'Name', placeholder: 'Page name' },
        breakpoint: {
          kind: 'enum',
          label: 'Breakpoint',
          options: [
            { value: 'desktop', label: 'Desktop' },
            { value: 'mobile', label: 'Mobile' },
          ],
        },
        background: {
          kind: 'enum',
          label: 'Background',
          options: [
            { value: 'surface', label: 'Surface' },
            { value: 'bg', label: 'Page bg' },
            { value: 'transparent', label: 'Transparent' },
          ],
        },
      },
    },
  },
})
