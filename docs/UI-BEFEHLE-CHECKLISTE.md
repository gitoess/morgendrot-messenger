# UI vs. CONFIG-REFERENCE & API – Checkliste

Stand: Prüfung nach Abgleich mit CONFIG-REFERENCE.md und api-server.ts.

---

## 1. Config-Variablen (CONFIG-REFERENCE)

Alle Variablen aus CONFIG-REFERENCE.md sind in der UI abgedeckt:

| Bereich | Variablen | In UI |
|--------|-----------|-------|
| Netzwerk | RPC_URL | ✅ TREE, ENV_GROUPS |
| Package | PACKAGE_ID, PACKAGE_ID_FILE, VAULT_REGISTRY_ID, MAILBOX_ID, COMMAND_REGISTRY_ID | ✅ TREE, ENV_GROUPS |
| Wallet & Adressen | MY_ADDRESS, PARTNER_ADDRESS, PARTNER_ADDRESS_FILE | ✅ TREE, ENV_GROUPS |
| Rolle & Lock | ROLE, LOCK_ID | ✅ TREE, ENV_GROUPS |
| Zeit & TTL | DEFAULT_TTL_DAYS, DEFAULT_KEY_TTL_DAYS, LISTENER_POLL_MS, HANDSHAKE_REFRESH_MS, LOCK_PEER_REFRESH_MS, LOCK_COMMAND_POLL_MS | ✅ TREE, ENV_GROUPS |
| Features | VAULT_FILE, USE_MAILBOX, LOG_VERBOSE, ENABLE_FILE_LOGGING, ENABLE_REPLAY_PROTECTION, ENABLE_HARDWARE_OPEN, ENABLE_PLAINTEXT_CHANNEL, ENABLE_PURGE, USE_ENCRYPTED_DISCOVERY, ENABLE_LISTENER, FETCH_LAST_ON_START, ENABLE_FETCH_COMMAND, ENABLE_AUTO_EXECUTE, ENABLE_UI, UI_PORT, ENABLE_MONITOR | ✅ TREE, ENV_GROUPS |
| Replay | REPLAY_STATE_FILE, PAYMENT_TRIGGER_STATE_FILE | ✅ TREE, ENV_GROUPS |
| Listener | AUTHORIZED_SENDERS, MAX_SEND_AMOUNT_IOTA | ✅ TREE, ENV_GROUPS |
| Zahlung | PAYMENT_TRIGGER_*, PAYMENT_TRIGGER_REQUIRE_MEMO | ✅ TREE, ENV_GROUPS |
| Hardware OPEN | OPEN_COMMAND, OPEN_URL, OPEN_COMMAND_WORDS, OPEN_COMMAND_LIST_* | ✅ TREE, ENV_GROUPS |
| Streams | OPEN_STREAMS_ENABLED, STREAMS_*, STREAMS_TOPIC | ✅ TREE, ENV_GROUPS |
| Signer | SIGNER, REMOTE_SIGNER_*, WALLET_DERIVATION_PATH | ✅ TREE, ENV_GROUPS |
| Gas | GAS_BUDGET | ✅ TREE, ENV_GROUPS |
| Verschlüsselte Env | ENCRYPTED_ENV_FILE | ✅ ENV_GROUPS (Blocklist), TREE (Einstellungen), HELP |

Zusätzlich in der UI (nicht in CONFIG-REFERENCE-Tabelle, aber in Doku/Projekten): PARTNER_ADDRESSES, BOSS_ADDRESS, KOMMANDANT_ADDRESSES, WORKER_ADDRESSES, BROADCAST_*, OFFLINE_*, MONITOR_*, ENABLE_HEARTBEAT, ENABLE_CHAIN_ANCHOR, ANCHOR_*, LOG_MAX_*, API_PORT.

---

## 2. API-Endpunkte (api-server.ts)

| Endpunkt | Verwendung in UI |
|----------|------------------|
| GET /api/status | ✅ checkApiStatus, Statuszeile |
| GET /api/current-ids | ✅ loadConfigCache, Aktuelle IDs |
| GET/POST /api/package-id-history, /api/package-id-hints | ✅ Package-History, Hinweise |
| GET/POST /api/config | ✅ .env-Kachel, Config-Cache |
| GET /api/doc | ✅ Dokumentations-Modal |
| GET /api/connect-addresses | ✅ getConnectAddresses (TREE) |
| GET /api/chain-reachable | ✅ isChainReachable (TREE) |
| GET /api/help | ✅ über /help (api/command) |
| GET /api/find-peer-handshake | ✅ findPeerHandshake (TREE) |
| GET /api/has-valid-ticket | ✅ hasValidTicket (TREE) |
| GET /api/list-tickets, /api/list-keys | ✅ TREE, Rebate-Bereich |
| GET /api/owned-objects | ✅ Rebate, Objektliste |
| GET /api/rebate-candidates | ✅ Rebate-Bereich |
| POST /api/unlock | ✅ Passwort-Overlay |
| POST /api/restart | ✅ Neustart-Button |
| GET /api/monitor-status | ✅ Monitor-Dashboard |
| GET /api/audit-export | ✅ Links „Audit CSV“, „Audit PDF“ |
| POST /api/purge-after-lieferung | ⚠️ **Nur Backend** – für Lieferketten-Purge (purges: [{ sender, recipient, nonce }]). Kein UI-Button; bei Bedarf in Projekt „Überwachung/Lieferkette“ ergänzbar. |
| POST /api/generate-address | ✅ Boss/Adresse erzeugen |
| POST /api/deploy-package | ✅ Deploy-Button (Package-ID) |
| POST /api/start-boss-signer | ✅ Boss-Signer starten |
| POST /api/boss-provision-handshake | ✅ Formular Handshake senden |
| POST /api/command | ✅ Alle „Ausführen“-Befehle (siehe unten) |

---

## 3. Befehle über /api/command („Ausführen“)

Alle folgenden Befehle sind in der UI mit „Ausführen“ (+ ggf. Eingabefelder/Prompt) erreichbar:

- /set-package-id, /transfer-coins, /connect, /handshake, /exit, /help  
- /vault-save, /vault-onchain, /purge-handshake, /purge-msg, /emergency-purge  
- /send, /send-plain, /fetch  
- /create-key, /create-keys, /emergency-purge-key, /purge-key, /transfer-key, /list-keys  
- /create-ticket, /use-ticket, /purge-ticket, /emergency-purge-ticket, /transfer-ticket, /list-tickets  

**CMD_ARG_FIELDS** und **needsArgs** sind für alle obigen Befehle gesetzt; Eingaben: Kästchen oder Prompt (Anzahl, Adresse, Package-ID, etc.).

---

## 4. Abweichungen / Optionale Erweiterungen

| Thema | Status |
|-------|--------|
| **ENCRYPTED_ENV_FILE** | In ENV_GROUPS („Verschlüsselte Env“), TREE (Einstellungen), HELP; Blocklist → nur in .env bearbeiten. |
| **create_globals / Package-ID** | Eingabefeld „Package-ID (aus Schritt 2)“ im manuellen Deploy-Panel; Kopieren-Button ersetzt \<PACKAGE_ID\> im Befehl. |
| **/api/purge-after-lieferung** | Bewusst nur Backend (Spezialfall Lieferkette). Bei Bedarf: Button/Aktion in UI ergänzen. |

---

## 5. Kurzfassung

- **Config:** Alle CONFIG-REFERENCE-Variablen sind in der UI (TREE und/oder ENV_GROUPS) vorhanden; ENCRYPTED_ENV_FILE ist nachgezogen.
- **Befehle:** Alle über /api/command angebotenen Slash-Befehle sind in der UI mit „Ausführen“ und korrekten Argumenten abgebildet.
- **API-Routen:** Bis auf **/api/purge-after-lieferung** (Spezialfall) sind alle Endpunkte in der UI genutzt.
- **create_globals:** Package-ID kann im Deploy-Schritt eingetragen werden; der kopierte create_globals-Befehl wird mit dieser ID gefüllt.
