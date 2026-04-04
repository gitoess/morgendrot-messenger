# Morgendrot – Testplan alle Reiter & Unterordner

Übersicht: Alle 9 TREE-Reiter inkl. Unterordner (Docs) und zugehörige Funktionen/Commands. Welche Skripte testen was – und in welcher Reihenfolge ein vollständiger Ablauf durchgespielt werden kann.

**Zwei Instanzen (z. B. Original + morgendrot-kopie) für echten 2-Wallet-Test:** siehe **scripts/ANLEITUNG-ZWEI-INSTANZEN-TEST.md**.

---

## Voraussetzungen

- **Server läuft:** z. B. `npm run dev` (API z. B. 3342, optional zweite Instanz 3345).
- **Ticket/AccessKey-Flow:** Gültige **PACKAGE_ID** (0x + 64 Hex). Ohne deploytes Move-Package bricht `npm run test:tickets-keys` mit Hinweis ab.

---

## 1. Anfang & Verbindung

| Typ    | Item / Funktion | Getestet durch |
|--------|------------------|----------------|
| config | MY_ADDRESS, RPC_URL, PACKAGE_ID, PACKAGE_ID_FILE, VAULT_REGISTRY_ID, MAILBOX_ID, COMMAND_REGISTRY_ID, ROLE | test-all-api (config GET) |
| api    | /set-package-id, /transfer-coins, /connect, /handshake, /exit, /help | test-all-api (Commands) |
| func   | findPeerHandshake, isChainReachable, getConnectAddresses | test-all-api (GET) |
| Doc    | ENV-ERKLAERUNG.md | test-all-api (alle Docs) |

**Vollständiger Ablauf (Beispiel):** status → current-ids → chain-reachable → handshake(partner) → connect → transfer-coins.

---

## 2. Vault & Sicherheit

| Typ    | Item / Funktion | Getestet durch |
|--------|------------------|----------------|
| config | VAULT_FILE, ENABLE_PURGE, ENABLE_REPLAY_PROTECTION, REPLAY_STATE_FILE, ENABLE_PLAINTEXT_CHANNEL, USE_ENCRYPTED_DISCOVERY | test-all-api (config), npm test (vault-local, replay-state) |
| api    | /vault-save, /vault-onchain, /purge-handshake, /purge-msg, /emergency-purge | test-all-api (/vault-save SKIP wenn kein VAULT_FILE; Commands erwähnt) |
| Doc    | VAULT-EINRICHTEN.md | test-all-api |

**Hinweis:** /vault-onchain, /emergency-purge benötigen VAULT_REGISTRY_ID; /purge-msg benötigt MAILBOX_ID. Lokaler Vault: Unit-Test in run-tests.

---

## 3. Nachrichten & Chat

| Typ    | Item / Funktion | Getestet durch |
|--------|------------------|----------------|
| config | PARTNER_*, AUTHORIZED_SENDERS, BOSS_*, KOMMANDANT_*, WORKER_*, ENABLE_PAIRWISE_GROUPS, BROADCAST_*, /send, /send-plain, ENABLE_LISTENER, LISTENER_POLL_MS, /fetch, FETCH_LAST_ON_START, ENABLE_FETCH_COMMAND, ENABLE_AUTO_EXECUTE, USE_MAILBOX, MAX_SEND_AMOUNT_IOTA | test-all-api (config, /send-plain, /fetch, /connect) |
| Doc    | BROADCAST-PINNWAND.md | test-all-api |

---

## 4. Schlüssel & Tickets

| Typ    | Item / Funktion | Getestet durch |
|--------|------------------|----------------|
| api    | /create-key, /create-keys, /emergency-purge-key, /purge-key, /transfer-key, /list-keys | test-all-api (list-keys, create-key SKIP); **test-tickets-keys-flow.ts** (vollständiger Flow) |
| func   | list-keys (GET), hasValidTicket, list-tickets (GET) | test-all-api (GET list-keys, list-tickets, has-valid-ticket) |
| api    | /create-ticket, /use-ticket, /purge-ticket, /emergency-purge-ticket, /transfer-ticket, /list-tickets | **test-tickets-keys-flow.ts** (kompletter Ablauf: erstellen → list → hasValid → use → list used → zweites Ticket → transfer → emergency-purge + purge) |
| config | DEFAULT_KEY_TTL_DAYS, DEFAULT_TTL_DAYS | – |
| Doc    | LEIHGERAETE-EINRICHTEN.md, FESTIVAL-TICKETS-EINRICHTEN.md (Unterordner/Anleitungen) | test-all-api (Docs) |

**Vollständiger Ablauf (2 Wallets / Ein-Wallet):**  
`npm run test:tickets-keys` – Ticket: create → list → hasValidTicket → use-ticket → list (used) → create 2 → transfer → emergency-purge-ticket → purge-ticket. AccessKey: create-key → list-keys → transfer-key → purge-key; optional create-key 2 → emergency-purge-key → purge-key.

---

## 5. Schloss & Hardware

| Typ    | Item / Funktion | Getestet durch |
|--------|------------------|----------------|
| config | LOCK_ID, OPEN_COMMAND, OPEN_URL, OPEN_COMMAND_WORDS, OPEN_COMMAND_LIST_FILE, OPEN_COMMAND_LIST_KEY, ENABLE_HARDWARE_OPEN, OFFLINE_*, HANDSHAKE_REFRESH_MS, LOCK_PEER_REFRESH_MS, LOCK_COMMAND_POLL_MS | test-all-api (config), getDoc |
| Doc    | SCHLOSS-EINRICHTEN.md | test-all-api |

Kein eigenes Flow-Skript; Ablauf manuell oder über Lock-Instanz (ROLE=lock) + AccessKey von Reiter 4.

---

## 6. Streams & Schnellkanal

| Typ    | Item / Funktion | Getestet durch |
|--------|------------------|----------------|
| config | OPEN_STREAMS_ENABLED, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, STREAMS_LISTEN_ENABLED, STREAMS_TOPIC | test-all-api (config) |
| Doc    | STREAMS-INTEGRATION.md | test-all-api |

---

## 7. Zahlung & Trigger

| Typ    | Item / Funktion | Getestet durch |
|--------|------------------|----------------|
| config | PAYMENT_TRIGGER_ENABLED, PAYMENT_TRIGGER_MIN_IOTA, PAYMENT_TRIGGER_POLL_MS, PAYMENT_TRIGGER_STATE_FILE, PAYMENT_TRIGGER_REQUIRE_MEMO | test-all-api (config) |
| Doc    | CAR-SHARING-EINRICHTEN.md | test-all-api |

---

## 8. Monitoring & Wartung

| Typ    | Item / Funktion | Getestet durch |
|--------|------------------|----------------|
| config | ENABLE_HEARTBEAT, HEARTBEAT_INTERVAL_MS, MONITOR_DEVICES, MONITOR_OFFLINE_TIMEOUT_MS, MONITOR_STATE_FILE, MONITOR_CHECK_INTERVAL_MS, MONITOR_ALARM_WEBHOOK_URL, ENABLE_CHAIN_ANCHOR, ANCHOR_INTERVAL_MS, ENABLE_FILE_LOGGING, LOG_VERBOSE, LOG_MAX_FILES, LOG_MAX_SIZE | test-all-api (config), npm test (monitoring) |
| func   | monitor-status, audit-export | test-all-api (GET) |
| Doc    | SENSOR-ALARME-EINRICHTEN.md | test-all-api |

---

## 9. Einstellungen & Entwickler

| Typ    | Item / Funktion | Getestet durch |
|--------|------------------|----------------|
| config | SIGNER, REMOTE_SIGNER_*, WALLET_DERIVATION_PATH, GAS_BUDGET, ENABLE_UI, UI_PORT, API_PORT | test-all-api (config) |
| func   | getConfigDisplay | test-all-api (GET /api/config) |
| Doc    | BOSS-MODUS.md | test-all-api |

---

## Unterordner / Alle Docs (Anleitungen)

Diese Anleitungen sind über `/api/doc?name=…` abrufbar und werden von **test-all-api.ps1** durchgetestet (alle refs im TREE sind in PROJECTS abgedeckt; validate:ui prüft 66 refs).

| Doc | Reiter / Zuordnung |
|-----|---------------------|
| ENV-ERKLAERUNG.md | 1. Anfang & Verbindung |
| VAULT-EINRICHTEN.md | 2. Vault & Sicherheit |
| BROADCAST-PINNWAND.md | 3. Nachrichten & Chat |
| LEIHGERAETE-EINRICHTEN.md | 4. Schlüssel & Tickets |
| SCHLOSS-EINRICHTEN.md | 5. Schloss & Hardware |
| STREAMS-INTEGRATION.md | 6. Streams |
| CAR-SHARING-EINRICHTEN.md | 7. Zahlung & Trigger |
| SENSOR-ALARME-EINRICHTEN.md | 8. Monitoring |
| BOSS-MODUS.md | 9. Einstellungen & Entwickler |
| NOTFALL-DATENSPEICHER.md | 2. Vault / Sicherheit |
| FESTIVAL-TICKETS-EINRICHTEN.md | 4. Schlüssel & Tickets |
| FAMILIEN-ZUGANG.md | 4. Schlüssel / Schloss |
| CHAT-GRUPPE-EINRICHTEN.md | 3. Nachrichten & Chat |
| M2M-KOORDINATION-EINRICHTEN.md | 5. Schloss / M2M |
| OFFLINE-FAEHIGKEIT.md | 5. Schloss |
| PACKAGE-ID-NEU-DEPLOYEN.md | 1. Anfang / Entwickler |
| CHAT-DURCHTESTEN.md | 3. Nachrichten & Chat |

Weitere Docs in `docs/` (z. B. NFT-PARAMETERS, CONFIG-REFERENCE, SECURITY-MODES) können bei Bedarf in test-all-api ergänzt werden.

---

## Skripte – Reihenfolge für kompletten Durchlauf

1. **Modultests:** `npm test` (19 Tests: crypto, vault, replay, chain-access, config, monitoring, …).
2. **Build & UI:** `npm run build:docs`, `npm run validate:ui`.
3. **API + alle Reiter (GET/POST/Commands + alle Docs):**  
   `powershell -ExecutionPolicy Bypass -File scripts/test-all-api.ps1`  
   (Server muss laufen; 44 OK, 0 Fail, 2 SKIP bei Standard-Setup.)
4. **Ticket- & AccessKey-Flow (2 Wallets oder Ein-Wallet):**  
   `npm run test:tickets-keys`  
   Erfordert **gültige PACKAGE_ID** (0x + 64 Hex). Bei Platzhalter „create_globals“ bricht das Skript mit Hinweis ab.
5. **Punkt 8 (manuell):** start-boss-signer, boss-provision-handshake, deploy-package, restart, exit – siehe TEST-ERGEBNIS.md.

---

## Kurzfassung: Was deckt was ab?

| Bereich | test-all-api.ps1 | test-tickets-keys-flow.ts | npm test |
|---------|-------------------|----------------------------|----------|
| 1. Anfang & Verbindung | GET + Commands | – | config, chain-access |
| 2. Vault & Sicherheit | config, vault-save (SKIP) | – | vault-local, replay-state |
| 3. Nachrichten & Chat | send-plain, fetch, connect | – | – |
| 4. Schlüssel & Tickets | list-keys, list-tickets, has-valid-ticket, create-key (SKIP) | **Vollflow Ticket + AccessKey** | chain-access |
| 5. Schloss & Hardware | config, getDoc | – | – |
| 6. Streams | config, getDoc | – | – |
| 7. Zahlung & Trigger | config, getDoc | – | – |
| 8. Monitoring | config, monitor-status, audit-export | – | monitoring |
| 9. Einstellungen | config, generate-address | – | config |
| Alle Docs | alle 15+ Doc-Namen | – | – |

Damit sind alle Reiter und Unterordner (Docs) einer Testart zugeordnet; der einzige **vollständige Szenario-Flow** (Ticket erstellen → Käufer nutzt → Weiterverkauf → Stornierung; AccessKey erstellen → transfer → purge; NFT-Mutation durch use-ticket) ist **test-tickets-keys-flow.ts** mit zwei Wallets oder Ein-Wallet-Modus.

---

## Ein Lauf: alle 19 Projekte (test:all-projects)

**`npm run test:all-projects`** (Script: **scripts/test-all-projects-full.ts**) führt ab Schritt 2 durch:

1. **Phase 1 – GET:** status, current-ids, package-id-history, package-id-hints, config, connect-addresses, chain-reachable, help, find-peer-handshake, has-valid-ticket, list-tickets, list-keys, rebate-candidates, monitor-status, audit-export; alle **18 Docs** (ENV-ERKLAERUNG … CHAT-DURCHTESTEN).
2. **Phase 2 – POST:** package-id-hints, config (LOG_VERBOSE), unlock (falsches Passwort / Bereits entsperrt), generate-address.
3. **Phase 3 – Commands:** alle apiCmd aus TREE: /help, /handshake, /send-plain, /transfer-coins, /fetch, /list-keys, /list-tickets, /connect, /purge-msg, /vault-save, /vault-onchain, /purge-handshake, /emergency-purge, /create-key, /create-keys, /create-ticket, /send, /emergency-purge-key, /purge-key, /transfer-key, /use-ticket, /purge-ticket, /emergency-purge-ticket, /transfer-ticket. (SKIP bei fehlender PACKAGE_ID/VAULT_FILE/VAULT_REGISTRY_ID/Objekt-IDs ist erwartet.)
4. **Phase 4 – Flow (optional):** Ticket+AccessKey-Flow, wenn PACKAGE_ID gültig und zweite Instanz (3345) erreichbar; sonst SKIP.

Die **18 Projekte** (Lean, Chat, Ticket, Lieferkette, Heimnetzwerk, Zahlung, Pinnwand, Vault, Notfall, Boss, Car-Sharing, Festival, Sensor-Alarme, Kühlkette, Familienzugang, Leihgeräte, Chat-Gruppe, M2M) nutzen genau diese Befehle, Abfragen und Einstellungen; ein erfolgreicher Lauf (OK + SKIP, 0 FAIL) deckt alle denkbaren Kombinationen ab.
