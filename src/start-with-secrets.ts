/**
 * Einstieg, wenn Secrets aus verschlüsselter Datei geladen werden sollen (Option B).
 * Reihenfolge: .env laden → verschlüsselte Env-Datei entschlüsseln und in process.env mergen → dann App starten.
 * So sieht config.ts beim Import bereits alle Variablen.
 *
 * Nutzung: ENCRYPTED_ENV_FILE in .env setzen (z. B. .env.secrets.enc), dann:
 *   npx tsx src/start-with-secrets.ts
 * oder: npm run start:secrets
 */
import './install-webcrypto-node.js';

import dotenv from 'dotenv';
import { loadEncryptedEnvIfConfigured } from './load-secrets.js';

dotenv.config({ quiet: true });

// Verhindern, dass ein einzelner Fehler (z. B. in /list-tickets) den ganzen Server beendet
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
  // Nicht exit – Server weiterlaufen lassen
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err?.message ?? err);
  // Im UI-Modus nicht sofort beenden, damit Nutzer den Fehler sehen und ggf. neu laden können
  const enableUi = process.env.ENABLE_UI !== 'false';
  if (!enableUi) process.exit(1);
});
const loaded = await loadEncryptedEnvIfConfigured();
if (loaded) {
    console.log('Verschlüsselte Env-Variablen geladen.');
    // .env erneut laden, damit UI-Änderungen (Setzen) die verschlüsselten Werte übersteuern
    dotenv.config({ override: true, quiet: true });
}
// App starten (wallet-bridge lädt config, das nun process.env inkl. .env-Overrides sieht)
await import('./wallet-bridge.js');
