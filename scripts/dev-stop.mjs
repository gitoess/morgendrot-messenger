#!/usr/bin/env node
/**
 * Beendet lokale Morgendrot-Dev-Prozesse auf den Standard-Ports (UI 3341, API 3342/3343).
 * Hilft bei EADDRINUSE / „Website nicht erreichbar“ nach doppelten `npm run dev`-Starts.
 */
import { execSync } from 'node:child_process'
import { platform } from 'node:os'

const PORTS = [3341, 3342, 3343, 3344]

function collectListeningPidsWindows() {
  const out = execSync('netstat -ano', { encoding: 'utf8' })
  const pids = new Set()
  const portGroup = PORTS.join('|')
  const listenRe = new RegExp(`127\\.0\\.0\\.1:(${portGroup})\\s+0\\.0\\.0\\.0:0`, 'i')
  for (const line of out.split(/\r?\n/)) {
    if (!listenRe.test(line)) continue
    const parts = line.trim().split(/\s+/)
    const pid = parts[parts.length - 1]
    if (/^\d+$/.test(pid)) pids.add(Number(pid))
  }
  return [...pids]
}

function collectListeningPidsUnix() {
  const pids = new Set()
  for (const port of PORTS) {
    try {
      const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' })
      for (const line of out.split(/\r?\n/)) {
        const n = Number(line.trim())
        if (Number.isFinite(n) && n > 0) pids.add(n)
      }
    } catch {
      // Port frei oder lsof fehlt
    }
  }
  return [...pids]
}

function killPid(pid) {
  if (platform() === 'win32') {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
  } else {
    process.kill(pid, 'SIGTERM')
  }
}

const pids = platform() === 'win32' ? collectListeningPidsWindows() : collectListeningPidsUnix()

if (!pids.length) {
  console.log(`Kein Listener auf ${PORTS.join(', ')} — Dev-Stack scheint bereits gestoppt.`)
  process.exit(0)
}

for (const pid of pids) {
  try {
    killPid(pid)
    console.log(`Beendet PID ${pid} (Ports ${PORTS.join(', ')})`)
  } catch {
    console.warn(`PID ${pid} konnte nicht beendet werden (evtl. schon beendet).`)
  }
}

console.log('Fertig. Neu starten mit: npm run dev')
