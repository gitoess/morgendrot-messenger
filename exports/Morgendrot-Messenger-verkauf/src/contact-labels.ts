/**
 * Lokale Anzeigenamen für Partner-Adressen (Lite-UI, kein Klartext auf der Chain).
 */
import fs from 'fs';
import path from 'path';

const DEFAULT_FILE = '.morgendrot-contact-labels.json';

function filePath(): string {
    return path.resolve(process.cwd(), process.env.CONTACT_LABELS_FILE || DEFAULT_FILE);
}

export function loadContactLabels(): Record<string, string> {
    try {
        const p = filePath();
        if (!fs.existsSync(p)) return {};
        const j = JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
        if (typeof j !== 'object' || j === null || Array.isArray(j)) return {};
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(j)) {
            if (typeof v === 'string' && k.startsWith('0x')) out[k.trim().toLowerCase()] = v.trim().slice(0, 64);
        }
        return out;
    } catch {
        return {};
    }
}

export function saveContactLabel(address: string, label: string): void {
    const hex = (address || '').trim().toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(hex)) return;
    const all = loadContactLabels();
    all[hex] = (label || 'Partner').trim().slice(0, 64) || 'Partner';
    fs.writeFileSync(filePath(), JSON.stringify(all, null, 0), 'utf8');
}

export function getContactLabel(address: string): string | undefined {
    const hex = (address || '').trim().toLowerCase();
    return loadContactLabels()[hex];
}
