/**
 * Demo 1: Ownership – digitaler Schlüssel (Boss → Gast).
 * Spielt die Demo automatisch durch: Key ausstellen, beim Gast prüfen.
 *
 * Voraussetzung: Zwei laufende Morgendrot-APIs (Wallet 1 = Boss, Wallet 2 = Gast).
 * Konfiguration: .env.kacheln (API_BASE_A, API_BASE_B) oder Umgebungsvariablen.
 *
 * Aufruf: npm run demo:1
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

async function apiGet(base: string, path: string): Promise<unknown> {
  const res = await fetch(`${base}${path}`, { method: 'GET' });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function apiPost(base: string, path: string, body: object): Promise<unknown> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`POST ${path}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('\n=== Demo 1: Ownership (digitaler Schlüssel) ===\n');

  let addrA: string, addrB: string, packageId: string;
  try {
    const idsA = (await apiGet(API_A, '/api/current-ids')) as { myAddress?: string; packageId?: string };
    addrA = idsA.myAddress || '';
    packageId = (idsA.packageId || '').trim();
    if (!addrA) throw new Error('Wallet A: MY_ADDRESS fehlt.');
    if (!/^0x[a-fA-F0-9]{64}$/.test(packageId)) throw new Error('Wallet A: PACKAGE_ID fehlt oder ungültig (0x+64 Hex).');

    const idsB = (await apiGet(API_B, '/api/current-ids')) as { myAddress?: string };
    addrB = idsB.myAddress || '';
    if (!addrB) throw new Error('Wallet B: MY_ADDRESS fehlt.');
  } catch (e: unknown) {
    const msg = (e as Error)?.message || String(e);
    if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('Verbindung')) {
      console.error('API(s) nicht erreichbar. Starte beide Morgendrot-Instanzen (Wallet 1 → API 3342, Wallet 2 → API 3343).');
      console.error('Siehe docs/DEMO-1-OWNERSHIP-Ablauf.md und .env.kacheln.');
    } else if (msg.includes('503') || msg.includes('Nicht verbunden')) {
      console.error('Boss-Instanz (Wallet 1) muss vollständig gestartet sein: Passwort eingeben, bis die App bereit ist. Dann erneut: npm run demo:1');
    } else if (msg.includes('options is not defined')) {
      console.error('Boss-Instanz (Wallet 1) mit altem Code. App komplett beenden und neu starten (npm run start), dann erneut: npm run demo:1');
    } else {
      console.error(msg);
    }
    process.exit(1);
  }

  console.log('Boss (Wallet A):', addrA.slice(0, 18) + '…');
  console.log('Gast (Wallet B):', addrB.slice(0, 18) + '…');
  console.log('LOCK_ID (Demo):', LOCK_ID.slice(0, 18) + '…');
  console.log('');

  if (UNLOCK_PASSWORD) {
    await apiPost(API_A, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
    await apiPost(API_B, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
  }

  // Schritt 1: Boss stellt Key für Gast aus
  console.log('Schritt 1: Boss stellt AccessKey für Gast aus (/create-key … 7 Tage) …');
  const createRes = (await apiPost(API_A, '/api/command', {
    cmd: '/create-key',
    args: [LOCK_ID, addrB, '7'],
  })) as { ok?: boolean; message?: string; error?: string; objectId?: string };

  if (!createRes.ok) {
    console.error('Fehler:', createRes.message || createRes.error || 'Unbekannt');
    if ((createRes as { error?: string }).error?.includes('Nicht verbunden')) {
      console.error('Tipp: Boss-Instanz vollständig starten (Passwort eingeben), dann npm run demo:1 erneut ausführen.');
    }
    process.exit(1);
  }
  const keyObjectId = createRes.objectId || '(Object-ID nicht in Antwort)';
  console.log('  → OK. Key erstellt. Object-ID:', keyObjectId);
  console.log('');

  await sleep(4000);

  // Schritt 2: Beim Gast prüfen (list-keys für Gast)
  console.log('Schritt 2: Beim Gast prüfen (list-keys, Owner = Gast) …');
  const listRes = (await apiGet(API_A, `/api/list-keys?owner=${encodeURIComponent(addrB)}`)) as {
    keys?: Array<{ objectId: string; lockId: string; expires_at_ms?: string }>;
  };
  const keys = listRes?.keys || [];
  const found = keys.find((k) => k.lockId === LOCK_ID || k.objectId === keyObjectId);
  if (found) {
    console.log('  → OK. Gast besitzt Key (Owner = Gast). Object-ID:', found.objectId);
  } else {
    console.log('  → Key möglicherweise noch nicht in Liste (RPC-Verzögerung). Object-ID aus Schritt 1:', keyObjectId);
    console.log('  → Im Explorer Object-ID prüfen → Owner sollte', addrB.slice(0, 18) + '…', 'sein.');
  }
  console.log('');

  console.log('=== Demo 1 abgeschlossen ===');
  console.log('Im Explorer: Object-ID', keyObjectId, '→ Owner = Gast-Adresse (nicht Boss).');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
