# Messenger-Nest (`messenger-nest/`)

**Kein NestJS-Framework:** Der Ordnername bezieht sich auf die **Ameisen-/Kammer-Metapher** (siehe unten), nicht auf [NestJS](https://nestjs.com/). Es handelt sich um **normale TypeScript-Module** unter `wallet-bridge` / `POST /api/command` — keine `@nestjs/*`-Abhängigkeit, kein DI-Container.

Fortführung der **Layer- / Ameisennest-Analogie** ([`docs/ARCHITECTURE-CHECKS.md`](../docs/ARCHITECTURE-CHECKS.md)): Hier liegt nur **Orchestrierung** für den Messenger – keine zweite Chain-Schicht.

**UI-Rollen:** Terminal und **`POST /api/command`** teilen sich dieselbe Befehlslogik. Welche **Browser-Oberfläche** wofür gedacht ist (Boss-Werkstatt `ui/` vs. Kunden-Next `frontend/`), steht in [`docs/DEV-START.md`](../docs/DEV-START.md) (*Zwei Oberflächen*).

| Kammer | Datei | Aufgabe |
|--------|--------|---------|
| **Session** | `messenger-session-password.ts` | Ein Passwort im RAM (Wallet + Vault) – minimale Oberfläche. |
| **Streams-Brücke** | `streams-bridge-client.ts` | HTTP zur Streams-Bridge: URL-Validierung, Timeouts, Fallback-Ports. |
| **Vorfeld** | `messenger-preflight.ts` | Backend-Veto vor riskanten Befehlen (`preFlightCheck`). |
| **Hilfe** | `messenger-help.ts` | `HELP_START` / `HELP_CHAT` (eine Quelle für Terminal + Generator). |
| **Peer / Inbox** | `peer-state.ts`, `messenger-fetch.ts`, `messenger-listener.ts` | Handshake-Peer-Zustand, `/fetch`, Hintergrund-Listener. |
| **Chain-Hülle** | `messenger-chain-wrap.ts` | Dünne Wrapper um `chain-access` + Passwort (keine SDK-Logik duplizieren). |
| **Connect** | `messenger-connect.ts` | `runConnectLogic`, `watchHandshakeUpdates`. |
| **Befehl** | `messenger-command-handler.ts` | **Eine** Dispatcher-Funktion für UI-API und Terminal (kein paralleler if/else-Zweig). |

`wallet-bridge.ts` bleibt der **Eingang** (Start, Rollen, `main`), importiert das Nest und exportiert die öffentlichen Symbole nach außen.

**UI-Zuordnung:** Terminal und **`POST /api/command`** teilen sich dieselbe Befehlslogik. Die **Alpine-Boss-UI** (`ui/`) und das **Next-Dashboard** (`frontend/`) sind nur Clients; Rollen und Ports: **`docs/DEV-START.md`** (*Zwei Oberflächen*).
