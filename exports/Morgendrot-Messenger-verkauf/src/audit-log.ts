/**
 * Audit-Log: Strukturierte Ereignisse für Lieferkette (Alarm, Sensor, Purge, Offline).
 * Export als CSV für Behörden/Compliance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CFG } from './config.js';

export type AuditEvent = {
    ts: number;
    type: 'alarm' | 'sensor' | 'offline' | 'purge' | 'heartbeat' | 'escalation';
    device?: string;
    message?: string;
    level?: number;
    temp?: number;
    humidity?: number;
    shock?: number;
    [key: string]: unknown;
};

function getAuditPath(): string {
    const p = CFG.AUDIT_LOG_FILE?.trim();
    if (p) return path.resolve(process.cwd(), p);
    return path.resolve(process.cwd(), 'logs', 'audit.jsonl');
}

/** Fügt ein Audit-Ereignis hinzu (eine JSON-Zeile pro Event). Optional: Hash in Streams (AUDIT_STREAMS_ENABLED). */
export function appendAuditEvent(event: Omit<AuditEvent, 'ts'> & { ts?: number }): void {
    const full = { ...event, ts: event.ts ?? Date.now() } as AuditEvent;
    const filePath = getAuditPath();
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(filePath, JSON.stringify(full) + '\n', 'utf-8');
    } catch {
        // Audit optional – kein Abbruch
    }
    if (CFG.AUDIT_STREAMS_ENABLED && CFG.STREAMS_ANCHOR_ID) {
        void (async () => {
            try {
                const crypto = await import('node:crypto');
                const { getStreamsAdapter } = await import('./streams-adapter.js');
                const hash = crypto.createHash('sha256').update(JSON.stringify(full)).digest('hex');
                await getStreamsAdapter().publish(CFG.STREAMS_ANCHOR_ID, hash);
            } catch {
                // Streams optional – kein Abbruch
            }
        })();
    }
}

/** Liest Audit-Events (neueste zuerst, begrenzt auf limit). */
export function readAuditEvents(limit = 10000): AuditEvent[] {
    const filePath = getAuditPath();
    if (!fs.existsSync(filePath)) return [];
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const lines = raw.split('\n').filter((l) => l.trim());
        const events = lines
            .map((l) => {
                try {
                    return JSON.parse(l) as AuditEvent;
                } catch {
                    return null;
                }
            })
            .filter((e): e is AuditEvent => e !== null);
        return events.slice(-limit).reverse();
    } catch {
        return [];
    }
}

/** Exportiert Audit-Log als CSV. */
export function exportAuditCsv(limit = 10000): string {
    const events = readAuditEvents(limit);
    const headers = ['ts', 'type', 'device', 'message', 'level', 'temp', 'humidity', 'shock'];
    const escape = (v: unknown): string => {
        if (v == null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = events.map((e) =>
        headers.map((h) => escape(e[h as keyof AuditEvent])).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
}

/** Exportiert Audit-Log als PDF (Stream). */
export async function exportAuditPdfStream(limit = 10000): Promise<import('node:stream').Readable> {
    const { default: PDFDocument } = await import('pdfkit');
    const events = readAuditEvents(limit);
    const doc = new PDFDocument({ margin: 50 });
    doc.fontSize(16).text('Morgendrot Audit-Log', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Export: ${new Date().toISOString()} · ${events.length} Einträge`, { align: 'center' });
    doc.moveDown(2);
    const headers = ['Zeit', 'Typ', 'Gerät', 'Meldung', 'Level', 'Temp', 'Feuchte', 'Schock'];
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(headers.join(' | '), { continued: false });
    doc.font('Helvetica').fontSize(8);
    for (const e of events) {
        const ts = e.ts ? new Date(e.ts).toLocaleString('de-DE') : '';
        const row = [ts, e.type || '', (e.device as string)?.slice(0, 12) || '', (e.message as string)?.slice(0, 40) || '', String(e.level ?? ''), String(e.temp ?? ''), String(e.humidity ?? ''), String(e.shock ?? '')].join(' | ');
        if (doc.y > 700) doc.addPage();
        doc.text(row, { continued: false });
    }
    doc.end();
    return doc as unknown as import('node:stream').Readable;
}
