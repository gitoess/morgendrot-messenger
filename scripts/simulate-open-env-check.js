/**
 * Simulation: Prüft, ob beim Aufruf als OPEN_COMMAND die erwarteten Env-Variablen gesetzt sind.
 * Nutzung: OPEN_COMMAND="node scripts/simulate-open-env-check.js" setzen und Lock mit "open" auslösen.
 * Erwartet: OPEN_SENDER gesetzt (0x…). Schreibt Ergebnis nach .open-env-check-result (oder stdout).
 */
const fs = require('fs');
const sender = process.env.OPEN_SENDER || '';
const result = { OPEN_SENDER: sender, ok: /^0x[a-fA-F0-9]{64}$/.test(sender), time: new Date().toISOString() };
const outPath = '.open-env-check-result';
try {
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
} catch {
    console.log(JSON.stringify(result));
}
process.exit(result.ok ? 0 : 1);
