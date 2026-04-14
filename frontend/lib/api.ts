/**
 * Abwärtskompatibilität: früher Monolith — jetzt Re-Export des Messenger-Barrels.
 * Für neue Codepfade: `import { … } from '@/frontend/lib/api'`.
 *
 * @see docs/FRONTEND-API-MODULARITY.md
 */
export * from '@/frontend/lib/api'
