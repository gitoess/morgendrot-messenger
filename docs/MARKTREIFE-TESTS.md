# Marktreife – Tests und nächste Schritte

**Stand:** Nach Clean-Run Tiles (113/113). Ziel: belastbares Produkt für Mainnet und Firmenkunden.

**Hinweis:** Nach Code-Änderungen (z. B. chain-access, wallet-bridge) Backend **neu starten**, damit die laufende API den neuen Code nutzt. Tiles-/Stresstests sprechen mit dem bereits laufenden Backend.

---

## 1. Was ihr bereits habt (Fundament)

| Bereich | Ist-Zustand |
|--------|-------------|
| **Funktionale Abdeckung** | Tiles: 118 Kombinationen (Nachricht, Zutritt, Tickets, Rebate, Streams, Device) + Phase E; Clean-Run bestanden. |
| **Serialisierung & Gas** | `withTxSerial(gasPayerKey)` pro Gas-Payer; explizite Gas-Coins im Non-Sponsor-Pfad; Retry bei „not available for consumption“. |
| **Rollenprüfung** | API: `getRequiredPermissionForCommand` + `getHierarchyPermissions(role)` → 403 für keyIssue/revokeDown/commandDown je nach ROLE. Wallet-Bridge: `hasRoleBit(ROLE_BITS.*)`. |
| **Rate-Limit** | `API_RATE_LIMIT_COMMANDS_PER_MINUTE` (0 = aus). Für Produktion konfigurierbar. |
| **Replay-Schutz** | OPEN-Befehle: `replay-state.ts` + `REPLAY_STATE_FILE` (Nonce pro Sender). Kein generischer TX-Replay-Schutz für /send-plain. |
| **Gas/Rebate** | `parseGasSummary(effects)` → `gasSummary` (computationCost, storageCost, storageRebate); wird in wallet-bridge bei Key/Ticket/Purge durchgereicht. Keine Aggregation/Dashboard. |
| **Stress** | `run-stress-test.ts`: API/Infra (Status + /help), kein On-Chain. `run-realworld-64-profiles-stress.ts`: viele Befehle gegen ein Backend (ein Wallet). `run-stress-test-ollama.ts`: KI-Last. |

---

## 2. Die vier Säulen – Bewertung und Sinnhaftigkeit

### 2.1 Chaos-Test (Resilience)

| Test | Sinnvoll? | Empfehlung |
|------|-----------|------------|
| **Netzwerk-Jitter (5–10 s Lags)** | Ja. | API- oder Proxy-Layer: künstliche Verzögerung (z. B. 5 s) vor Antwort; Tiles oder Stresstest mit erhöhtem Timeout. Prüfen: Kein Doppel-Submit, keine verlorenen Nonces. |
| **Duplicate / Replay** | Ja. | **A)** Gleiche Nachricht zweimal schnell senden: heute können zwei TXs mit gleichem Inhalt (evtl. gleiche Nonce bei gleicher ms) landen. **B)** Optional: Idempotency-Key pro Befehl (z. B. Client sendet `idempotencyKey: uuid`); Backend lehnt zweite gleiche Key innerhalb X Sekunden ab. **C)** Replay für OPEN ist bereits abgedeckt (REPLAY_STATE_FILE). |
| **Backend-Crash / Nonce-Wiederfinden** | Ja. | Backend mitten im Lauf killen; Neustart. Prüfen: Wallet/Nonce „verhakt“ oder nicht. Heute: Nonce für Nachrichten = `Date.now()` (kein persistenter Zähler); nach Neustart kein Verhaken. Kritisch wäre nur, wenn ihr einen streng monotonen Zähler pro Sender persistiert – dann Crash-Recovery testen. |

**Konkrete Schritte:**  
- Skript „Chaos“: z. B. 50 On-Chain-Befehle, bei 25. Befehl 8 s künstliche Latenz (z. B. via Proxy oder `setTimeout` im Test), danach weiter; Auswertung: alle ok, keine Doppel-TX.  
- Optional: kleines „Replay“-Skript: zweimal denselben /send-plain (gleicher Text, gleiche Adresse) im Abstand von 100 ms; definieren, ob zweite Antwort „already sent“ sein soll (dann Idempotency einbauen) oder zwei TXs akzeptabel sind.

---

### 2.2 Echte Parallelität (Multi-Payer / 4 Wallets)

| Aspekt | Bewertung |
|--------|-----------|
| **withTxSerial pro gasPayerKey** | Serialisierung nur **pro Gas-Payer**. Mehrere Gas-Payer = parallele Ketten. |
| **4 Wallets** | Sehr sinnvoll: 4 Backend-Instanzen (4 Mnemonics, 4 Ports) oder 1 Backend mit 4 „Payer“-Rollen – je nach Architektur. Ziel: 4 × 250 Aktionen parallel, Gesamtdauer deutlich unter 4 × Einzel-Serial. |
| **Shared Objects** | Bei gleicher Package-ID: prüfen, ob Move/Sui-Objekt-Konflikte (z. B. gemeinsamer Lock) bei parallelen TXs von verschiedenen Payern auftreten. Tiles/Phase E nutzen überwiegend pro-TX-Objekte; trotzdem explizit testen. |

**Konkreter Plan (4-Wallet-Stresstest):**

1. **Vorbereitung:** 4 Mnemonics, je mit Testnet-IOTA. 4 Backend-Instanzen: Ports 3342, 3343, 3344, 3345; je eigenes `.env` (MY_ADDRESS, Mnemonic/Wallet), gleiche PACKAGE_ID/RPC.
2. **Lauf:** Ein Skript („Orchestrator“) startet parallel 4 Worker: je Worker = eine API_BASE, z. B. 250 Befehle Phase-E-ähnlich (create-key/ticket mit variierenden TTL/Adressen). Alle 4 laufen gleichzeitig.
3. **Metriken:** Gesamtzeit, Erfolgsrate pro Wallet, Explorer: TXs von allen 4 Adressen in denselben Blöcken (parallele Einordnung).
4. **Akzeptanz:** z. B. 1.000 Aktionen (4 × 250) in unter 15–20 Min, 100 % Erfolg (oder definierter Schwellenwert).

Technisch: Neues Skript `scripts/run-parallel-4-wallets-stress.ts`, das `API_BASES='http://127.0.0.1:3342,http://127.0.0.1:3343,...'` nutzt und pro Base eine feste Anzahl On-Chain-Befehle abfeuert (parallel mit Promise.all oder Worker-Threads).

---

### 2.3 Sicherheits-Audit (Penetration)

| Test | Ist-Zustand | Empfehlung |
|------|-------------|------------|
| **Rollen-Exploit** | API: 403 für keyIssue/revokeDown/commandDown wenn ROLE=arbeiter bzw. Kommandant ohne Recht. Wallet-Bridge: hasRoleBit. | Explizit testen: Backend mit ROLE=arbeiter starten, POST /api/command mit `/create-key` → erwartet 403. Optional: ROLE=kommandant, `/purge-key` → 403. |
| **Gas-Exhaustion** | Kein harter Limit pro Wallet; Rate-Limit nur pro IP (wenn gesetzt). | **A)** `API_RATE_LIMIT_COMMANDS_PER_MINUTE` in Produktion setzen. **B)** Optional: Obergrenze „max On-Chain-Befehle pro Stunde“ oder „max Gas pro Tag“ (Konfiguration + Abbruch wenn erreicht). **C)** Stresstest: viele ungültige/teure Anfragen (z. B. falsche Adressen, die trotzdem Gas verbrauchen) – prüfen, dass Wallet nicht leergepumpt wird oder Queue verstopft. |

**Konkrete Schritte:**  
- Kleines „Security-Check“-Skript: Start (oder Mock) Backend als „arbeiter“, Aufruf `/create-key`, `/purge-key`, `/boss-command` → alle 403.  
- Dokumentation: Empfehlung für Produktion (Rate-Limit, ggf. API-Auth wenn API von außen erreichbar).

---

### 2.4 Wirtschaftliche Vorhersagbarkeit (Kosten-Dashboard)

| Aspekt | Ist-Zustand | Empfehlung |
|--------|-------------|------------|
| **Gas/Rebate pro TX** | `gasSummary` (computationCost, storageCost, storageRebate) pro signAndExecute; in Antworten von create-key, create-ticket, purge durchgereicht. | **A)** Aggregation: z. B. in-memory oder Log-Datei: pro Tag/Woche Summe `gasUsed - storageRebate` (Netto-Gas). **B)** Optional API-Endpoint: `GET /api/stats/gas` → letzte N TX, Summen, Durchschnitt. **C)** Mainnet-Simulation: Testnet-Kosten (z. B. 10.000 Aktionen) in IOTA, dann Umrechnung auf Mainnet-Preis (z. B. IOTA/EUR) → „1.000 Mitarbeiter ≈ X €/Monat“. |

**Konkrete Schritte:**  
- Minimal: Logging aller `gasSummary` in strukturierter Form (JSON-Line); kleines Auswertungsskript für 1.000/10.000 Aktionen (Summe, Netto, Mittelwert).  
- Optional: einfaches Dashboard (z. B. in der bestehenden UI) oder statische Auswertung nach Stresstest (z. B. nach 4-Wallet-Lauf).

---

## 3. Priorisierung für Marktreife

1. **4-Wallet-Parallel-Stresstest** (Skript + einmaliger Lauf) – beweist Skalierbarkeit und Concurrency.  
2. **Chaos/Resilience** – Jitter + optional Replay/Idempotency; Backend-Crash optional.  
3. **Security-Check** – Rollen-Exploit automatisiert; Rate-Limit + Empfehlungen dokumentieren.  
4. **Kosten-Dashboard** – Gas/Rebate aggregieren, Mainnet-Simulation als Verkaufsargument.

---

## 4. Nächster konkreter Schritt: 4-Wallet-Stresstest

- **Mindestens 4 Wallets** wie besprochen: Durchbrechen der Serialisierungs-Mauer, Concurrency, Risiko-Verteilung, realistische Last.  
- **Skript:** `scripts/run-parallel-4-wallets-stress.ts`  
  - Konfiguration: 4 API-Basen (Umgebungsvariable oder Default 3342–3345).  
  - Pro Base: z. B. 250 Aktionen (Phase E: create-key / create-ticket mit variierenden Parametern).  
  - Parallel ausführen (z. B. 4 parallele async-Läufe), gemeinsame Zeitnahme, am Ende: passed/failed pro Base, Gesamtzeit, Hinweis auf Explorer (Adressen prüfen).  
- **Voraussetzung:** 4 Backends laufen, Wallet je entsperrt, gleiche Package-ID/RPC.  
- **Erfolg:** Alle 1.000 Aktionen bestanden, Gesamtzeit unter definiertem Ziel (z. B. 15–20 Min als Richtwert).

Die genannten Zahlen (15 Min, 10.000 TX etc.) sind Beispiele und können je nach Testnet und Ziel angepasst werden.
