#!/usr/bin/env tsx
/**
 * CLI: read a project.json snapshot exported from the canvas and write a full
 * set of React + Tailwind files to ./ui/ (or a custom output dir).
 *
 * Usage:
 *   npm run sync                              # reads ./project.json → ./ui/
 *   npm run sync -- ./snapshots/v1.json       # custom input
 *   npm run sync -- project.json --out src/components/generated
 *
 * The snapshot format is whatever `buildProjectSnapshot(editor)` produces
 * (and the in-app "Export project" button downloads).
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import { emitProject } from '../src/lib/emitter/emitProject'
import type { ProjectSnapshot } from '../src/lib/projectExport'

const PARSER_BY_EXT: Record<string, string> = {
  '.tsx': 'typescript',
  '.ts': 'typescript',
  '.css': 'css',
  '.md': 'markdown',
}

async function formatIfPossible(filename: string, code: string): Promise<string> {
  const ext = extname(filename)
  const parser = PARSER_BY_EXT[ext]
  if (!parser) return code
  try {
    return await prettier.format(code, {
      parser,
      semi: false,
      singleQuote: true,
      trailingComma: 'all',
      printWidth: 100,
    })
  } catch (err) {
    console.warn(`  ⚠ prettier failed on ${filename}: ${(err as Error).message}`)
    return code
  }
}

interface CliOptions {
  inputPath: string
  outDir: string
  dryRun: boolean
  mode: 'default' | 'shadcn'
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    inputPath: 'project.json',
    outDir: 'ui',
    dryRun: false,
    mode: 'default',
  }
  let positional = 0
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out' || a === '-o') {
      opts.outDir = argv[++i]
    } else if (a === '--dry-run') {
      opts.dryRun = true
    } else if (a === '--shadcn') {
      opts.mode = 'shadcn'
    } else if (a === '--help' || a === '-h') {
      console.log(USAGE)
      process.exit(0)
    } else if (!a.startsWith('-')) {
      if (positional === 0) opts.inputPath = a
      positional++
    }
  }
  return opts
}

const USAGE = `
tldraw-ui-builder sync — emit React + Tailwind from a project.json snapshot.

  usage: npm run sync [-- [snapshot.json] [--out <dir>] [--dry-run]]

  arguments:
    snapshot.json    Path to project.json. Defaults to ./project.json.

  options:
    --out, -o <dir>  Output directory. Defaults to ./ui/.
    --shadcn         Emit using shadcn/ui primitives (Button, Input, Label, Checkbox)
                     from \`@/components/ui/*\` and import \`cn\` from \`@/lib/utils\`.
    --dry-run        Print the file plan without writing anything.
    --help, -h       Show this message.
`.trim()

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const inputPath = resolve(process.cwd(), opts.inputPath)
  const outDir = resolve(process.cwd(), opts.outDir)

  console.log(`▸ reading ${inputPath}`)
  let snapshot: ProjectSnapshot
  try {
    const raw = readFileSync(inputPath, 'utf8')
    snapshot = JSON.parse(raw) as ProjectSnapshot
  } catch (err) {
    console.error(`✗ failed to read snapshot at ${inputPath}:`, (err as Error).message)
    console.error(`  (Hint: click "Export project" in the canvas to generate one.)`)
    process.exit(1)
  }

  if (snapshot.version !== 1) {
    console.warn(`⚠ snapshot version is ${snapshot.version}; this CLI expects 1. Continuing anyway.`)
  }

  console.log(
    `▸ emitting: ${snapshot.defs.length} component def${snapshot.defs.length === 1 ? '' : 's'}, ${snapshot.pages.length} page${snapshot.pages.length === 1 ? '' : 's'}`,
  )

  if (opts.mode === 'shadcn') {
    console.log(`▸ mode: shadcn (composing with @/components/ui primitives)`)
  }
  const { files } = emitProject(snapshot, { mode: opts.mode })

  if (opts.dryRun) {
    console.log(`\n— dry run — would write ${files.length} files to ${outDir}:\n`)
    for (const f of files) {
      console.log(`  ${join(opts.outDir, f.filename)} (${f.code.length} bytes)`)
    }
    return
  }

  mkdirSync(outDir, { recursive: true })

  // Track what's about to be written so we can prune orphans from prior syncs.
  const writtenNames = new Set<string>(files.map(f => f.filename))
  const existingNames = existsSync(outDir)
    ? new Set(readdirSync(outDir).filter(n => isOurOutput(n)))
    : new Set<string>()

  let created = 0
  let updated = 0
  for (const f of files) {
    const fullPath = join(outDir, f.filename)
    mkdirSync(dirname(fullPath), { recursive: true })
    const formatted = await formatIfPossible(f.filename, f.code)
    const existed = existingNames.has(f.filename)
    const same = existed && readFileSync(fullPath, 'utf8') === formatted
    if (same) {
      // skip writing
    } else {
      writeFileSync(fullPath, formatted)
      if (existed) updated++
      else created++
    }
    console.log(`  ${existed ? (same ? '·' : '↻') : '+'} ${join(opts.outDir, f.filename)}`)
  }

  // Prune files we wrote previously but aren't part of the new emit.
  let removed = 0
  for (const name of existingNames) {
    if (writtenNames.has(name)) continue
    unlinkSync(join(outDir, name))
    removed++
    console.log(`  - ${join(opts.outDir, name)}`)
  }

  const parts: string[] = []
  if (created) parts.push(`${created} created`)
  if (updated) parts.push(`${updated} updated`)
  if (removed) parts.push(`${removed} removed`)
  const unchanged = files.length - created - updated
  if (unchanged) parts.push(`${unchanged} unchanged`)
  console.log(`\n✓ ${parts.join(', ') || 'no changes'} in ${outDir}`)
  if (created > 0 && (created + updated) === files.length) {
    console.log(`  Next: import the theme.css + tailwind.preset.ts (see README.md in ${opts.outDir}).`)
  }
}

/** Which filenames in the output dir do we own and may safely delete?
 *  Anything we'd ever emit: .tsx, .ts, .css, .md (theme + README + components). */
function isOurOutput(filename: string): boolean {
  return /\.(tsx|ts|css|md)$/.test(filename)
}

// Run only when invoked directly (not when imported).
const isDirect = fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
if (isDirect) main().catch(err => { console.error(err); process.exit(1) })
