# Ports & Oberflächen: Next (3341) vs. API-Backend

## Kurzfassung

| Was | Typisch | Rolle |
|-----|---------|--------|
| **Port 3341** | Next.js (dieses React-Dashboard) | Spricht per **Proxy** mit dem Morgendrot-Backend; Messenger-PWA oft hier installiert. |
| **API-Port** (z. B. **3342**) | Morgendrot-Node (`npm run start:secrets` / `start`) | **Dasselbe Backend** mit der **Lite-UI** (`ui/index.html`) — oft mehr Legacy-Boss-/Setup-Fläche als in Next. |

`npm run dev` startet in der Regel **Backend + Next parallel** (siehe `docs/DEV-START.md` und `PWA-HANDBUCH-OFFLINE.md` §4).

**Arbeitsbereich, Rollen, Geräte-Radar** (Next-Panel vs. Messenger-Modus): `docs/UI-ROLLEN-WORKSPACES.md` §5–§7.

## Lite-UI am API-Port

- Mit `SERVE_LITE_UI_STATIC=false` am API-Port kann die statische `ui/index.html` abgeschaltet sein — dann nur Next unter **3341**.
- Es gibt **keinen** separaten „Standalone-Ordner“ am laufenden Dev-Server: ein exportierbares Messenger-Bundle entsteht über **`npm run bundle:messenger`** (siehe README / Boss-Orientierung).

## UI_VARIANT & Messenger-Edition

Im Backend setzen u. a. `UI_VARIANT` und `MESSENGER_EDITION` das Verhalten der Oberfläche (Lite-Messenger vs. volles Dashboard). Typische Kombinationen:

| UI_VARIANT | MESSENGER_EDITION (Beispiel) | Kurz |
|------------|-----------------------------|------|
| `full` | `standalone` o. ä. | **Morgendrot Projekt** — volle Plattform; Next (3341) nutzt dasselbe Backend per Proxy. |
| `messenger` | je nach Build | **Morgendrot Messenger** — Lite-UI am API-Port oder Next-PWA ohne Plattform-Umschalter. |

Die **laufenden Werte** siehst du in Next unter `GET /api/status` (`uiVariant`, `messengerEdition`, ggf. `serveLiteUiStatic`). Details im Fahrplan § H.0 und in der Boss-Orientierung.

## Messenger ohne entsperrten Tresor?

Solange die **API-Sitzung gesperrt** ist (`locked: true` in `/api/status`), liegen **keine** Schlüssel im RAM der Basis — **Signieren, Mailbox und zuverlässiges Senden** brauchen einen **entsperrten Tresor**. In dieser Next-Oberfläche blockiert bei gesperrter Sitzung in der Regel der **Dialog „Tresor entsperren“** die Nutzung, bis entsperrt wurde. Hinweise im Messenger (z. B. gelber Banner) betreffen vor allem **Randfälle**: Sitzung wurde **während** du im Chat warst gesperrt (anderes Tab/Fenster, manuelles Sperren, Hintergrund-Lock der PWA) oder die Anzeige ist **kurz veraltet** — dann **Startseite** bzw. erneut entsperren.
