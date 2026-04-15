/**
 * Einsatz-Rollen-Templates auf dem Boss-Rechner (lokal, keine Chain).
 * Roadmap § H.3g Paket 2 — siehe docs/API-EINSATZ-ROLE-TEMPLATES.md
 */
import fs from 'node:fs';
import path from 'node:path';

import {
    parseEinsatzRoleTemplates,
    type EinsatzRoleTemplate,
    EINSATZ_TEMPLATES_MAX,
    EINSATZ_TEMPLATES_FILE_MAX_BYTES,
} from './shared/einsatz-role-templates.js';

export {
    parseEinsatzRoleTemplates,
    EINSATZ_TEMPLATES_MAX,
    EINSATZ_TEMPLATES_FILE_MAX_BYTES,
    type EinsatzRoleTemplate,
};

const DEFAULT_FILE = '.morgendrot-einsatz-templates.json';

function filePath(): string {
    return path.resolve(process.cwd(), process.env.EINSATZ_ROLE_TEMPLATES_FILE || DEFAULT_FILE);
}

export function loadEinsatzRoleTemplates(): EinsatzRoleTemplate[] {
    try {
        const p = filePath();
        if (!fs.existsSync(p)) return [];
        const j = JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
        if (typeof j !== 'object' || j === null || Array.isArray(j)) return [];
        const raw = j as Record<string, unknown>;
        const arr = raw.templates;
        const v = parseEinsatzRoleTemplates({ templates: Array.isArray(arr) ? arr : [] });
        return v.ok ? v.templates : [];
    } catch {
        return [];
    }
}

export function saveEinsatzRoleTemplates(templates: EinsatzRoleTemplate[]): void {
    const p = filePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = { version: 1 as const, templates };
    fs.writeFileSync(p, JSON.stringify(payload, null, 0), 'utf8');
}
