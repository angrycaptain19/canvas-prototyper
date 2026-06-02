import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
} from 'tldraw'
import { registerComponent } from '@/lib/registry'

export type TabsShape = TLBaseShape<
  'ui-tabs',
  {
    w: number
    h: number
    /** comma-separated tab labels */
    tabs: string
    activeIndex: number
  }
>

export const tabsShapeProps: RecordProps<TabsShape> = {
  w: T.number,
  h: T.number,
  tabs: T.string,
  activeIndex: T.number,
}

const DEFAULTS: TabsShape['props'] = {
  w: 360,
  h: 40,
  tabs: 'Overview, Activity, Settings',
  activeIndex: 0,
}

export class TabsShapeUtil extends BaseBoxShapeUtil<TabsShape> {
  static override type = 'ui-tabs' as const
  static override props = tabsShapeProps

  override hideRotateHandle = () => true

  override getDefaultProps(): TabsShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: TabsShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: TabsShape, info: TLResizeInfo<TabsShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: TabsShape) {
    const { tabs, activeIndex, w, h } = shape.props
    const labels = tabs
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
        <div className="w-full h-full flex items-end border-b border-border pointer-events-none select-none">
          {labels.map((label, i) => {
            const active = i === activeIndex
            return (
              <div
                key={`${label}-${i}`}
                className={
                  'px-4 h-full inline-flex items-center text-sm transition-colors ' +
                  (active
                    ? 'text-fg font-medium border-b-2 border-brand -mb-px'
                    : 'text-muted')
                }
              >
                {label}
              </div>
            )
          })}
        </div>
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: TabsShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

registerComponent({
  type: 'ui-tabs',
  label: 'Tabs',
  category: 'layout',
  icon: 'Rows3',
  initialSize: { w: 360, h: 40 },
  defaults: { ...DEFAULTS },
  schema: {
    tabs: { kind: 'string', label: 'Tabs (comma-separated)' },
    activeIndex: { kind: 'number', label: 'Active tab', min: 0, step: 1 },
  },
})
