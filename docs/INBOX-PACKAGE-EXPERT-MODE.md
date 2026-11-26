# Posteingang: Package-ID / Vertrag (Expertenmodus)

Stand: 2026-11-24 — Vertrag-UI sitzt in **Einstellungen → IOTA → Expertenmodus** (nicht Posteingang-Toolbar, nicht Allgemein).

## Kurzfassung

| Nutzer | Package-/Vertrags-UI |
|--------|----------------------|
| Standard (Simple Mode / ohne Toggle) | **Keine** Steuerung |
| Expertenmodus (client) + IOTA-Transport | Block **IOTA-Vertrag (Package-ID)** unter dem Toggle |
| Dauerhafter Wechsel | `/set-package-id` (Button „Dauerhaft wechseln“) |
| Temporär | nur Posteingang-Filter (`inboxPackageFilter`), **ohne** Server-Wechsel |

## Was der Expertenmodus kann (Ist)

| Ja | Nein / Backlog |
|----|----------------|
| Temporär: Posteingang auf eine Package-ID filtern | Multi-Package Side-by-Side (H.24b) |
| Dauerhaft: Server-Package setzen (`/set-package-id`) | Allgemeines „alles Expert“-Dashboard |
| Opt-in pro Browser (`localStorage`) | Freischaltung bei Simple Mode (serverseitig gesperrt) |
| Zusätzlich: Pulse-/Direkt-IOTA-Expert-Felder im Messenger-UI freischalten (wenn `uiVariant=messenger`) | Relay/R1-Alltag für Helfer |

**Wer braucht ihn?** Boss/Dev bei Package-Wechsel, Deploy-Vergleich, Debug „falsche“ Nachrichten im Posteingang. Alltagschat: aus lassen.

**Nicht verwechseln** mit Nachrichten → Optionen → **Pakete** = `.morg-pkg` Sneakernet.

## Was „Temporär“ macht

**Ja:** Der Posteingang lädt Nachrichten **nur für diese Move-Package-ID** (ein anderes Deploy/Programm). Server-Config und Sendepfad bleiben auf der aktiven ID.

**Nein:** Kein zweites Konto, kein dauerhafter Wechsel, kein `.morg-pkg`-Datei-Paket.

Amber-Hinweis im Panel = Temp-Filter aktiv. „Zurück zum aktiven Vertrag“ leert den Filter.

## Drei Schichten (wichtig)

1. **Server Simple Mode** (`ROLE=arbeiter`, `uiMode=simple`, …) — **hard block**, kein Toggle, kein Panel.
2. **IOTA-Transport sichtbar** — ohne IOTA kein Experten-Panel.
3. **Client Expertenmodus** (`localStorage` `morgendrot.messenger.expertMode`) — **opt-in** pro Browser.

## UX

- Einstellungen → **IOTA** → Expertenmodus **an** → Vertrags-Panel.
- **Temporär anzeigen** — `writeInboxPackageFilterStore` + Event → Chat lädt `/inbox` mit Filter.
- **Dauerhaft wechseln** — `setPackageIdCommand` + Force-Refresh.
- Verlauf aus `GET /api/package-id-history`.

## Code-Referenzen

| Datei | Rolle |
|-------|--------|
| `frontend/lib/messenger-client-expert-mode.ts` | Toggle localStorage + Event |
| `frontend/lib/inbox-package-filter-store.ts` | Temporärer Filter + Cross-View-Event |
| `frontend/lib/inbox-package-view.ts` | View-Modus + Fetch-Auflösung |
| `frontend/components/settings-expert-mode-section.tsx` | Toggle (Tab IOTA) |
| `frontend/components/settings-inbox-package-contract-panel.tsx` | Vertrags-UI |
| `frontend/components/chat-view-inbox-package-expert-menu.tsx` | Shared Menu (`embedded`) |
| `frontend/hooks/use-chat-view-package-id.ts` | Chat: Filter-Event → Reload |

## Vorbereitung Multi-Package (Zukunft)

Volles Multi-Package-Dropdown / Side-by-Side bleibt Backlog (`docs/ROADMAP-FAHRPLAN.md` H.24b).
