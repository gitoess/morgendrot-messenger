/**
 * Diagnose: .env vs /api/status, Posteingang-Union, MsgKey pro Mailbox.
 * Aufruf: node scripts/probe-inbox-diagnose.mjs [apiBase]
 */
import fs from 'node:fs';
import path from 'node:path';

const API = (process.argv[2] || 'http://127.0.0.1:3342').replace(/\/$/, '');
const RPC = process.env.RPC_URL || 'https://api.testnet.iota.cafe';
const HEX64 = /^0x[a-fA-F0-9]{64}$/i;

function readEnvKey(key) {
  try {
    const p = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(p)) return '';
    const m = fs.readFileSync(p, 'utf-8').match(new RegExp(`^${key}=(.+)$`, 'm'));
    return (m?.[1] || '').trim().replace(/^["']|["']$/g, '');
  } catch {
    return '';
  }
}

function readLines(file) {
  try {
    const p = path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) return [];
    return fs
      .readFileSync(p, 'utf-8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => HEX64.test(s));
  } catch {
    return [];
  }
}

async function postCommand(command, args = []) {
  const res = await fetch(`${API}/api/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, args }),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text.slice(0, 500) };
  }
}

async function countMailboxMsgKeys(mailboxId) {
  let cursor = null;
  const all = [];
  for (let page = 0; page < 20; page++) {
    const body = { jsonrpc: '2.0', id: 1, method: 'iotax_getDynamicFields', params: [mailboxId, cursor, 500] };
    const rpcRes = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const rpcJson = await rpcRes.json();
    const result = rpcJson.result;
    const data = result?.data ?? [];
    all.push(...data);
    if (!result?.hasNextPage || !result?.nextCursor) break;
    cursor = result.nextCursor;
  }
  const isMsgKey = (t) => t.endsWith('::messaging::MsgKey') && !t.endsWith('::messaging::PlainMsgKey');
  const isTeamBc = (t) => t.endsWith('::messaging::TeamPlainBroadcastKey');
  const msgKeys = all.filter((e) => isMsgKey(String(e?.name?.type ?? '')));
  const teamBc = all.filter((e) => isTeamBc(String(e?.name?.type ?? '')));
  const enc = msgKeys.filter((e) => !String(e?.name?.type || '').includes('Plain'));
  return { fields: all.length, msgKey: msgKeys.length, enc: enc.length, teamBroadcast: teamBc.length };
}

async function main() {
  console.log('API:', API);
  const envPkg = readEnvKey('PACKAGE_ID');
  const envMb = readEnvKey('MAILBOX_ID');
  const pkgHist = readLines('.morgendrot-package-id-history');
  const mbHist = readLines('.morgendrot-mailbox-id-history');

  console.log('\n=== .env (Datei) ===');
  console.log('PACKAGE_ID:', envPkg || '(leer)');
  console.log('MAILBOX_ID:', envMb || '(leer)');
  console.log('package-id-history:', pkgHist.length, 'Zeilen');
  const envTeam = readEnvKey('TEAM_MAILBOX_IDS');
  console.log('TEAM_MAILBOX_IDS:', envTeam || '(leer)');

  let status;
  try {
    const statusRes = await fetch(`${API}/api/status`);
    status = await statusRes.json();
  } catch (e) {
    console.log('\nAPI nicht erreichbar:', e.message);
    console.log('→ npm run dev starten, dann Skript erneut.');
    return;
  }

  console.log('\n=== /api/status (laufender Server) ===');
  console.log('packageId:', status.packageId);
  console.log('mailboxId:', status.mailboxId);
  console.log('inboxUnionPackageIds:', status.inboxUnionPackageIds?.length ?? '(nicht im Build)');
  console.log('inboxUnionMailboxIds:', status.inboxUnionMailboxIds?.length ?? '(nicht im Build)');
  if (status.configHints?.length) {
    console.log('configHints:');
    for (const h of status.configHints) console.log('  -', h);
  }

  if (envMb && status.mailboxId && envMb.toLowerCase() !== status.mailboxId.toLowerCase()) {
    console.log('\n*** MISMATCH: .env MAILBOX_ID ≠ Server mailboxId ***');
    console.log('  .env:   ', envMb);
    console.log('  Server: ', status.mailboxId);
    console.log('  Fix: Server neu starten ODER einmal /api/status (lädt .env nach, ab neuem Build).');
  }

  const unionMb = status.inboxUnionMailboxIds ?? [status.mailboxId].filter(Boolean);
  const unionPkg = status.inboxUnionPackageIds ?? [status.packageId].filter(Boolean);
  if (!status.inboxUnionMailboxIds?.length) {
    unionMb.length = 0;
    if (envMb) unionMb.push(envMb);
    for (const id of mbHist) if (!unionMb.some((x) => x.toLowerCase() === id.toLowerCase())) unionMb.push(id);
  }
  if (envTeam) {
    for (const id of envTeam.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!unionMb.some((x) => x.toLowerCase() === id.toLowerCase())) unionMb.push(id);
    }
  }

  console.log('\n=== RPC MsgKey pro Mailbox ===');
  for (const mb of unionMb.length ? unionMb : [envMb].filter(Boolean)) {
    const c = await countMailboxMsgKeys(mb);
    console.log(`  ${mb.slice(0, 10)}… → fields=${c.fields} msgKey=${c.msgKey} teamBc=${c.teamBroadcast} (enc~${c.enc})`);
  }

  const inbox = await postCommand('/inbox', ['500']);
  console.log('\n=== /inbox (500) ===');
  console.log('ok:', inbox.ok, inbox.message || inbox.error);
  const rows = inbox.messages ?? inbox.data ?? [];
  const plain = rows.filter((r) => r.isPlain === true);
  const enc = rows.filter((r) => r.isPlain === false);
  console.log('total:', rows.length, '| plain:', plain.length, '| encrypted:', enc.length);

  if (envMb && unionMb.some((id) => id.toLowerCase() === envMb.toLowerCase())) {
    const c = await countMailboxMsgKeys(envMb);
    if (c.msgKey > 0 && enc.length === 0) {
      console.log('\n*** MsgKey auf .env-Mailbox, aber /inbox ohne verschlüsselt → Package-Union oder Handshake prüfen. ***');
    }
  }

  const n1 = enc.filter((r) => String(r.nonce) === '1');
  const pkg = status.packageId || envPkg;
  let chainEncMine = 0;
  if (pkg) {
    const body = { query: { MoveModule: { package: pkg, module: 'messaging' } }, limit: 1000, order: 'descending' };
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'iotax_queryEvents', params: body }),
    }).then((x) => x.json());
    const my = (status.myAddressFull || status.myAddress || '').trim();
    chainEncMine = (r.result?.data || []).filter(
      (e) =>
        String(e.type || '').includes('EncryptedMessage') &&
        (e.parsedJson?.sender === my || e.parsedJson?.recipient === my)
    ).length;
  }
  console.log('\n=== Chain vs Posteingang (aktuelles Package) ===');
  console.log('verschlüsselte Events für dich (letzte 1000 Abfrage):', chainEncMine);
  console.log('verschlüsselte Zeilen in /inbox(500):', enc.length, '| davon nonce=1:', n1.length);
  if (chainEncMine >= 10 && n1.length < Math.min(10, chainEncMine)) {
    console.log('*** Dedup-Bug: Backend lädt nicht alle Events — npm run dev komplett neu starten (eventId-Fix). ***');
  } else if (n1.length >= 10) {
    console.log('OK: viele nonce=1-Zeilen sichtbar — Dedup-Fix aktiv.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
