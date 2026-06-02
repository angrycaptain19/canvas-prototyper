// Validate an AI-generated template tree against the live shape registry.
// Returns readable error strings that get fed back to the model for retry.

import type { ComponentDef, TemplateNode } from '@/lib/componentDef'
import { flattenSchema, type PropDef } from '@/lib/propSchema'
import { getRegistration, listRegistrations } from '@/lib/registry'

export interface ValidationError {
  path: string
  message: string
}

function formatPath(path: string): string {
  return path === '' ? 'root' : path
}

function checkProp(propKey: string, value: unknown, def: PropDef): string | null {
  switch (def.kind) {
    case 'string':
      return typeof value === 'string' ? null : `expected string, got ${typeof value}`
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) return `expected number, got ${typeof value}`
      if (def.min !== undefined && value < def.min) return `value ${value} below min ${def.min}`
      if (def.max !== undefined && value > def.max) return `value ${value} above max ${def.max}`
      return null
    case 'boolean':
      return typeof value === 'boolean' ? null : `expected boolean, got ${typeof value}`
    case 'enum': {
      const valid = def.options.map(o => o.value)
      if (typeof value !== 'string' || !valid.includes(value)) {
        return `invalid value ${JSON.stringify(value)}; valid: ${valid.map(v => `'${v}'`).join(', ')}`
      }
      return null
    }
    case 'color':
      return typeof value === 'string' ? null : `expected color string, got ${typeof value}`
  }
}

export function validateTemplate(
  node: TemplateNode,
  path = '',
  userDefs: ComponentDef[] = [],
): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof node !== 'object' || node === null) {
    errors.push({ path: formatPath(path), message: 'expected an object node' })
    return errors
  }

  // `ui-component-instance` is special — it's not in the primitive registry
  // (intentionally hidden so it doesn't appear in the LibraryPanel), and its
  // props are dynamic (variantChoices is a free-form object). Validate it
  // separately against the user's saved-component defs.
  if (node.type === 'ui-component-instance') {
    return validateComponentInstance(node, path, userDefs)
  }

  const reg = getRegistration(node.type)
  if (!reg) {
    const known = listRegistrations()
      .map(r => `'${r.type}'`)
      .join(', ')
    errors.push({
      path: formatPath(path),
      message: `unknown shape type '${node.type}'. Use one of: ${known}, or 'ui-component-instance' to reference a saved component.`,
    })
    return errors
  }

  if (typeof node.w !== 'number' || node.w <= 0) {
    errors.push({
      path: formatPath(path),
      message: `invalid w (${JSON.stringify(node.w)}); must be a positive number`,
    })
  }
  if (typeof node.h !== 'number' || node.h <= 0) {
    errors.push({
      path: formatPath(path),
      message: `invalid h (${JSON.stringify(node.h)}); must be a positive number`,
    })
  }

  const flat = flattenSchema(reg.schema)
  const propByKey = new Map(flat.map(({ key, def }) => [key, def] as const))
  // w/h are always implicit
  propByKey.set('w', { kind: 'number', label: 'w' })
  propByKey.set('h', { kind: 'number', label: 'h' })

  const props = (node.props ?? {}) as Record<string, unknown>
  for (const [key, value] of Object.entries(props)) {
    const def = propByKey.get(key)
    if (!def) {
      errors.push({
        path: `${formatPath(path)}.props.${key}`,
        message: `unknown prop on ${node.type}. Valid: ${[...propByKey.keys()].sort().join(', ')}`,
      })
      continue
    }
    const err = checkProp(key, value, def)
    if (err) {
      errors.push({
        path: `${formatPath(path)}.props.${key}`,
        message: err,
      })
    }
  }

  if (node.children) {
    if (!Array.isArray(node.children)) {
      errors.push({
        path: `${formatPath(path)}.children`,
        message: 'expected array',
      })
    } else {
      for (let i = 0; i < node.children.length; i++) {
        errors.push(
          ...validateTemplate(
            node.children[i],
            path === '' ? String(i) : `${path}.${i}`,
            userDefs,
          ),
        )
      }
    }
  }

  return errors
}

/** Validate a `ui-component-instance` node — it doesn't live in the primitive
 *  registry, so we check it against the user's saved-component defs. */
function validateComponentInstance(
  node: TemplateNode,
  path: string,
  userDefs: ComponentDef[],
): ValidationError[] {
  const errors: ValidationError[] = []
  const props = (node.props ?? {}) as Record<string, unknown>

  if (typeof node.w !== 'number' || node.w <= 0) {
    errors.push({
      path: formatPath(path),
      message: `invalid w (${JSON.stringify(node.w)}); must be a positive number`,
    })
  }
  if (typeof node.h !== 'number' || node.h <= 0) {
    errors.push({
      path: formatPath(path),
      message: `invalid h (${JSON.stringify(node.h)}); must be a positive number`,
    })
  }

  const defId = props.defId
  if (typeof defId !== 'string' || defId.length === 0) {
    errors.push({
      path: `${formatPath(path)}.props.defId`,
      message: 'ui-component-instance requires a defId (string) pointing to a saved component.',
    })
    return errors
  }

  const def = userDefs.find(d => d.id === defId)
  if (!def) {
    const available = userDefs.length > 0
      ? userDefs.map(d => `${d.name}=${d.id}`).join(', ')
      : '(no saved components in this project)'
    errors.push({
      path: `${formatPath(path)}.props.defId`,
      message: `defId ${JSON.stringify(defId)} doesn't match any saved component. Available: ${available}`,
    })
    return errors
  }

  // variantChoices: must be an object whose keys/values match the def's axes.
  const choicesRaw = props.variantChoices
  const choices =
    choicesRaw && typeof choicesRaw === 'object' && !Array.isArray(choicesRaw)
      ? (choicesRaw as Record<string, unknown>)
      : null
  if (choicesRaw !== undefined && !choices) {
    errors.push({
      path: `${formatPath(path)}.props.variantChoices`,
      message: `expected an object (axis → value), got ${typeof choicesRaw}`,
    })
  }
  if (choices) {
    const axesByName = new Map((def.variants ?? []).map(a => [a.name, a]))
    for (const [axisName, value] of Object.entries(choices)) {
      const axis = axesByName.get(axisName)
      if (!axis) {
        const valid = [...axesByName.keys()]
        errors.push({
          path: `${formatPath(path)}.props.variantChoices.${axisName}`,
          message: `unknown axis '${axisName}' on ${def.name}. Valid axes: ${valid.length > 0 ? valid.join(', ') : '(none — this component has no variants)'}`,
        })
        continue
      }
      if (typeof value !== 'string' || !axis.values.includes(value)) {
        errors.push({
          path: `${formatPath(path)}.props.variantChoices.${axisName}`,
          message: `invalid value ${JSON.stringify(value)} for axis '${axisName}'. Valid: ${axis.values.map(v => `'${v}'`).join(', ')}`,
        })
      }
    }
  }

  // Reject children — instance shapes don't have inline children.
  if (Array.isArray(node.children) && node.children.length > 0) {
    errors.push({
      path: `${formatPath(path)}.children`,
      message:
        'ui-component-instance must not have children. The instance renders the def template inline.',
    })
  }

  return errors
}

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map(e => `  - ${e.path}: ${e.message}`).join('\n')
}
