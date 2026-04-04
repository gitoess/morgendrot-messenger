# Morgendrot – Technische Spezifikation für RAG

Zusammenfassung des Projekts: Slash-Befehle, Move-Funktionen in `messaging.move` und logische Abfolge vom Setup bis zum Purge. Formatiert für RAG-Retrieval (Stichworte, eindeutige Zuordnung Befehl → Funktion).

---

## 1. Verfügbare Slash-Befehle

Alle Befehle werden über Terminal oder `POST /api/command` mit `{ cmd, args }` ausgeführt.

### 1.1 Fundament (Säule 1 – Setup)

| Befehl | Argumente | Bedeutung |
|--------|-----------|-----------|
| `/set-package-id` | `<0x…>` (Package-ID, 64 Hex) | Package-ID setzen; in `.morgendrot-package-id` speichern. Voraussetzung für alle Move-Calls. |
| `/help` | — | Hilfe anzeigen (Befehlsliste). |
| `/exit` | — | Programm beenden. |

**Abhängigkeiten:** `MY_ADDRESS`, `RPC_URL` müssen gesetzt sein. Wallet muss entsperrt sein.

### 1.2 Kanal (Säule 2 – Handshake / Connect)

| Befehl | Argumente | Bedeutung |
|--------|-----------|-----------|
| `/handshake` | `<0x…>` (Partner-Adresse) | ECDH-Handshake an Partner senden. Partner wird in `.morgendrot-partner` gespeichert. |
| `/connect` | `[0x…]` (optional, Partner) | Auf Handshake von Partner warten, dann Chat starten. Ohne Adresse: PARTNER_ADDRESS aus .env. |
| `/send-plain` | `<0x…> <Text>` | Klartext senden (kein Handshake nötig). Im Explorer sichtbar. |
| `/send` | `<Text>` | Verschlüsselte Nachricht an verbundene Partner. Erfordert vorher `/connect`. |
| `/fetch` | `<n> [sender]` | Letzte n Nachrichten laden (1–100). Optional: nur von sender (0x…). Ohne Connect: Handshakes von der Chain. |

**Abhängigkeiten:** `/send`, `/purge-handshake`, `/purge-msg` benötigen aktive Chat-Verbindung (peerMap). `/handshake`, `/send-plain`, `/fetch` (Handshakes) nicht.

### 1.3 Aktivität (Coins, Keys, Tickets)

| Befehl | Argumente | Bedeutung |
|--------|-----------|-----------|
| `/transfer-coins` | `<0x…> <IOTA>` | Native IOTA an Adresse senden (z. B. 0.1). Kein Connect nötig. |
| `/create-key` | `<lock> <recipient> [ttl]` | Ein AccessKey-NFT ausstellen. ttl = Tage (optional). |
| `/create-keys` | `<lock> <recipient> [ttl] [anzahl]` | Mehrere AccessKeys ausstellen. |
| `/create-key-and-notify` | `<lock> <recipient> [ttl] <Nachricht>` | PTB: AccessKey + Klartext-Nachricht in einer Transaktion. |
| `/list-keys` | `[owner]` | AccessKeys auflisten (lock_id, expires_at). |
| `/create-ticket` | `<event_id> <valid_from_ms> <valid_until_ms> <metadata_hex> <recipient>` | Ticket-NFT ausstellen. metadata_hex = Hex (z. B. JSON für Sitz, Name, Preis). |
| `/list-tickets` | `[owner]` | Tickets auflisten. |
| `/use-ticket` | `<ticket_id> <event_id>` | Ticket einlösen (Einlass/Gate). |
| `/transfer-key` | `<keyId> <new_owner>` | AccessKey an neue Adresse übertragen. |
| `/transfer-ticket` | `<ticket_id> <new_owner>` | Ticket übertragen. |

**Abhängigkeiten:** Keys und Tickets brauchen keinen Handshake/Connect; sie sind On-Chain-Objekte.

### 1.4 Nachsorge (Säule 4 – Vault, Purge, Rebate)

| Befehl | Argumente | Bedeutung |
|--------|-----------|-----------|
| `/vault-save` | — | Messaging-Keys lokal speichern (VAULT_FILE). Erfordert Passwort. |
| `/vault-onchain` | — | Keys on-chain im VaultRegistry speichern. Erfordert VAULT_REGISTRY_ID. |
| `/purge-handshake` | — oder `<recipient> <sender>` | Handshake aus Mailbox löschen (Rebate). ENABLE_PURGE, MAILBOX_ID. |
| `/purge-msg` | `<nonce> [sender]` oder `<recipient> <sender> <nonce>` | Nachricht aus Mailbox löschen. Nonce aus Event/Explorer. |
| `/emergency-purge` | — | Vault Notfall-Purge (enable + purge). VAULT_REGISTRY_ID. |
| `/emergency-purge-key` | `<keyId>` | AccessKey für Notfall-Purge vorbereiten; danach `/purge-key`. |
| `/purge-key` | `<keyId>` | AccessKey löschen (Storage-Rebate). |
| `/purge-keys` | `<keyId1> [keyId2] …` | Mehrere AccessKeys in einer TX löschen (Batch). |
| `/emergency-purge-ticket` | `<ticketId>` | Ticket für Notfall-Purge vorbereiten; danach `/purge-ticket`. |
| `/purge-ticket` | `<ticketId>` | Ticket löschen (Storage-Rebate). |

**Abhängigkeiten:** ENABLE_PURGE für Purge-Befehle. MAILBOX_ID für `/purge-handshake`, `/purge-msg`. VAULT_REGISTRY_ID für Vault-Purge.

---

## 2. Move-Funktionen in `messaging.move`

Modul: `messaging::messaging`. Package-ID aus Move.toml / deploy.

### 2.1 Legacy (nur Events, nicht purgbar)

| Entry-Funktion | Kurzbeschreibung |
|----------------|------------------|
| `emit_ecdh_init(recipient, pub_key, nonce, ctx)` | ECDH-Handshake als Event emittieren. |
| `send_encrypted_message(recipient, ciphertext, iv, tag, nonce, ctx)` | Verschüsselte Nachricht als Event. |
| `send_plaintext_message(recipient, text, nonce, ctx)` | Klartext als Event (Explorer sichtbar). |

### 2.2 Globals (Shared Objects)

| Entry-Funktion | Kurzbeschreibung |
|----------------|------------------|
| `create_globals(ctx)` | Erstellt einmal VaultRegistry, Mailbox, CommandRegistry; Event GlobalsCreated mit IDs. |
| `set_open_words(registry, lock_id, words, ctx)` | Öffnen-Wörter pro lock_id setzen (nur lock_id darf). |
| `create_command_registry(ctx)` | Alternative: CommandRegistry einzeln erstellen. |

### 2.3 Vault (On-Chain Keys)

| Entry-Funktion | Kurzbeschreibung |
|----------------|------------------|
| `create_vault(registry, payload, ttl_days, ctx)` | Vault-Eintrag für Owner anlegen. |
| `update_vault(registry, owner, payload, ttl_days, ctx)` | Vault-Payload aktualisieren. |
| `enable_emergency_purge(registry, ctx)` | Notfall-Purge für Vault aktivieren. |
| `purge_vault(registry, owner, ctx)` | Vault löschen (Rebate). |

### 2.4 Mailbox (Handshakes & Nachrichten, purgbar)

| Entry-Funktion | Kurzbeschreibung |
|----------------|------------------|
| `store_ecdh_init(mailbox, recipient, sender, pub_key, nonce, ttl_days, ctx)` | Handshake in Mailbox speichern. |
| `purge_handshake(mailbox, recipient, sender, ctx)` | Handshake aus Mailbox löschen (Rebate). |
| `store_encrypted_message(mailbox, recipient, sender, ciphertext, iv, tag, nonce, ttl_days, ctx)` | Verschüsselte Nachricht in Mailbox. |
| `store_plaintext_message(mailbox, recipient, sender, text, nonce, ttl_days, ctx)` | Klartext in Mailbox. |
| `purge_message(mailbox, recipient, sender, nonce, ctx)` | Nachricht aus Mailbox löschen (Rebate). |

### 2.5 AccessKeys

| Entry-Funktion | Kurzbeschreibung |
|----------------|------------------|
| `create_access_key(lock, recipient, ttl_days, ctx)` | AccessKey-NFT ausstellen; recipient wird Owner. |
| `enable_emergency_purge_key(key, ctx)` | Key für Notfall-Purge vorbereiten. |
| `transfer_access_key(key, new_owner, ctx)` | Key übertragen. |
| `purge_key(key, ctx)` | Key löschen (Storage-Rebate). |

### 2.6 Tickets (Event/Festival)

| Entry-Funktion | Kurzbeschreibung |
|----------------|------------------|
| `create_ticket(event_id, valid_from_ms, valid_until_ms, metadata, recipient, ctx)` | Ticket-NFT ausstellen. |
| `use_ticket(ticket, event_id, ctx)` | Ticket einlösen (Einlass). |
| `enable_emergency_purge_ticket(ticket, ctx)` | Ticket für Notfall-Purge vorbereiten. |
| `transfer_ticket(ticket, new_owner, ctx)` | Ticket übertragen. |
| `purge_ticket(ticket, ctx)` | Ticket löschen (Rebate). |

### 2.7 Event-Registry (Tickets in Registry)

| Entry-Funktion | Kurzbeschreibung |
|----------------|------------------|
| `create_event_registry(event_id, ctx)` | Registry für Event anlegen. |
| `create_ticket_to_registry(registry, event_id, valid_from_ms, valid_until_ms, metadata, recipient, ctx)` | Ticket in Registry minten. |
| `use_ticket_from_registry(registry, ticket_id, event_id, ctx)` | Ticket aus Registry einlösen. |
| `purge_expired_tickets(registry, ctx)` | Abgelaufene Tickets in Registry löschen. |

**Interne (nicht entry):** `purge_expired_tickets_loop` – Hilfsfunktion für purge_expired_tickets.

---

## 3. Logische Abfolge: Setup → Kanal → Aktivität → Purge

### Phase 1: Setup (Säule 1)

1. **MY_ADDRESS** setzen (Wallet-Adresse, z. B. aus CLI oder .env).
2. **PACKAGE_ID** setzen: `/set-package-id 0x…` oder in .env / `.morgendrot-package-id`. Die ID stammt aus `create_globals` (Move) oder Package-Deploy.
3. **RPC_URL** erreichbar; Wallet entsperren.
4. Optional: **MAILBOX_ID**, **VAULT_REGISTRY_ID**, **COMMAND_REGISTRY_ID** aus dem Event `GlobalsCreated` nach `create_globals` in .env eintragen.

Ohne Phase 1 funktionieren keine Move-Calls.

### Phase 2: Kanal (Säule 2)

1. **Partner-Adresse** bekannt (PARTNER_ADDRESS oder manuell).
2. **Handshake:** A sendet `/handshake 0x…` (Partner B). Move: `store_ecdh_init` (Mailbox) oder `emit_ecdh_init` (Legacy).
3. **Connect:** B führt `/connect` aus (wartet auf Handshake von A). Danach ist Chat-Verbindung aufgebaut (peerMap).
4. **Senden:** `/send <Text>` (verschlüsselt) oder `/send-plain 0x… <Text>` (Klartext). Move: `store_encrypted_message` / `store_plaintext_message` bzw. Legacy-Events.
5. **Empfangen:** `/fetch n` – lädt Nachrichten (und ggf. Handshakes von der Chain).

Reihenfolge: Handshake → Connect → Send. Ohne Connect kein verschlüsseltes `/send`.

### Phase 3: Aktivität (Keys, Tickets, Coins)

- **Coins:** `/transfer-coins 0x… <IOTA>` – jederzeit (kein Connect).
- **AccessKeys:** `/create-key <lock> <recipient> [ttl]` – Lock oft = MY_ADDRESS. Move: `create_access_key`. Optional danach `/vault-save`.
- **Tickets:** `/create-ticket <event_id> <valid_from> <valid_until> <metadata_hex> <recipient>`. Move: `create_ticket`.
- **Listen:** `/list-keys`, `/list-tickets` – jederzeit (On-Chain-Abfrage).

Keys und Tickets sind unabhängig von Handshake/Connect.

### Phase 4: Nachsorge (Purge, Rebate)

- **Vault sichern:** `/vault-save` (lokal), `/vault-onchain` (on-chain).
- **Handshake löschen:** `/purge-handshake` (oder mit Args: recipient, sender). Move: `purge_handshake`. Rebate an Aufrufer.
- **Nachricht löschen:** `/purge-msg <nonce> [sender]` oder `<recipient> <sender> <nonce>`. Move: `purge_message`. Rebate an Aufrufer.
- **Key löschen:** Optional zuerst `/emergency-purge-key <keyId>`, dann `/purge-key <keyId>`. Move: `enable_emergency_purge_key`, `purge_key`. Rebate an Key-Owner.
- **Ticket löschen:** Optional zuerst `/emergency-purge-ticket <ticketId>`, dann `/purge-ticket <ticketId>`. Move: `enable_emergency_purge_ticket`, `purge_ticket`. Rebate an Ticket-Owner.
- **Vault löschen:** `/emergency-purge` (enable + purge). Move: `enable_emergency_purge`, `purge_vault`.

Voraussetzung für Purge: **ENABLE_PURGE**; für Mailbox-Purge **MAILBOX_ID**.

---

## 4. Mapping Slash-Befehl → Move (Kernfälle)

| Slash-Befehl | Move-Funktion (messaging.move) |
|--------------|---------------------------------|
| `/handshake` (Mailbox) | `store_ecdh_init` |
| `/handshake` (Legacy) | `emit_ecdh_init` |
| `/send-plain` (Mailbox) | `store_plaintext_message` |
| `/send-plain` (Legacy) | `send_plaintext_message` |
| `/send` (Mailbox) | `store_encrypted_message` |
| `/send` (Legacy) | `send_encrypted_message` |
| `/purge-handshake` | `purge_handshake` |
| `/purge-msg` | `purge_message` |
| `/create-key` | `create_access_key` |
| `/create-key-and-notify` | `create_access_key` + Klartext-Nachricht (PTB) |
| `/purge-key` | `purge_key` |
| `/emergency-purge-key` | `enable_emergency_purge_key` |
| `/transfer-key` | `transfer_access_key` |
| `/create-ticket` | `create_ticket` |
| `/use-ticket` | `use_ticket` |
| `/purge-ticket` | `purge_ticket` |
| `/emergency-purge-ticket` | `enable_emergency_purge_ticket` |
| `/transfer-ticket` | `transfer_ticket` |
| `/vault-onchain` | `create_vault` / `update_vault` |
| `/emergency-purge` | `enable_emergency_purge` + `purge_vault` |

---

## 5. Stichworte für RAG (Suchanker)

- Slash-Befehle: set-package-id, handshake, connect, send, send-plain, fetch, transfer-coins, create-key, create-keys, create-key-and-notify, list-keys, purge-key, emergency-purge-key, transfer-key, create-ticket, list-tickets, use-ticket, purge-ticket, emergency-purge-ticket, transfer-ticket, vault-save, vault-onchain, purge-handshake, purge-msg, emergency-purge.
- Move-Modul: messaging.move, messaging::messaging.
- Säulen: Säule 1 Fundament, Säule 2 Kanal, Säule 3 Aktivität, Säule 4 Nachsorge.
- Ablauf: Setup → Handshake → Connect → Send → Fetch → Vault → Purge, Rebate, ENABLE_PURGE, MAILBOX_ID, VAULT_REGISTRY_ID, create_globals, GlobalsCreated.

Ende der Spezifikation.
