/**
 * Demo 2: PTB – Key + Nachricht in einer Transaktion.
 * Spielt die Demo durch: /create-key-and-notify (eine TX = create_access_key + Nachricht).
 *
 * Voraussetzung: Zwei laufende Morgendrot-APIs (Wallet 1 = Boss, Wallet 2 = Gast).
 * Konfiguration: .env.kacheln (API_BASE_A, API_BASE_B).
 *
 * Aufruf: npm run demo:2
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env.kacheln'), override: true });

const API_A = process.env.API_BASE_A || 'http://127.0.0.1:3342';
const API_B = process.env.API_BASE_B || 'http://127.0.0.1:3343';
const UNLOCK_PASSWORD = process.env.UNLOCK_PASSWORD || '';
const LOCK_ID = '0x' + 'd'.repeat(64);
const NACHRICHT = 'Dein Key ist aktiv. (Demo 2 – PTB)';

async function apiGet(base: string, p: string): Promise<unknown> {
  const res = await fetch(`${base}${p}`, { method: 'GET' });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${p}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function apiPost(base: string, p: string, body: object): Promise<unknown> {
  const res = await fetch(`${base}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`POST ${p}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log('\n=== Demo 2: PTB (Key + Nachricht in einer TX) ===\n');

  let addrA: string, addrB: string;
  try {
    const idsA = (await apiGet(API_A, '/api/current-ids')) as { myAddress?: string; packageId?: string };
    addrA = idsA.myAddress || '';
    const pkgId = (idsA.packageId || '').trim();
    if (!addrA || !/^0x[a-fA-F0-9]{64}$/.test(pkgId)) throw new Error('Wallet A: MY_ADDRESS oder PACKAGE_ID fehlt.');

    const idsB = (await apiGet(API_B, '/api/current-ids')) as { myAddress?: string };
    addrB = idsB.myAddress || '';
    if (!addrB) throw new Error('Wallet B: MY_ADDRESS fehlt.');
  } catch (e: unknown) {
    const msg = (e as Error)?.message || String(e);
    if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('Verbindung')) {
      console.error('API(s) nicht erreichbar. Beide Instanzen starten (3342, 3343). Siehe .env.kacheln und docs/DEMO-2-PTB-Ablauf.md');
    } else {
      console.error(msg);
    }
    process.exit(1);
  }

  console.log('Boss (Wallet A):', addrA.slice(0, 18) + '…');
  console.log('Gast (Wallet B):', addrB.slice(0, 18) + '…');
  console.log('Nachricht:', NACHRICHT);
  console.log('');

  if (UNLOCK_PASSWORD) {
    await apiPost(API_A, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
  }

  console.log('Schritt 1: Boss führt /create-key-and-notify aus (Key + Klartext in einer TX) …');
  const res = (await apiPost(API_A, '/api/command', {
    cmd: '/create-key-and-notify',
    args: [LOCK_ID, addrB, '30', NACHRICHT],
  })) as { ok?: boolean; message?: string; error?: string; objectId?: string };

  if (!res.ok) {
    console.error('Fehler:', res.message || res.error || 'Unbekannt');
    process.exit(1);
  }

  const objectId = res.objectId || '(Object-ID in Antwort prüfen)';
  console.log('  → OK.', res.message || '');
  console.log('  → AccessKey Object-ID:', objectId);
  console.log('');
  console.log('=== Demo 2 abgeschlossen ===');
  console.log('Im Explorer: Letzte TX der Boss-Adresse öffnen → Summary / Object Changes.');
  console.log('Eine Transaktion enthält: create_access_key + Nachricht (store_plaintext_message oder send_plaintext_message).');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
