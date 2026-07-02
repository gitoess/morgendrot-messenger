#!/usr/bin/env node
/**
 * Modus-A-Hilfe: /api/status gegen FINAL-Pflicht aus docs/FELDTEST-BOSS-BEI-0.md.
 * Ersetzt keinen manuellen Wizard-Durchlauf — prüft nur Server-Status nach Setup.
 *
 *   npm run dm
 *   npm run feldtest:boss-readiness
 */
const port = String(process.env.API_PORT || '3342').trim();
const base = (process.env.MORGENDROT_API_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
const HEX64 = /^0x[a-fA-F0-9]{64}$/;

function ampel(ok, warn = false) {
  if (ok) return '🟢';
  if (warn) return '🟡';
  return '🔴';
}

async function main() {
  let status;
  try {
    const res = await fetch(`${base}/api/status`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    status = await res.json();
  } catch (e) {
    console.error(`Boss-Server nicht erreichbar (${base}/api/status): ${e?.message || e}`);
    console.error('→ npm run dm starten, dann erneut ausführen.');
    process.exit(2);
  }

  const backendOk = status.backendOnline !== false && status.backendRunning !== false;
  const addr = String(status.myAddressFull || status.myAddress || '').trim();
  const walletOk = HEX64.test(addr);
  const packageOk = HEX64.test(String(status.packageId || '').trim());
  const mailboxOk = HEX64.test(String(status.mailboxId || '').trim());
  const teamWarn = !HEX64.test(String(status.teamMailboxId || '').trim());

  const rows = [
    ['Boss-Server', ampel(backendOk), backendOk ? 'Erreichbar' : 'Offline'],
    ['Wallet / Signer', ampel(walletOk), walletOk ? addr.slice(0, 12) + '…' : 'Keine Adresse'],
    ['Move-Package', ampel(packageOk), packageOk ? 'Package gesetzt' : 'PACKAGE_ID fehlt'],
    ['Server-Postfach', ampel(mailboxOk), mailboxOk ? 'MAILBOX_ID gesetzt' : 'Postfach fehlt'],
    ['Team-Postfach', ampel(true, teamWarn), teamWarn ? 'Optional — nicht gesetzt' : 'Team-Postfach ok'],
  ];

  console.log('\nBoss Readiness (CLI) — Gate Modus A / FINAL-Pflicht\n');
  for (const [label, light, detail] of rows) {
    console.log(`${light} ${label.padEnd(18)} ${detail}`);
  }

  const pass = backendOk && walletOk && packageOk && mailboxOk;
  console.log('\n' + (pass ? 'FINAL-Pflicht: PASS (Server-Status)' : 'FINAL-Pflicht: FAIL'));
  if (!pass) {
    console.log('→ Wizard Schritte 1–5 in docs/FELDTEST-BOSS-BEI-0.md nachholen.');
    process.exit(1);
  }
  console.log('→ UI-Modal „Einrichtung prüfen“ und FINAL+ (Testnachricht) weiterhin manuell empfohlen.');
  process.exit(0);
}

main();
