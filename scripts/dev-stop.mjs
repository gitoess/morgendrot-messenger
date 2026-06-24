#!/usr/bin/env node
/**
 * Beendet lokale Morgendrot-Dev-Prozesse auf den Standard-Ports (UI 3341, API 3342/3343).
 * Hilft bei EADDRINUSE / „Website nicht erreichbar“ nach doppelten `npm run dev`-Starts.
 */
import { collectListeningPids, DEV_STACK_PORTS, killPid } from './dev-port-utils.mjs'

const pids = collectListeningPids(DEV_STACK_PORTS)

if (!pids.length) {
  console.log(`Kein Listener auf ${DEV_STACK_PORTS.join(', ')} — Dev-Stack scheint bereits gestoppt.`)
  process.exit(0)
}

for (const pid of pids) {
  try {
    killPid(pid)
    console.log(`Beendet PID ${pid} (Ports ${DEV_STACK_PORTS.join(', ')})`)
  } catch {
    console.warn(`PID ${pid} konnte nicht beendet werden (evtl. schon beendet).`)
  }
}

console.log('Fertig. Neu starten mit: npm run dev:messenger:clean')
