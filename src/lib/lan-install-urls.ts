/**
 * LAN-Hosts für Boss-Install-QR (H.16) — ohne manuelle ipconfig/npm-Schritte.
 */
import os from 'node:os';

function isPrivateOrLanIpv4(address: string): boolean {
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(address)) return false;
    if (address.startsWith('127.')) return false;
    if (address.startsWith('169.254.')) return false;
    const [a, b] = address.split('.').map((x) => parseInt(x, 10));
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
}

/** Nicht-loopback IPv4-Adressen dieses PCs (WLAN/LAN). */
export function collectLanIpv4Hosts(): string[] {
    const out: string[] = [];
    const nets = os.networkInterfaces();
    for (const entries of Object.values(nets)) {
        for (const net of entries ?? []) {
            const family = net.family as string | number;
            const isV4 = family === 'IPv4' || family === 4;
            if (!isV4 || net.internal) continue;
            const addr = net.address.trim();
            if (isPrivateOrLanIpv4(addr)) out.push(addr);
        }
    }
    return [...new Set(out)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function buildLanInstallUrlPair(host: string, uiPort: number, apiPort: number): { pwaUrl: string; apiBaseUrl: string } {
    const h = host.trim();
    return {
        pwaUrl: `http://${h}:${uiPort}`,
        apiBaseUrl: `http://${h}:${apiPort}`,
    };
}
