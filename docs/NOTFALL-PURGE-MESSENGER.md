# Notfall-Purge & lokaler Cache – Messenger

Kurzreferenz: **was** welcher Schalter löscht und **was nicht**.

## UI (Einstellungen → Sicherheit → Notfall-Löschung)

| Option | Chain-Tresor | Lokale Datei `.morgendrot-vault` | Inbox-Cache (`.inbox.enc` + Browser-Liste) | Browser-Geheimnisse (Sidecars) | RAM |
|--------|--------------|-----------------------------------|--------------------------------------------|--------------------------------|-----|
| **Sitzung sperren** | Nein | Bleibt | oft geschreddert via `/vault-lock` | gesperrt (Ciphertext bleibt) | Keys weg |
| **Nur Nachrichten lokal** | Nein | Bleibt | Ja (Server + Browser) | Nein | Inbox-RAM leer |
| **Nur Browser-Geheimnisse** | Nein | Bleibt | Nein | Ja (`purgeLocalSecretVaults`) | Session-PW weg |
| **Gerät lokal aufräumen** | Nein | Bleibt | Ja + Einsatz-Spuren | Ja | wie Einsatz-Ende |
| **Tresor on-chain löschen** | Ja (`/emergency-purge`) | **Bleibt** | Ja | Ja | — |
| **Lokale Tresor-Datei löschen** | Nein | Ja (`/vault-delete-local`, nur mit Chain-Backup) | Nein | Nein | — |

**Nur Medien:** kein eigener Scope — Bilder in Nachrichten bzw. NFT (On-Chain/NFT brennen). Einzelne Chain-Msgs: Posteingang → Burn.

## Voraussetzungen (On-Chain-Purge)

- `ENABLE_PURGE=true`
- `VAULT_REGISTRY_ID` gesetzt
- Wallet kann signieren (Gas)
- Implementierung: `src/messenger-nest/messenger-command-handler.ts` (`/emergency-purge`)

## Verwandt

- `POST /api/clear-local-history` — Server-Inbox-Cache
- `/purge-msg`, `/purge-key`, … — gezielte Chain-Objekte, nicht Vault-Notfall
- Einsatz beenden — `performEinsatzEndCacheWipe` (gleiche Browser-Aufräumlogik wie „Gerät lokal“)

---

*Stand: 2026-11-12 — UI-Scopes an echten APIs ausgerichtet.*
