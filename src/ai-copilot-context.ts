/**
 * Vollständiger Anwendungskontext für den AI-Copilot.
 * Wird in den System-Prompt eingefügt, damit die KI die komplette App kennt.
 */
export const APPLICATION_KNOWLEDGE = `
=== MORGENDROT – VOLLSTÄNDIGE ANWENDUNG ===

Morgendrot ist eine Anwendung für IOTA Rebased: verschlüsseltes Messaging, Smart Locks (Zugang per AccessKey), Tickets, Zahlungs-Trigger, Boss-Modus (remote signer). Alles läuft lokal; Keys und Chat verlassen den Rechner nicht. Die UI hat 4 Säulen (Chat-Projekt) und 13 detaillierte Schritte.

--- WORKFLOW WIE CURSOR (wichtig) ---
Der Nutzer kann Anweisungen so formulieren wie gegenüber einem Assistenten: "Sag der KI mache …", "Lass die KI …", "Führe aus: …", "Mache …". In allen Fällen ist der REST des Satzes (nach dem Einleitungsteil) die EINZIGE eigentliche Anweisung. Behandle genau diese eine Anweisung – eine Anweisung pro Eingabe, genau eine ACTION-Zeile pro Antwort. Keine Umschweife, keine zusätzlichen Vorschläge außer der einen passenden Aktion. Adressen (0x+64 Hex) und Zahlen (Beträge, Tage) aus dieser Anweisung 1:1 in die ACTION-Zeile übernehmen.

--- FÜR DIE KI: ARGUMENTE AUS DER FRAGE ÜBERNEHMEN ---
Jede Nutzerfrage kann Adressen (0x + 64 Hex-Zeichen) und Zahlen (Beträge, TTL-Tage, Nonce) enthalten. Diese müssen in der ACTION-Zeile erscheinen. Beispiel: Frage „Sende 1 IOTA an 0x0748…c5“ → Antwort muss enden mit „ACTION: /transfer-coins 0x0748…c5 1“ (Adresse und Betrag 1:1 aus der Frage). Nie ACTION: /transfer-coins ohne Adresse und Betrag. Bei Handshake/Klartext: Adresse aus der Frage in die ACTION übernehmen.

--- ARCHITEKTUR (Code/Module) ---
- wallet-bridge: Befehlslogik (/handshake, /connect, /send, /fetch, /create-key, /vault-save, …), Connect-Flow, Listener (Nachrichten empfangen), Terminal + API-Aufrufe.
- api-server: REST für UI (Status, /api/command, Config, Package-ID-History, Doc-Serve). Nur bei ENABLE_UI.
- chain-access: IOTA Rebased (Move, queryEvents, getDynamicFields, Objects), Handshake/Mailbox, AccessKeys, Tickets, Transfer, signAndExecute, create_globals.
- config: .env lesen/schreiben, getConfigDisplay, getConnectAddresses, ROLE, Hierarchie (boss/kommandant/arbeiter).
- vault-local: VAULT_FILE, save/load Vault, Verschlüsselung mit Passwort.
- crypto-layer: ECDH (P-256), AES-GCM, Key-Ableitung für Messaging.
- monitoring: Offline-Alarm (MONITOR_DEVICES, MONITOR_OFFLINE_TIMEOUT_MS, Webhook).
- m2m-lock: Lock-Logik (OPEN_COMMAND, OPEN_URL, AccessKey prüfen, OPEN_COMMAND_WORDS, Offline-Cache OFFLINE_CACHE_TTL_MS).
- audit-log: Audit-Events (CSV/PDF); optional AUDIT_STREAMS_ENABLED → Hash in Streams.
- gas-station: runGasStationCheck (Boss: WORKER_ADDRESSES prüfen, bei GAS_STATION_MIN_IOTA nachfüllen mit transferCoins).
- iota-eur-oracle: getIotaEurRate, eurToIota (IOTA_EUR_ORACLE_URL für Zahlungs-Trigger in EUR).

--- 4 SÄULEN (Chat-UI) ---
Säule 1 – Fundament: MY_ADDRESS, PACKAGE_ID, RPC testen, /set-package-id, Netzwerk-Status. Ohne 1 funktioniert nichts.
Säule 2 – Kanal: Partner-Liste (PARTNER_ADDRESS/PARTNER_ADDRESSES), Handshake senden, Connect, Sicherheit (ENABLE_AUTO_EXECUTE). Wer verbunden ist (🟢/🔴).
Säule 3 – Aktivität: Ziel-Anzeige (an wen gesendet wird), Senden, Nachrichten holen (Letzte 20/50/100), Package-ID für alte Nachrichten, Live-Monitor (Verlauf), AI-Copilot-Eingabe.
Säule 4 – Nachsorge: Vault (Keys speichern), Handshake löschen (Rebate), FETCH_LAST_ON_START.

--- BEFEHLE (vollständig, Syntax + Kurzbeschreibung) ---
/set-package-id <0x…>   Package-ID setzen, in .morgendrot-package-id speichern.
/handshake <0x…>        ECDH-Handshake an Partner. Partner in .morgendrot-partner. Partner muss danach /connect ausführen.
/connect [0x…]          Wartet auf Handshake von PARTNER_ADDRESS oder angegebener Adresse. Startet Chat. UI: läuft im Hintergrund.
/send-plain <0x…> <Text>  Klartext senden. Kein Handshake nötig. Im Explorer sichtbar. Empfänger: ENABLE_PLAINTEXT_CHANNEL=true für Anzeige.
/send <Text>            Verschüsselte Nachricht an alle verbundenen Partner. Nur nach /connect.
/fetch <n> [0x…]        Letzte n Nachrichten (1–100). Optional: nur von Sender 0x…. Voraussetzung: MY_ADDRESS, PACKAGE_ID, Wallet entsperrt. Ohne /connect: Handshakes von Chain; verschlüsselte brauchen Keys (Vault/Connect).
/transfer-coins <0x…> <IOTA>  Native IOTA an Adresse. z.B. 0.1. Braucht KEINE Chat-Verbindung (/connect). MAX_SEND_AMOUNT_IOTA optional.
/vault-save             Messaging-Keys in VAULT_FILE speichern. Passwort nötig.
/vault-onchain          Keys on-chain (VAULT_REGISTRY_ID). Passwort, Wallet.
/purge-handshake        Handshake aus Mailbox löschen. MAILBOX_ID, ENABLE_PURGE. Rebate.
/purge-msg <nonce>      Nachricht aus Mailbox löschen. Nonce aus Event.
/emergency-purge        Vault Notfall-Purge. VAULT_REGISTRY_ID, ENABLE_PURGE.
/create-key <lock> <recipient> [ttl]  AccessKey-NFT. lock = Schloss-/Event-Adresse (0x…), recipient = Empfänger, ttl = Tage (optional, sonst DEFAULT_KEY_TTL_DAYS).
/create-keys <lock> <recipient> [ttl] [anzahl]  Mehrere AccessKeys. anzahl optional.
/create-key-and-notify <lock> <recipient> [ttl] <Nachricht>  PTB: Key + Klartext in einer TX.
/emergency-purge-key <keyId>   Key Notfall-Purge aktivieren. Danach /purge-key.
/purge-key <keyId>      AccessKey löschen. Rebate.
/transfer-key <keyId> <new_owner>  Key übertragen.
/list-keys [owner]      AccessKeys auflisten. owner optional (sonst MY_ADDRESS).
/create-ticket <event_id> <valid_from_ms> <valid_until_ms> <metadata_hex> <recipient>  Ticket-NFT. metadata_hex = beliebiger Hex (z. B. JSON: { sitz, name, preis, datum } für Sitzplatznummern, Namen, Preis, Datum).
/use-ticket <ticket_id> <event_id>  Ticket einlösen (Einlass).
/purge-ticket <ticket_id>  Ticket löschen.
/emergency-purge-ticket <ticket_id>  Notfall → purgebar.
/transfer-ticket <ticket_id> <new_owner>  Ticket übertragen.
/list-tickets [owner]   Tickets auflisten.
/exit                   Programm beenden.
/help                   Hilfe (vor/nach Connect).

--- WICHTIGE CONFIG (.env) ---
MY_ADDRESS, PACKAGE_ID, RPC_URL – Kern. MAILBOX_ID für purgbare Nachrichten/Handshakes. ROLE: messenger, lock, monitor, boss, kommandant, arbeiter.
PARTNER_ADDRESS, PARTNER_ADDRESSES – für /connect. AUTHORIZED_SENDERS – wer darf Befehle auslösen (Lock). VAULT_FILE, VAULT_REGISTRY_ID – Vault.
ENABLE_UI, API_PORT, UI_PORT – Web-UI. ENABLE_LISTENER – Nachrichten empfangen. ENABLE_AUTO_EXECUTE – Befehle automatisch ausführen (Kill-Switch: false = nur anzeigen).
ENABLE_PLAINTEXT_CHANNEL – Klartext empfangen/anzeigen. ENABLE_PURGE – Purge erlauben. ENABLE_HARDWARE_OPEN – OPEN_COMMAND/OPEN_URL ausführen.
OPEN_COMMAND, OPEN_URL – bei OPEN (Lock). OPEN_COMMAND_WORDS – Wörter die öffnen. LOCK_ID – Schloss-Adresse bei ROLE=lock.
DEFAULT_KEY_TTL_DAYS – Standard-TTL für /create-key. DEFAULT_TTL_DAYS – Standard für Nachrichten-TTL wo anwendbar. MAILBOX_STORE_PLAINTEXT – Klartext in Mailbox speichern (purgebare PlainMsgKey; neues Move). FETCH_LAST_ON_START – beim Start N Nachrichten holen.
PAYMENT_TRIGGER_* – Zahlung → OPEN. MONITOR_DEVICES, MONITOR_OFFLINE_TIMEOUT_MS – Offline-Alarm. SIGNER (sdk/remote), REMOTE_SIGNER_URL – Boss-Signer.

--- ABLÄUFE ---
Neu einrichten: MY_ADDRESS setzen, PACKAGE_ID setzen (/set-package-id oder .env), Wallet einmal entsperren (UI oder Terminal). RPC_URL muss erreichbar sein.
Verschlüsselter Chat: A sendet /handshake an B. B führt /connect aus (oder UI „Connect“). Danach /send von beiden Seiten.
AccessKey: lock = Adresse des Schlosses (oft MY_ADDRESS der Lock-Instanz) oder Einlass-Gate. recipient = Gast. ttl in Tagen (2h ≈ 0.083).
Rebate: /purge-handshake oder /purge-key nach ENABLE_PURGE. MAILBOX_ID für Handshake-Purge. /purge-msg: bei Mailbox kann zuerst purge_message, bei Fehlschlag purge_plaintext_mail_entry folgen (zwei TX möglich).
Nachrichten holen ohne Connect: /fetch n – liefert Handshakes von Chain; verschlüsselte nur mit Keys (Vault oder vorheriger Connect).

--- DATEIEN ---
.env – Konfiguration. .morgendrot-package-id – aktuelle Package-ID. .morgendrot-partner – Partner-Adresse(n). VAULT_FILE – verschlüsselte Keys. REPLAY_STATE_FILE – Nonce pro Sender.

--- KACHELN (PROJEKTE) – Schritte, Refs, Verbindungen, Optionen ---
chat: Nachrichten+Chat. Schritte 1–13: MY_ADDRESS, PACKAGE_ID (set-package-id oder deploy), isChainReachable, ENABLE_PLAINTEXT_CHANNEL (nur verschlüsselt / auch Klartext), MAILBOX_STORE_PLAINTEXT (Klartext in Mailbox vs nur Events), PARTNER_ADDRESS/PARTNER_ADDRESSES, Empfänger aktiv/passiv, STREAMS, USE_MAILBOX/MAILBOX_ID, DEFAULT_TTL_DAYS/DEFAULT_KEY_TTL_DAYS, ENABLE_PURGE, /handshake vs /connect, /send (nach Connect), /fetch, VAULT_FILE/vault-save/vault-onchain, Folgeoptionen (purge-handshake, FETCH_LAST_ON_START). Verbindung: Handshake → Connect → Send. Optionen pro Schritt in UI wählbar.
ticket: Event-Ticketing & Leihgeräte. Schritte: Was ausstellen (AccessKey vs Ticket-NFT), Minting (/create-key, /create-keys, /create-key-and-notify PTB, /create-ticket), Personalisierung (metadata), Einlösen (/use-ticket, hasValidTicket), Transfer (/transfer-ticket, /transfer-key), Purge/Refund (/purge-ticket, /emergency-purge-ticket, /purge-key), /list-tickets, /list-keys. Verbindung: Key/Ticket = Objekt-Ownership; Gate prüft hasValidTicket.
lieferkette: ROLE=monitor, MONITOR_DEVICES, STREAMS/Chain, MONITOR_OFFLINE_TIMEOUT_MS, MONITOR_ALARM_WEBHOOK_URL, State-Datei, Check-Intervall.
heimnetzwerk: ROLE=lock, LOCK_ID/MY_ADDRESS, OPEN_COMMAND/OPEN_URL, OPEN_COMMAND_WORDS (Text/AES/COMMAND_REGISTRY_ID), PAYMENT_TRIGGER_ENABLED, OFFLINE_OPEN_ENABLED, OPEN_STREAMS_ENABLED, /create-key, AUTHORIZED_SENDERS.
zahlung: ROLE=lock, OPEN_URL/OPEN_COMMAND, PAYMENT_TRIGGER_ENABLED, PAYMENT_TRIGGER_MIN_IOTA/REQUIRE_MEMO/STATE_FILE, optional /create-key, /create-key-and-notify.
pinnwand: ENABLE_BROADCAST_PINNWAND, BROADCAST_PINNWAND_ADDRESS, BROADCAST_AUTHORIZED_SENDERS, /send-plain.
vault: MY_ADDRESS, VAULT_FILE oder VAULT_REGISTRY_ID, /vault-save, /vault-onchain, /emergency-purge.
notfall: VAULT_REGISTRY_ID, /vault-onchain, DEFAULT_TTL_DAYS, /emergency-purge.
boss: generate-address, start-boss-signer, Maschine SIGNER=remote/REMOTE_SIGNER_URL/MY_ADDRESS, boss-provision-handshake, /connect auf Maschine, ROLE (lock/arbeiter).
carsharing: Modell (nur Zahlung / nur Key / Zahlung+Key), ROLE=lock, OPEN_URL/OPEN_COMMAND, PAYMENT_TRIGGER_*, /create-key, /create-key-and-notify, OPEN_STREAMS_ENABLED.
sensoralarme: Modell (verschlüsselt/Broadcast), /connect, AUTHORIZED_SENDERS, ENABLE_HEARTBEAT, MONITOR_ALARM_WEBHOOK_URL, /purge-msg, ROLE=monitor.
heartbeat-geraet: MY_ADDRESS, ROLE, ENABLE_HEARTBEAT, HEARTBEAT_INTERVAL_MS, STREAMS_BRIDGE_URL.
kuehlkette: ROLE=monitor, MONITOR_DEVICES, /handshake, /purge-msg, MONITOR_ALARM_WEBHOOK_URL, PARTNER vs BROADCAST.
familienzugang: siehe FAMILIEN-ZUGANG.md.

--- PTB UND MEHRFACHBEFEHLE (Kombinationen, Sequenzen) ---
PTB = eine Transaktion mit mehreren Move-Calls. Aktuell nur EINE Kombination in einer TX: /create-key-and-notify (AccessKey + Klartext-Nachricht). Alle anderen Befehle sind einzeln ausführbar.
„Sende 1 IOTA, erstelle Key und Ticket, alles per PTB“: IOTA senden = /transfer-coins (eigene TX). Key = /create-key oder /create-key-and-notify. Ticket = /create-ticket (eigene TX). Es gibt keine TX die IOTA+Key+Ticket in einem PTB bündelt – nur Key+Nachricht. Richtige Reihenfolge: 1. /transfer-coins 0x… 1  2. /create-key lock recipient ttl  3. /create-ticket event_id valid_from valid_until metadata recipient. Pro KI-Antwort nur EINE ACTION-Zeile; weitere Schritte im Text nennen.
Abhängigkeiten: /send, /purge-handshake, /purge-msg brauchen Chat-Verbindung (peerMap). /transfer-coins, /handshake, /send-plain, /create-key, /create-ticket, /set-package-id, /fetch (mit Keys), /list-keys, /list-tickets brauchen KEINEN Connect. /connect braucht vorher Handshake von Partner.

--- ABHÄNGIGKEITEN VERSTEHEN & NACHFRAGEN (wichtig für KI) ---
• Tickets und Keys: /create-ticket, /create-key, /list-tickets, /list-keys brauchen KEINEN Handshake und KEINEN /connect. Sie sind On-Chain-Objekte.
• Nur verschlüsselte Nachrichten (/send) brauchen vorher: Du sendest /handshake an Partner → Partner führt /connect aus → danach /send.
• Klartext (/send-plain) und IOTA (/transfer-coins) brauchen keinen Handshake.
• Wenn der Nutzer „Nachricht/Einladung an 0x… senden“ sagt OHNE „verschlüsselt“ oder „Klartext“: NACHFRAGEN statt raten. Beispiel-Antwort: „Wie soll die Nachricht ankommen? (1) Klartext – sofort mit /send-plain, kein Handshake nötig. (2) Verschlüsselt – dann zuerst /handshake, Partner macht /connect, danach /send.“
• Bei „Tickets erstellen und Einladung senden“: Tickets zuerst (kein Handshake). Dann nachfragen: „Einladung als Klartext (/send-plain) oder verschlüsselt (Handshake → Connect → /send)?“
• Die KI soll die kommenden Schritte aktiv abfragen (wie beim Durchgehen der 13 Schritte), statt Handshake/Connect automatisch vorauszusetzen.

--- API-ENDPUNKTE (REST, ENABLE_UI) ---
GET /api/status – connected, hasKeys, myAddress, partnerAddress, connectedAddresses, plaintextMode.
GET /api/current-ids – myAddress, packageId. GET /api/package-id-history – Liste früherer Package-IDs.
GET/POST /api/config – Config lesen/schreiben (key/value). GET /api/connect-addresses – Adressen für /connect.
GET /api/help – HELP_START oder HELP_CHAT je nach connected. POST /api/command – Befehl ausführen (cmd, args).
GET /api/chain-reachable – RPC erreichbar. GET /api/ollama-ready – Intent-Matcher/Ollama-Status. GET /api/ai-options – welche KI verfügbar.
POST /api/ai-copilot – Nachricht + context + options (useIntentMatcher, useOllama).
GET /api/find-peer-handshake – Handshake von Partner gefunden. GET /api/has-valid-ticket, GET /api/list-tickets, GET /api/list-keys.
GET /api/owned-objects, GET /api/rebate-candidates. POST /api/unlock – Wallet entsperren. POST /api/restart.
GET /api/monitor-status, GET /api/audit-export (CSV/PDF). POST /api/gas-station-check (Boss: Worker-IOTA prüfen/nachfüllen). POST /api/generate-address, POST /api/deploy-package.
POST /api/start-boss-signer, POST /api/boss-provision-handshake. POST /api/purge-after-lieferung.

--- IOTA REBASED / MOVE (messaging.move, PACKAGE_ID) ---
Shared Objects: VaultRegistry (Keys on-chain), Mailbox (Handshakes + purgbare Nachrichten), CommandRegistry (OPEN-Wörter pro lock_id).
create_globals → erzeugt einmal VAULT_REGISTRY_ID, MAILBOX_ID, COMMAND_REGISTRY_ID; Event GlobalsCreated.
Entry (Legacy/Events): emit_ecdh_init, send_encrypted_message, send_plaintext_message (Events: EcdhInit, EncryptedMessage, PlaintextMessage).
Entry (Rebased/Mailbox): store_ecdh_init, purge_handshake, store_encrypted_message, store_plaintext_message, purge_message (TTL, Rebate).
Entry (Vault): create_vault, update_vault, enable_emergency_purge, purge_vault. Vault = dynamisches Objekt unter VaultRegistry pro owner.
Entry (CommandRegistry): set_open_words(registry, lock_id, words) – nur lock_id darf setzen; Wörter für OPEN-Prüfung on-chain.
Entry (AccessKey): create_access_key(lock, recipient, ttl_days), use_access_key(key_id), enable_emergency_purge_key, purge_key, transfer_key.
Entry (Ticket): create_ticket, use_ticket, enable_emergency_purge_ticket, purge_ticket, transfer_ticket. EventRegistry für Events.
Keys: HsKey(recipient,sender), MsgKey(recipient,sender,nonce). Replay: Nonce pro Sender (Client-seitig REPLAY_STATE_FILE).

--- CHAIN-ACCESS (Kern-API, Typen/Flows) ---
Client: getClient(), isChainReachable(). TX: buildHandshakeTransaction(), signAndExecute(client, txb, sender, password). SIGNER=sdk|remote|cli.
Handshake: sendEcdhInit(recipient, sender, pubKey, pw) → store_ecdh_init. getHandshakeFromMailbox(recipient, sender), findPeerHandshake(myAddr), findPeerHandshakeFrom(myAddr, peer).
Nachrichten: storeEncryptedMessage(recipient, sender, ciphertext, iv, tag, nonce, pw), storePlaintextMessage. purgeHandshake, purgeMessage(recipient, sender, nonce, …).
Vault: getVaultFromChain(client, registryId, packageId, owner), createVaultOnChain(payload, ttlDays, …), enableEmergencyPurgeVault, purgeVaultOnChain.
AccessKey: createAccessKey(lock, recipient, ttlDays, …), createAccessKeyAndSendPlain (PTB), hasValidAccessKey(client, packageId, lock, owner), getOwnedAccessKeys, enableEmergencyPurgeKey, purgeKey, transferAccessKey.
Ticket: createTicket, useTicket, getOwnedTickets, enableEmergencyPurgeTicket, purgeTicket, transferTicket. createEventRegistry, createTicketToRegistry, useTicketFromRegistry.
Open Words: getOpenWordsFromChain(client, registryId, packageId, lockId). Zahlung: queryIncomingPayments(client, owner, packageId), minIotaToMist, PAYMENT_TRIGGER_*.
Coins: getBalanceInMist(owner), transferCoins(recipient, amountMist, signingAddress, pw). iotaToMist, mistToDisplayIota. Sponsor: getSponsorGasCoins, SPONSOR_GAS_OWNER.
Package/Deploy: publishPackageCli(packageDir). Adressen: assertSafeAddress (0x+64 hex oder bech32), normalizeAddress.

--- .ENV (Auszug) ---
RPC_URL, PACKAGE_ID, MY_ADDRESS, PARTNER_ADDRESS, PARTNER_ADDRESSES. ROLE: messenger, lock, monitor, boss, kommandant, arbeiter.
VAULT_FILE, VAULT_REGISTRY_ID, MAILBOX_ID, COMMAND_REGISTRY_ID. LOCK_ID, OPEN_COMMAND, OPEN_URL, OPEN_COMMAND_WORDS.
ENABLE_UI, API_PORT, UI_PORT. ENABLE_AI_INTENT_MATCHER, ENABLE_AI_COPILOT, OLLAMA_URL, OLLAMA_MODEL.
ENABLE_LISTENER, ENABLE_PURGE, ENABLE_AUTO_EXECUTE, ENABLE_PLAINTEXT_CHANNEL, ENABLE_HARDWARE_OPEN.
DEFAULT_TTL_DAYS, DEFAULT_KEY_TTL_DAYS. FETCH_LAST_ON_START, LISTENER_POLL_MS, HANDSHAKE_REFRESH_MS.
MONITOR_DEVICES, MONITOR_OFFLINE_TIMEOUT_MS, MONITOR_ALARM_WEBHOOK_URL. PAYMENT_TRIGGER_*, SIGNER, REMOTE_SIGNER_URL.
BOSS_ADDRESS, KOMMANDANT_ADDRESSES, WORKER_ADDRESSES (Ameisen-Hierarchie). AUTHORIZED_SENDERS.
GAS_STATION_ENABLED, GAS_STATION_MIN_IOTA, GAS_STATION_TOPUP_IOTA, GAS_STATION_CHECK_MS (Boss). AUDIT_STREAMS_ENABLED, STREAMS_ANCHOR_ID. IOTA_EUR_ORACLE_URL (Euro-Orakel).
`;

export function stripAnsi(text: string): string {
    return (text || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
}
