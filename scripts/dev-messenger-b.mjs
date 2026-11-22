#!/usr/bin/env node
/**
 * Zweite Messenger-Instanz am selben Repo (PC Zwei-Wallet-Surrogat).
 * Ports 3344 (UI) / 3345 (API), Vault `.morgendrot-vault-b` — Instanz A (3341/3342) bleibt unberührt.
 *
 * Aufruf: npm run dm:b
 * Dann: http://localhost:3344/ — neues Profil / anderen Seed (nicht A-Vault).
 */
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectListeningPids, killPid, waitUntilPortsFree } from './dev-port-utils.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const UI_PORT = 3344
const API_PORT = 3345
const PORTS = [UI_PORT, API_PORT]
const VAULT_FILE = process.env.VAULT_FILE?.trim() || '.morgendrot-vault-b'

function stopBPorts() {
  const pids = collectListeningPids(PORTS)
  if (!pids.length) {
    console.log(`Kein Listener auf ${PORTS.join(', ')} — Ports frei.`)
    return
  }
  for (const pid of pids) {
    try {
      killPid(pid)
      console.log(`Beendet PID ${pid} (Ports ${PORTS.join(', ')})`)
    } catch {
      console.warn(`PID ${pid} konnte nicht beendet werden.`)
    }
  }
}

async function main() {
  console.log('── Morgendrot Messenger B (Zwei-Wallet) ──')
  stopBPorts()
  const wait = await waitUntilPortsFree(PORTS, 20000)
  if (!wait.ok) {
    console.error(`Ports noch belegt: ${wait.busy.join(', ')}.`)
    process.exit(1)
  }
  console.log(`Ports ${PORTS.join(' + ')} frei.`)
  console.log(`UI http://localhost:${UI_PORT}/  API http://127.0.0.1:${API_PORT}/api/status`)
  console.log(`VAULT_FILE=${VAULT_FILE} (eigenes Profil ≠ A)`)
  console.log('PARTNER_ADDRESS_FILE=.morgendrot-partner-b (nicht A’s .morgendrot-partner)')
  console.log('Hinweis: Telegram Long-Poll kollidiert mit Instanz A — Bot-Warnungen erwartbar.\n')

  try {
    execSync('npm run validate:ui', { cwd: ROOT, stdio: 'inherit' })
  } catch {
    process.exit(1)
  }

  const env = {
    ...process.env,
    API_PORT: String(API_PORT),
    UI_PORT: String(UI_PORT),
    VAULT_FILE,
    /** Getrennt von A — sonst überschreibt B-Handshake PARTNER mit A und A connectet zu sich selbst. */
    PARTNER_ADDRESS_FILE: process.env.PARTNER_ADDRESS_FILE?.trim() || '.morgendrot-partner-b',
    MORGENDROT_API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
    MORGENDROT_DEV_STRICT_PORTS: '0',
    API_KILL_PREVIOUS_INSTANCE: 'false',
  }

  const child = spawn('npm', ['run', 'dev:messenger:b:serve'], {
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
