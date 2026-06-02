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
  useValue,
} from 'tldraw'
import type { Editor, TLShape } from 'tldraw'
import { ComponentDefRecord, type ComponentDef, type TemplateNode } from '@/lib/componentDef'
import { resolveTemplate } from '@/lib/variantResolution'

export type ComponentInstanceShape = TLBaseShape<
  'ui-component-instance',
  {
    w: number
    h: number
    defId: string
    /** Choice per axis name; missing axes fall back to the axis default. */
    variantChoices: Record<string, string>
  }
>

export const componentInstanceShapeProps: RecordProps<ComponentInstanceShape> = {
  w: T.number,
  h: T.number,
  defId: T.string,
  variantChoices: T.dict(T.string, T.string),
}

const DEFAULTS: ComponentInstanceShape['props'] = {
  w: 200,
  h: 80,
  defId: '',
  variantChoices: {},
}

export class ComponentInstanceShapeUtil extends BaseBoxShapeUtil<ComponentInstanceShape> {
  static override type = 'ui-component-instance' as const
  static override props = componentInstanceShapeProps

  override hideRotateHandle = () => true
  override canEdit = () => false

  override getDefaultProps(): ComponentInstanceShape['props'] {
    return { ...DEFAULTS }
  }

  override getGeometry(shape: ComponentInstanceShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override onResize(shape: ComponentInstanceShape, info: TLResizeInfo<ComponentInstanceShape>) {
    const next = resizeBox(shape, info)
    return { ...next, meta: { ...(shape.meta ?? {}), userSized: true } }
  }

  override component(shape: ComponentInstanceShape) {
    return <ComponentInstanceBody shape={shape} />
  }

  override getIndicatorPath(shape: ComponentInstanceShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function ComponentInstanceBody({ shape }: { shape: ComponentInstanceShape }) {
  const editor = useEditor()
  const def = useValue<ComponentDef | null>(
    'instance def',
    () => (editor.store.get(shape.props.defId as any) as ComponentDef | undefined) ?? null,
    [editor, shape.props.defId],
  )

  if (!def) {
    return (
      <HTMLContainer
        style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
      >
        <div className="w-full h-full rounded-token border border-dashed border-danger/60 bg-danger/5 flex items-center justify-center text-[11px] text-danger pointer-events-none select-none">
          missing component
        </div>
      </HTMLContainer>
    )
  }

  const template = resolveTemplate(def, shape.props.variantChoices)

  // Scale the template to fit the instance's current size so resizing works.
  // Use the chosen variant's bounds so a non-default variant of different
  // intrinsic size still scales correctly.
  const sx = shape.props.w / Math.max(1, template.w)
  const sy = shape.props.h / Math.max(1, template.h)

  return (
    <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}>
      <div className="w-full h-full overflow-hidden pointer-events-none select-none">
        <div
          style={{
            width: template.w,
            height: template.h,
            transform: `scale(${sx}, ${sy})`,
            transformOrigin: '0 0',
          }}
        >
          {renderTemplateNode(editor, template, 'root')}
        </div>
      </div>
    </HTMLContainer>
  )
}

function renderTemplateNode(editor: Editor, node: TemplateNode, path: string): React.ReactNode {
  const util = editor.getShapeUtil(node.type as any)
  if (!util) {
    return (
      <div
        key={path}
        style={{
          position: 'absolute',
          left: node.x,
          top: node.y,
          width: node.w,
          height: node.h,
        }}
        className="bg-danger/10 border border-danger text-[10px] text-danger flex items-center justify-center"
      >
        ?{node.type}
      </div>
    )
  }

  // Synthesize a shape-like object for the util's component() to render.
  const synthetic = {
    id: `synth:${path}`,
    typeName: 'shape',
    type: node.type,
    x: node.x,
    y: node.y,
    rotation: 0,
    index: 'a1',
    isLocked: false,
    opacity: 1,
    parentId: 'page:synthetic',
    meta: node.meta ?? {},
    props: node.props,
  } as unknown as TLShape

  return (
    <div
      key={path}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
      }}
    >
      <SyntheticShape util={util} shape={synthetic} />
      {node.children?.map((child, i) => renderTemplateNode(editor, child, `${path}/${i}`))}
    </div>
  )
}

// Isolate each synthetic shape into its own React fiber so any hooks inside
// the shape util's component() (useEditor, useValue, useEffect, useRef…)
// land in a stable, isolated hook list. Without this every synthetic shape's
// hooks pile onto ComponentInstanceBody and React's rules of hooks fire.
function SyntheticShape({
  util,
  shape,
}: {
  util: { component(shape: TLShape): React.ReactNode }
  shape: TLShape
}) {
  return <>{util.component(shape)}</>
}
