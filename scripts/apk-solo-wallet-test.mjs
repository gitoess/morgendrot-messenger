/**
 * APK Solo-Wallet Test — echter Flow ohne localStorage-Shortcuts.
 */
import WebSocket from 'ws'

const WS_URL = process.env.CDP_WS_URL || ''
const PASSWORD = process.env.TEST_PW || '12345678'

if (!WS_URL) {
  console.error('Set CDP_WS_URL')
  process.exit(1)
}

let msgId = 0
const pending = new Map()

function cdpSend(ws, method, params = {}) {
  const id = ++msgId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`CDP timeout: ${method}`))
      }
    }, 90_000)
  })
}

async function evaluate(ws, expression, awaitPromise = false) {
  const r = await cdpSend(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result?.value
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function clickButton(ws, matcher) {
  const ok = await evaluate(
    ws,
    `(() => {
      const fn = ${matcher};
      const nodes = [...document.querySelectorAll('button')];
      for (const el of nodes) {
        const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
        if (fn(t, el)) {
          el.scrollIntoView({ block: 'center' });
          el.click();
          return { ok: true, text: t.slice(0, 120) };
        }
      }
      return { ok: false };
    })()`
  )
  if (!ok?.ok) throw new Error('button not found')
  console.log('   clicked:', ok.text)
}

async function fillById(ws, id, value) {
  const ok = await evaluate(
    ws,
    `(() => {
      const el = document.getElementById(${JSON.stringify(id)});
      if (!el) return { ok: false };
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    })()`
  )
  if (!ok?.ok) throw new Error('fill failed: ' + id)
}

async function snapshot(ws) {
  return evaluate(
    ws,
    `(() => ({
      bodyPe: getComputedStyle(document.body).pointerEvents,
      vaultOpen: [...document.querySelectorAll('h2')].some(h => /entsperren|Wallet einrichten/i.test(h.textContent||'') && document.querySelector('[role=dialog]')),
      titles: [...document.querySelectorAll('h2')].map(h => (h.textContent||'').trim().slice(0,50)),
      hasEncSigner: Boolean(localStorage.getItem('morgendrot.direct-iota-signer.enc.v1')),
      soloPath: localStorage.getItem('morgendrot.standaloneOnboardingPath.v1'),
      handoff: Boolean(localStorage.getItem('morgendrot.handoff.localApplied.v1')),
    }))()`
  )
}

async function main() {
  const ws = new WebSocket(WS_URL)
  await new Promise((res, rej) => {
    ws.once('open', res)
    ws.once('error', rej)
  })
  ws.on('message', (raw) => {
    const msg = JSON.parse(String(raw))
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    }
  })
  await cdpSend(ws, 'Runtime.enable')

  console.log('A) Startzustand:', JSON.stringify(await snapshot(ws)))

  console.log('1) Privat/Solo (unter Vault — native overlay erlaubt Klick?) …')
  try {
    await clickButton(ws, `(t) => t.includes('Privat / Solo')`)
    await sleep(1000)
    console.log('   nach Solo:', JSON.stringify(await snapshot(ws)))
  } catch (e) {
    console.log('   Solo-Klick nicht möglich (Vault darüber):', e.message)
  }

  console.log('2) Neues Profil anlegen …')
  await clickButton(ws, `(t) => t.startsWith('Neues Profil anlegen')`)
  await sleep(700)

  console.log('3) Seed erzeugen …')
  await clickButton(ws, `(t) => t === 'Seed erzeugen' || t.startsWith('Seed erzeugen')`)
  await sleep(2500)

  const seedLen = await evaluate(ws, `document.getElementById('create-signer-a')?.value?.length || 0`)
  if (seedLen < 10) throw new Error('Seed-Feld leer nach Erzeugen')
  console.log('   Seed-Länge:', seedLen)

  console.log('4) Passwort', PASSWORD)
  await fillById(ws, 'wallet-password-create', PASSWORD)
  await fillById(ws, 'wallet-password-create-2', PASSWORD)
  await sleep(400)

  console.log('5) Profil anlegen (Submit-Button) …')
  await clickButton(
    ws,
    `(t, el) => (t === 'Profil anlegen' || t.startsWith('Profil wird')) && !el.closest('[class*="OptionCard"]')?.querySelector('p')?.textContent?.includes('Neues Profil')`
  )
  await sleep(500)

  const mid = await snapshot(ws)
  console.log('6) Nach Submit:', JSON.stringify(mid))

  console.log('7) Klick Einstellungen …')
  let settingsOk = false
  let messagesOk = false
  try {
    await clickButton(ws, `(t) => t === 'Einstellungen' || t.includes('Einstellungen')`)
    settingsOk = true
    await sleep(600)
  } catch (e) {
    console.log('   Einstellungen:', e.message)
  }
  try {
    await clickButton(ws, `(t) => t.startsWith('Nachrichten')`)
    messagesOk = true
  } catch (e) {
    console.log('   Nachrichten:', e.message)
  }

  const fin = await snapshot(ws)
  const frozen = fin.bodyPe === 'none' || (!settingsOk && !messagesOk) || fin.vaultOpen

  console.log('8) Endzustand:', JSON.stringify(fin))
  console.log(frozen ? '\n=== RESULT: FREEZE ===' : '\n=== RESULT: OK ===')
  ws.close()
  process.exit(frozen ? 2 : 0)
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message)
  process.exit(1)
})
