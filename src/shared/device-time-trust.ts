/**
 * Re-export: kanonische Implementierung in **`@morgendrot/core`** (`device-time`).
 *
 * **Relativer Pfad** (statt `@morgendrot/core/…`): Root-`tsx` (**`scripts/run-tests.ts`**, Smoke) lädt diese Datei
 * ohne separates `npm install` in **`src/shared/`** — dort gäbe es sonst kein auflösbares `node_modules`.
 * Next-PWA nutzt **`@/frontend/lib/device-time-trust`** → Core per `file:` aus **`frontend/`**.
 */
export * from '../../packages/morgendrot-core/src/device-time/index.js'
