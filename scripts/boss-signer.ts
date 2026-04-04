/**
 * Boss-Signer-Service: Kleiner HTTP-Server, der für angefragte Adressen TXs signiert.
 * Der Boss hat die IOTA-CLI + Keystore; Maschinen (nur Adresse + App) senden TX-Bytes hierher,
 * erhalten die Signatur zurück und können execute-signed-tx lokal oder der Boss führt es aus.
 *
 * Start: npx tsx scripts/boss-signer.ts
 * .env: PORT=3340, BOSS_SIGNER_TOKEN=optional, RPC_URL=optional (für iota client)
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
dotenv.config();

const PORT = parseInt(process.env.PORT || '3340', 10);
const TOKEN = process.env.BOSS_SIGNER_TOKEN || '';

function runIotaSign(address: string, txBytesBase64: string, password?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const args = ['client', 'sign', '--json', '--address', address, '--data', txBytesBase64];
        const child = spawn('iota', args, { shell: false, env: process.env });
        let stdout = '';
        let stderr = '';
        if (password !== undefined && password !== '') {
            child.stdin?.end(password + '\n', 'utf-8');
        }
        child.stdout?.on('data', (d) => { stdout += d; });
        child.stderr?.on('data', (d) => { stderr += d; });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`iota sign exit ${code}: ${stderr || stdout}`));
                return;
            }
            try {
                const j = JSON.parse(stdout.trim()) as Record<string, unknown>;
                const sig =
                    (j?.iota_signature as string) ||
                    (j?.signature as string) ||
                    ((j?.result as Record<string, unknown>)?.signature as string) ||
                    ((j?.result as Record<string, unknown>)?.iota_signature as string);
                if (sig) resolve(sig.trim());
                else reject(new Error('Keine Signatur in iota-Ausgabe.'));
            } catch {
                reject(new Error('Ungültige JSON-Ausgabe von iota sign.'));
            }
        });
    });
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            try {
                const body = Buffer.concat(chunks).toString('utf-8');
                resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
            } catch {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}

function send(res: ServerResponse, status: number, data: Record<string, unknown>) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
        send(res, 200, { ok: true, service: 'boss-signer' });
        return;
    }

    if (req.method !== 'POST' || (req.url !== '/sign' && req.url !== '/')) {
        send(res, 404, { error: 'Not Found. POST /sign with { address, txBytesBase64 }.' });
        return;
    }

    if (TOKEN) {
        const auth = req.headers['authorization'];
        const bearer = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (bearer !== TOKEN) {
            send(res, 401, { error: 'Unauthorized' });
            return;
        }
    }

    let body: Record<string, unknown>;
    try {
        body = await parseBody(req);
    } catch {
        send(res, 400, { error: 'Invalid JSON body' });
        return;
    }

    const address = body?.address as string;
    const txBytesBase64 = body?.txBytesBase64 as string;
    if (!address || typeof txBytesBase64 !== 'string') {
        send(res, 400, { error: 'Missing address or txBytesBase64' });
        return;
    }

    const password = (body?.password as string) || process.env.WALLET_PASSWORD || undefined;

    try {
        const signature = await runIotaSign(address, txBytesBase64, password);
        send(res, 200, { signature, iota_signature: signature });
    } catch (e) {
        const msg = (e as Error)?.message || String(e);
        console.error('Sign error:', msg);
        send(res, 500, { error: 'Sign failed', detail: msg });
    }
});

server.listen(PORT, () => {
    console.log(`Boss-Signer: http://localhost:${PORT}  (POST /sign, optional Bearer token)`);
});
