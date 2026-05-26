/**
 * Headless-Entry: Kein UI-Server, nur Listener + Heartbeat (ggf. Lock/Monitor).
 * Setzt ENABLE_UI=false, falls nicht in .env gesetzt, und startet die gleiche App-Logik wie wallet-bridge.
 * Nutzung: npx tsx src/worker-headless.ts  oder  npm run start:headless
 */
import './install-webcrypto-node.js';

import dotenv from 'dotenv';
import { loadEncryptedEnvIfConfigured } from './load-secrets.js';

dotenv.config({ quiet: true });
if (process.env.ENABLE_UI === undefined || process.env.ENABLE_UI === '') {
    process.env.ENABLE_UI = 'false';
}
const loaded = await loadEncryptedEnvIfConfigured();
if (loaded) {
    console.log('Verschlüsselte Env-Variablen geladen.');
    dotenv.config({ override: true, quiet: true });
}
if (process.env.ENABLE_UI === undefined || process.env.ENABLE_UI === '') {
    process.env.ENABLE_UI = 'false';
}
await import('./wallet-bridge.js');
