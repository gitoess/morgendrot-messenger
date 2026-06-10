# Posteingang: Package-ID im Expertenmodus

Stand: 2026-06 — Kompromiss zwischen Lite-UI-Dropdown (früher) und heutigem Messenger (eine kanonische ID + Partner-Filter).

## Kurzfassung

| Nutzer | Posteingang Package-UI |
|--------|-------------------------|
| Standard (Simple Mode / ohne Toggle) | **Kein** Package-Dropdown — nur Partner/Kanal/Transport |
| Expertenmodus (Einstellungen, client) + IOTA-Transport | Kleines **Pkg:**-Menü oben rechts im Posteingang |
| Dauerhafter Wechsel | weiterhin **Einstellungen → System & Identität** (`/set-package-id`) |

## Drei Schichten (wichtig)

1. **Server Simple Mode** (`ROLE=arbeiter`, `uiMode=simple`, …) — **hard block**, kein Toggle, kein Menü.
2. **IOTA-Transport sichtbar** (`transportProfile` iota-*, `iotaTransportUiEnabled`) — ohne IOTA kein Package-Menü (Mesh-only-Einsätze).
3. **Client Expertenmodus** (`localStorage` `morgendrot.messenger.expertMode`) — **opt-in** pro Browser.

Expert-Relay/R1/Tangle bleiben an Schicht 1+2 gekoppelt (`expertTools`); das Package-Menü ist **schmaler** (nur Schicht 3 zusätzlich).

## UX im Expertenmodus

- Button **Pkg: 0xabc…** (amber = temporäre Anzeige).
- **Temporär anzeigen** — setzt `inboxPackageFilter`, lädt `/inbox` **ohne** `/set-package-id`.
- **Dauerhaft wechseln** — wie Einstellungen (`applyPackageIdBackend`).
- **Zurück zur Basis-ID** — Filter leeren, Posteingang neu laden.
- Verlauf aus `GET /api/package-id-history`.

**Nicht verwechseln** mit Toolbar **Pakete** = `.morg-pkg` Sneakernet (ECDH-Bundle).

## Kritische Verbesserungen gegenüber Rohvorschlag

| Punkt | Verbesserung |
|-------|----------------|
| Ein Toggle für alles | Package-Menü **nicht** an volle `expertTools` (Relay/R1) koppeln — eigene Gate-Funktion `canShowInboxPackageExpertMenu` |
| Rollen Boss-only | **Nicht** nur Boss — jeder ohne Server-Simple-Mode; Toggle schützt Normalnutzer |
| Namenskonflikt „Pakete“ | UI-Label **Pkg:** / „Package-ID (Move)“ |
| Temporär unsichtbar | Amber **Temp:** + Hinweistext im Menü |
| Multi-Package später | Typ `InboxPackageViewMode` + `comparePackageIds[]` in `inbox-package-view.ts` |

## Code-Referenzen

| Datei | Rolle |
|-------|--------|
| `frontend/lib/messenger-client-expert-mode.ts` | Toggle localStorage + Event |
| `frontend/lib/inbox-package-view.ts` | View-Modus + Fetch-Auflösung |
| `frontend/lib/messenger-role-capabilities.ts` | `canShowInboxPackageExpertMenu` |
| `frontend/hooks/use-chat-view-package-id.ts` | Temporär vs. dauerhaft (bestehend) |
| `frontend/components/chat-view-inbox-package-expert-menu.tsx` | Posteingang-UI |
| `frontend/components/settings-expert-mode-section.tsx` | Einstellungen |

## Vorbereitung Multi-Package (Zukunft)

**Wann ein volles Dropdown (oder Side-by-Side) mehr Sinn macht:**

- Mehrere **parallele Einsätze** mit unterschiedlichen Move-Deploys auf **einem** Gerät.
- Forensik/Vergleich **ohne** dauerndes `/set-package-id`.
- Backend-**Event-Union** über mehrere IDs in `.env` / `package-id-history` (Betreiber-Konfiguration existiert teilweise).

**Geplante Erweiterung (noch nicht UI):**

```typescript
// inbox-package-view.ts
mode: 'multi_union'
comparePackageIds: ['0x…', '0x…']
```

Fetch-Schicht (`fetchInbox`, `fetchInboxFromAllOwnedMailboxes`) könnte dann:

- `packageIds: string[]` + `union: true` (ein gemergter Posteingang), oder
- parallele Fetches + UI **Vergleichsmodus** (zwei Spalten).

Roadmap-Hinweis: `docs/ROADMAP-FAHRPLAN.md` → Abschnitt *Multi-Package Posteingang*.

## Abgrenzung Lite-UI

Die Screenshots mit Package-Dropdown im Posteingang stammen aus **`ui/index.html`** (Alpine Projekt-Dashboard). Der Messenger übernimmt das **nicht** als Default — nur den Experten-Pfad oben.
