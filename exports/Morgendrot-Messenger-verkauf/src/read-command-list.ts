/**
 * Verschlüsselte Öffnen-Befehlsliste aus Datei laden (AES-GCM).
 * Format: 12 Byte IV + Ciphertext (inkl. 16-Byte Auth-Tag). Key = 32 Byte aus keyHex.
 */
import crypto from 'crypto';
import fs from 'fs';

const IV_LEN = 12;

/**
 * Liest die Datei, entschlüsselt mit dem 32-Byte-Hex-Key und liefert die kommagetrennte Liste als string[] (Kleinbuchstaben).
 * keyHex: 64 Hex-Zeichen (32 Bytes). filePath: Pfad zur Datei (IV + Ciphertext).
 */
export function loadOpenWordsFromFile(filePath: string, keyHex: string): string[] {
    const key = Buffer.from(keyHex.replace(/^0x/, ''), 'hex');
    if (key.length !== 32) throw new Error('OPEN_COMMAND_LIST_KEY muss 32 Bytes (64 Hex-Zeichen) sein.');
    const raw = fs.readFileSync(filePath);
    if (raw.length < IV_LEN + 16) throw new Error('Befehlsliste-Datei zu kurz (mind. IV + Tag).');
    const iv = raw.subarray(0, IV_LEN);
    const ciphertext = raw.subarray(IV_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    const tag = ciphertext.subarray(-16);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
    const str = decrypted.toString('utf-8');
    return str
        .split(',')
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean);
}
