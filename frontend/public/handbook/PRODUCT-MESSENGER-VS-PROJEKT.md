# Zwei Produkte: Morgendrot Messenger vs. Morgendrot Projekt

**Stand:** 2026-05-28 — Phase 2: **getrennte Next-Builds** und eigene Dashboard-Shells.

## Kurzfassung

| Produkt | Build | Dashboard | Inhalt |
|---------|-------|-----------|--------|
| **Morgendrot Messenger** | `npm run build:messenger` | `messenger-dashboard.tsx` | Einsatz-App: Nachrichten, Tresor, Einsatzleitung (rollenabhängig), Boss-Schnellstart |
| **Morgendrot Projekt** | `npm run build` (Default) | `projekt-dashboard.tsx` | Plattform: Zugang, Überwachung, Radar, Steuerung, **plus** Kachel „Nachrichten“ (Messenger-Modul) |

**Regeln:**

1. Der **Messenger** ist kein Umschalter im Projekt und kein „blinder Passagier“ im selben Bundle.
2. Das **Projekt** enthält Kommunikation über die normale Kachel **Nachrichten** — nicht über eine eingebettete Messenger-App-Shell.
3. Für Helfer/Boss **im Feld**: eigenes Messenger-Produkt bauen/deployen (`UI_VARIANT=messenger`, `build:messenger` oder `bundle:messenger` + Lite-UI).

## Technische Trennung

| Aspekt | Messenger | Projekt |
|--------|-----------|---------|
| Env Build | `NEXT_PUBLIC_MORG_PRODUCT=messenger` | (leer / `projekt`) |
| Einstieg | `app/page.tsx` → dynamischer Import nur **einer** Shell | dynamischer Import `projekt-dashboard` |
| Schwere Views | **Kein** Import von `lock-view`, `monitor-view`, `device-radar-view`, `worker-action-center-view` | Alle Module |
| Backend `.env` | `UI_VARIANT=messenger` | `UI_VARIANT=full` |
| APK/Capacitor | `build:capacitor-web` setzt Messenger-Produkt | — |
| ZIP-Export | `npm run bundle:messenger` (ohne `frontend/`, Lite-UI `ui/`) | Haupt-Repo |

## Entwicklung

```bash
# Im Repo-Root (empfohlen): Backend + UI zusammen
npm run dev              # Morgendrot Projekt
npm run dev:messenger    # Morgendrot Messenger

# Nur UI (Backend muss separat laufen — sonst „Keine Verbindung zum Backend“):
cd frontend && npm run dev
cd frontend && npm run dev:messenger

# LAN / Handy im WLAN
npm run dev:lan
npm run dev:messenger:lan
```

| Befehl (Repo-Root) | UI (Port 3341) | Backend (Port 3342) |
|--------------------|----------------|---------------------|
| `npm run dev` | Projekt | ja |
| `npm run dev:messenger` | Messenger | ja |

`cd frontend && npm run dev:messenger` allein startet **nur** die Oberfläche — dafür in einem zweiten Terminal `npm run start:secrets` (im Root) oder besser direkt `npm run dev:messenger` im Root.

Produktionscheck weiterhin: `npm run build:messenger && npm run start`.

## Rollen im Messenger

| Rolle | UI |
|-------|-----|
| Helfer (`arbeiter`, …) | Nachrichten + Tresor |
| Kommandant | + Einsatzleitung |
| Boss | Schnellstart (Nachrichten, Einsatzleitung, Tresor) + optional Kachel „Steuerung“ |

Kein Geräte-Radar, kein Bank-Tor-Action-Center, kein Zugangs-Kachel-Grid aus dem Projekt.

## Phase 3 (erledigt / Backlog)

- **`dev:messenger` / `dev:messenger:lan`** — Messenger mit Hot Reload
- **`useDashboardSession`** — gemeinsame Logik (Status, Unlock, Navigation, Handshakes, Offline) für `messenger-dashboard.tsx` und `projekt-dashboard.tsx`
- Backlog: Bundle-Größen-Vergleich in CI (`build` vs. `build:messenger`); Messenger als iframe/Deep-Link vom Projekt (nur URL)

## Code

- `frontend/frontend/lib/morg-product.ts`
- `frontend/frontend/hooks/use-dashboard-session.ts`
- `frontend/frontend/components/messenger-dashboard.tsx`
- `frontend/frontend/components/projekt-dashboard.tsx`
- `frontend/app/page.tsx` (dynamische Imports)

## Verwandte Docs

- `docs/UI-ROLLEN-WORKSPACES.md`
- `docs/MESSENGER-BUNDLE-SOURCE-OF-TRUTH.md`
- `docs/DASHBOARD-ERSTE-SCHRITTE.md`
