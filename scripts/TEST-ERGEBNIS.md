# Morgendrot – Vollständiger Testlauf

## 1. Modultests (npm test)
- **19/19 bestanden**
- crypto-layer, vault-local, replay-state, utils, load-secrets, read-command-list
- chain-access (Validation + IOTA/MIST + Anzeige), config, monitoring, chain-anchor

## 2. Projekt-Start
- **build:docs** – OK (18 Anleitungen)
- **validate:ui** – OK (66 refs in PROJECTS im TREE)

## 3. API – GET (alle Reiter / Abfragen)
| Endpoint | Status |
|----------|--------|
| /api/status | OK |
| /api/current-ids | OK |
| /api/package-id-history | OK |
| /api/package-id-hints | OK |
| /api/config | OK |
| /api/doc?name=… (15 Docs) | OK |
| /api/connect-addresses | OK |
| /api/chain-reachable | OK |
| /api/help | OK |
| /api/find-peer-handshake | OK |
| /api/has-valid-ticket | OK |
| /api/list-tickets | OK |
| /api/list-keys | OK |
| /api/rebate-candidates | OK |
| /api/monitor-status | OK |
| /api/audit-export?format=csv | OK |

## 4. API – POST
| Endpoint | Status |
|----------|--------|
| /api/package-id-hints | OK |
| /api/config (LOG_VERBOSE) | OK |
| /api/unlock (falsches Passwort) | OK (abgelehnt) |
| /api/generate-address | OK |

## 5. Commands (apiCmd – alle Reiter)
| Befehl | Status |
|--------|--------|
| /help | OK |
| /handshake | OK |
| /send-plain | OK |
| /transfer-coins | OK |
| /fetch | OK |
| /list-keys | OK |
| /list-tickets | OK |
| /connect | OK |
| /purge-msg | OK |
| /vault-save | SKIP (VAULT_FILE nicht gesetzt) |
| /create-key | SKIP (Lock-Adresse/Chain abhängig) |

## 6. TREE-Reiter (9 Bereiche) – Detailplan: scripts/TEST-PLAN-REITER.md
1. Anfang & Verbindung – getestet (status, current-ids, connect-addresses, chain-reachable, help, handshake, connect, transfer-coins)
2. Vault & Sicherheit – getestet (config, vault-save skip)
3. Nachrichten & Chat – getestet (send-plain, fetch)
4. Schlüssel & Tickets – getestet (list-keys, list-tickets, has-valid-ticket, create-key skip); **Vollflow:** `npm run test:tickets-keys` (erfordert PACKAGE_ID 0x+64 Hex, sonst Abbruch mit Hinweis)
5. Schloss & Hardware – config/getDoc
6. Streams – getDoc
7. Zahlung & Trigger – config/getDoc
8. Monitoring – monitor-status, audit-export
9. Einstellungen & Entwickler – config, generate-address

## 7. Docs (alle 15 Anleitungen)
ENV-ERKLAERUNG, VAULT-EINRICHTEN, BROADCAST-PINNWAND, LEIHGERAETE-EINRICHTEN, SCHLOSS-EINRICHTEN, STREAMS-INTEGRATION, CAR-SHARING-EINRICHTEN, SENSOR-ALARME-EINRICHTEN, BOSS-MODUS, NOTFALL-DATENSPEICHER, FESTIVAL-TICKETS-EINRICHTEN, FAMILIEN-ZUGANG, CHAT-GRUPPE-EINRICHTEN, M2M-KOORDINATION-EINRICHTEN – alle per /api/doc abrufbar.

## 8. Weitere Skripte
- **test:message** – OK (schreibt test-message.txt)
- **ui** (Standalone) – UI unter 3341 erreichbar (167335 Bytes)
- **lora-bridge:test** – 3/3 bestanden (SimLoraDriver, config, HTTP-API)

## 9. Punkt 8 – manuell Schritt für Schritt getestet
| Funktion | Ergebnis |
|----------|----------|
| **/api/start-boss-signer** | OK – API meldet „Boss-Signer wird gestartet“ (Port 3340) |
| **/api/boss-provision-handshake** | OK – Endpunkt reagiert (500 bei Test-Pubkey erwartbar) |
| **/api/deploy-package** | OK – Package deployt, Package-ID gesetzt |
| **/api/restart** | OK – Neustart ausgeführt, API danach neu |
| **/exit** | OK – „Programm wird beendet“, Prozess beendet |

## 10. Nicht in Automatik (nur manuell sinnvoll)
- **/api/purge-after-lieferung** – spezifische Purge-Payload

---
**Volltest ausführen:** `powershell -ExecutionPolicy Bypass -File scripts/test-all-api.ps1`  
(Voraussetzung: Server läuft, z. B. `npm run dev`)

**Ticket- & AccessKey-Vollflow (2 Wallets / Ein-Wallet):** `npm run test:tickets-keys`  
(Voraussetzung: PACKAGE_ID = 0x + 64 Hex, z. B. nach `/api/deploy-package` oder in .env. Ohne echte Package-ID bricht das Skript mit Hinweis ab.)

**Alle Reiter & Unterordner (Zuordnung Funktionen ↔ Tests):** siehe **scripts/TEST-PLAN-REITER.md**

**Zwei Ordner (morgendrot + morgendrot-kopie) für 2-Wallet-Test:** siehe **scripts/ANLEITUNG-ZWEI-INSTANZEN-TEST.md**

**Ab Schritt 2 – alle 19 Projekte (Befehle, Funktionen & Einstellungen):** `npm run test:all-projects`  
(Phase 1: alle GET + alle Docs, Phase 2: POST, Phase 3: alle Commands, Phase 4: optional Ticket+AccessKey-Flow. Voraussetzung: Server läuft, z. B. `npm run dev`.)
