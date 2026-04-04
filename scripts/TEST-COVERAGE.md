# Test-Abdeckung: Alle Funktionen im Projekt

Übersicht, welche API-Endpunkte und Befehle wo getestet werden.

---

## 1. GET-Endpunkte (api-server.ts)

| Endpunkt | test-all-projects-full | run-all-9-tiles | run-messages |
|----------|------------------------|-----------------|--------------|
| /api/status | ✅ | indirekt (Setup) | ✅ |
| /api/current-ids | ✅ | ✅ | – |
| /api/package-id-history | ✅ | – | – |
| /api/package-id-hints | ✅ | – | – |
| /api/config | ✅ | ✅ (Kachel 3, 8) | – |
| /api/doc | ✅ (18 Docs) | – | – |
| /api/connect-addresses | ✅ | – | ✅ |
| /api/chain-reachable | ✅ | – | ✅ |
| /api/help | ✅ | – | ✅ |
| /api/find-peer-handshake | ✅ | – | ✅ |
| /api/has-valid-ticket | ✅ | ✅ (Kachel 2) | – |
| /api/list-tickets | ✅ | ✅ (Kachel 2, 3) | – |
| /api/list-keys | ✅ | ✅ (Kachel 2, 3) | – |
| /api/rebate-candidates | ✅ | – | – |
| /api/monitor-status | ✅ | ✅ (Kachel 4, 5) | – |
| /api/audit-export | ✅ (csv + pdf) | – | – |

**Lücken:** keine.

---

## 2. POST-Endpunkte (api-server.ts)

| Endpunkt | test-all-projects-full | run-all-9-tiles |
|----------|------------------------|-----------------|
| /api/package-id-hints | ✅ | – |
| /api/config | ✅ | – |
| /api/unlock | ✅ (falsches Passwort) | ✅ (richtiges Passwort) |
| /api/restart | ❌ | ❌ (destruktiv) |
| /api/generate-address | ✅ | ✅ (Kachel 9) |
| /api/deploy-package | – | ✅ (Kachel 9) |
| /api/start-boss-signer | ❌ | ❌ |
| /api/boss-provision-handshake | – | ✅ (optional, ohne Pubkey) |
| /api/command | ✅ (alle Commands) | ✅ (alle Kacheln) |
| /api/purge-after-lieferung | ✅ (Body purges: [] → 400/503) | – |
| /api/start-boss-signer | ✅ (SKIP wenn CLI fehlt) | – |

**Lücken:**
- **POST /api/restart** – bewusst nicht automatisiert (beendet/startet Server).

---

## 3. Befehle (/api/command)

| Befehl | test-all-projects-full | run-all-9-tiles | run-messages | run-ticket-accesskey |
|--------|------------------------|-----------------|--------------|----------------------|
| /help | ✅ | – | – | – |
| /set-package-id | – | ✅ (B) | – | ✅ (B) |
| /handshake | ✅ | ✅ | ✅ | – |
| /connect | ✅ (ohne Args) | ✅ (mit Adresse) | ✅ | – |
| /send | ✅ | ✅ | ✅ | – |
| /send-plain | ✅ | ✅ | ✅ | – |
| /fetch | ✅ (5) | ✅ (10, 5 mit Sender) | ✅ (10, 5, 3, mit Sender) | – |
| /purge-handshake | ✅ | ✅ (optional) | ✅ (optional) | – |
| /purge-msg | ✅ (99999) | ❌ | – | – |
| /vault-save | ✅ | ✅ (optional) | – | – |
| /vault-onchain | ✅ | ✅ (optional/skip) | – | – |
| /emergency-purge | ✅ | ✅ (optional) | – | – |
| /transfer-coins | ✅ | ✅ | – | – |
| /create-key | ✅ | ✅ (mehrfach) | – | ✅ |
| /create-keys | ✅ | ✅ (2 Keys, 1 Tag) | – | – |
| /list-keys | ✅ | – (nur GET) | – | – |
| /list-tickets | ✅ | – (nur GET) | – | – |
| /emergency-purge-key | ✅ | ✅ | – | ✅ |
| /purge-key | ✅ | ✅ | – | ✅ |
| /transfer-key | ✅ | ✅ | – | ✅ |
| /create-ticket | ✅ | ✅ | – | ✅ |
| /use-ticket | ✅ | ✅ (wenn list) | – | ✅ |
| /transfer-ticket | ✅ | ✅ (wenn list) | – | ✅ |
| /emergency-purge-ticket | ✅ | ✅ (wenn list) | – | ✅ |
| /purge-ticket | ✅ | ✅ (wenn list) | – | ✅ |
| /exit | nicht sinnvoll (beendet Server) | – | – | – |

**Lücken:**
- **/purge-msg** – nur in test-all-projects-full (SKIP ohne MAILBOX); nicht im Chat-Real-World (run-messages/run-all-9-tiles). Optional mit MAILBOX in run-messages ergänzbar.

---

## 4. Zusammenfassung: Nicht oder nur teilweise getestet

| Funktion | Empfehlung |
|----------|------------|
| POST /api/restart | Bewusst nicht automatisiert (Neustart). |
| /purge-msg | Nur in test-all-projects-full; mit MAILBOX optional in run-messages/run-all-9-tiles. |

---

## 5. Test-Skripte im Überblick

| Skript | Zweck |
|--------|--------|
| **test-all-projects-full.ts** | GET/POST/Commands (eine Instanz), optional test-tickets-keys-flow. |
| **run-all-9-tiles-realworld.ts** | Alle 9 Kacheln mit 2 Wallets (Real-Life). |
| **run-scenarios-realworld.ts** | Szenarien: Tür mit NFT, Boss→Kommandant→Arbeiter, Zahlung, Pinnwand (2–3 Wallets). Siehe **SZENARIEN-PLAYBOOK.md**. |
| **run-messages-chat-realworld.ts** | Chat: Handshake, Connect, Send, Fetch (inkl. Sender), Send-Plain, Purge-Handshake. |
| **run-ticket-accesskey-realworld.ts** | Ticket + AccessKey komplett mit 2 Wallets. |
| **run-remaining-tests.ts** | Verbleibende Lücken: Konfig setzen/lesen, PARTNER_ADDRESSES (3 Partner), Monitor+MONITOR_DEVICES, Pinnwand+AUTHORIZED_SENDERS, Lock+Zahlung, purge-msg, vault-Hinweise, Ticket-Metadata (tier/promo). **Aufruf:** `npm run test:remaining`. |
| **test-tickets-keys-flow.ts** | Wird optional von test-all-projects-full aufgerufen. |

Alle Funktionen sind mindestens in **test-all-projects-full** (Phase 1–3) abgedeckt; Ausnahmen: restart, start-boss-signer, purge-after-lieferung. Der 2-Wallet-Real-World-Flow deckt die wichtigsten Szenarien in **run-all-9-tiles** und **run-scenarios-realworld** ab.

---

## 6. Szenarien durchspielen (mit dir zusammen)

Was man **effektiv** mit den Funktionen macht, steht in **scripts/SZENARIEN-PLAYBOOK.md**:

- **Tür mit NFT:** Schloss stellt Key aus → Gast sendet "open" → (Lock führt OPEN aus, Log prüfen).
- **Boss → Kommandant → Arbeiter:** Boss sendet Anweisung an Kommandant; Kommandant sendet "open" an Arbeiter (Lock); alle Kombinationen.
- **Zahlung → Freischaltung:** B zahlt an A (Lock) → OPEN im Lock-Log.
- **Pinnwand, Ticket, Key-Liste** usw.

**Aufruf:** `npm run test:scenarios` (optional: `API_BASE_C=http://127.0.0.1:3346` für 3. Instanz = Arbeiter).  
**Deine Prüfung:** Bei laufendem Lock (ROLE=lock bzw. ROLE=arbeiter) im Log „OPEN GRANTED“ bzw. „Zahlungs-Trigger … OPEN“ prüfen.
