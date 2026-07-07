/**
 * Discover Chrome DevTools WebSocket URL for Morgendrot APK WebView via ADB.
 * Requires: authorized device, app open in foreground.
 */
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { chainEnvFromGlobals } from './apk-chain-globals.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.CDP_PORT || 9222)
const PACKAGE = process.env.APK_PACKAGE || 'de.morgendrot.messenger'

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    return (e.stdout?.toString() || '') + (e.stderr?.toString() || '')
  }
}

function adbDevices() {
  const out = run('adb devices')
  const lines = out.split(/\r?\n/).slice(1).filter((l) => l.trim())
  return lines.map((l) => {
    const [id, state] = l.split(/\s+/)
    return { id, state }
  })
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function tryForward(abstract) {
  run(`adb forward tcp:${PORT} ${abstract}`)
  try {
    const list = await fetchJson(`http://127.0.0.1:${PORT}/json`)
    const hit = list.find(
      (t) =>
        (t.title || '').includes('Morgendrot') ||
        (t.url || '').includes('morgendrot') ||
        (t.description || '').includes(PACKAGE) ||
        (t.url || '').startsWith('https://localhost')
    )
    const target = hit || list.find((t) => t.type === 'page') || list[0]
    if (!target?.webSocketDebuggerUrl) return null
    return { ws: target.webSocketDebuggerUrl, title: target.title, url: target.url, abstract }
  } catch {
    return null
  }
}

async function main() {
  const devices = adbDevices()
  const authorized = devices.filter((d) => d.state === 'device')
  if (!authorized.length) {
    const bad = devices.filter((d) => d.state === 'unauthorized')
    if (bad.length) {
      console.error('ADB unauthorized — USB-Debugging am Handy bestätigen (RSA-Fingerabdruck).')
      console.error('Geräte:', devices.map((d) => `${d.id} (${d.state})`).join(', '))
    } else {
      console.error('Kein autorisiertes Gerät — adb devices leer oder offline.')
    }
    process.exit(2)
  }

  console.log('Gerät:', authorized[0].id)
  run(`adb shell am start -n ${PACKAGE}/.MainActivity`)

  const unix = run('adb shell cat /proc/net/unix')
  const sockets = [...unix.matchAll(/webview_devtools_remote_\d+/g)].map((m) => m[0])
  const candidates = [
    ...new Set([
      'localabstract:chrome_devtools_remote',
      ...sockets.map((s) => `localabstract:${s}`),
    ]),
  ]

  for (const abstract of candidates) {
    const hit = await tryForward(abstract)
    if (hit) {
      console.log('CDP_WS_URL=' + hit.ws)
      console.log('Title:', hit.title)
      console.log('URL:', hit.url)
      console.log('Forward:', abstract)
      const ids = chainEnvFromGlobals()
      if (ids.SOLO_PACKAGE_ID) console.log('SOLO_PACKAGE_ID=' + ids.SOLO_PACKAGE_ID)
      if (ids.SOLO_MAILBOX_ID) console.log('SOLO_MAILBOX_ID=' + ids.SOLO_MAILBOX_ID)
      if (ids.SOLO_RPC_URL) console.log('SOLO_RPC_URL=' + ids.SOLO_RPC_URL)
      if (ids.SOLO_TESTNET_PACKAGE_ID) console.log('SOLO_TESTNET_PACKAGE_ID=' + ids.SOLO_TESTNET_PACKAGE_ID)
      if (ids.SOLO_TESTNET_MAILBOX_ID) console.log('SOLO_TESTNET_MAILBOX_ID=' + ids.SOLO_TESTNET_MAILBOX_ID)
      if (ids.SOLO_MAINNET_PACKAGE_ID) console.log('SOLO_MAINNET_PACKAGE_ID=' + ids.SOLO_MAINNET_PACKAGE_ID)
      if (ids.SOLO_MAINNET_MAILBOX_ID) console.log('SOLO_MAINNET_MAILBOX_ID=' + ids.SOLO_MAINNET_MAILBOX_ID)
      process.exit(0)
    }
  }

  console.error('Kein WebView-Target gefunden — App im Vordergrund öffnen, WebView-Debugging ist in MainActivity aktiv.')
  process.exit(1)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
