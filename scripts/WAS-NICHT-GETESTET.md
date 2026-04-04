# Was nicht (oder nur teilweise) automatisiert getestet wird

Kurzantwort auf: **IOTA Streams? Pinnwand (Wallet beobachtet und führt aus)? Vault erstellt? Boss→K→A Nachricht? Alle Funktionen aller Kacheln?**

---

## 1. IOTA Streams

| Frage | Antwort |
|-------|--------|
| **Streams getestet?** | **Nein.** Es gibt keine automatisierten Tests, die einen echten Streams-Kanal (STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL) nutzen. |
| Was getestet ist | Konfig lesen (GET /api/config zeigt OPEN_STREAMS_ENABLED, STREAMS_ANCHOR_ID, STREAMS_LISTEN_ENABLED, STREAMS_BRIDGE_URL). |
| Was du tun kannst | Streams-Bridge betreiben, in .env setzen, OPEN auslösen und im Log prüfen (siehe docs/STREAMS-INTEGRATION.md). |

---

## 2. Pinnwand: Wallet beobachtet und führt Befehle aus

| Frage | Antwort |
|-------|--------|
| **Pinnwand „Wallet 3 beobachtet und führt aus“ getestet?** | **Senden:** Ja (B send-plain an Pinnwand-Adresse). **Empfangen & Ausführen:** Nur indirekt. |
| Was getestet ist | • Config: ENABLE_BROADCAST_PINNWAND, BROADCAST_PINNWAND_ADDRESS, BROADCAST_AUTHORIZED_SENDERS (run-remaining-tests).<br>• B sendet Klartext an Pinnwand-Adresse (A oder C). |
| Was nicht geht | Die **Empfänger-Instanz** (z. B. Wallet 3 / C) muss als **Lock-Prozess** (ROLE=lock oder ROLE=arbeiter) laufen – dann lauscht sie auf der Chain auf Nachrichten an BROADCAST_PINNWAND_ADDRESS und führt OPEN aus, wenn Sender in BROADCAST_AUTHORIZED_SENDERS und Text = OPEN_COMMAND_WORDS. Das läuft **ohne API-Server**; automatischer Test kann nur senden und dir sagen: „Im Log von C prüfen“. |
| Was du tun kannst | C mit ROLE=arbeiter starten, BROADCAST_PINNWAND_ADDRESS=addrC, BROADCAST_AUTHORIZED_SENDERS=addrB. Dann `npm run test:scenarios` – B sendet „open“ an C. Im Log von C: „OPEN GRANTED [Pinnwand]“. |

---

## 3. Vault erstellt?

| Frage | Antwort |
|-------|--------|
| **Vault-Erstellung getestet?** | **Nein.** Es wird nur der Aufruf von /vault-save und /vault-onchain getestet; ohne VAULT_FILE bzw. VAULT_REGISTRY_ID und ohne Passwort antwortet die App mit „nicht gesetzt“ / Skip. |
| Was getestet ist | GET config (VAULT_FILE, VAULT_REGISTRY_ID), Aufruf /vault-save und /vault-onchain (erwartetes Verhalten: Skip oder Erfolg). |
| Was du tun kannst | VAULT_FILE (und ggf. VAULT_REGISTRY_ID) setzen, Passwort manuell eingeben, /vault-save bzw. /vault-onchain ausführen. Kein Passwort in Tests (Sicherheit). |

---

## 4. Boss → Kommandant → Arbeiter: Nachricht gesehen?

| Frage | Antwort |
|-------|--------|
| **Boss-Befehl an Kommandant gesendet, Kommandant hat es gesehen?** | **Ja.** Szenario: A (Boss) /send „Anweisung an Kommandant“, B (Kommandant) /fetch – Assert: Nachricht enthält „Anweisung“. |
| **Kommandant sendet an Arbeiter, Arbeiter hat Nachricht von Kommandant bekommen?** | **Ja (neu).** Szenario: B /handshake C, C /connect B, B /connect C, B /send „Anweisung an Arbeiter: bitte Tür öffnen“, C /fetch – Assert: C hat die Nachricht. (`npm run test:scenarios` mit API_BASE_C.) |

---

## 5. Alle Funktionen aller Kacheln getestet?

| Kategorie | Getestet? | Anmerkung |
|-----------|-----------|-----------|
| **Kern-Befehle** (create-ticket, create-key, send, fetch, transfer-coins, list-*, …) | ✅ | test:all-tiles, test:scenarios, test:remaining, test:messages |
| **Konfig setzen/lesen** (ENABLE_*, ROLE, MONITOR_DEVICES, BROADCAST_*, …) | ✅ | test:remaining |
| **Mehrere Partner, Monitor, Pinnwand-Config, Lock+Zahlung (Config), Ticket-Metadata** | ✅ | test:remaining |
| **Boss→K→A Nachricht (B send, C fetch)** | ✅ | test:scenarios (neu) |
| **OPEN wirklich ausführen** (Lock-Prozess) | ❌ | Manuell: ROLE=lock/arbeiter starten, Log „OPEN GRANTED“ prüfen |
| **IOTA Streams** (echter Kanal) | ❌ | Kein Streams-Setup in Tests |
| **Vault mit Passwort erstellen** | ❌ | Nur Aufruf/Skip |
| **Pinnwand: Empfänger führt aus** | ❌ | Nur wenn Lock läuft → Log prüfen |
| **Monitor-Webhook auslösen** | ❌ | Nicht automatisiert |
| **MAILBOX + /purge-msg erfolgreich** | Optional | Nur Aufruf/Skip ohne MAILBOX_ID |
| **Einzelne UI-Optionen** (FETCH_LAST_ON_START, OPEN_COMMAND_LIST_FILE, …) | Teilweise | Siehe KACHELN-ABDECKUNG.md pro Kachel |

**Fazit:** Alle **Kern-Funktionen** und die wichtigsten **Kombinationen** (inkl. Boss→K→A Nachricht) sind getestet. **Nicht** automatisiert: Streams, echtes Vault-Erstellen, Lock-Prozess (OPEN/Pinnwand-Ausführung), Webhook, optionale Setups (MAILBOX, Streams-Bridge).

---

## Test-Skripte Übersicht

| Befehl | Inhalt |
|--------|--------|
| `npm run test:scenarios` | Tür mit NFT, Boss→K (Anweisung), **K→A (Nachricht + OPEN)**, Zahlung, Pinnwand senden, Ticket/Key |
| `npm run test:remaining` | Konfig, mehrere Partner, Monitor, Pinnwand-Config, Ticket-Metadata, purge-msg, Vault-Skip |
| `npm run test:all-tiles` | Alle 9 Kacheln (2 Wallets) |
| `npm run test:kacheln` | 9 Kacheln nacheinander, optional KACHEL=1..9 |
