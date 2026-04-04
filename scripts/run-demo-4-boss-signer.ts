/**
 * Demo 4: Boss-Signer – Prüfung, optional Ablauf mit Arbeiter-API.
 * Prüft Boss-Signer; wenn DEMO4_WORKER_API gesetzt, löst dort einen Befehl aus (z. B. /handshake).
 *
 * Aufruf: npm run demo:4
 * Optional: DEMO4_WORKER_API=http://127.0.0.1:3345 und Arbeiter-Instanz mit SIGNER=remote läuft.
 */

import dotenv from 'dotenv';
dotenv.config();

const SIGNER_URL = process.env.REMOTE_SIGNER_URL || 'http://127.0.0.1:3340';
const base = new URL(SIGNER_URL).origin;
const WORKER_API = process.env.DEMO4_WORKER_API || '';
const BOSS_ADDR = (process.env.BOSS_ADDRESS || process.env.MY_ADDRESS || '').trim();

async function checkBossSigner(): Promise<boolean> {
  try {
    const res = await fetch(`${base}/`, { method: 'GET' });
    const data = res.ok ? (await res.json().catch(() => ({}))) : {};
    return res.ok && (data as { ok?: boolean }).ok === true;
  } catch {
    return false;
  }
}

async function triggerWorkerCommand(apiBase: string, cmd: string, args: string[]): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd, args }),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    const ok = res.ok && (data as { ok?: boolean }).ok === true;
    if (!ok) console.log('  Antwort:', (data as { message?: string; error?: string }).message || (data as { error?: string }).error || text.slice(0, 120));
    return ok;
  } catch (e) {
    console.log('  Fehler:', (e as Error)?.message || e);
    return false;
  }
}

async function main() {
  console.log('\n=== Demo 4: Boss-Signer (Prüfung & Ablauf) ===\n');
  console.log('Boss-Signer URL:', base);
  const ok = await checkBossSigner();
  if (!ok) {
    console.log('  → Boss-Signer nicht erreichbar.\n');
    console.log('Boss-Signer starten (anderes Terminal): npm run boss-signer');
    console.log('Ablauf: docs/DEMO-4-BOSS-SIGNER-Ablauf.md\n');
    return;
  }
  console.log('  → Boss-Signer läuft.\n');

  if (WORKER_API && BOSS_ADDR && /^0x[a-fA-F0-9]{64}$/.test(BOSS_ADDR)) {
    console.log('Arbeiter-API auslösen: ' + WORKER_API + ' → /handshake ' + BOSS_ADDR.slice(0, 18) + '…');
    const success = await triggerWorkerCommand(WORKER_API, '/handshake', [BOSS_ADDR]);
    if (success) {
      console.log('  → Befehl ausgeführt. Im Boss-Signer-Terminal ggf. Signatur bestätigen.\n');
    } else {
      console.log('  → Arbeiter nicht bereit oder Fehler. Arbeiter mit SIGNER=remote, REMOTE_SIGNER_URL, MY_ADDRESS=Arbeiter-Adresse starten.\n');
    }
  } else {
    console.log('Nächste Schritte:');
    console.log('  1. Boss-Signer-Terminal offen lassen.');
    console.log('  2. Arbeiter-Instanz starten: SIGNER=remote, REMOTE_SIGNER_URL=' + base + ', MY_ADDRESS=Arbeiter-Adresse (vom Boss angelegt), BOSS_ADDRESS.');
    console.log('  3. Aktion auslösen (z. B. hier mit DEMO4_WORKER_API=http://127.0.0.1:3345 BOSS_ADDRESS=0x… npm run demo:4).');
    console.log('\nDetails: docs/DEMO-4-BOSS-SIGNER-Ablauf.md');
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
