# Morgendrot – Sicherheits-Checkliste (für RAG / KI)

## Priorität: Bestätigung bei Aktionen

- **Regel 0:** Bei Aktionen (open, purge, create-key, transfer-coins, handshake, connect, vault-save, …) immer auf Bestätigung hinweisen – besonders wenn **ENABLE_AUTO_EXECUTE** aktiv ist.
- **ENABLE_AUTO_EXECUTE=false:** Befehle nur anzeigen, nicht ausführen (Kill-Switch). Empfohlen für Schlösser und Produktion.
- **ENABLE_LISTENER=false:** Kein Empfang von Nachrichten – maximale Abschottung.
- **ENABLE_HARDWARE_OPEN=false:** OPEN_COMMAND/OPEN_URL werden nicht ausgeführt – nur Log.

## Säule 1 vor allem anderen

- Ohne MY_ADDRESS und PACKAGE_ID keine Chain-Aktionen.
- RPC muss erreichbar sein; Wallet entsperrt.

## Schlösser / Lock

- Bei ROLE=lock: ENABLE_AUTO_EXECUTE=false setzen (manuelle Bestätigung).
- OPEN nur bei gültigem AccessKey (on-chain) und Replay-Schutz.
- AUTHORIZED_SENDERS begrenzen, wer Befehle auslösen darf.

## Vault & Keys

- Keys in Vault (VAULT_FILE) oder VaultRegistry speichern (/vault-save).
- Ein Passwort (Wallet) für Vault und Signatur – Verlust = kein Zugriff ohne Backup.

## Purge

- ENABLE_PURGE und MAILBOX_ID für /purge-handshake, /purge-msg, /purge-key.
- Purge nur nach Ablauf/Erledigung – Rebate zurück.
