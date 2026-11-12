# Notfall-Purge & lokaler Cache – Messenger

Kurzreferenz: **was** welcher Schalter löscht und **was nicht**.

## UI (Einstellungen → Sicherheit → Notfall-Löschung)

| Option | Chain-Tresor | Lokale Datei `.morgendrot-vault` | Inbox-Cache | Browser-Geheimnisse | Telegram Runtime/Journal | RAM |
|--------|--------------|-----------------------------------|-------------|---------------------|--------------------------|-----|
| **Sitzung sperren** | Nein | Bleibt | oft via `/vault-lock` | gesperrt | Nein | Keys weg |
| **Nur Nachrichten lokal** | Nein | Bleibt | Ja (Server + Browser) | Nein | Nein | Inbox-RAM |
| **Nur Browser-Geheimnisse** | Nein | Bleibt | Nein | Ja | Nein | Session-PW |
| **Telegram lokal löschen** | Nein | Bleibt | Nein | Nein | Ja (Runtime + Journal + Prefs) | — |
| **Gerät lokal aufräumen** | Nein | Bleibt | Ja + Einsatz-Spuren | Ja | Nein (bewusst getrennt) | wie Einsatz-Ende |
| **Tresor on-chain löschen** | Ja | **Bleibt** | Ja | Ja | Nein | — |
| **Lokale Tresor-Datei löschen** | Nein | Ja (nur mit Chain-Backup) | Nein | Nein | Nein | — |

**Nur Medien:** kein eigener Scope — in Nachrichten bzw. NFT (brennen).

**.env:** Telegram-Bot-Token nur in `.env` wird durch „Telegram lokal“ **nicht** gelöscht — Runtime-Config und Journal schon.

## Geplant: Komplett-alles-löschen (Roadmap T56)

Ein Wizard „soweit möglich alles“: Gerät + Chain-Tresor + Vault-Datei + Telegram + optional NFT/Keys brennen. **Nicht** gebaut — Absicht: Checklisten-Dialog mit ehrlichen Grenzen (fremde Chain-Kopien, Telegram-Server, .env).

## Voraussetzungen (On-Chain-Purge)

- `ENABLE_PURGE=true`, `VAULT_REGISTRY_ID`, Gas
- `src/messenger-nest/messenger-command-handler.ts` (`/emergency-purge`)

---

*Stand: 2026-11-12 — Telegram-Wipe + ehrliche Scopes.*
