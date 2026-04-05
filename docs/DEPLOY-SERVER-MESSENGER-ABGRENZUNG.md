# Server-Deploy vs. „Messenger only“

Es gibt **keinen** separaten „Messenger-Server-Ordner“ im Repo: **dieselbe** Node-App (`src/`, `package.json`) — Unterschied ist **Konfiguration** (`.env`) und **optional** welche Assets du mit auslieferst.

## Was auf den Server (Raspi / VPS / Headless)

Typisch (siehe auch **`deploy/README-DEPLOY-BUNDLES.md`**):

| Mitnehmen | Zweck |
|-----------|--------|
| `src/` | API, Wallet-Bridge, Befehle |
| `package.json`, `package-lock.json`, `tsconfig.json` | Install & Build |
| `.env` | Secrets, Rollen, Features |
| `ui/` (optional) | Lite-UI, wenn `ENABLE_UI=true` |

**Oft nicht nötig auf dem gleichen Host:** `frontend/` (Next.js) — das ist eine **separate** Oberfläche; für reines Headless-Relay reicht Backend + ggf. `ui/`.

## „Messenger only“ — was bedeutet das?

**Hauptsächlich `.env`**, keine zweite Codebasis:

- **`UI_VARIANT`**, **`ROLE`**, **`MESSENGER_EDITION`** — siehe **`docs/DEV-START.md`**
- Welche Endpunkte/Features aktiv sind, steuern weitere Variablen (z. B. `ENABLE_UI`, Relay-URLs, Sponsor-Wallet)

**Kurz:** „Messenger only“ = dieselbe API, aber **Messenger-Oberfläche** und oft **reduzierte** Boss/Werkstatt-Funktionen — alles über **Umgebungsvariablen**, nicht über einen anderen Ordner.

## Zwei Frontends (Erinnerung)

| Pfad | Rolle |
|------|--------|
| `ui/` | Lite-UI (klassisch, oft Gerät/Raspi) |
| `frontend/` | Next.js (Boss/Werkstatt, moderner Stack) |

Beide sprechen dieselbe Backend-API — **Deployment** kann getrennt sein (z. B. Next auf Vercel, API auf Raspi).
