# Morgendrot – .env – alles ganz einfach erklärt

Die Datei **.env** ist wie die „Einstellungszentrale“ von Morgendrot: Hier trägst du ein, wer du bist, wo die Blockchain wohnt, ob du Schloss oder Chat bist, und vieles mehr. Alles in einfachen Worten – wie für einen Freund.

**Nur Messenger-PWA (Einstellungen → Erweiterte Konfiguration):** vollständige Key-Liste und Tabellen — **`docs/ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md`** (Handbuch: `/handbook?file=ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md`). Dieses Dokument hier deckt zusätzlich Lock, Shop, Monitor und weitere Projekt-Keys ab.

**Wichtig: Nach jeder Änderung in der .env die Änderung speichern und das Programm neu starten!**

**Erste `.env` im Repo:** Nach **`npm install`** wird automatisch eine **`.env`** aus **`.env.example`** erstellt, **wenn noch keine** existiert (Skript `scripts/ensure-env.mjs`). Du musst `.env.example` nicht mehr manuell kopieren.

**Du musst nicht alles setzen – nimm nur, was du für dein Projekt brauchst.** Fang mit „Wer bin ich?“ (MY_ADDRESS, ROLE) und „Internet & Kette“ (RPC_URL, PACKAGE_ID) an.

---

## 🌐 1. Internet & Kette (★ das Erste, was du eintragen musst!)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **RPC_URL** | `https://api.testnet.iota.cafe` | Wo die Blockchain wohnt. **testnet** = Spielwiese (kein echtes Geld). **mainnet** = echtes IOTA. Ohne Angabe: Testnet-Default. |

---

## 🔑 2. Programm & Schubladen (★ einmalig nach dem ersten Start setzen)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **PACKAGE_ID** | `0x7137af6c…` | Die „Hausnummer“ deines Programms auf der Kette. Nach `create_globals` deploy bekommst du sie. Leer → wird aus `.morgendrot-package-id` geladen (z.B. nach `/set-package-id`). |
| **VAULT_REGISTRY_ID** | `0xc4ac51a8…` | Adresse des Vault-Registers (aus `create_globals`-Event). Nötig für On-Chain-Vault: ein Blob pro Adresse, kein Versand an andere (siehe **VAULT-EINRICHTEN.md**). |
| **MAILBOX_ID** | `0xadd744a5…` | Adresse des Briefkastens (aus `create_globals`). Ermöglicht purgbare Nachrichten und Handshakes. Ohne: nur Events (nicht purgbar). |
| **COMMAND_REGISTRY_ID** | `0xa66e55a8…` | Liste für geheime Öffnen-Wörter (aus `create_globals` oder `create_command_registry`). Lock liest von hier, welche Wörter „öffnen“ auslösen. |

---

## 👤 3. Wer bin ich? (★ immer zuerst setzen!)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **MY_ADDRESS** | `0x671bf669…` | Meine Adresse (wie meine Handynummer). Ohne sie funktioniert fast nichts. Bei ROLE=lock = Schloss-Adresse. Bei SIGNER=sdk kann leer sein (wird aus Mnemonic abgeleitet). |
| **ROLE** | `messenger` | Was bin ich gerade? **messenger** = Chat-Mensch, Key-Verwaltung. **lock** = das Schloss selbst (hört auf „open“). **monitor** = nur Zuschauer (Offline-Alarm). **boss** / **kommandant** / **arbeiter** = Hierarchie-Modus (Ameisen). |

---

## 🤝 4. Mit wem rede ich? (Partner & Gruppen)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **PARTNER_ADDRESS** | `0x0748329e…` | Mein Haupt-Gesprächspartner (z.B. das Schloss). Wird automatisch in `.morgendrot-partner` gespeichert bei `/connect` oder Handshake. |
| **PARTNER_ADDRESSES** | `0xabc…,0xdef…` | Mehrere Partner (kommagetrennt). Bei ENABLE_PAIRWISE_GROUPS: jeder mit eigenem Handshake. Teurer, sicherer. |
| **AUTHORIZED_SENDERS** | `0x671b…,0x0748…` | Wer darf mir Befehle geben? (kommagetrennt). Leer = keine Zusatz-Whitelist. Lock prüft zusätzlich AccessKey. |
| **BOSS_ADDRESS** | `0x…` | Boss-Adresse (nur bei Ameisen-Modus). |
| **KOMMANDANT_ADDRESSES** | `0x…,0x…` | Kommandant-Adressen (Ameisen). |
| **WORKER_ADDRESSES** | `0x…,0x…` | Arbeiter-Adressen (Ameisen). |
| **BROADCAST_PINNWAND_ADDRESS** | `0x…` | Adresse der Pinnwand (alle hören hier). Nur bei ENABLE_BROADCAST_PINNWAND. |
| **BROADCAST_AUTHORIZED_SENDERS** | `0x…,0x…` | Nur diese dürfen an die Pinnwand senden. **Pflicht** bei Broadcast. |

**Ameisen-Hierarchie (boss/kommandant/arbeiter):** Wer darf was, steuerst du mit diesen Flags (alle default true). Siehe Tabelle in **M2M-KOORDINATION-EINRICHTEN.md** (Wer darf was?).

| Variable | Default | Bedeutung |
|----------|---------|-----------|
| **ENABLE_COMMAND_DOWN** | `true` | Befehl senden (Boss/Kommandant). |
| **ENABLE_KEY_ISSUE** | `true` | Schlüssel ausstellen (nur Boss). |
| **ENABLE_REVOKE_DOWN** | `true` | Widerruf/Sperren (Boss, Kommandant). |
| **ENABLE_STATUS_READ_DOWN** | `true` | Status von unten lesen. |
| **ENABLE_STATUS_READ_UP** | `true` | Status von oben lesen (Arbeiter/Kommandant). |
| **ENABLE_CONFIG_CHANGE** | `true` | Konfig ändern (nur Boss). |
| **ENABLE_HIERARCHY_CHANGE** | `true` | Hierarchie ändern (nur Boss). |

---

## 🛡️ 5. Wie sicher soll es sein?

| Variable | Default | Was bedeutet das? |
|----------|---------|-------------------|
| **ENABLE_PLAINTEXT_CHANNEL** | `false` | Darf ich auch Klartext senden? **true** = im Explorer sichtbar. Nur für Tests! |
| **ENABLE_PURGE** | `true` | Darf ich alte Daten löschen? **false** = alle Purge-Befehle werden abgelehnt. |
| **ENABLE_REPLAY_PROTECTION** | `true`* | Alte Befehle blockieren? (Nonce pro Sender). *Wenn REPLAY_STATE_FILE gesetzt. |
| **REPLAY_STATE_FILE** | (leer) | Datei für letzte Nonce pro Sender. Leer = nur in-memory (kein Schutz nach Neustart). |
| **USE_ENCRYPTED_DISCOVERY** | `false` | Discovery über verschlüsselte Kanäle (z.B. Streams). Geplant. |

---

## ⚡ 6. Was soll automatisch laufen? (Schalter für Bequemlichkeit)

| Variable | Default | Was bedeutet das? |
|----------|---------|-------------------|
| **ENABLE_LISTENER** | `true` | Auf Nachrichten warten und reagieren? **false** = keine eingehenden Nachrichten, Lock reagiert nicht. **→ Ausschalten für maximale Sicherheit!** |
| **ENABLE_AUTO_EXECUTE** | `true` | Befehle automatisch ausführen? **false** = nur anzeigen, nicht ausführen (Kill-Switch). Lock: „open“ wird nicht ausgeführt. **→ Ausschalten für maximale Sicherheit!** |
| **ENABLE_HARDWARE_OPEN** | `true`* | Relais / Web-Link bei „open“ aufrufen? **false** = nur Log, keine Aktion. *Wenn OPEN_COMMAND oder OPEN_URL gesetzt. **→ Ausschalten wenn nur Chat/Status!** |
| **ENABLE_FILE_LOGGING** | `true` | Alles in eine Log-Datei schreiben? **false** = nur Konsole. |
| **ENABLE_FETCH_COMMAND** | `true` | Befehl „hole letzten N“ / `/fetch N“ erlauben. |
| **FETCH_LAST_ON_START** | `0` | Beim Start (nach /connect) die letzten N Nachrichten holen. 0 = aus. Für Maschinen z.B. 20. |
| **USE_MAILBOX** | `true`* | Purgebare Nachrichten (Mailbox statt nur Events). *Wenn MAILBOX_ID gesetzt. |
| **MAX_SEND_AMOUNT_IOTA** | (leer) | Max. IOTA pro Sendung (zukünftig). Leer = kein Limit. |

---

## ⏱️ 7. Wie schnell & wie lange? (Zeit-Einstellungen)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **DEFAULT_TTL_DAYS** | `30` | Nachrichten / Vault leben X Tage (danach purgebar). |
| **DEFAULT_KEY_TTL_DAYS** | `30` | Standard-Gültigkeit für AccessKey-NFTs (Tage). `/create-key` nutzt dies, wenn kein ttl angegeben. |
| **LISTENER_POLL_MS** | `5000` | Alle X Millisekunden die Kette anschauen (5000 = 5 Sekunden). Min. 1000. |
| **HANDSHAKE_REFRESH_MS** | `5000` | Handshake-Update-Intervall (ms). |
| **LOCK_COMMAND_POLL_MS** | `3000` | Lock: Abstand für Befehls-Poll (ms). |
| **LOCK_PEER_REFRESH_MS** | `15000` | Lock: Abstand für Peer-Update (ms). |
| **HEARTBEAT_INTERVAL_MS** | `600000` | Alle X ms „Ich bin noch da“ melden (600000 = 10 Min). |
| **PAYMENT_TRIGGER_POLL_MS** | `15000` | Abstand Zahlungs-Prüfungen (ms). |
| **MONITOR_OFFLINE_TIMEOUT_MS** | `1800000` | Timeout bis Offline-Alarm (30 Min). |
| **MONITOR_CHECK_INTERVAL_MS** | `300000` | Abstand Offline-Prüfungen (5 Min). |
| **ANCHOR_INTERVAL_MS** | `86400000` | Abstand zwischen Chain-Anchors (24h). |

---

## 🔧 8. Tür & Hardware (physische Aktionen)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **LOCK_ID** | `0x…` | Adresse meines Schlosses (meist = MY_ADDRESS bei ROLE=lock). |
| **OPEN_COMMAND** | `node relay-on.js` | Was soll passieren bei „open“? (z.B. Relais-Skript). Wird per spawn ohne Shell ausgeführt. **Nur in .env setzen, nicht per UI!** |
| **OPEN_URL** | `http://192.168.1.123/open` | Web-Link, der bei „open“ aufgerufen wird (z.B. Smart-Lock). **Nur in .env setzen!** |
| **OPEN_COMMAND_WORDS** | `open,öffnen` | Wörter die „öffnen“ auslösen (kommagetrennt, Kleinbuchstaben). Default: open,öffnen. |
| **OPEN_COMMAND_LIST_FILE** | (leer) | AES-Datei mit Öffnen-Wörtern (Priorität vor .env). |
| **OPEN_COMMAND_LIST_KEY** | (64 Hex) | 32-Byte-Key für AES-Datei. |
| **OFFLINE_OPEN_ENABLED** | `false` | OPEN mit gecachtem AccessKey erlauben (ohne Internet). |
| **OFFLINE_CACHE_TTL_MS** | `86400000` | Gültigkeit AccessKey-Cache (24h). |
| **OFFLINE_QUEUE_FILE** | (leer) | Datei für Offline-Befehls-Queue. |

**Mehr dazu:** Was „offline“ bedeutet und welche Möglichkeiten es gibt (Cache, Queue, Streams, LoRa), steht in **OFFLINE-FAEHIGKEIT.md**.

---

## 🌐 9. Streams (schneller, geheimer Zusatzkanal – optional)

**Alles mit einem Befehl starten (App + Streams-Mock):** `npm run start:with-streams` – startet die App und die Mock-Bridge (Port 9343). In der .env dann z. B. `STREAMS_BRIDGE_URL=http://127.0.0.1:9343` setzen.

| Variable | Default | Was bedeutet das? |
|----------|---------|-------------------|
| **OPEN_STREAMS_ENABLED** | `false` | Bei „open“ auch Streams nutzen? (schneller & günstiger). Sendet Status nach OPEN GRANTED. |
| **STREAMS_LISTEN_ENABLED** | `false` | Lock empfängt „open“ auch von Streams (zusätzlich zu Rebased). Bei Ausfall: Fallback auf Rebased. |
| **STREAMS_ANCHOR_ID** | (leer) | ID des Streams-Kanals (wenn aktiviert). |
| **STREAMS_BRIDGE_URL** | (leer) | HTTP-Bridge (z.B. Mock: `http://127.0.0.1:9343` nach `npm run start:with-streams`). Leer = Stub. |
| **STREAMS_TOPIC** | (leer) | Streams-Topic (optional). |

**Was passiert bei true vs. false (Streams)?**

| Flag | Was passiert bei „open“-Befehl? | Streams wird gesendet? | Rebased wird genutzt? | Fallback bei Streams-Ausfall? |
|------|--------------------------------|------------------------|------------------------|-------------------------------|
| **false** (Default) | Nur Rebased + Hardware (Relais/URL) | Nein | Ja (Hauptweg) | – |
| **true** | Rebased + Hardware + zusätzlich Streams | Ja (zusätzlich) | Ja (Hauptweg) | Ja – fällt automatisch auf Rebased zurück |

---

## 💳 10. Zahlung & Trigger (z.B. Ladesäule)

| Variable | Default | Was bedeutet das? |
|----------|---------|-------------------|
| **PAYMENT_TRIGGER_ENABLED** | `false` | Bei Zahlung an Lock-Adresse OPEN auslösen? |
| **PAYMENT_TRIGGER_MIN_IOTA** | (leer) | Mindestbetrag (IOTA, z.B. `0.001`). Leer = jede Zahlung. |
| **PAYMENT_TRIGGER_REQUIRE_MEMO** | (leer) | Memo muss Code enthalten (Substring). Leer = keine Prüfung. |
| **PAYMENT_TRIGGER_STATE_FILE** | (leer) | Datei für verarbeitete TX (Replay-Schutz). |

---

## 📂 11. Dateien, Signer & UI

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **VAULT_FILE** | `.morgendrot-vault` | Eine Datei: verschlüsselter Tresor für ECDH-Keys und optional Streams Anchor-ID (siehe **VAULT-EINRICHTEN.md**). Leer = Vault aus. |
| **REPLAY_STATE_FILE** | `.morgendrot-replay-state` | Alte Nummern speichern (gegen Wiederholung). |
| **GAS_BUDGET** | `10000000` | Wie viel Gas pro Befehl (meist ok so lassen). |
| **SPONSOR_GAS_OWNER** | `0x…` | Adresse, die Gas übernimmt (z. B. Boss). Mit SPONSORED_TRANSACTION_ENABLED=true und (bei use_ticket) **SPONSOR_GAS_PASSWORD** zahlt der Sponsor das Gas. |
| **SPONSOR_GAS_PASSWORD** | (leer) | Passwort des Sponsor-Wallets. Für **Wärter:** Boss zahlt Gas bei `/use-ticket`, wenn Wärter SPONSOR_GAS_OWNER=Boss und SPONSOR_GAS_PASSWORD=Boss-Passwort setzt. **Nur in .env setzen!** |
| **SPONSORED_TRANSACTION_ENABLED** | `false` | Sponsored Transactions erlauben (create-key, use-ticket etc.). |
| **SIGNER** | `cli` | **cli** = IOTA-CLI (lokal). **remote** = Boss-Service signiert. **sdk** = Mnemonic im Prozess (keine CLI nötig). **Handy/PWA mit Seed im Browser:** `sdk` setzen, sonst kein Mnemonic-Feld. |
| **REMOTE_SIGNER_URL** | `https://boss.example:3340/sign` | URL des Boss-Signer-Services. Nur bei SIGNER=remote. |
| **REMOTE_SIGNER_TOKEN** | (leer) | Bearer-Token für REMOTE_SIGNER_URL. **Nur in .env setzen!** |
| **WALLET_DERIVATION_PATH** | (leer) | Ableitungspfad (nur bei SIGNER=sdk). Leer = Default. |
| **ENABLE_UI** | `false` | Web-Oberfläche im Browser starten? |
| **UI_PORT** | `3341` | Auf welchem Port die Web-Seite läuft (localhost:3341). |
| **API_PORT** | `3342` | Port der API (Befehle, Status). |

---

## 📊 12. Monitoring & Wartung

| Variable | Default | Was bedeutet das? |
|----------|---------|-------------------|
| **ENABLE_HEARTBEAT** | `false` | Lock sendet Heartbeat via Streams („ich bin online“). |
| **ENABLE_MONITOR** | `false` | Bei ROLE=messenger zusätzlich Offline-Monitor (Heartbeat + Webhook) im Hintergrund. So kannst du Messenger und Monitor in einer Instanz nutzen. |
| **MONITOR_DEVICES** | (leer) | Geräte-Adressen für Offline-Monitor (kommagetrennt). Für ROLE=monitor oder ENABLE_MONITOR=true. Die Meldung „Monitor aktiv: N Gerät(e)“ kommt von der Anzahl Einträge hier (z. B. zwei Adressen → „2 Gerät(e)“). Zum Ändern: .env bearbeiten oder in der Lite-UI unter „Monitor“ → MONITOR_DEVICES setzen. |
| **MONITOR_STATE_FILE** | (leer) | Datei für letzten Heartbeat pro Gerät. |
| **MONITOR_ALARM_WEBHOOK_URL** | (leer) | Webhook bei Offline-Alarm. **Nur in .env setzen!** |
| **ENABLE_CHAIN_ANCHOR** | `false` | Zustands-Hash on-chain anker. |
| **ENABLE_FILE_LOGGING** | `true` | Logs in Dateien schreiben. |
| **LOG_VERBOSE** | `false` | Ausführliche Logs. |
| **LOG_MAX_FILES** | `7` | Max. Log-Dateien (Rotation). |
| **LOG_MAX_SIZE** | `20m` | Max. Größe pro Log-Datei. |

---

## 🛑 Was genau passiert bei true vs. false? (Sicherheits-Schalter)

| Flag | Was passiert bei „open“-Befehl? | Risiko | Wann empfohlen? |
|------|--------------------------------|--------|-----------------|
| **ENABLE_AUTO_EXECUTE=false** | Listener zeigt Nachrichten nur noch an – führt aber nichts aus | **0** | Immer, wenn maximale Sicherheit (Produktion, echtes Schloss) |
| **ENABLE_LISTENER=false** | Kein Empfang mehr – Instanz hört gar nichts | **0** | Wenn nur zum Senden genutzt (z.B. nur als „Schlüssel“ ohne Rückkanal) |
| **ENABLE_HARDWARE_OPEN=false** | OPEN_COMMAND/OPEN_URL wird nicht ausgeführt | **Sehr niedrig** | Wenn nur Chat/Status, keine physischen Aktionen |

**Um die Gefahr auf null zu bringen, reicht es, eine dieser drei Dinge zu deaktivieren.**

---

## 📖 Weitere Infos

- **docs/ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md** – **Hauptreferenz** alle Keys in Messenger-Einstellungen (77 Keys, kategorisiert)
- **docs/CONFIG-REFERENCE.md** – technische Referenz
- **docs/STREAMS-INTEGRATION.md** – Streams letzte Meile, Ablauf, Fallback
- **.env.example** – alle Variablen mit Defaults
