# Morgendrot – Werkzeug-Schnittstellen (Function Calling / Tool-Beschreibung)

Die KI „sieht“ diese Funktionen und weiß, welche Parameter (0x-Adresse, Zahl, Text) sie einsetzen muss. Für Siemens-Niveau: klare Typen und Abhängigkeiten.

---

## 1. Zutritt & Keys

| Funktion (logisch) | Befehl / API | Parameter (Typ) | Abhängigkeiten |
|--------------------|--------------|-----------------|----------------|
| `create_key(lock, recipient, ttl_days?)` | `/create-key <lock> <recipient> [ttl]` | lock: 0x64, recipient: 0x64, ttl: int (Tage, optional) | Säule 1 (MY_ADDRESS, PACKAGE_ID, RPC). lock oft = MY_ADDRESS (Lock-Instanz). |
| `create_keys_batch(lock, recipient, ttl_days?, count?)` | `/create-keys <lock> <recipient> [ttl] [anzahl]` | wie oben + count: int | Wie create_key. |
| `create_key_and_notify(lock, recipient, ttl_days?, message)` | `/create-key-and-notify <lock> <recipient> [ttl] <Nachricht>` | + message: string | PTB: Key + Klartext in einer TX. |
| `purge_key(key_id)` | `/purge-key <keyId>` | key_id: 0x (Objekt-ID) | ENABLE_PURGE. Säule 4 (Rebate). |
| `emergency_purge_key(key_id)` | `/emergency-purge-key <keyId>` | key_id: 0x | Danach /purge-key. |
| `transfer_key(key_id, new_owner)` | `/transfer-key <keyId> <new_owner>` | key_id: 0x, new_owner: 0x64 | Säule 1. |
| `list_keys(owner?)` | `/list-keys [owner]` | owner: 0x64 optional (default MY_ADDRESS) | Säule 1. |

---

## 2. Messaging

| Funktion (logisch) | Befehl / API | Parameter (Typ) | Abhängigkeiten |
|--------------------|--------------|-----------------|----------------|
| `send_plain(recipient, text)` | `/send-plain <recipient> <text>` | recipient: 0x64, text: string | Kein Handshake. Säule 1. |
| `send_encrypted(text)` | `/send <text>` | text: string | **Säule 2:** zuvor /handshake + Partner /connect. |
| `handshake(recipient)` | `/handshake <recipient>` | recipient: 0x64 | Säule 1. Partner muss danach /connect ausführen. |
| `connect(partner?)` | `/connect [partner]` | partner: 0x64 optional | Säule 1. Wartet auf Handshake. |
| `fetch_messages(n, sender?)` | `/fetch <n> [sender]` | n: int (1–100), sender: 0x64 optional | Säule 1. Verschüsselte brauchen Keys (Vault/Connect). |

---

## 3. Zahlung & Coins

| Funktion (logisch) | Befehl / API | Parameter (Typ) | Abhängigkeiten |
|--------------------|--------------|-----------------|----------------|
| `transfer_coins(recipient, amount_iota)` | `/transfer-coins <recipient> <IOTA>` | recipient: 0x64, amount: number (IOTA) | **Kein /connect nötig.** Säule 1. Optional MAX_SEND_AMOUNT_IOTA. |

---

## 4. Tickets

| Funktion (logisch) | Befehl / API | Parameter (Typ) | Abhängigkeiten |
|--------------------|--------------|-----------------|----------------|
| `create_ticket(event_id, valid_from_ms, valid_until_ms, metadata_hex, recipient)` | `/create-ticket <event_id> <valid_from_ms> <valid_until_ms> <metadata_hex> <recipient>` | metadata_hex = Hex(UTF-8), z. B. JSON: `{"sitz":1,"name":"Platz 1","preis":"10€","datum":"11.12.2026"}` für Sitzplatz, Name, Preis, Datum | Säule 1. |
| `use_ticket(ticket_id, event_id)` | `/use-ticket <ticket_id> <event_id>` | ticket_id: 0x, event_id: 0x | Einlösen (Einlass). |
| `purge_ticket(ticket_id)` | `/purge-ticket <ticket_id>` | ticket_id: 0x | ENABLE_PURGE. Rebate. |
| `transfer_ticket(ticket_id, new_owner)` | `/transfer-ticket <ticket_id> <new_owner>` | ticket_id: 0x, new_owner: 0x64 | Säule 1. |
| `list_tickets(owner?)` | `/list-tickets [owner]` | owner: 0x64 optional | Säule 1. |

---

## 5. Vault & Purge (Säule 4)

| Funktion (logisch) | Befehl / API | Parameter (Typ) | Abhängigkeiten |
|--------------------|--------------|-----------------|----------------|
| `vault_save()` | `/vault-save` | — | Passwort nötig. VAULT_FILE. |
| `vault_onchain()` | `/vault-onchain` | — | VAULT_REGISTRY_ID, Passwort. |
| `purge_handshake()` | `/purge-handshake` | — | MAILBOX_ID, ENABLE_PURGE. Rebate. |
| `purge_message(nonce)` | `/purge-msg <nonce>` | nonce: int | MAILBOX_ID, ENABLE_PURGE. |
| `emergency_purge_vault()` | `/emergency-purge` | — | VAULT_REGISTRY_ID, ENABLE_PURGE. |

---

## 6. Konfiguration & Sonstiges

| Funktion (logisch) | Befehl / API | Parameter (Typ) | Abhängigkeiten |
|--------------------|--------------|-----------------|----------------|
| `set_package_id(package_id)` | `/set-package-id <0x…>` | package_id: 0x | Säule 1. |
| `help()` | `/help` | — | Zeigt HELP_START oder HELP_CHAT. |

---

## Typen (Kurz)

- **0x64** = Adresse: `0x` + genau 64 Hex-Zeichen.
- **0x** = Objekt-ID: beliebige 0x-Hex-ID (keyId, ticketId, event_id, nonce je Kontext).
- **int** = ganze Zahl (Tage, Anzahl, nonce).
- **number** = IOTA-Betrag (z. B. 0.1, 1).
- **string** = Freitext (Nachricht, metadata_hex je Befehl).

Diese Tabelle kann als System-Prompt-Ergänzung oder für echtes Function Calling (OpenAI/Compatible Tools JSON) genutzt werden.
