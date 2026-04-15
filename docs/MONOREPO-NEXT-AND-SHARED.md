# Monorepo: `src/shared` und die Next-PWA (`frontend/`)

**Ziel:** Eine **kanonische** TypeScript-Quelle unter `src/shared/` für **Node** (z. B. `src/einsatz-role-templates.ts`) und **Next 16** (Messenger-PWA), **ohne** manuelle Spiegel-Dateien und **ohne** Symlinks. **Messenger-Kern (`@morgendrot/core`):** `packages/morgendrot-core/` — gleiches Muster: **`frontend/package.json`** → `"@morgendrot/core": "file:../packages/morgendrot-core"`, **`transpilePackages`** + **`turbopack.root`** (Repo-Parent); siehe **`docs/MORGENDROT-CORE-PACKAGE-PLAN.md`**.

---

## Kritische Einordnung: Was `transpilePackages` wirklich macht

Laut [Next.js – `transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages) transpiliert Next **bestimmte npm-Pakete**, die typischerweise unter **`node_modules/`** liegen und dort **unkompiliertes** (z. B. TS/ESM+) ausliefern.

**Folge:** `transpilePackages: ['@morgendrot/shared']` allein **reicht nicht**, wenn es **kein** installiertes Paket `@morgendrot/shared` gibt. Ein bloßer `tsconfig`-`paths`-Eintrag auf `../src/shared` **ersetzt** das nicht: Der Bundler muss das Modul wie ein **Paket** auflösen können.

**Saubere Lösung (hier umgesetzt):**

1. **`src/shared/package.json`** — minimales Paket mit `"name": "@morgendrot/shared"` und **`exports`** für die öffentlichen Einstiege (z. B. `./einsatz-role-templates`).
2. **`frontend/package.json`** — Abhängigkeit **`"@morgendrot/shared": "file:../src/shared"`** → `npm install` legt unter `frontend/node_modules/@morgendrot/shared` einen **Verweis** auf den echten Ordner an (je nach npm-Version Symlink/Junction o. ä.).
3. **`frontend/next.config.mjs`** — **`transpilePackages`** enthält **`@morgendrot/shared`**, damit Next dieses lokale Paket mitbündelt/transpiliert.
4. **`frontend/tsconfig.json`** — optional **`paths`** für `@morgendrot/shared/*` → `../src/shared/*` (IDE, `tsc`) — **nur** in Kombination mit **`turbopack.root`** = Monorepo-Parent (s. unten); sonst zeigen die Pfade aus Sicht von Turbopack **außerhalb** des Bundler-Roots und der Build bricht mit „Module not found“.

5. **`frontend/next.config.mjs` → `turbopack.root`** = **`path.resolve(repoRoot)`** (Parent von `frontend/`). **Warum nötig:** `file:../src/shared` verlinkt auf einen Ordner **außerhalb** von `frontend/`. Mit dem Default-Root `frontend/` folgt Turbopack dem Link nicht zuverlässig. Der Parent-Root enthält **`src/`** und **`frontend/`** (inkl. `node_modules`).

Damit gilt: **Eine** Quelle auf der Platte (`src/shared/*.ts`), **kein** manueller Spiegel-Sync — dafür **`turbopack.root`** auf den Repo-Parent (offizielles Turbopack-Mittel für Monorepos / Links).

---

## Alternativen (kurz)

| Variante | Wann sinnvoll | Nachteil |
|----------|----------------|----------|
| **`turbopack.root` = Monorepo-Parent** | **Hier aktiv** neben `file:` + `transpilePackages`, damit der Link nach `src/shared` aufgelöst wird | Etwas breiterer Watch-/Resolve-Raum; siehe [Turbopack root](https://nextjs.org/docs/app/api-reference/next-config-js/turbopack#root-directory). |
| **`next dev --webpack` / `next build --webpack`** | Turbopack zickt auf einer Plattform | Langsamerer Dev/Build. |
| **Symlink nur im Repo** | Ohne npm-`file:` | Windows/Git/CI oft fragiler als `file:`. |
| **Spiegel-Datei + Sync-Skript** | — | Zwei Quellen, leicht driftend — **verworfen**. |

---

## Workflow für Entwickler:innen

1. **Nach `git pull`**, wenn sich `frontend/package.json` oder `src/shared/package.json` geändert hat: im Ordner **`frontend/`** **`npm install`** (oder **`npm ci`** in CI).
2. **Neues Modul** unter `src/shared/`: Eintrag unter **`exports`** in `src/shared/package.json` ergänzen (oder bewusst nur Deep-Imports, wenn ihr ohne strikte `exports` arbeitet — aktuell ist `exports` gesetzt, daher **explizit** erweitern).
3. **Node-Seite** (`src/*.ts`): weiterhin normale relative Imports **`./shared/…`** bzw. **`./shared/….js`** in ESM — unabhängig vom npm-Paketnamen.

---

## CI

`.github/workflows/frontend-checks.yml` führt in **`frontend/`** `npm ci` aus. Der Lockfile **`frontend/package-lock.json`** muss den Eintrag `file:../src/shared` enthalten — nach Änderung an den `package.json`-Dateien **`npm install` im Ordner `frontend/`** ausführen und Lockfile committen.

Workflow-Trigger wurde um **`src/shared/**`** ergänzt, damit Änderungen am Shared-Paket die Frontend-Checks anstoßen.

---

## Referenz-Dateien

| Datei | Rolle |
|--------|--------|
| `src/shared/package.json` | Paketname, `exports` |
| `src/shared/einsatz-role-templates.ts` | Beispiel-Modul |
| `frontend/package.json` | `"@morgendrot/shared": "file:../src/shared"` |
| `frontend/next.config.mjs` | `transpilePackages` + **`turbopack.root` = Repo-Parent** |
| `frontend/tsconfig.json` | `@/*` + `@morgendrot/shared/*` → `../src/shared/*` (mit Parent-`turbopack.root`) |
| `frontend/frontend/lib/einsatz-role-templates-validate.ts` | Import `@morgendrot/shared/einsatz-role-templates` |

---

## Lockfiles: keine zweite `pnpm-lock.yaml` unter `frontend/`

Wenn unter **`frontend/`** eine **`pnpm-lock.yaml`** liegt, während CI und Team **`npm`** + **`frontend/package-lock.json`** nutzen, kann Next die **Workspace-Root** falsch inferieren und **warnen**.

**Maßnahme:** nur **`package-lock.json`** im Ordner **`frontend/`** pflegen; fremde Lockfiles dort **nicht** committen.

**Hinweis:** Die gewählte **`turbopack.root`** ist der **Monorepo-Parent** (wegen `file:` → `src/shared`), nicht nur die Warnung-Umgehung.

---

## Risiken / Grenzen

- **`exports` in `package.json`:** Nur unter `exports` gelistete Unterpfade sind „offiziell“ importierbar (je nach Toolchain). Neue Dateien → `exports` pflegen.
- **`npm`/Lockfile:** Ohne erneutes `npm install` nach Änderung der `file:`-Abhängigkeit kann CI lokal abweichen.
- **Vitest:** Löst `@morgendrot/shared` über `node_modules` auf; bei Abweichungen kann in `vitest.config.ts` ein Alias ergänzt werden (aktuell nicht nötig, solange `npm install` in `frontend/` gelaufen ist).

---

*Stand: Next 16 — `transpilePackages`, `file:../src/shared`, `turbopack.root` = Monorepo-Parent, keine Spiegel-Datei.*
