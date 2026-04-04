/**
 * Erzeugt eine verschlüsselte Env-Datei (gleiche Krypto wie Vault: PBKDF2 + AES-GCM).
 * Nutzung:
 *   npx tsx scripts/encrypt-env.ts <eingabe.txt> [ausgabe.enc]
 * Liest Zeilen KEY=VALUE aus eingabe.txt, fragt nach Passwort, schreibt ausgabe.enc (Default: .env.secrets.enc).
 */
import fs from 'fs';
import path from 'path';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { encryptUtf8ToPayload } from '../src/vault-local.js';

async function askPassword(prompt: string): Promise<string> {
    const rl = createInterface({ input: stdin, output: stdout });
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

const inputFile = process.argv[2];
const outputFile = process.argv[3] || '.env.secrets.enc';

if (!inputFile) {
    console.error('Nutzung: npx tsx scripts/encrypt-env.ts <eingabe.txt> [ausgabe.enc]');
    process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputFile);
const outputPath = path.resolve(process.cwd(), outputFile);

if (!fs.existsSync(inputPath)) {
    console.error('Eingabedatei nicht gefunden:', inputPath);
    process.exit(1);
}

const plain = fs.readFileSync(inputPath, 'utf-8');
const password = await askPassword('Passwort für verschlüsselte Datei: ');
if (!password) {
    console.error('Passwort darf nicht leer sein.');
    process.exit(1);
}

const payload = await encryptUtf8ToPayload(plain, password);
fs.writeFileSync(outputPath, payload);
console.log('Geschrieben:', outputPath);
console.log('In .env setzen: ENCRYPTED_ENV_FILE=' + path.basename(outputPath));
console.log('Start mit: npx tsx src/start-with-secrets.ts');
