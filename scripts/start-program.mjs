import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const project = fileURLToPath(new URL('../', import.meta.url))
const url = 'http://127.0.0.1:4173/'
const runtime = join(project, '.runtime')
const vite = join(project, 'node_modules', 'vite', 'bin', 'vite.js')
const noBrowser = process.argv.includes('--no-browser')

async function probe() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500), cache: 'no-store' })
    if (!response.ok) return 'unavailable'
    return (await response.text()).includes('ACMI') ? 'ready' : 'other'
  } catch { return 'unavailable' }
}

try {
  let state = await probe()
  if (state === 'other') throw new Error('Port 4173 is serving another application. Close that application before starting ACMI.')
  if (state !== 'ready') {
    if (!existsSync(vite)) throw new Error('Dependencies are missing. Run npm.cmd install first.')
    if (!existsSync(join(project, 'dist', 'index.html'))) throw new Error('Production build is missing. Run npm.cmd run build first.')
    mkdirSync(runtime, { recursive: true })
    const out = openSync(join(runtime, 'production.stdout.log'), 'a')
    const err = openSync(join(runtime, 'production.stderr.log'), 'a')
    const server = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
      cwd: project, detached: true, windowsHide: true, stdio: ['ignore', out, err],
    })
    closeSync(out); closeSync(err)
    let spawnError
    server.on('error', error => { spawnError = error })
    server.unref()
    for (let attempt = 0; attempt < 30; attempt++) {
      if (spawnError) throw spawnError
      state = await probe()
      if (state === 'ready') break
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    if (state !== 'ready') throw new Error('Server did not become ready. See .runtime/production.stderr.log.')
    writeFileSync(join(runtime, 'server.json'), JSON.stringify({ pid: server.pid, url, mode: 'production-preview' }, null, 2))
  }
  console.log(`ACMI is ready: ${url}`)
  if (!noBrowser) {
    const browser = spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`], { windowsHide: true, detached: true, stdio: 'ignore' })
    browser.on('error', () => console.log(`Open ${url} in your browser.`))
    browser.unref()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
