/**
 * Zählt erfolgreiche selbstbezahlte Messenger-Chain-TXs pro Adresse (lokal).
 * Genutzt für „erste TX aus Shadow/Selbst, ab der zweiten Sponsor + Lizenz-NFT“.
 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE = '.messenger-gas-state.json';

type StateFile = { selfPaidSuccessCountByAddress?: Record<string, number> };

function statePath(): string {
    const custom = (process.env.MESSENGER_GAS_STATE_FILE || '').trim();
    if (custom) {
        return path.isAbsolute(custom) ? custom : path.resolve(process.cwd(), custom);
    }
    return path.resolve(process.cwd(), DEFAULT_FILE);
}

function load(): StateFile {
    try {
        const p = statePath();
        if (!fs.existsSync(p)) return {};
        const raw = fs.readFileSync(p, 'utf-8');
        const j = JSON.parse(raw) as StateFile;
        return j && typeof j === 'object' ? j : {};
    } catch {
        return {};
    }
}

function save(s: StateFile): void {
    const p = statePath();
    fs.writeFileSync(p, JSON.stringify(s, null, 2), 'utf-8');
}

function normAddr(a: string): string {
    const x = String(a || '').trim().toLowerCase();
    return x.startsWith('0x') ? x : `0x${x}`;
}

/** Anzahl abgeschlossener selbstbezahlter Messenger-TXs (nur erhöht bei Erfolg ohne Sponsor). */
export function getSelfPaidMessengerTxCount(address: string): number {
    const k = normAddr(address);
    if (!/^0x[a-f0-9]{64}$/.test(k)) return 0;
    const n = load().selfPaidSuccessCountByAddress?.[k];
    return typeof n === 'number' && n >= 0 ? n : 0;
}

export function recordSelfPaidMessengerTxSuccess(address: string): void {
    const k = normAddr(address);
    if (!/^0x[a-f0-9]{64}$/.test(k)) return;
    const st = load();
    const map = { ...(st.selfPaidSuccessCountByAddress ?? {}) };
    map[k] = (map[k] ?? 0) + 1;
    save({ ...st, selfPaidSuccessCountByAddress: map });
}
