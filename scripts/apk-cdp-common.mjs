/**
 * Gemeinsame CDP-Helfer für APK-Standalone-Smoke (4b–4f).
 */
import WebSocket from 'ws'
import { loadChainGlobals } from './apk-chain-globals.mjs'

const GLOBALS = loadChainGlobals()

export const CHAIN = {
  testnet: {
    packageId: process.env.SOLO_TESTNET_PACKAGE_ID || GLOBALS.testnet.packageId,
    mailboxId: process.env.SOLO_TESTNET_MAILBOX_ID || GLOBALS.testnet.mailboxId,
    rpcUrl: process.env.SOLO_TESTNET_RPC_URL || GLOBALS.testnet.rpcUrl,
  },
  mainnet: {
    packageId: process.env.SOLO_MAINNET_PACKAGE_ID || GLOBALS.mainnet.packageId,
    mailboxId: process.env.SOLO_MAINNET_MAILBOX_ID || GLOBALS.mainnet.mailboxId,
    rpcUrl: process.env.SOLO_MAINNET_RPC_URL || GLOBALS.mainnet.rpcUrl,
  },
}

/** @deprecated Testnet-Alias */
export const PACKAGE_ID = process.env.SOLO_PACKAGE_ID || CHAIN.testnet.packageId
/** @deprecated Testnet-Alias */
export const MAILBOX_ID = process.env.SOLO_MAILBOX_ID || CHAIN.testnet.mailboxId
/** @deprecated Testnet-Alias */
export const RPC_URL = process.env.SOLO_RPC_URL || CHAIN.testnet.rpcUrl

export const PASSWORD = process.env.TEST_PW || '12345678'
export const SKIP_ONBOARDING = process.env.SKIP_ONBOARDING === '1'

export function assertChainIds() {
  for (const net of ['testnet', 'mainnet']) {
    const p = CHAIN[net]
    if (!p.packageId || !p.mailboxId || !p.rpcUrl) {
      throw new Error(`Chain-IDs für ${net} fehlen — .morgendrot-globals-ids.json prüfen.`)
    }
  }
}

export function createCdpSession(wsUrl) {
  let msgId = 0
  const pending = new Map()

  const ws = new WebSocket(wsUrl)

  const ready = new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
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

  async function cdpSend(method, params = {}) {
    const id = ++msgId
    ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id)
          reject(new Error(`CDP timeout: ${method}`))
        }
      }, 120_000)
    })
  }

  async function evaluate(expression, awaitPromise = false) {
    const r = await cdpSend('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result?.value
  }

  async function init() {
    await ready
    await cdpSend('Runtime.enable')
  }

  function close() {
    ws.close()
  }

  return { evaluate, cdpSend, init, close }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Nach Kaltstart: WebView lädt oft zuerst about:blank — localStorage erst nach App-Load. */
export async function waitForAppReady(session, opts = {}) {
  const { timeoutMs = 90_000, requireEncSigner = false } = opts
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await session.evaluate(
        `(() => {
          const requireEncSigner = ${JSON.stringify(Boolean(requireEncSigner))};
          try {
            const ls = window.localStorage;
            if (!ls) return { ready: false, why: 'no-ls', title: (document.title || '').slice(0, 80) };
            ls.getItem('__morgendrot_probe__');
            const encSigner = Boolean(ls.getItem('morgendrot.directIotaSigner.enc.v1'));
            const title = (document.title || '').trim();
            if (requireEncSigner && !encSigner) {
              return { ready: false, why: 'no-signer', title };
            }
            return { ready: true, encSigner, title: title.slice(0, 80) };
          } catch (e) {
            return {
              ready: false,
              why: (e && e.name) || 'ls-denied',
              msg: (e && e.message) || '',
              title: (document.title || '').slice(0, 80),
            };
          }
        })()`
      )
      if (r?.ready) {
        console.log('   App bereit:', JSON.stringify({ encSigner: r.encSigner, title: r.title }))
        return r
      }
      if (r?.why) console.log('   Warte auf App …', r.why, r.title || '')
    } catch {
      /* CDP noch nicht bereit */
    }
    await sleep(1500)
  }
  throw new Error('App-Ready Timeout — WebView nach Kaltstart nicht geladen?')
}

export async function clickButton(session, matcher) {
  const ok = await session.evaluate(
    `(() => {
      const fn = ${matcher};
      const nodes = [...document.querySelectorAll('button,[role="button"]')];
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
  return ok.text
}

export async function clickIfPresent(session, matcher) {
  try {
    return await clickButton(session, matcher)
  } catch {
    return null
  }
}

export async function fillById(session, id, value) {
  const ok = await session.evaluate(
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

export async function readSessionState(session) {
  return session.evaluate(
    `(() => {
      const dialog = document.querySelector('[role=dialog]');
      const dialogH2 = dialog ? [...dialog.querySelectorAll('h2')].map(h => (h.textContent||'').trim()) : [];
      const vaultDialogOpen = Boolean(
        dialog &&
          dialogH2.some(h => /Wallet einrichten|Tresor|Direkt-IOTA|Privat-Modus/i.test(h))
      );
      const addr = (localStorage.getItem('morgendrot.directChain.senderAddress') || '').trim().toLowerCase();
      return {
        addr,
        vaultDialogOpen,
        hasPasswordField: Boolean(document.getElementById('wallet-password')),
        unlockError: (dialog?.querySelector('.text-destructive')?.textContent || '').trim().slice(0, 160),
      };
    })()`
  )
}

export async function snapshot(session) {
  const sessionState = await readSessionState(session)
  const snap = await session.evaluate(
    `(() => {
      const body = document.body;
      const iotaLine = [...document.querySelectorAll('p')].map(p => (p.textContent||'').trim()).find(t => t.startsWith('IOTA:'));
      const sendStatus = document.querySelector('[data-testid="chat-composer-send-status"]')?.textContent?.trim() || '';
      const composer = document.getElementById('chat-composer-message');
      let np = null;
      try {
        np = JSON.parse(localStorage.getItem('morgendrot.einsatz.networkProfiles.v1') || 'null');
      } catch { /* ignore */ }
      return {
        bodyPe: body ? getComputedStyle(body).pointerEvents : '',
        titles: [...document.querySelectorAll('h2')].map(h => (h.textContent||'').trim().slice(0,60)),
        hasEncSigner: Boolean(localStorage.getItem('morgendrot.directIotaSigner.enc.v1')),
        soloPath: localStorage.getItem('morgendrot.standaloneOnboardingPath.v1'),
        packageId: localStorage.getItem('morgendrot.directChain.packageId')?.slice(0,14),
        mailboxId: localStorage.getItem('morgendrot.directChain.mailboxId')?.slice(0,14),
        rpcUrl: localStorage.getItem('morgendrot.directIotaRpcUrl'),
        senderAddress: (localStorage.getItem('morgendrot.directChain.senderAddress') || '').slice(0, 14),
        networkActive: np?.active || '',
        testnetPkg: np?.testnet?.packageId?.slice(0, 14) || '',
        mainnetPkg: np?.mainnet?.packageId?.slice(0, 14) || '',
        setupPlan: np?.setupPlan || '',
        iotaLine: iotaLine || '',
        sendStatus: sendStatus.slice(0, 200),
        composerVisible: Boolean(composer),
        path: location.pathname,
      };
    })()`
  )
  return {
    ...snap,
    vaultOpen: sessionState.vaultDialogOpen,
    sessionAddr: sessionState.addr,
    unlockError: sessionState.unlockError,
  }
}

export async function unlockVaultIfNeeded(session, { force = false } = {}) {
  let state = await readSessionState(session)
  if (!force && state.addr.length >= 66 && !state.vaultDialogOpen) {
    const diag = await readSendDiagnostics(session).catch(() => null)
    const vaultBlocked = /tresor gesperrt/i.test(
      `${diag?.sendTitle || ''} ${diag?.hint || ''} ${diag?.status || ''}`
    )
    if (!vaultBlocked) {
      console.log('… Vault bereits entsperrt:', state.addr.slice(0, 10) + '…')
      return state.addr
    }
    console.log('… Vault laut Composer gesperrt — erneut entsperren')
  }

  console.log('… Vault entsperren (Passwort', PASSWORD + ')')

  await session.evaluate(
    `(() => {
      if (localStorage.getItem('morgendrot.directIotaSigner.enc.v1')) {
        localStorage.setItem('morgendrot.standaloneOnboardingPath.v1', 'solo');
      }
    })()`
  )

  await clickIfPresent(session, `(t) => t === 'Übersicht' || /^Start/i.test(t)`)
  await sleep(500)
  const opened = await session.evaluate(
    `(() => {
      const nodes = [...document.querySelectorAll('button,[role="button"],a')];
      for (const el of nodes) {
        const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
        if (/Tresor öffnen/i.test(t)) {
          el.click();
          return { ok: true, label: t.slice(0, 80) };
        }
      }
      return { ok: false };
    })()`
  )
  if (opened?.ok) console.log('   Dialog:', opened.label)

  await clickIfPresent(session, `(t) => t === 'Tresor entsperren'`)
  await sleep(800)
  await clickIfPresent(session, `(t) => {
    const title = el.querySelector?.('p.font-semibold, p.text-base')?.textContent?.trim();
    return title === 'Tresor öffnen';
  }`)
  await sleep(800)

  let hasPw = false
  for (let i = 0; i < 20; i++) {
    hasPw = await session.evaluate(`Boolean(document.getElementById('wallet-password'))`)
    if (hasPw) break
    await clickIfPresent(session, `(t) => t === 'Tresor entsperren'`)
    await sleep(500)
  }
  if (!hasPw) throw new Error('wallet-password Feld nicht gefunden — Tresor-Dialog öffnen')

  await fillById(session, 'wallet-password', PASSWORD)
  await sleep(300)
  await clickButton(session, `(t) => t === 'Entsperren' || t === 'Wird entsperrt…' || t === 'Chat aktivieren'`)

  for (let i = 0; i < 45; i++) {
    await sleep(1000)
    state = await readSessionState(session)
    const diag = await readSendDiagnostics(session).catch(() => null)
    const vaultBlocked = /tresor gesperrt/i.test(
      `${diag?.sendTitle || ''} ${diag?.hint || ''}`
    )
    if (state.addr.length >= 66 && !state.vaultDialogOpen && !vaultBlocked) {
      console.log('   Entsperrt:', state.addr.slice(0, 10) + '…')
      return state.addr
    }
    if (state.unlockError) {
      throw new Error('Vault-Fehler: ' + state.unlockError)
    }
  }
  throw new Error('Vault-Entsperren Timeout — Dialog noch offen?')
}

export async function applyDualNetworkChainViaStorage(session, senderAddress) {
  const tn = CHAIN.testnet
  const mn = CHAIN.mainnet
  await session.evaluate(
    `(() => {
      const testnet = ${JSON.stringify(tn)};
      const mainnet = ${JSON.stringify(mn)};
      const sender = ${JSON.stringify(senderAddress || '')};
      localStorage.setItem('morgendrot.directIotaRpcUrl', testnet.rpcUrl);
      localStorage.setItem('morgendrot.directChain.packageId', testnet.packageId);
      localStorage.setItem('morgendrot.directChain.mailboxId', testnet.mailboxId);
      if (sender) localStorage.setItem('morgendrot.directChain.senderAddress', sender);
      localStorage.setItem('morgendrot.directChain.ttlDays', '30');
      localStorage.setItem(
        'morgendrot.directChain.flagsJson',
        JSON.stringify({ useMailbox: true, mailboxStorePlaintext: true, messengerCreditsConfigured: false })
      );
      localStorage.setItem('morgendrot.directMailboxDrain', '1');
      localStorage.removeItem('morgendrot.iotaSubmitMode');
      localStorage.setItem('morgendrot.directChain.savedAtMs', String(Date.now()));
      const npKey = 'morgendrot.einsatz.networkProfiles.v1';
      localStorage.setItem(
        npKey,
        JSON.stringify({
          active: 'testnet',
          setupPlan: 'both',
          setupPlanChosen: true,
          testnet,
          mainnet,
        })
      );
      try {
        const key = 'morgendrot.handoff.localApplied.v1';
        const raw = localStorage.getItem(key);
        if (raw) {
          const snap = JSON.parse(raw);
          snap.packageId = testnet.packageId;
          snap.mailboxId = testnet.mailboxId;
          snap.savedAtMs = Date.now();
          localStorage.setItem(key, JSON.stringify(snap));
        }
      } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('morgendrot-direct-iota-ui-changed'));
      window.dispatchEvent(new CustomEvent('morgendrot:einsatz-network-profiles-changed'));
      window.dispatchEvent(new CustomEvent('morgendrot.standaloneHandoffApplied'));
      window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'));
      try { localStorage.removeItem('morgendrot.apiStatus.lastOk.v1'); } catch { /* ignore */ }
      return true;
    })()`
  )
  console.log('   Testnet + Mainnet per Storage gesetzt')
}

export async function readNetworkProfilesOk(session) {
  return session.evaluate(
    `(() => {
      const expected = ${JSON.stringify(CHAIN)};
      let np;
      try {
        np = JSON.parse(localStorage.getItem('morgendrot.einsatz.networkProfiles.v1') || 'null');
      } catch {
        return { ok: false, reason: 'parse' };
      }
      if (!np) return { ok: false, reason: 'missing' };
      const match = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
      const tnOk =
        match(np.testnet?.packageId, expected.testnet.packageId) &&
        match(np.testnet?.mailboxId, expected.testnet.mailboxId) &&
        match(np.testnet?.rpcUrl, expected.testnet.rpcUrl);
      const mnOk =
        match(np.mainnet?.packageId, expected.mainnet.packageId) &&
        match(np.mainnet?.mailboxId, expected.mainnet.mailboxId) &&
        match(np.mainnet?.rpcUrl, expected.mainnet.rpcUrl);
      return {
        ok: tnOk && mnOk && np.active === 'testnet' && np.setupPlan === 'both',
        tnOk,
        mnOk,
        active: np.active,
        setupPlan: np.setupPlan,
      };
    })()`
  )
}

export async function configureSoloChain(session, senderAddress) {
  console.log('6) Solo-Kette (Testnet + Mainnet) …')
  const profiles = await readNetworkProfilesOk(session)
  const chainOk = await session.evaluate(
    `(() => {
      const pkg = (localStorage.getItem('morgendrot.directChain.packageId') || '').trim().toLowerCase();
      const mb = (localStorage.getItem('morgendrot.directChain.mailboxId') || '').trim().toLowerCase();
      const rpc = (localStorage.getItem('morgendrot.directIotaRpcUrl') || '').trim();
      return (
        pkg === ${JSON.stringify(CHAIN.testnet.packageId)}.trim().toLowerCase() &&
        mb === ${JSON.stringify(CHAIN.testnet.mailboxId)}.trim().toLowerCase() &&
        rpc === ${JSON.stringify(CHAIN.testnet.rpcUrl)}.trim()
      );
    })()`
  )
  if (chainOk && profiles?.ok) {
    console.log('   Testnet + Mainnet bereits korrekt')
    return
  }

  const hasSoloFields = await session.evaluate(`Boolean(document.getElementById('solo-package-id'))`)
  if (hasSoloFields) {
    await fillById(session, 'solo-rpc-url', CHAIN.testnet.rpcUrl)
    await fillById(session, 'solo-package-id', CHAIN.testnet.packageId)
    await fillById(session, 'solo-mailbox-id', CHAIN.testnet.mailboxId)
    await sleep(300)
    await clickButton(session, `(t) => t.includes('Speichern') && t.includes('Chat aktivieren')`)
    await sleep(2000)
    // Solo-Wizard setzt nur Testnet — Mainnet nachziehen
    if (!(await readNetworkProfilesOk(session))?.mnOk) {
      await applyDualNetworkChainViaStorage(session, senderAddress)
    }
  } else {
    console.log('   Solo-Wizard nicht sichtbar — Storage …')
    await clickIfPresent(session, `(t) => t === 'Übersicht' || t.startsWith('Start')`)
    await sleep(1000)
    await applyDualNetworkChainViaStorage(session, senderAddress)
  }

  const final = await readNetworkProfilesOk(session)
  if (!final?.ok) {
    throw new Error('Netzwerk-Profile unvollständig: ' + JSON.stringify(final))
  }
}

export async function fillRecipientFields(session, myAddr) {
  return session.evaluate(
    `(() => {
      const setInput = (el, value) => {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const addr = ${JSON.stringify(myAddr)};
      const inputs = [
        ...document.querySelectorAll('input[list="chat-recipient-addresses"]'),
        ...document.querySelectorAll('input[list="chat-partner-addresses-encrypted"]'),
        ...document.querySelectorAll('input[placeholder*="0x"]'),
      ].filter((el) => el instanceof HTMLInputElement && el.offsetParent !== null);
      if (inputs[0]) {
        setInput(inputs[0], addr);
        return { ok: true, via: 'input' };
      }
      return { ok: false };
    })()`
  )
}

export async function armRecipient(session, myAddr) {
  let r = await fillRecipientFields(session, myAddr)
  if (r?.ok) return r

  await session.evaluate(
    `(() => {
      const addr = ${JSON.stringify(myAddr)};
      try {
        const peerKey = 'morgendrot.connectedPeersSnapshot.v1';
        const raw = localStorage.getItem(peerKey);
        const snap = raw ? JSON.parse(raw) : { peers: [] };
        const peers = Array.isArray(snap.peers) ? snap.peers : [];
        if (!peers.some((p) => String(p?.address || p).toLowerCase() === addr)) {
          peers.push({ address: addr, label: 'smoke', savedAtMs: Date.now() });
          localStorage.setItem(peerKey, JSON.stringify({ ...snap, peers }));
        }
      } catch { /* ignore */ }
      return true;
    })()`
  )

  const search = await session.evaluate(
    `(() => {
      const input = document.querySelector('input[aria-label="Messenger durchsuchen"]');
      if (!input) return { ok: false };
      const proto = HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, ${JSON.stringify(myAddr)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      return { ok: true };
    })()`
  )
  if (search?.ok) {
    await sleep(900)
    await clickIfPresent(session, `(t, el) => t.includes(${JSON.stringify(myAddr.slice(0, 8))}) && el.tagName === 'BUTTON'`)
    await sleep(600)
    r = await fillRecipientFields(session, myAddr)
    if (r?.ok) return r
  }

  const activePartner = await session.evaluate(
    `(() => {
      const text = document.body?.innerText || '';
      const hasAddr = text.toLowerCase().includes(${JSON.stringify(myAddr.slice(0, 10))});
      return { hasAddr };
    })()`
  )
  if (activePartner?.hasAddr) {
    return { ok: true, via: 'active-conversation' }
  }

  await clickIfPresent(session, `(t) => /Wallet-Adresse des Partners|Verschlüsselung|Partner/i.test(t)`)
  await sleep(500)
  r = await fillRecipientFields(session, myAddr)
  return r?.ok ? r : { ok: false }
}

export async function fillComposerMessage(session, message) {
  const viaDom = await session.evaluate(
    `(() => {
      const ta = document.getElementById('chat-composer-message');
      if (!ta) return { ok: false, reason: 'no-composer' };
      ta.focus();
      const proto = HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(ta, ${JSON.stringify(message)});
      ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(message)} }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, len: ta.value.length };
    })()`
  )
  if (viaDom?.ok && viaDom.len > 0) return viaDom

  try {
    const { root } = await session.cdpSend('DOM.getDocument')
    const q = await session.cdpSend('DOM.querySelector', { nodeId: root.nodeId, selector: '#chat-composer-message' })
    if (q?.nodeId) {
      await session.cdpSend('DOM.focus', { nodeId: q.nodeId })
      await session.cdpSend('Input.insertText', { text: message })
      return { ok: true, via: 'cdp-insert' }
    }
  } catch {
    /* fallback */
  }
  return viaDom
}

export async function readDirectRpcReady(session) {
  return session.evaluate(
    `(() => {
      const rpc = Boolean(localStorage.getItem('morgendrot.directIotaRpcUrl'));
      const drain = localStorage.getItem('morgendrot.directMailboxDrain') === '1';
      const clientMode = localStorage.getItem('morgendrot.iotaSubmitMode') !== 'relay';
      const pkg = Boolean(localStorage.getItem('morgendrot.directChain.packageId'));
      const mb = Boolean(localStorage.getItem('morgendrot.directChain.mailboxId'));
      const sender = Boolean(localStorage.getItem('morgendrot.directChain.senderAddress'));
      const uiLine = [...document.querySelectorAll('p,span,strong')].map((el) => (el.textContent || '').trim()).find((t) => /Direkt-RPC/i.test(t)) || '';
      return { rpc, drain, clientMode, pkg, mb, sender, uiLine: uiLine.slice(0, 120), ready: rpc && drain && clientMode && pkg && mb && sender };
    })()`
  )
}

export async function readSendDiagnostics(session) {
  return session.evaluate(
    `(() => {
      const btn = document.querySelector('[data-testid="chat-composer-primary-send"]');
      const status = document.querySelector('[data-testid="chat-composer-send-status"]')?.textContent?.trim() || '';
      const hint = [...document.querySelectorAll('p.text-xs, p.text-sm')].map((p) => (p.textContent || '').trim()).find((t) => /Empfänger|Tresor|Keys|Senden/i.test(t)) || '';
      const composerLen = document.getElementById('chat-composer-message')?.value?.length || 0;
      return {
        sendDisabled: btn ? btn.disabled : true,
        sendText: btn?.textContent?.trim() || '',
        sendTitle: btn?.getAttribute('title') || '',
        status,
        hint: hint.slice(0, 200),
        composerLen,
      };
    })()`
  )
}

export async function ensureChatEcdhForSelf(session, myAddr) {
  const r = await session.evaluate(
    `(async () => {
      const addr = ${JSON.stringify(myAddr)}.trim().toLowerCase();
      const LS_PEER = 'morgendrot.directChatEcdh.peerPubB64ByRecipient.v1';
      const LS_JWK = 'morgendrot.directChatEcdh.privateJwk.v1';
      const LS_OWN = 'morgendrot.directChatEcdh.ownPubRawB64.v1';
      const map = JSON.parse(localStorage.getItem(LS_PEER) || '{}');
      let jwkJson = localStorage.getItem(LS_JWK) || '';
      let b64 = map[addr] || localStorage.getItem(LS_OWN) || '';
      if (!jwkJson || !b64) {
        const pair = await crypto.subtle.generateKey(
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          ['deriveBits', 'deriveKey']
        );
        const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
        const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
        b64 = btoa(String.fromCharCode(...pubRaw));
        jwkJson = JSON.stringify(jwk);
        localStorage.setItem(LS_JWK, jwkJson);
        localStorage.setItem(LS_OWN, b64);
        map[addr] = b64;
        localStorage.setItem(LS_PEER, JSON.stringify(map));
      }
      return { ok: true, jwkJson, via: map[addr] ? 'peer-map' : 'generated' };
    })()`,
    true
  )
  const pulse = await applyEcdhJwkViaPulse(session, r?.jwkJson || '')
  console.log('   ECDH Puls:', pulse?.ok ? 'JWK aktiv' : 'nur LS')
  return { ...r, pulseOk: pulse?.ok }
}

async function applyEcdhJwkViaPulse(session, jwkJson) {
  if (!jwkJson || jwkJson.length < 20) return { ok: false }
  await clickIfPresent(session, `(t) => /Mailbox · Direkt-RPC|Puls|Expertenoptionen/i.test(t)`)
  await sleep(400)
  await clickIfPresent(session, `(t) => t.includes('Expertenoptionen anzeigen')`)
  await sleep(400)
  const filled = await session.evaluate(
    `(() => {
      const areas = [...document.querySelectorAll('textarea')];
      const ta = areas.find((el) => (el.placeholder || '').includes('kty') || el.className.includes('font-mono'));
      if (!ta) return { ok: false };
      const proto = HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(ta, ${JSON.stringify(jwkJson)});
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    })()`
  )
  if (!filled?.ok) return { ok: false }
  await clickIfPresent(session, `(t) => t === 'ECDH-JWK anwenden'`)
  await sleep(800)
  return { ok: true }
}

export async function openMessagesComposer(session) {
  const pre = await snapshot(session)
  if (!pre.composerVisible) {
    console.log('7) Nachrichten öffnen …')
    await clickButton(session, `(t) => /^Nachrichten/i.test(t) && !/verlauf/i.test(t)`)
    await sleep(2000)
  } else {
    console.log('7) Chat bereits offen')
  }
  await clickIfPresent(session, `(t) => /^Online$/i.test(t) || t === 'Online'`)
  await sleep(400)
}

export async function sendComposerMessage(session, { encrypted, message, myAddr, recipientAddr }) {
  const toAddr = recipientAddr || myAddr
  if (encrypted) {
    await clickIfPresent(session, `(t) => /^Verschl\\./i.test(t) || t === 'Verschlüsselt' || t.includes('Verschl')`)
  } else {
    await clickIfPresent(session, `(t) => /^Klartext$/i.test(t) || t.includes('Unverschlüsselt')`)
    await clickIfPresent(session, `(t) => t === 'Verstanden, fortfahren'`)
  }
  await sleep(400)

  if (encrypted) {
    const ecdh = await ensureChatEcdhForSelf(session, toAddr)
    console.log('   ECDH:', ecdh?.via || JSON.stringify(ecdh))
  }

  const armed = await armRecipient(session, toAddr)
  if (!armed?.ok) throw new Error('Empfänger nicht gesetzt')
  console.log('   Empfänger via:', armed.via || 'input')

  const composed = await fillComposerMessage(session, message)
  if (!composed?.ok) throw new Error('Composer nicht bereit: ' + (composed?.reason || 'unknown'))

  const preSend = await readSendDiagnostics(session)
  console.log('   Pre-Send:', JSON.stringify(preSend))
  if (preSend.sendDisabled) {
    throw new Error('Senden blockiert: ' + (preSend.sendTitle || preSend.hint || preSend.status || 'unbekannt'))
  }

  const sent = await session.evaluate(
    `(() => {
      const btn = document.querySelector('[data-testid="chat-composer-primary-send"]');
      if (!btn) return { ok: false, reason: 'missing' };
      if (btn.disabled) return { ok: false, reason: 'disabled' };
      btn.click();
      return { ok: true };
    })()`
  )
  if (!sent?.ok) throw new Error('Send-Button nicht klickbar: ' + (sent?.reason || 'unknown'))

  let lastStatus = ''
  let bodyHint = ''
  for (let i = 0; i < 60; i++) {
    await sleep(1500)
    const diag = await readSendDiagnostics(session)
    lastStatus = diag.status
    bodyHint = await session.evaluate(
      `(() => {
        const t = document.body?.innerText || '';
        const line = t.split(/\\n/).find((l) => /gesendet|digest|fehl|gas|rejected|error|verschl/i.test(l));
        return (line || '').trim().slice(0, 240);
      })()`
    )
    if (/erfolg|gesendet|digest|txblock|0x[a-f0-9]{16}/i.test(lastStatus + ' ' + bodyHint)) break
    if (/fehl|error|gas|insufficient|rejected/i.test(lastStatus + ' ' + bodyHint)) break
  }
  return { lastStatus, bodyHint }
}

export async function refreshInboxAndFindMessage(session, needle) {
  await session.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
  await sleep(500)
  await clickIfPresent(session, `(t) => t === 'Aktualisieren'`)
  await sleep(3000)

  let found = false
  let sourceLine = ''
  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    const r = await session.evaluate(
      `(() => {
        const needle = ${JSON.stringify(needle)};
        const body = document.body?.innerText || '';
        const hit = body.includes(needle);
        const rpcLine = [...document.querySelectorAll('p,span,strong,div')].map((el) => (el.textContent || '').trim()).find((t) => /Direkt-RPC/i.test(t)) || '';
        return { hit, rpcLine: rpcLine.slice(0, 160) };
      })()`
    )
    if (r?.hit) {
      found = true
      sourceLine = r.rpcLine
      break
    }
    if (i === 5) await clickIfPresent(session, `(t) => t === 'Aktualisieren'`)
  }
  return { found, sourceLine }
}

export function sendOk(statusBlob) {
  return /gesendet|digest|txblock|0x[a-f0-9]{16}/i.test(statusBlob)
}

export function isDirectRelay(fin, rpcState) {
  const directRpc = rpcState.ready || /Direkt-RPC aktiv/i.test(fin.iotaLine + ' ' + rpcState.uiLine)
  const relay = /über Relay/i.test(fin.iotaLine + ' ' + rpcState.uiLine)
  return { directRpc, relay }
}

/** Boss-Handoff-Ketten-IDs + Partner für Helfer→Boss-Smoke. */
export async function applyBossHandoffChainViaStorage(session, p) {
  const { packageId, mailboxId, rpcUrl, bossAddress, senderAddress } = p
  await session.evaluate(
    `(() => {
      const pkg = ${JSON.stringify(packageId)};
      const mb = ${JSON.stringify(mailboxId)};
      const rpc = ${JSON.stringify(rpcUrl)};
      const boss = ${JSON.stringify(bossAddress || '')};
      const sender = ${JSON.stringify(senderAddress || '')};
      localStorage.setItem('morgendrot.directIotaRpcUrl', rpc);
      localStorage.setItem('morgendrot.directChain.packageId', pkg);
      localStorage.setItem('morgendrot.directChain.mailboxId', mb);
      if (sender) localStorage.setItem('morgendrot.directChain.senderAddress', sender);
      localStorage.setItem('morgendrot.directMailboxDrain', '1');
      localStorage.removeItem('morgendrot.iotaSubmitMode');
      if (boss) {
        try {
          const peerKey = 'morgendrot.connectedPeersSnapshot.v1';
          const raw = localStorage.getItem(peerKey);
          const snap = raw ? JSON.parse(raw) : { peers: [] };
          const peers = Array.isArray(snap.peers) ? snap.peers : [];
          const b = boss.toLowerCase();
          if (!peers.some((x) => String(x?.address || x).toLowerCase() === b)) {
            peers.push({ address: boss, label: 'Boss', savedAtMs: Date.now() });
            localStorage.setItem(peerKey, JSON.stringify({ ...snap, peers }));
          }
        } catch { /* ignore */ }
      }
      window.dispatchEvent(new CustomEvent('morgendrot-direct-iota-ui-changed'));
      window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'));
      return { pkg: pkg.slice(0, 14), mb: mb.slice(0, 14), boss: boss.slice(0, 14) };
    })()`
  )
}
