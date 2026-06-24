#!/usr/bin/env node
/**
 * Messenger-Dev sauber starten:
 * 1) Konflikte auf 3341 (Next) + 3342 (API) beenden
 * 2) Warten bis Ports frei
 * 3) Stack mit festen Ports starten (API bleibt auf 3342, kein Fallback)
 *
 * Aufruf: npm run dev:messenger:clean
 */
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MESSENGER_DEV_PORTS,
  collectListeningPids,
  killPid,
  waitUntilPortsFree,
} from './dev-port-utils.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const UI_PORT = 3341
const API_PORT = 3342

function stopDevPorts() {
  const pids = collectListeningPids(MESSENGER_DEV_PORTS)
  if (!pids.length) {
    console.log(`Kein Listener auf ${MESSENGER_DEV_PORTS.join(', ')} — Ports sind frei.`)
    return
  }
  for (const pid of pids) {
    try {
      killPid(pid)
      console.log(`Beendet PID ${pid} (Ports ${MESSENGER_DEV_PORTS.join(', ')})`)
    } catch {
      console.warn(`PID ${pid} konnte nicht beendet werden (evtl. schon beendet).`)
    }
  }
}

async function main() {
  console.log('── Morgendrot Messenger Dev: Port-Bereinigung ──')
  stopDevPorts()

  const wait = await waitUntilPortsFree(MESSENGER_DEV_PORTS, 20000)
  if (!wait.ok) {
    console.error(
      `Ports noch belegt: ${wait.busy.join(', ')}. Task-Manager prüfen oder erneut npm run dev:stop.`
    )
    process.exit(1)
  }

  console.log(`Ports ${MESSENGER_DEV_PORTS.join(' + ')} frei.`)
  console.log(
    `Starte Messenger-Dev — Next http://127.0.0.1:${UI_PORT}/  API http://127.0.0.1:${API_PORT}/api/status`
  )
  console.log('(Strg+C zum Beenden)\n')

  try {
    execSync('npm run validate:ui', { cwd: ROOT, stdio: 'inherit' })
  } catch {
    process.exit(1)
  }

  const env = {
    ...process.env,
    MORGENDROT_DEV_STRICT_PORTS: '1',
    API_KILL_PREVIOUS_INSTANCE: 'false',
  }

  const child = spawn('npm run dev:messenger:serve', {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env,
  })

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    process.exit(code ?? 1)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
