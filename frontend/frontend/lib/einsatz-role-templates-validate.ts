/**
 * Client-Validierung vor POST — gleiche Logik wie Server (`parseEinsatzRoleTemplates`).
 * Kanonisch: `src/shared/einsatz-role-templates.ts` → Paket `@morgendrot/shared` (siehe docs/MONOREPO-NEXT-AND-SHARED.md).
 */
export {
    parseEinsatzRoleTemplates as validateEinsatzRoleTemplatesBody,
    EINSATZ_TEMPLATES_MAX,
    EINSATZ_TEMPLATES_FILE_MAX_BYTES,
} from '@morgendrot/shared/einsatz-role-templates'
export type { EinsatzRoleTemplate } from '@morgendrot/shared/einsatz-role-templates'
