#!/usr/bin/env tsx
/**
 * Builds a comprehensive test project.json that exercises every shape type,
 * lifted props, multi-axis variants, and a saved component referenced from
 * a page. Used by the codegen audit — run sync against this fixture and
 * inspect every emitted file.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ProjectSnapshot, ProjectSnapshotPage } from '../src/lib/projectExport'
import type { ComponentDef, TemplateNode, VariantAxis } from '../src/lib/componentDef'

type Props = Record<string, unknown>
function node(
  type: string,
  w: number,
  h: number,
  props: Props,
  children?: TemplateNode[],
): TemplateNode {
  return { type, x: 0, y: 0, w, h, props: { w, h, ...props }, children }
}

// ─── Common helpers ────────────────────────────────────────────────────────

const stack = (
  w: number,
  h: number,
  extra: Partial<Props>,
  children: TemplateNode[],
): TemplateNode =>
  node(
    'ui-stack',
    w,
    h,
    {
      direction: 'vertical',
      gap: 12,
      padding: 16,
      alignItems: 'stretch',
      justifyContent: 'start',
      background: 'surface',
      borderRadius: 8,
      border: false,
      ...extra,
    },
    children,
  )

const text = (content: string, role = 'body', extra: Partial<Props> = {}): TemplateNode => {
  const h = role === 'heading' ? 36 : role === 'subheading' ? 28 : role === 'caption' ? 20 : 24
  return node('ui-text', 320, h, {
    content,
    role,
    weight: 'normal',
    tone: 'default',
    align: 'left',
    ...extra,
  })
}

const button = (label: string, variant = 'primary', extra: Partial<Props> = {}): TemplateNode =>
  node('ui-button', 160, 40, {
    label,
    variant,
    size: 'md',
    loading: false,
    ...extra,
  })

const input = (label: string, placeholder = '', extra: Partial<Props> = {}): TemplateNode =>
  node('ui-input', 320, 68, {
    label,
    placeholder,
    value: '',
    type: 'text',
    helperText: '',
    error: false,
    ...extra,
  })

// ─── A saved component with multi-axis variants ────────────────────────────

const buttonDefAxes: VariantAxis[] = [
  { name: 'tone', values: ['neutral', 'brand', 'danger'], default: 'neutral' },
  { name: 'size', values: ['sm', 'md', 'lg'], default: 'md' },
]

function makeButtonTemplate(tone: string, size: string): TemplateNode {
  const variantByTone: Record<string, string> = {
    neutral: 'outline',
    brand: 'primary',
    danger: 'destructive',
  }
  const sizeMap: Record<string, { w: number; h: number; sizeProp: string }> = {
    sm: { w: 100, h: 32, sizeProp: 'sm' },
    md: { w: 140, h: 40, sizeProp: 'md' },
    lg: { w: 180, h: 48, sizeProp: 'lg' },
  }
  const { w, h, sizeProp } = sizeMap[size]
  return node('ui-button', w, h, {
    label: tone === 'danger' ? 'Delete' : tone === 'brand' ? 'Save' : 'Cancel',
    variant: variantByTone[tone],
    size: sizeProp,
    loading: false,
  })
}

const buttonDef: ComponentDef = {
  id: 'componentDef:button-test' as unknown as ComponentDef['id'],
  typeName: 'componentDef',
  name: 'ActionButton',
  icon: 'MousePointerClick',
  category: 'form',
  template: makeButtonTemplate('neutral', 'md'),
  templateBounds: { w: 140, h: 40 },
  variants: buttonDefAxes,
  variantSnapshots: {
    'tone=brand': makeButtonTemplate('brand', 'md'),
    'tone=danger': makeButtonTemplate('danger', 'md'),
    'size=sm': makeButtonTemplate('neutral', 'sm'),
    'size=lg': makeButtonTemplate('neutral', 'lg'),
    'size=sm|tone=brand': makeButtonTemplate('brand', 'sm'),
    'size=lg|tone=danger': makeButtonTemplate('danger', 'lg'),
  },
  createdAt: 0,
}

// ─── Page 1: Form with lifted props + field extraction ────────────────────

const formPage: ProjectSnapshotPage = {
  name: 'Sign Up',
  bounds: { w: 480, h: 640 },
  template: node('ui-page', 480, 640, {
    name: 'Sign Up',
    breakpoint: 'desktop',
    background: 'surface',
  }, [
    stack(440, 600, { padding: 32, gap: 16 }, [
      text('Create your account', 'heading'),
      text('Already a customer? Sign in.', 'caption', { tone: 'muted' }),
      node('ui-form', 440, 400, {
        direction: 'vertical',
        gap: 12,
        padding: 0,
        alignItems: 'stretch',
        justifyContent: 'start',
        background: 'none',
        borderRadius: 0,
        border: false,
        action: '/api/signup',
        method: 'POST',
      }, [
        input('Full name', 'Ada Lovelace'),
        input('Email', 'ada@example.com', { type: 'email' }),
        input('Password', '••••••••', { type: 'password' }),
        input('Confirm password', '••••••••', { type: 'password' }),
        node('ui-checkbox', 440, 24, {
          label: 'I agree to the terms',
          checked: false,
          disabled: false,
        }),
        button('Create account', 'primary', { w: 440 }),
      ]),
    ]),
  ]),
}

// ─── Page 2: Card grid with the saved component ───────────────────────────

const cardsPage: ProjectSnapshotPage = {
  name: 'Pricing',
  bounds: { w: 960, h: 600 },
  template: node('ui-page', 960, 600, {
    name: 'Pricing',
    breakpoint: 'desktop',
    background: 'bg',
  }, [
    stack(920, 560, { padding: 32, gap: 24, background: 'none' }, [
      text('Plans', 'heading'),
      stack(880, 400, {
        direction: 'horizontal',
        gap: 24,
        padding: 0,
        background: 'none',
        alignItems: 'start',
      }, [
        node('ui-card', 280, 380, {
          shadow: 'md',
          borderRadius: 12,
          border: true,
          padding: 24,
        }, [
          stack(232, 332, { padding: 0, gap: 12, background: 'none' }, [
            text('Free', 'heading'),
            text('$0/mo', 'subheading'),
            text('For individuals', 'caption', { tone: 'muted' }),
            // Reference the saved ActionButton via an instance — variantChoices
            // hits the brand+md combo snapshot.
            node('ui-component-instance', 140, 40, {
              defId: 'componentDef:button-test',
              variantChoices: { tone: 'brand', size: 'md' },
            }),
          ]),
        ]),
        node('ui-card', 280, 380, {
          shadow: 'lg',
          borderRadius: 12,
          border: true,
          padding: 24,
        }, [
          stack(232, 332, { padding: 0, gap: 12, background: 'none' }, [
            node('ui-badge', 80, 22, { label: 'Most popular', tone: 'brand', variant: 'solid' }),
            text('Pro', 'heading'),
            text('$29/mo', 'subheading'),
            node('ui-component-instance', 180, 48, {
              defId: 'componentDef:button-test',
              variantChoices: { tone: 'brand', size: 'lg' },
            }),
          ]),
        ]),
        node('ui-card', 280, 380, {
          shadow: 'sm',
          borderRadius: 12,
          border: true,
          padding: 24,
        }, [
          stack(232, 332, { padding: 0, gap: 12, background: 'none' }, [
            text('Enterprise', 'heading'),
            text('Contact us', 'subheading'),
            node('ui-component-instance', 140, 40, {
              defId: 'componentDef:button-test',
              variantChoices: { tone: 'neutral', size: 'md' },
            }),
          ]),
        ]),
      ]),
    ]),
  ]),
}

// ─── Page 3: kitchen-sink of every primitive ──────────────────────────────

const kitchenSink: ProjectSnapshotPage = {
  name: 'Kitchen Sink',
  bounds: { w: 600, h: 1200 },
  template: node('ui-page', 600, 1200, {
    name: 'Kitchen Sink',
    breakpoint: 'desktop',
    background: 'surface',
  }, [
    stack(560, 1160, { padding: 32, gap: 16 }, [
      text('Everything', 'heading'),
      text('All registered shape types.', 'body', { tone: 'muted' }),

      // Status + display
      node('ui-alert', 480, 72, {
        title: 'Heads up',
        description: 'You have 3 unread notifications.',
        tone: 'info',
        variant: 'subtle',
      }),
      node('ui-alert', 480, 72, {
        title: 'Action required',
        description: 'Please verify your email.',
        tone: 'warning',
        variant: 'solid',
      }),
      node('ui-progress', 480, 8, { value: 60, max: 100, tone: 'brand', showLabel: true }),
      node('ui-divider', 480, 1, { orientation: 'horizontal', tone: 'border', thickness: 1 }),

      // Form controls
      node('ui-switch', 220, 24, { label: 'Email notifications', checked: true, disabled: false }),
      node('ui-radio', 220, 24, { label: 'Plan A', checked: true, disabled: false, name: 'plan' }),
      node('ui-radio', 220, 24, { label: 'Plan B', checked: false, disabled: false, name: 'plan' }),
      node('ui-checkbox', 220, 24, { label: 'Remember me', checked: false, disabled: false }),
      input('Project name', 'My SaaS app'),
      node('ui-select', 320, 68, {
        label: 'Country',
        placeholder: 'Choose…',
        value: 'us',
        // New value|Label syntax — values stay terse, labels are human-readable.
        options: 'us|United States, ca|Canada, gb|United Kingdom, de|Germany',
      }),
      // Exercise #6 — an intentionally bad variant value should warn at emit
      // time (not silently fall back to "primary").
      button('Test bad variant', 'BOGUS'),

      // Display
      node('ui-tag', 80, 28, { label: 'design', tone: 'brand', removable: true }),
      node('ui-tag', 80, 28, { label: 'engineering', tone: 'neutral', removable: false }),
      node('ui-badge', 64, 22, { label: 'NEW', tone: 'success', variant: 'subtle' }),
      node('ui-avatar', 40, 40, { initials: 'AB', shape: 'circle', src: '' }),

      // Tabs
      node('ui-tabs', 480, 40, {
        tabs: 'Overview,Settings,Billing',
        activeIndex: 0,
      }),

      button('Submit', 'primary'),
      button('Cancel', 'ghost'),
    ]),
  ]),
}

// ─── Build + write ─────────────────────────────────────────────────────────

// Exercise #9 — two pages with the same pascal'd name (Pricing) so the
// dedup warning fires and the second one becomes Pricing2.
const pricingDupe: ProjectSnapshotPage = {
  ...cardsPage,
  name: 'pricing',
}

const snapshot: ProjectSnapshot = {
  version: 1,
  exportedAt: new Date().toISOString(),
  defs: [buttonDef],
  pages: [formPage, cardsPage, kitchenSink, pricingDupe],
}

const outPath = resolve(process.cwd(), 'test-fixture.json')
writeFileSync(outPath, JSON.stringify(snapshot, null, 2))
console.log(`✓ wrote ${outPath}`)
console.log(`  ${snapshot.defs.length} def, ${snapshot.pages.length} pages`)
