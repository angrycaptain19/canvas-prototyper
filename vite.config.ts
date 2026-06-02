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

export default defineConfig({
  plugins: [react(), agentLogSink()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
})
