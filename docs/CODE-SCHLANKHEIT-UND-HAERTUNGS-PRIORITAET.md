# Code-Schlankheit & Härtung: kritische Prüfung der „Top-5“-Priorität

**Status:** **Umsetzungs-Reihenfolge** — Ziel ist **weniger verwirrende Oberfläche** (klare Zustände), **weniger doppelte Buchungen** (Idempotenz), **kein Wildwuchs** neuer Dateien ohne Löschen von Altem.

**Verknüpft:** **`docs/ROADMAP-FAHRPLAN.md`** § **H.13**, § **H.14** (**`docs/MORGENDROT-HARDENING-V3-PRECISION.md`**), § **H.1a** (**`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`**), **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**, **`docs/MESSENGER-STRATEGIC-PRINCIPLES-LOCAL-FIRST-IDEMPOTENCY-PQ.md`**, **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`**, **`docs/API-INITIAL-PROFILE.md`**, **`docs/API-PROVISION-DEVICE-IDEMPOTENCY-SKIZZE.md`** (`provision-device`), **`docs/API-VOUCHER-CLAIM-SPEC.md`**, **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`**.

---

## 1. Fazit in einem Satz

**Schlank** wird der Code **nicht** durch „noch eine zentrale Datei“, sondern durch **eine** durchgängige **Status-/Schnittstellen-Semantik** (lokal vs. chain-bestätigt), **durchgesetzte** Idempotenz **pro Vorgangstyp** und **Aufteilen** des Monolithen **`api-server.ts`** in testbare Module — dabei **Duplikate entfernen**, nicht nur verschieben.

---

## 2. Fehler in der ursprünglichen „Top-5“-Liste

| Behauptung | Korrektur |
|------------|-----------|
| **`src/iota/wallet-bridge.ts`** | Existiert **nicht**. Wallet-Bridge liegt unter **`src/wallet-bridge.ts`**. |
| **`src/iota/chain-access.ts`** | Existiert **nicht**. Chain-Zugriff liegt unter **`src/chain-access.ts`**. |
| **`frontend/frontend/lib/messenger-logic.ts`** | Existiert **nicht**. Transport/Umschaltung ist **verteilt**, u. a. **`frontend/frontend/lib/chat-view-messenger-transport.ts`**, Hooks wie **`use-chat-view-core.ts`**, Inbox/Merge **`use-chat-view-inbox.ts`**, Delayed-Queue **`delayed-mirror-queue.ts`** / **`use-chat-view-mirror-delay.ts`**. |
| **`POST /api/claim`** | So heißt der Endpunkt **nicht**. Öffentlicher Voucher-Flow: **`POST /api/voucher-claim`** (siehe **`voucher-claim-state.ts`**, **`docs/API-VOUCHER-CLAIM-SPEC.md`**). Shop: u. a. **`/api/shop/session-claim`**. |
| **`OFFLINE-QUEUE-…` als einzige „Single Source of Truth“** | **Überzogen.** Diese Datei regelt **Boss-Relay-Queue / Profil-Payload** — **nicht** alle Rollen (`initialProfile` ist zusätzlich **`docs/API-INITIAL-PROFILE.md`**, Sync-Gesamtbild **`SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**). |

**PTB-Größe:** In **`chain-access.ts`** ist die serielle TX bewusst unter **`~128 KiB`** gedeckelt (`maxTxBytes = 128 * 1024 - 4096`) — die Formulierung „128-KB-Grenze“ ist **inhaltlich richtig**, aber **Härtung** bedeutet hier: alle **Batch-Pfade** (Credits, Tickets, …) müssen **dieselbe** Kappe respektieren und **keine** stillen Teilüberschreitungen erlauben.

---

## 3. Korrigierte Prioritäten (technisch sauber benannt)

1. **`src/api-server.ts`** — Zentral; **Idempotenz** für **tatsächliche** Claim-/Shop-Routen prüfen und **provision-device** auf **Doppel-POST**-Szenarien (z. B. gleicher Client, erneuter Klick) **klar** machen (HTTP-/State-Verhalten dokumentieren und ggf. Request-Id). **Mittelfristig:** Router in **`src/api/*`** auslagern, um Datei **kleiner** und Tests **einfacher** zu machen — das ist **Schlankheit** im Sinne von **Wartbarkeit**.
2. **`src/voucher-claim-state.ts`** (+ Aufrufer in **`api-server.ts`**) — **`consumeClaimTokenOnce`** ist bereits **idempotent** auf Token-Ebene; „wasserdicht“ prüfen heißt: **alle** nachgelagerten **Chain-Schritte** bei **Doppelklick/Retry** ebenfalls **deterministisch** (kein zweites Mint ohne Absicherung).
3. **`src/wallet-bridge.ts`** — **Local-First / Offline-Vorbereitung** von Signaturen nur, wo das **SDK/Flow** das hergibt; oft hängt „signieren“ an **frischen Object-Refs** der Chain — dann ist „offline vorbereiten“ **teilweise** möglich (Intent cachen), **nicht** blind versprechen. Grenze explizit in Doku/Comments.
4. **`frontend/frontend/`** — Statt einer fiktiven **`messenger-logic.ts`**: **einen** dünnen **Status-Typ** („lokal queued“ / „relay gesendet“ / „mailbox sichtbar“) aus den bestehenden Hooks **konsolidieren** — idealerweise **ohne** riesige neue Schicht; **Duplikat-Logik löschen**.
5. **`src/chain-access.ts`** — PTB-Limits, **Batching**, **Credits-Pfade**: keine **Geister-Credits** = **Ledger + Idempotenz + klare Fehler** bei halb erfolgreichen PTBs; eng mit **`settlement-queue.ts`** und **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`** abstimmen.
6. **Doku-Set (kein Monopol einer Datei):** **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`** + **`docs/API-INITIAL-PROFILE.md`** + **`SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** — Rollen wie „Sanitäter“ über **`initialProfile`** / UI-Einsatzlabels, **ohne** Move-Rolle umzubauen (siehe bestehende Kritik-Specs).

---

## 4. In den Fahrplan aufnehmen?

**Ja — kurz und gebunden an Umsetzung**, nicht als neues Parallel-Epik: Im Fahrplan **§ H.13** (siehe **`ROADMAP-FAHRPLAN.md`**). **Priorität:** mit **§ H.12** und **Phase B** (Delayed Upload) **verzahnen**; **§ H.10** (Sicherheit/Schlankheit) bleibt der **übergeordnete** Härtungs-Track.

---

*Stand: 2026-03-28*
