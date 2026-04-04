/**
 * Optionale verschlüsselte Env-Variablen (Option B in docs/SECRETS-OPTIONS.md).
 * Wenn ENCRYPTED_ENV_FILE in .env gesetzt ist: Passwort abfragen, Datei entschlüsseln
 * (gleiche Krypto wie Vault: PBKDF2 + AES-GCM) und Key=Value-Zeilen in process.env mergen.
 * .env bleibt ohne Secrets; nur die verschlüsselte Datei enthält sie.
 */
import fs from 'fs';
import path from 'path';
import { decryptPayloadToUtf8 } from './vault-local.js';
import { readPasswordMasked } from './read-password.js';

/**
 * Parst env-ähnlichen Text (KEY=VALUE pro Zeile, # Kommentar, leere Zeilen ignoriert).
 * Wert in Anführungszeichen wird entfernt; einfache KEY=VALUE ohne Quotes.
 * Export für Tests.
 */
export function parseEnvText(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        let key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (key) out[key] = value;
    }
    return out;
}

/**
 * Lädt verschlüsselte Env-Datei, wenn ENCRYPTED_ENV_FILE gesetzt ist.
 * Muss nach dotenv.config() und vor dem restlichen App-Start aufgerufen werden.
 * Gibt true zurück, wenn Secrets geladen und in process.env gemerged wurden; sonst false.
 */
export async function loadEncryptedEnvIfConfigured(): Promise<boolean> {
    const filePath = process.env.ENCRYPTED_ENV_FILE?.trim();
    if (!filePath) return false;
    const resolved = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        console.warn('ENCRYPTED_ENV_FILE ist gesetzt, aber Datei nicht gefunden: ' + resolved);
        return false;
    }

    const password = await readPasswordMasked('Secrets-Passwort (für verschlüsselte Env-Datei): ');
    const raw = new Uint8Array(fs.readFileSync(resolved));
    const plain = await decryptPayloadToUtf8(raw, password);
    const parsed = parseEnvText(plain);
    for (const [k, v] of Object.entries(parsed)) {
        process.env[k] = v;
    }
    return true;
}
