# Morgendrot – Konfigurationsreferenz (alle Endpunkte)

Alle Konfigurationsoptionen mit kurzer Erklärung. Quelle: `.env` (oder `.env.example` als Vorlage). Design-Prinzipien: siehe [DESIGN-PRINCIPLES.md](DESIGN-PRINCIPLES.md).

---

## Netzwerk

| Variable | Erklärung |
|----------|-----------|
| **RPC_URL** | URL des IOTA-Rebased-Nodes (z. B. Fullnode). Ohne Angabe: Testnet-Default. |

---

## Package & Shared Objects

| Variable | Erklärung |
|----------|-----------|
| **PACKAGE_ID** | ID des deployten Move-Packages. Leer → wird aus Datei `.morgendrot-package-id` geladen (z. B. nach `/set-package-id`). |
| **PACKAGE_ID_FILE** | Pfad zur Datei mit Package-ID. Default: `.morgendrot-package-id`. |
| **VAULT_REGISTRY_ID** | Objekt-ID des VaultRegistry (aus `create_globals`-Event). Für On-Chain-Vault nötig. |
| **MAILBOX_ID** | Objekt-ID der shared Mailbox (aus `create_globals`). Für purgebare Nachrichten/Handshakes. |
| **COMMAND_REGISTRY_ID** | Objekt-ID des CommandRegistry (On-Chain-Öffnen-Wörter). Priorität vor AES-Datei und .env. |

---

## Wallet & Adressen

| Variable | Erklärung |
|----------|-----------|
| **MY_ADDRESS** | Eigene Adresse (Wallet). Bei Lock = Schloss-Adresse. Bei SIGNER=sdk kann leer sein (wird aus Mnemonic abgeleitet). |
| **PARTNER_ADDRESS** | Partner-Adresse (Messenger). Leer erlaubt; wird automatisch in `.morgendrot-partner` gespeichert bei `/connect` oder Handshake. |
| **PARTNER_ADDRESS_FILE** | Pfad für gespeicherte Partner-Adresse. Default: `.morgendrot-partner`. |

---

## Rolle & Lock

| Variable | Erklärung |
|----------|-----------|
| **ROLE** | `messenger` = Chat, Key-Verwaltung, Purge. `lock` = M2M-Schloss, hört auf „open“, prüft AccessKey. |
| **LOCK_ID** | Schloss-Adresse (oft = MY_ADDRESS). Leer → MY_ADDRESS wird genutzt. |

---

## Zeit & TTL

| Variable | Erklärung |
|----------|-----------|
| **DEFAULT_TTL_DAYS** | Standard-Gültigkeit für Nachrichten, Handshake, Vault (Tage). Default: 30. |
| **DEFAULT_KEY_TTL_DAYS** | Standard-Gültigkeit für AccessKey-NFTs (Tage). `/create-keys` nutzt dies, wenn kein ttl angegeben. Default: wie DEFAULT_TTL_DAYS. |
| **LISTENER_POLL_MS** | Pause zwischen Event-Abfragen (ms). Min. 1000. Default: 5000. |
| **HANDSHAKE_REFRESH_MS** | Pause beim Warten auf Handshake (ms). Min. 1000. Default: 5000. |
| **LOCK_PEER_REFRESH_MS** | Pause für PeerMap-Update (Lock, neue Handshakes). Min. 1000. Default: 15000. |
| **LOCK_COMMAND_POLL_MS** | Pause für Befehls-Poll (Lock, „open“-Nachrichten). Min. 1000. Default: 3000. |

---

## Features (Schalter)

| Variable | Erklärung |
|----------|-----------|
| **VAULT_FILE** | Pfad zur lokalen Vault-Datei (verschlüsselte Messaging-Keys). Leer = aus. Für Lock empfohlen. |
| **USE_MAILBOX** | Mailbox für Nachrichten/Handshakes nutzen (purgebar). Default: true, wenn MAILBOX_ID gesetzt. |
| **LOG_VERBOSE** | Ausführlicheres Logging. Default: false. |
| **ENABLE_FILE_LOGGING** | Logs in Datei (logs/) schreiben. false = nur Konsole. Default: true. |
| **ENABLE_REPLAY_PROTECTION** | Replay-Schutz (Nonce pro Sender). Default: true, wenn REPLAY_STATE_FILE gesetzt. |
| **ENABLE_HARDWARE_OPEN** | Bei OPEN Hardware ausführen (OPEN_COMMAND/OPEN_URL). Default: true, wenn einer gesetzt. |
| **ENABLE_PLAINTEXT_CHANNEL** | Zusätzlich Klartext-Events beim Chat (im Explorer sichtbar). Regel 2: Allow Cleartext. Default: false. |
| **ENABLE_PURGE** | Purge-Befehle erlauben. false = alle Purge-Befehle werden abgelehnt (Daten bleiben dauerhaft). Regel 5. Default: true. |
| **USE_ENCRYPTED_DISCOVERY** | Discovery über verschlüsselte Kanäle (z.B. Streams). Geplant. Regel 4. Default: false. |
| **ENABLE_LISTENER** | Listener an (Events abfragen). false = keine eingehenden Nachrichten, Lock reagiert nicht. Default: true. |
| **FETCH_LAST_ON_START** | Beim Start (nach /connect) die letzten N Nachrichten von der Chain holen. 0 = aus. Für Maschinen z.B. 20. Default: 0. |
| **ENABLE_FETCH_COMMAND** | Befehl „hole letzten N“ / „/fetch N“ erlauben. Default: true. |
| **ENABLE_AUTO_EXECUTE** | Empfangene Befehle ausführen. false = nur anzeigen, nicht ausführen (Kill-Switch). Default: true. |
| **ENABLE_UI** | Optionale Offline-Web-UI für Config/Log. Default: false. |
| **UI_PORT** | Port der lokalen UI. Default: 3341. |
| **ENABLE_MONITOR** | Bei ROLE=messenger zusätzlich Offline-Monitor im Hintergrund (Heartbeat + Webhook). Default: false. |

---

## Replay & State-Dateien

| Variable | Erklärung |
|----------|-----------|
| **REPLAY_STATE_FILE** | Datei für letzte Nonce pro Sender (Replay-Schutz Lock). Leer = nur in-memory (kein Schutz nach Neustart). |
| **PAYMENT_TRIGGER_STATE_FILE** | Datei für bereits verarbeitete Zahlungs-TX-Digests. Leer = nur in-memory. |

---

## Listener & Auto-Befehle (Schutz)

| Variable | Erklärung |
|----------|-----------|
| **AUTHORIZED_SENDERS** | Kommagetrennte Adressen, die Auto-Befehle auslösen dürfen. Leer = keine Zusatz-Whitelist (Lock: AccessKey bleibt Pflicht). |
| **MAX_SEND_AMOUNT_IOTA** | Max. Betrag (IOTA) pro Auto-Befehl „sende X coins“ (vorbereitet). Leer = kein Limit. |

---

## Zahlungs-Trigger (Lock)

| Variable | Erklärung |
|----------|-----------|
| **PAYMENT_TRIGGER_ENABLED** | Bei Zahlung an Lock-Adresse OPEN_COMMAND/OPEN_URL auslösen (z. B. Ladesäule). Default: false. |
| **PAYMENT_TRIGGER_MIN_IOTA** | Mindestbetrag in IOTA (z. B. 0.001). Nur dann Aktion. Leer = jede Zahlung. |
| **PAYMENT_TRIGGER_POLL_MS** | Pause zwischen Zahlungs-Prüfungen (ms). Min. 1000. Default: 15000. |

---

## Hardware bei OPEN (Lock)

| Variable | Erklärung |
|----------|-----------|
| **OPEN_COMMAND** | Befehl bei OPEN (z. B. `node relay-on.js`). Wird per spawn ohne Shell ausgeführt. OPEN_SENDER gesetzt. |
| **OPEN_URL** | HTTP-URL (GET) bei OPEN, z. B. Smart-Lock-Webhook. Nur aus .env, nicht aus Nutzerinput. |
| **OPEN_COMMAND_WORDS** | Kommagetrennte Wörter, die „Tür öffnen“ auslösen (Kleinbuchstaben). Default: open,öffnen. Genutzt, wenn weder On-Chain noch AES-Datei. |
| **OPEN_COMMAND_LIST_FILE** | AES-verschlüsselte Datei mit Öffnen-Wörtern (Priorität 2). Format: 12 Byte IV + AES-256-GCM. |
| **OPEN_COMMAND_LIST_KEY** | 32-Byte-Key als Hex (64 Zeichen) für OPEN_COMMAND_LIST_FILE. |
| **COMMAND_REGISTRY_ID** | On-Chain-Befehlsliste (Priorität 1). Aus create_globals / create_command_registry. |

---

## Streams (letzte Meile, optional)

| Variable | Erklärung |
|----------|-----------|
| **OPEN_STREAMS_ENABLED** | Bei OPEN GRANTED zusätzlich Nachricht auf Streams-Kanal senden. Default: false. Siehe docs/STREAMS-INTEGRATION.md. |
| **STREAMS_LISTEN_ENABLED** | Lock empfängt „open“ auch von Streams (zusätzlich zu Rebased). Default: false. Bei Ausfall: Fallback auf Rebased. |
| **STREAMS_ANCHOR_ID** | Anchor-ID des Streams-Kanals. Für OPEN_STREAMS_ENABLED (Ausgabe) und STREAMS_LISTEN_ENABLED (Empfang). |
| **STREAMS_BRIDGE_URL** | HTTP-Bridge für Streams (z. B. LoRa-Bridge: `http://localhost:9342`). Leer = Stub. |
| **STREAMS_TOPIC** | Topic/Branch (optional, API-abhängig). |

---

## Signer

| Variable | Erklärung |
|----------|-----------|
| **SIGNER** | `cli` = IOTA-CLI (lokal). `remote` = Boss-Service signiert. `sdk` = Mnemonic im Prozess (keine CLI nötig). Default: cli. **PWA / Android / Browser-Entsperr-UI:** `sdk` nötig, damit das Mnemonic-Feld erscheint. |
| **REMOTE_SIGNER_URL** | URL des Boss-Signer-Services (POST /sign). Nur bei SIGNER=remote. |
| **REMOTE_SIGNER_TOKEN** | Optionaler Bearer-Token für REMOTE_SIGNER_URL. |
| **WALLET_DERIVATION_PATH** | Ableitungspfad für Mnemonic (nur bei SIGNER=sdk). Leer = Default (z. B. m/44'/4218'/0'/0'/0'). |

---

## Gas

| Variable | Erklärung |
|----------|-----------|
| **GAS_BUDGET** | Gas-Budget pro Transaktion. Default: 10000000. |

---

## Messenger: Self-Pay (Zielbild, wenn implementiert)

| Variable | Erklärung |
|----------|-----------|
| **ENABLE_MESSENGER_SELF_PAY** | Wenn **`true`**: bei **Credits = 0** und vorhandenem **MIST** darf der Client (sofern technisch umgesetzt) mit **Eigen-Gas** senden statt Sponsoring. **`false`** (Default): kein stiller Verbrauch von Nutzer-MIST — Senden bleibt blockiert bis Credits/Aufladung. Siehe **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`**. **Ist-Code:** Variable ist **Vorbereitung**; Auswertung folgt mit Self-Pay-Implementierung. |

---

## Optionale verschlüsselte Env

| Variable | Erklärung |
|----------|-----------|
| **ENCRYPTED_ENV_FILE** | Pfad zu verschlüsselter Secrets-Datei. App mit `npm run start:secrets` starten. Sensible Werte nicht in .env. |

---

## Betrieb: externe Secret-Manager (Doppler & Co.)

| Thema | Erklärung |
|-------|-----------|
| **Kein eigener Env-Key** | Tools wie **Doppler** setzen Standard-Variablen (`SPONSOR_GAS_PASSWORD`, …) per CLI vor dem Start — siehe **`docs/SECRETS-OPTIONS.md`** (Option C) und **`deploy/README-DEPLOY-BUNDLES.md`** (Hinweis Produktion). |
