# Messenger-Nest (`messenger-nest/`)

Fortführung der **Layer- / Ameisennest-Analogie** ([`docs/ARCHITECTURE-CHECKS.md`](../docs/ARCHITECTURE-CHECKS.md)): Hier liegt nur **Orchestrierung** für den Messenger – keine zweite Chain-Schicht.

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
