// Minimal flex layout — runs in TS land, writes back to shape x/y/w/h.
// Children's coords are relative to their parent stack.

export type StackDirection = 'horizontal' | 'vertical'
export type AlignItems = 'start' | 'center' | 'end' | 'stretch'
export type JustifyContent = 'start' | 'center' | 'end' | 'space-between' | 'space-around'

export interface StackLayoutInput {
  width: number
  height: number
  direction: StackDirection
  gap: number
  padding: number
  alignItems: AlignItems
  justifyContent: JustifyContent
}

export interface LayoutChild {
  id: string
  w: number
  h: number
  /** when 'fill', the child grows to absorb remaining main-axis space */
  fill?: boolean
  /** when true, this child opts out of cross-axis stretch — its intrinsic
   *  w/h are preserved even when the parent has alignItems='stretch'. */
  userSized?: boolean
}

export interface LayoutResult {
  id: string
  x: number
  y: number
  w: number
  h: number
}

/** Minimum (w,h) needed for the stack to fit all children plus padding +
 *  gaps. Cross-axis uses children's intrinsic max, NOT stretched size, so
 *  we never grow a stack just because alignItems=stretch is on. */
export function computeStackRequiredSize(
  stack: Pick<StackLayoutInput, 'direction' | 'gap' | 'padding'>,
  children: Array<{ w: number; h: number }>,
): { w: number; h: number } {
  if (children.length === 0) return { w: 0, h: 0 }
  const horiz = stack.direction === 'horizontal'
  const pad2 = stack.padding * 2
  const totalGap = stack.gap * Math.max(0, children.length - 1)

  let mainSum = 0
  let crossMax = 0
  for (const c of children) {
    if (horiz) {
      mainSum += c.w
      if (c.h > crossMax) crossMax = c.h
    } else {
      mainSum += c.h
      if (c.w > crossMax) crossMax = c.w
    }
  }
  const mainTotal = mainSum + totalGap + pad2
  const crossTotal = crossMax + pad2
  return horiz
    ? { w: mainTotal, h: crossTotal }
    : { w: crossTotal, h: mainTotal }
}

export function layoutStack(stack: StackLayoutInput, children: LayoutChild[]): LayoutResult[] {
  if (children.length === 0) return []
  const horiz = stack.direction === 'horizontal'
  const innerW = Math.max(0, stack.width - stack.padding * 2)
  const innerH = Math.max(0, stack.height - stack.padding * 2)
  const containerMain = horiz ? innerW : innerH
  const containerCross = horiz ? innerH : innerW

  // Distribute 'fill' children
  const fixedMain = children.reduce(
    (acc, c) => acc + (c.fill ? 0 : horiz ? c.w : c.h),
    0,
  )
  const totalGap = stack.gap * (children.length - 1)
  const fillCount = children.filter(c => c.fill).length
  const remaining = Math.max(0, containerMain - fixedMain - totalGap)
  const perFill = fillCount > 0 ? remaining / fillCount : 0

  const sized = children.map(c => {
    const mainSize = c.fill ? perFill : horiz ? c.w : c.h
    return {
      id: c.id,
      mainSize,
      crossSize: horiz ? c.h : c.w,
      userSized: !!c.userSized,
    }
  })

  const usedMain = sized.reduce((a, s) => a + s.mainSize, 0) + totalGap
  const extra = Math.max(0, containerMain - usedMain)

  let mainStart = stack.padding
  let spacing = stack.gap
  switch (stack.justifyContent) {
    case 'center':
      mainStart += extra / 2
      break
    case 'end':
      mainStart += extra
      break
    case 'space-between':
      if (children.length > 1) spacing = stack.gap + extra / (children.length - 1)
      break
    case 'space-around':
      mainStart += extra / (children.length * 2)
      spacing = stack.gap + extra / children.length
      break
  }

  const results: LayoutResult[] = []
  let main = mainStart
  for (const s of sized) {
    // userSized children opt out of cross-axis stretch — they keep their
    // intrinsic size regardless of the parent's alignItems.
    const stretch = stack.alignItems === 'stretch' && !s.userSized
    const crossSize = stretch ? containerCross : Math.min(s.crossSize, containerCross)
    let cross = stack.padding
    switch (stack.alignItems) {
      case 'center':
        cross += (containerCross - crossSize) / 2
        break
      case 'end':
        cross += containerCross - crossSize
        break
      case 'stretch':
      case 'start':
      default:
        break
    }
    const x = horiz ? main : cross
    const y = horiz ? cross : main
    const w = horiz ? s.mainSize : crossSize
    const h = horiz ? crossSize : s.mainSize
    results.push({ id: s.id, x, y, w, h })
    main += s.mainSize + spacing
  }
  return results
}
