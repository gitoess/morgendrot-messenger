/**
 * Passwort-Eingabe mit Maskierung (*) im Terminal.
 * Windows: readline-sync (hideEchoBack) – zuverlässig & maskiert.
 * Unix + TTY: Raw-Mode mit Maskierung (*).
 */
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';
import { stdin, stdout } from 'node:process';

const require = createRequire(import.meta.url);

function useReadlineSync(): boolean {
    return process.platform === 'win32' || !stdin.isTTY;
}

export function readPasswordMasked(prompt: string): Promise<string> {
    if (useReadlineSync()) {
        const readlineSync = require('readline-sync');
        return Promise.resolve(
            readlineSync.question(prompt, { hideEchoBack: true, mask: '*' }).trim()
        );
    }
    return new Promise((resolve) => {
        stdout.write(prompt);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        let buf = '';
        const onData = (ch: string | Buffer) => {
            const s = typeof ch === 'string' ? ch : ch.toString('utf8');
            for (const c of s) {
                if (c === '\n' || c === '\r') {
                    stdin.removeListener('data', onData);
                    stdin.setRawMode(false);
                    stdout.write('\n');
                    resolve(buf.trim());
                    return;
                }
                if (c === '\u0008' || c === '\u007f') {
                    if (buf.length > 0) {
                        buf = buf.slice(0, -1);
                        stdout.write('\b \b');
                    }
                    continue;
                }
                buf += c;
                stdout.write('*');
            }
        };
        stdin.on('data', onData);
    });
}
