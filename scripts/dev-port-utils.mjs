#!/usr/bin/env node
/**
 * Hilfsfunktionen für Dev-Port-Bereinigung (3341 Next, 3342 API, …).
 */
import { execSync } from 'node:child_process'
import { platform } from 'node:os'

/** Standard-Ports des Messenger-Dev-Stacks. */
export const DEV_STACK_PORTS = [3341, 3342, 3343, 3344]

/** Messenger-Dev: Next + API (kein Fallback auf 3343). */
export const MESSENGER_DEV_PORTS = [3341, 3342]

function parsePid(line) {
  const parts = line.trim().split(/\s+/)
  const pid = parts[parts.length - 1]
  return /^\d+$/.test(pid) ? Number(pid) : null
}

function isWindowsListenLine(line, port) {
  if (!new RegExp(`:${port}\\s`).test(line)) return false
  // Lauschen: Remote 0.0.0.0:0 oder [::]:0 (sprachunabhängig; DE: ABHÖREN, EN: LISTENING)
  return /\s0\.0\.0\.0:0\s/.test(line) || /\s\[::\]:0\s/.test(line) || /LISTENING/i.test(line) || /ABH/i.test(line)
}

/** PIDs, die auf einem der Ports lauschen (127.0.0.1, 0.0.0.0, [::]). */
export function collectListeningPids(ports = DEV_STACK_PORTS) {
  if (platform() === 'win32') {
    const out = execSync('netstat -ano', { encoding: 'utf8' })
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      for (const port of ports) {
        if (!isWindowsListenLine(line, port)) continue
        const pid = parsePid(line)
        if (pid) pids.add(pid)
      }
    }
    return [...pids]
  }

  const pids = new Set()
  for (const port of ports) {
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

export function isPortListening(port) {
  return collectListeningPids([port]).length > 0
}

export async function waitUntilPortsFree(ports, maxMs = 15000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const busy = ports.filter((p) => isPortListening(p))
    if (!busy.length) return { ok: true, busy: [] }
    await new Promise((r) => setTimeout(r, 350))
  }
  const busy = ports.filter((p) => isPortListening(p))
  return { ok: !busy.length, busy }
}

export function killPid(pid) {
  if (platform() === 'win32') {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
  } else {
    process.kill(pid, 'SIGTERM')
  }
}
