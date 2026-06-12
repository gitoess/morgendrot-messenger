/**
 * Einsatz-Rollen-Templates: JSON-Body-Parser (Boss-API, keine Chain).
 * Node: `src/einsatz-role-templates.ts`. Next-PWA: Paket **`@morgendrot/shared`** (`src/shared/package.json`, `file:` aus `frontend/`).
 */
import {
    parseEinsatzHandoffTemplateSnapshot,
    type EinsatzHandoffTemplateSnapshot,
} from './einsatz-handoff-template-snapshot';

export type { EinsatzHandoffTemplateSnapshot } from './einsatz-handoff-template-snapshot';

export const EINSATZ_TEMPLATES_MAX = 100;
export const EINSATZ_TEMPLATES_FILE_MAX_BYTES = 262_144;

const ALLOWED_CHAIN = new Set(['kommandant', 'arbeiter', 'lock', 'monitor', 'waerter', 'user']);

export type EinsatzRoleTemplate = {
    id: string;
    label: string;
    iconHint?: string;
    chainRole: 'kommandant' | 'arbeiter' | 'lock' | 'monitor' | 'waerter' | 'user';
    roleId: number;
    defaultDeploymentChannelTag?: string;
    /** Phase 4: voller Handoff-Export-Snapshot (Capabilities, Partner, Team-Postfächer, …). */
    handoffSnapshot?: EinsatzHandoffTemplateSnapshot;
};

function isId(s: string): boolean {
    return /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$/.test(s);
}

export function parseEinsatzRoleTemplates(
    raw: unknown
): { ok: true; templates: EinsatzRoleTemplate[] } | { ok: false; error: string } {
    if (raw === null || raw === undefined) {
        return { ok: false, error: 'Body fehlt oder templates fehlen.' };
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: 'Erwarte JSON-Objekt mit templates[].' };
    }
    const o = raw as Record<string, unknown>;
    const arr = o.templates;
    if (!Array.isArray(arr)) {
        return { ok: false, error: 'templates muss ein Array sein.' };
    }
    if (arr.length > EINSATZ_TEMPLATES_MAX) {
        return { ok: false, error: 'Maximal ' + EINSATZ_TEMPLATES_MAX + ' Templates.' };
    }
    const seen = new Set<string>();
    const out: EinsatzRoleTemplate[] = [];
    for (let i = 0; i < arr.length; i++) {
        const t = arr[i];
        if (typeof t !== 'object' || t === null || Array.isArray(t)) {
            return { ok: false, error: 'templates[' + i + '] muss ein Objekt sein.' };
        }
        const x = t as Record<string, unknown>;
        const id = String(x.id ?? '')
            .trim()
            .toLowerCase();
        if (!id || !isId(id)) {
            return {
                ok: false,
                error:
                    'templates[' +
                    i +
                    '].id: gültige ID (Kleinbuchstaben, Zahlen, Bindestrich) erforderlich.',
            };
        }
        if (seen.has(id)) return { ok: false, error: 'Doppelte id: ' + id };
        seen.add(id);
        const label = String(x.label ?? '')
            .trim()
            .slice(0, 120);
        if (!label) return { ok: false, error: 'templates[' + i + '].label darf nicht leer sein.' };
        const cr = String(x.chainRole ?? '')
            .trim()
            .toLowerCase();
        if (!ALLOWED_CHAIN.has(cr)) {
            return { ok: false, error: 'templates[' + i + '].chainRole ungültig.' };
        }
        const rid = parseInt(String(x.roleId ?? ''), 10);
        if (!Number.isFinite(rid) || rid < 0 || rid > 63) {
            return { ok: false, error: 'templates[' + i + '].roleId muss 0–63 sein.' };
        }
        const iconHint =
            x.iconHint === undefined || x.iconHint === null
                ? undefined
                : String(x.iconHint)
                      .trim()
                      .slice(0, 32);
        const defaultDeploymentChannelTag =
            x.defaultDeploymentChannelTag === undefined || x.defaultDeploymentChannelTag === null
                ? undefined
                : String(x.defaultDeploymentChannelTag)
                      .trim()
                      .slice(0, 120);
        let handoffSnapshot: EinsatzHandoffTemplateSnapshot | undefined;
        if (x.handoffSnapshot !== undefined && x.handoffSnapshot !== null) {
            const snap = parseEinsatzHandoffTemplateSnapshot(x.handoffSnapshot);
            if (!snap.ok) {
                return { ok: false, error: 'templates[' + i + '].handoffSnapshot: ' + snap.error };
            }
            handoffSnapshot = snap.snapshot;
        }
        out.push({
            id,
            label,
            ...(iconHint ? { iconHint } : {}),
            chainRole: cr as EinsatzRoleTemplate['chainRole'],
            roleId: rid,
            ...(defaultDeploymentChannelTag ? { defaultDeploymentChannelTag } : {}),
            ...(handoffSnapshot ? { handoffSnapshot } : {}),
        });
    }
    const ser = JSON.stringify({ version: 1, templates: out });
    if (new TextEncoder().encode(ser).length > EINSATZ_TEMPLATES_FILE_MAX_BYTES) {
        return { ok: false, error: 'Gesamtdatei zu groß (max. ' + EINSATZ_TEMPLATES_FILE_MAX_BYTES + ' Bytes).' };
    }
    return { ok: true, templates: out };
}
