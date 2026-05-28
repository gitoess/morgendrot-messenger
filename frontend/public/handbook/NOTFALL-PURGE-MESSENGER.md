# Notfall-Purge & lokaler Cache – Messenger

Kurzreferenz: **was** welcher Schalter löscht und **was nicht**.

## UI (Messenger-Frontend) – drei Umfänge

| Option | Chain | Lokale Datei `.morgendrot-vault` (oder `VAULT_FILE`) | Inbox-Klartext-Cache (`.inbox.enc` neben dem Vault) | RAM (Keys / Passwort) |
|--------|--------|------------------------------------------------------|------------------------------------------------------|-------------------------|
| **Vollständig** (`emergencyPurge` / `/emergency-purge`) | Ja: Vault-Objekt im Registry wird per PTB entfernt (`enable` + `purge`). | **Bleibt** – wird nicht gelöscht; Inhalt ist weiter verschlüsselt. On-Chain-Backup ist danach weg. | Ja, **geschreddert** (überschreiben + löschen). | Wallet/Session wie nach Neustart ohne Unlock |
| **Nur lokale Klartext-Spuren** (`clearLocalHistory` mit shred) | Nein | Unverändert | Ja, geschreddert | Unverändert (wenn Tresor offen) |
| **Nur Sitzung / Tresor sperren** (`/vault-lock`) | Nein | Unverändert | Ja, geschreddert | Keys und Wallet-Passwort aus RAM entfernt |

**Wichtig:** Eine vollständige „alles weg vom Datenträger“-Löschung der Vault-Datei passiert **nicht** automatisch. Nach Notfall-Purge die Datei bei Bedarf **manuell** löschen (und ggf. weitere Artefakte: `.morgendrot-partner`, Logs, …).

## Voraussetzungen (Voll-Purge)

- `ENABLE_PURGE=true`
- `VAULT_REGISTRY_ID` gesetzt
- Wallet kann signieren (Gas)
- Implementierung: `src/messenger-nest/messenger-command-handler.ts` (`/emergency-purge`)

## Verwandte Befehle (nicht identisch)

- **`/purge-key`**, **`/purge-ticket`**, **`/purge-handshake`**, **`/purge-msg`**: gezielte Chain-/Mailbox-Löschungen – anderer Zweck als Vault-Notfall-Purge.
- **`POST /api/clear-local-history`**: wie „nur lokaler Cache“ oben.

## Aufräum-Status (Projekt)


**Verwandt (operativ, nicht Purge-Technik):** **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`** — wen man im Ernstfall erreicht, Brücken zur professionellen Hilfe.

---

*Technische Quelle: `purgeInboxCache` / `inboxCachePath` in `src/vault-local.ts`, Emergency-Purge in `messenger-command-handler.ts`.*
