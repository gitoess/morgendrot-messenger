# Abdeckung: Alle Funktionen und Kombinationen pro Kachel

Kurzantwort: **Alle Kern-Befehle** pro Kachel sind getestet; **nicht** alle UI-Optionen und Kombinationen.

---

## Pro Kachel: Was getestet ✅ vs. was fehlt ❌

### Kachel 1: Chat mit Freunden
| In der UI / TREE | Getestet? | Anmerkung |
|------------------|-----------|-----------|
| /handshake, /connect, /send, /fetch | ✅ | inkl. Sender-Filter |
| /send-plain | ✅ | |
| /purge-handshake | ✅ (optional/skip) | nur mit MAILBOX voll nutzbar |
| ENABLE_PLAINTEXT_CHANNEL | ❌ | Konfig, nicht Ablauf |
| PARTNER_ADDRESS (ein Partner) | ✅ | implizit |
| PARTNER_ADDRESSES + ENABLE_PAIRWISE_GROUPS (mehrere) | ❌ | kein Test mit 3+ Partnern |
| STREAMS_BRIDGE_URL, Streams | ❌ | nicht automatisiert |
| USE_MAILBOX, /purge-msg | ❌ | /purge-msg nur in test-all-projects (SKIP ohne MAILBOX) |
| VAULT_FILE, /vault-save (Chat-Keys) | ✅ (optional) | Kachel 8 |
| chain-reachable, connect-addresses, help, find-peer-handshake | ✅ | in run-messages / test-all-projects |
| FETCH_LAST_ON_START | ❌ | Konfig |

---

### Kachel 2: Tickets & Schlüssel
| In der UI / TREE | Getestet? | Anmerkung |
|------------------|-----------|-----------|
| /create-ticket (normal + personalisiert Nicole) | ✅ | |
| /create-key, /create-keys | ✅ | |
| GET list-tickets, list-keys | ✅ | |
| hasValidTicket (GET) | ✅ | (manchmal false wegen Indizierung) |
| /use-ticket, /transfer-ticket, /emergency-purge-ticket, /purge-ticket | ✅ | wenn list Einträge liefert |
| /transfer-key, /purge-key, /emergency-purge-key | ✅ | wenn list Einträge liefert |
| metadata: tier, promo_code, seat | ❌ | nur holder_name (Nicole) |
| Gate (ROLE=lock, LOCK_ID) | ❌ | OPEN-Ausführung nur manuell/Log |
| DEFAULT_KEY_TTL_DAYS | ❌ | Konfig |

---

### Kachel 3: Schloss & Tür
| In der UI / TREE | Getestet? | Anmerkung |
|------------------|-----------|-----------|
| /create-key (Lock stellt Key für B aus) | ✅ | |
| GET list-keys (B) | ✅ | |
| GET config ROLE/OPEN | ✅ | |
| ROLE=lock, OPEN_COMMAND, OPEN_URL | ❌ | OPEN-Ausführung nur wenn Lock-Prozess läuft (Log prüfen) |
| OPEN_COMMAND_WORDS, OPEN_COMMAND_LIST_FILE, COMMAND_REGISTRY_ID | ❌ | nicht durchgespielt |
| PAYMENT_TRIGGER_ENABLED (Zahlung → OPEN) | ❌ | transfer-coins ✅, OPEN im Lock nicht automatisiert |
| OFFLINE_OPEN_ENABLED, OPEN_STREAMS_ENABLED | ❌ | |
| AUTHORIZED_SENDERS, ENABLE_BROADCAST_PINNWAND | ❌ | Konfig |

---

### Kachel 4: Sensor-Alarm
| In der UI / TREE | Getestet? | Anmerkung |
|------------------|-----------|-----------|
| Send/Fetch (Alarm = verschlüsselte Nachricht) | ✅ | über Chat |
| GET /api/monitor-status | ✅ | |
| AUTHORIZED_SENDERS, ENABLE_HEARTBEAT | ❌ | Konfig |
| MONITOR_ALARM_WEBHOOK_URL | ❌ | nicht ausgelöst im Test |
| /purge-msg (nach Entwarnung) | ❌ | nur in test-all-projects (SKIP) |
| ROLE=monitor | ❌ | Konfig |

---

### Kachel 5: Überwachung (Lieferkette)
| In der UI / TREE | Getestet? | Anmerkung |
|------------------|-----------|-----------|
| GET /api/monitor-status (A, B) | ✅ | |
| ROLE=monitor, MONITOR_DEVICES | ❌ | Konfig; kein Test mit echten Geräte-Adressen |
| STREAMS_BRIDGE_URL, MONITOR_OFFLINE_TIMEOUT_MS | ❌ | |
| MONITOR_ALARM_WEBHOOK_URL, MONITOR_STATE_FILE | ❌ | |

---

### Kachel 6: Zahlung & Freischaltung
| In der UI / TREE | Getestet? | Anmerkung |
|------------------|-----------|-----------|
| /transfer-coins (B → A) | ✅ | |
| ROLE=lock, OPEN_URL/OPEN_COMMAND | ❌ | Lock-Prozess |
| PAYMENT_TRIGGER_ENABLED | ❌ | OPEN nach Zahlung nur im Lock-Log prüfbar |
| PAYMENT_TRIGGER_MIN_IOTA, REQUIRE_MEMO, STATE_FILE | ❌ | Konfig |
| /create-key nach Zahlung (Backend) | ❌ | manuelles Szenario |

---

### Kachel 7: Pinnwand
| In der UI / TREE | Getestet? | Anmerkung |
|------------------|-----------|-----------|
| /send-plain (an B bzw. Pinnwand-Adresse) | ✅ | |
| ENABLE_BROADCAST_PINNWAND, BROADCAST_PINNWAND_ADDRESS | ❌ | Konfig |
| BROADCAST_AUTHORIZED_SENDERS | ❌ | |

---

### Kachel 8: Tresor & Notfall
| In der UI / TREE | Getestet? | Anmerkung |
|------------------|-----------|-----------|
| GET config VAULT_FILE / VAULT_REGISTRY_ID | ✅ | |
| /vault-save, /vault-onchain, /emergency-purge | ✅ (optional/skip) | ohne Konfig → skip |
| Mit VAULT_FILE / VAULT_REGISTRY_ID + Passwort | ❌ | nicht automatisiert (Passwort-Eingabe) |

---

### Kachel 9: Boss-Modus
| In der UI / TREE | Getestet? | Anmerkung |
|------------------|-----------|-----------|
| POST /api/generate-address | ✅ | |
| POST /api/deploy-package | ✅ | |
| POST /api/boss-provision-handshake | ✅ (optional/skip) | ohne Pubkey → skip |
| POST /api/start-boss-signer | ✅ | nur test-all-projects (SKIP wenn CLI fehlt) |
| SIGNER=remote, REMOTE_SIGNER_URL (Maschine) | ❌ | Setup, kein 2-Wallet-Flow |
| ROLE=lock / ROLE=arbeiter (Maschine ohne Wallet) | ❌ | siehe Szenario 3 (Lock-Log) |

---

## Kombinationen: Was getestet wird (run-remaining-tests)

**Aufruf:** `npm run test:remaining` (API_BASE_A, API_BASE_B, optional API_BASE_C).

- **Chat:** Mehrere Partner (PARTNER_ADDRESSES + ENABLE_PAIRWISE_GROUPS) – A handshake B/C, B und C connect A, A connect (ohne Arg), A send, B/C fetch. ✅
- **Konfig:** ENABLE_PLAINTEXT_CHANNEL, ROLE, OPEN_COMMAND_WORDS, AUTHORIZED_SENDERS, PAYMENT_TRIGGER_ENABLED, USE_MAILBOX, ENABLE_BROADCAST_PINNWAND, BROADCAST_*, OFFLINE_OPEN_ENABLED, DEFAULT_TTL_DAYS, MONITOR_ALARM_WEBHOOK_URL, MONITOR_DEVICES – setzen und (wo möglich) lesen. ✅
- **Monitor:** ROLE=monitor + MONITOR_DEVICES=addrB[,addrC], GET /api/monitor-status. ✅
- **Pinnwand:** BROADCAST_PINNWAND_ADDRESS + BROADCAST_AUTHORIZED_SENDERS, B send-plain an A. ✅
- **Lock + Zahlung:** PAYMENT_TRIGGER_ENABLED setzen, B transfer-coins an A; OPEN im Log manuell prüfen. ✅
- **Ticket-Metadata:** create-ticket mit metadata_hex (tier, promo). ✅
- **/purge-msg:** Aufruf (SKIP ohne MAILBOX). ✅
- **Vault:** vault-save/vault-onchain aufrufbar (Hinweise für manuelle Ausführung). ✅
- **Boss→K→A Nachricht:** Kommandant sendet an Arbeiter, Arbeiter fetcht (test:scenarios). ✅

**Weiterhin nicht automatisiert:** IOTA Streams (echter Kanal), OPEN/Pinnwand ausführen (Lock-Prozess ohne API), Vault mit Passwort erstellen, boss-provision mit echtem Pubkey, Monitor-Webhook. → Siehe **WAS-NICHT-GETESTET.md**.

---

## Zusammenfassung

| Kategorie | Status |
|-----------|--------|
| **Alle Kern-Befehle** (create-ticket, create-key, send, fetch, transfer-coins, …) | ✅ getestet |
| **Alle GET-APIs** (status, config, list-*, monitor-status, …) | ✅ in test-all-projects / run-all-9-tiles |
| **Optionale Befehle** (purge-handshake, vault-save, boss-provision, …) | ✅ aufrufbar, bei fehlender Konfig skip |
| **Kombinationen** (mehrere Partner, Lock+Zahlung, Monitor+Geräte, Pinnwand+Auth) | ✅ **run-remaining-tests** (`npm run test:remaining`) |
| **Konfig-Optionen** (ENABLE_*, ROLE, MONITOR_DEVICES, …) | ✅ **run-remaining-tests** (setzen + lesen) |
| **Echte OPEN-Ausführung / Lock-Log** | ❌ manuell prüfen (ROLE=lock/arbeiter) |

**Fazit:** Alle **wichtigen Funktionen** jeder Kachel sind mindestens einmal (Befehl oder API) getestet. **Nicht** abgedeckt sind viele **Kombinationen** und **Konfigurationen**, die zusätzliche Setups (Lock-Prozess, MAILBOX, Vault-Datei, mehrere Instanzen mit speziellen Rollen) oder manuelle Schritte (Passwort, Log prüfen) brauchen.
