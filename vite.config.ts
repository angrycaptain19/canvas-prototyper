import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { appendFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Dev-only sink for agent logs. The browser POSTs JSON lines here while
// debugging agent behaviour; the file is then readable from the project
// root as `agent.log` (newline-delimited JSON, one entry per line).
const LOG_PATH = path.resolve(__dirname, 'agent.log')

function agentLogSink(): Plugin {
  return {
    name: 'agent-log-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__agent_log', (req, res) => {
        if (req.method === 'DELETE') {
          // Truncate on demand — handy to clear before a fresh run.
          writeFileSync(LOG_PATH, '')
          res.statusCode = 200
          res.end('ok')
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('use POST or DELETE')
          return
        }
        const chunks: Buffer[] = []
        req.on('data', c => chunks.push(c))
        req.on('end', () => {
          try {
            appendFileSync(LOG_PATH, Buffer.concat(chunks).toString('utf8') + '\n')
            res.statusCode = 200
            res.end('ok')
          } catch (err) {
            res.statusCode = 500
            res.end((err as Error).message)
          }
        })
      })
    },
  }
}

// The Anthropic SDK's beta "agent-toolset" (fs-util, skills) does *named*
// imports from node: builtins (node:crypto's randomUUID, node:child_process,
// node:stream/promises, …). rollup externalizes node: builtins to empty
// modules for the browser, so those named bindings can't resolve and the
// production build fails. This app only uses the messages API and never
// touches `client.beta` sessions/environments, so the whole subtree is dead
// code in the browser — replace the two offending leaves with no-op stubs at
// build time. Dev (esbuild pre-bundle) handles these fine, so scope to build.
function stubAnthropicNodeTools(): Plugin {
  const nope =
    'const __nodeOnly = () => { throw new Error("@anthropic-ai/sdk agent-toolset is Node-only and unavailable in the browser") }'
  const STUBS: Record<string, string> = {
    'agent-toolset/fs-util': [
      'export const DIR_CREATE_MODE = 0o755',
      'export const FILE_CREATE_MODE = 0o644',
      nope,
      'export const canonicalize = __nodeOnly',
      'export const confineToRoot = __nodeOnly',
      'export const atomicWriteFile = __nodeOnly',
      'export const fsErrorMessage = () => ""',
    ].join('\n'),
    'agent-toolset/skills': [
      nope,
      'export const setupSkills = __nodeOnly',
      'export const resolveSkillVersion = __nodeOnly',
      'export const extractSkillArchive = __nodeOnly',
    ].join('\n'),
    'agent-toolset/node': [
      nope,
      'export const setupSkills = __nodeOnly',
      'export const resolveSkillVersion = __nodeOnly',
      'export const extractSkillArchive = __nodeOnly',
      'export const betaAgentToolset20260401 = __nodeOnly',
      'export const resolvePath = __nodeOnly',
      'export class BashSession {}',
      'export const betaBashTool = __nodeOnly',
      'export const betaReadTool = __nodeOnly',
      'export const betaWriteTool = __nodeOnly',
      'export const betaEditTool = __nodeOnly',
      'export const betaGlobTool = __nodeOnly',
      'export const betaGrepTool = __nodeOnly',
    ].join('\n'),
  }
  return {
    name: 'stub-anthropic-node-tools',
    apply: 'build',
    enforce: 'pre',
    load(id) {
      const norm = id.replace(/\\/g, '/')
      if (!norm.includes('@anthropic-ai/sdk/')) return null
      for (const key of Object.keys(STUBS)) {
        if (norm.includes(key)) return STUBS[key]
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [react(), agentLogSink(), stubAnthropicNodeTools()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
})
