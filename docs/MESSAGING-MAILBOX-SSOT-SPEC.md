# Messaging: IOTA-Mailbox als primärer Speicher (Zielbild + „Persistent“-Schalter)

**Zweck:** Architektur- und UX-Vorgabe für **persistente** Chat-/System-Nachrichten auf der **IOTA-Mailbox** (`MAILBOX_ID`, Shared Object), abgeglichen mit dem **Ist-Code**, inkl. **„Persistent“-Schalter** (Event vs. Mailbox-Anker).  
**Stand:** 2026-04-16  
**Verknüpft:** `docs/ROADMAP-FAHRPLAN.md` (**§ H.12**, **§ H.15**, **§ H.22** / **`docs/MESSENGER-KANAL-MAILBOX-MEILENSTEINE.md`** M1–M4), `docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`, `docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`, `docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`, `move-test/sources/messaging.move`, `src/chain-access.ts`, `src/messenger-nest/messenger-fetch.ts`, `src/messenger-nest/messenger-chain-wrap.ts`, `frontend/frontend/lib/mailbox-send-hybrid.ts`, `frontend/frontend/hooks/use-chat-view-handle-send.ts`

---

## 1. Zielbild (Produkt)

Die **Mailbox** soll für alles, was **zuverlässig abholbar** und **bestandteil der Historie** sein soll, die **bevorzugte on-chain Quelle** werden:

- **Verschlüsselte** 1:1-/Gruppen-Nachrichten (bestehend: `MsgKey` + `store_encrypted_message*`).
- **Klartext**, wenn der Betrieb das **bewusst** will (Konfiguration + UX, siehe § 4).
- **System-/Dienst-Nachrichten** nach einheitlichem Schema (Typ-Flag, TTL), sofern nicht nur ephemer.

**Ausgenommen** (explizit): reine **Asset-Transfers** (Coins/NFTs) ohne Messaging-Semantik.

**Nicht-Ziele (ohne separates Konzept):**

- **LoRa LUMA/CHROMA** als vollständiger **Primärpfad** in die Mailbox (Volumen, Kosten, PTB-/UTF-8-Limits, Airtime). Funk bleibt **Transport**; optional später **Archiv-/Mirror**-Scheibe mit Budget.
- Ersetzen von **Mesh**, **Offline-Warteschlange** und **Direct-IOTA-Client-Submit** durch Mailbox allein.
- Behauptung „ohne Indexer-Scan“: Abholen bleibt ein **paginierter Scan** der Dynamic Fields unter `MAILBOX_ID` + `multiGetObjects` — gemeint ist **deterministische** Inbox statt „nur zufällig Events querlesen“.

---

## 2. Ist-Stand (kritisch, code-nah)

### 2.1 Move (`messaging.move`)

Es gibt **keinen** generischen `store_message`-Eintrag; relevant sind u. a.:

- **`MsgKey`** + verschlüsselte Nutzlast (`store_encrypted_message*`, Credits-Varianten).
- **`PlainMsgKey`** + Klartext im Objekt (`store_plaintext_message*`, ggf. mit parallelem **Event** `store_plaintext_mailbox_emit` — je nach Entry).
- **`HsKey`** (Handshake), Purge/TTL/Rebate nach Paket.

**„Generische Blobs“** als neuer DF-Typ = **neues Move-Design** (Limits, Credits, Purge), nicht nur ein UI-Schalter.

### 2.2 `messenger-fetch.ts`

- Mailbox-Modus: **alle** `getDynamicFields` unter `MAILBOX_ID` (paginiert), dann Filter nach **DF-Typ** (`MsgKey` vs. `PlainMsgKey`), **nicht** nach einem Chain-Feld `is_encrypted`.
- Verschlüsselt: Felder `iv` / `ciphertext` / `tag` mit Längen-Checks.
- Klartext: nur wenn **`MAILBOX_STORE_PLAINTEXT`** und passende Move-Pfade aktiv sind.

### 2.3 Send-Pfade

- **Verschlüsselt:** `store_encrypted_message*` (Mailbox-Modus) bzw. Hybrid **Direct-IOTA zuerst** (`mailbox-send-hybrid.ts` → `@morgendrot/core`), API `/send` als Fallback (**§ H.15**).
- **Klartext:** `storePlaintextMessage` in `chain-access.ts` wählt zwischen **Mailbox-Store** und **nur Event** (`send_plaintext_message`). **`sendPlaintextOnly`** (`messenger-chain-wrap.ts`) setzt aktuell **`forceLegacyPlaintext: true`** → **immer Event-Pfad** für `/send-plain` über diese API-Schicht, unabhängig von `MAILBOX_STORE_PLAINTEXT`.

Damit ist die Aussage „nur Verschlüsseltes landet in der Mailbox“ für den **Standard-API-Klartextweg** praktisch **zutreffend**; technisch **kann** die Mailbox Klartext, wird aber durch **`forceLegacyPlaintext`** umgangen.

---

## 3. Umsetzungsphasen (Engineering)

| Phase | Inhalt |
|-------|--------|
| **A** | **`forceLegacyPlaintext`** / Composer-**Persistent**-Schalter abstimmen; bei Modus „Mailbox“ Klartext über `storePlaintext_message*` (ohne Force-Flag); Fetch bleibt typbasiert. |
| **B** | System-Nachrichten-Typ + TTL in Wire/API vereinheitlichen; Boss-/Kommandant-Pfade prüfen. |
| **C** | Optional: große Blob-Typen / LoRa-Archiv — **eigenes** Größen-/Kosten-Paket. |

---

## 4. UX: „Persistent“-Schalter (Analog „Brief-Priorität“)

**Hinweis:** Im Repo gibt es **keine** bestehende UI-Komponente „Brief-Priorität“; der Schalter ist **neu** und nur **konzeptionell** an vertraute Post-Metaphern angelehnt.

### 4.1 Modi

| Modus | Label (Vorschlag) | Technik (Ziel) | Nutzen |
|--------|-------------------|----------------|--------|
| **Standard** | **Schnell & günstig** | Wo möglich **Event**-Pfad (`send_plaintext_message` / Legacy-Klartext), ggf. ohne Mailbox-Objekt-Zuwachs | Live-Chat, beide online, weniger Storage-Last |
| **Persistent** | **Sicher & permanent (Anker)** | **`store_plaintext_message*`** / verschlüsselt wie heute **`store_encrypted_message*`** — Inhalt im **Mailbox-Objekt** (TTL/Purge nach Policy) | wichtige Anweisungen, Dokumentationsfäden, Empfänger **offline** |

### 4.2 Persistenz (lokal, Vorschlag)

- **`localStorage`**-Schlüssel: `morgendrot.messagingPersistenceMode`
- Werte: **`event`** (Default, rückwärtskompatibel zum heutigen `/send-plain`-Verhalten) | **`mailbox`**
- Geltungsbereich: **Klartext**-Sendungen über **Online/IOTA** im privaten Chat (und ggf. Pinnwand, sobald Product-Regeln klar); **Verschlüsselt** bleibt ohnehin überwiegend Mailbox — UI kann den Schalter dort **ausblenden** oder nur „bereits persistent“ anzeigen.

### 4.3 Events nur für Ephemera (Zielbild, nicht vollständig im Move)

**Typing / Read-Receipts** als reine Events: **Zusatz-Epic** — im aktuellen Paket nicht als fertiger Kanal modelliert; hier nur **Platzhalter** in der Roadmap (siehe unten).

---

## 5. Single Source of Truth (ehrliche Grenze)

- **SSOT** für **„was unter `MAILBOX_ID` als DF liegt“`** und von `/fetch` + Direct-Inbox konsistent gelesen werden kann.
- **Mesh**, lokale Mesh-Zeilen und **Client-Outbox** bleiben **parallel**, bis explizit gespiegelt (`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`).

---

## 6. Kosten / Betrieb

- Mailbox-Einträge: **Storage Deposit**, optional **Messenger-Credits**, **TTL**, **Purge/Rebate** — skaliert mit Nachrichtenvolumen.
- **„Revisionssicher“** = **zustandsbasiert on-chain abrufbar**; rechtliche Archivierung bleibt **organisatorisch** getrennt.

---

## 7. Roadmap-Übersicht (wo es weitergeht)

Die **operative** Lieferliste steht in **`docs/ROADMAP-FAHRPLAN.md`** (Phasen **A → B → C**, gekoppelt an **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**). Kurzüberblick:

| Dokument / Kapitel | Inhalt |
|--------------------|--------|
| **`docs/ROADMAP-FAHRPLAN.md`** | **§ A** technische 8-Punkte-Liste; **§ H.0** Produkt/UX vorgezogen; **§ H.1–H.2** Phase A (Messenger, PWA, Tests); **§ H.3** Phase B (Mesh v2, Delayed LoRa→IOTA); **§ H.12** Sync/SSOT; **§ H.15** Handy-first / Client-IOTA / Hybrid; **§ C.0b** kanonische Ausführungsreihenfolge |
| **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** | Meshtastic-First, Anti-Feature-Creep, A/B/C-Leitplanke |
| **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** | Vertrauen, SBOM, Keystore-Pfade, Abgrenzung Hochzulassung (**§ H.10** im Fahrplan) |
| **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** | Offline-Queue, Idempotenz, Konflikte (**§ H.12**) |
| **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** + **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** | Direct-RPC vs. Relay, **§ H.15** |

**Empfehlung für die nächste Roadmap-Session:** Diese Spec (**Mailbox + Persistent**, Wegfall pauschalen **`forceLegacyPlaintext`**) mit **§ H.12** und **§ H.15** verzahnen — im Fahrplan festgehalten (**`docs/ROADMAP-FAHRPLAN.md`**: **Nachtrag 2026-04-16 (Mailbox …)**, **§ C.1** Punkt **3**, **§ C.0b** „nächste Scheiben“). **§ H.15 Stufe 2** (manuelles Smoke **`HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**) steht dort **nach** Schreibtisch-/PWA-/Mailbox-Prioritäten **hinten**. **LoRa-Feldtests** (**§ H.3**, `HANDY-TEST-WINDOW`) **hinten an**, bis dieses Paket durch Ritual (`TESTING.md`) abgesichert ist.

---

## 8. Nächste konkrete Schritte (Checkliste)

1. Produkt: Default **`event`** vs. **`mailbox`** pro Rolle / Kanal (Privat vs. Pinnwand) — **Backlog** (aktuell global + `localStorage`).  
2. **Ist:** Backend **`sendPlaintextOnly`** / API **`messagingPersistenceMode`** → **`forceLegacyPlaintext`** nur bei **`event`** (Default); **`mailbox`** wenn Move/`.env` passen (`messenger-chain-wrap.ts`, **`api-server`**).  
3. **Ist:** Frontend **Transport-Card** (Nur Event / Mailbox) + **`mailbox-send-hybrid`** / **`use-chat-view-handle-send`**.  
4. **Ist (Teil):** Vitest **`buildApiCommandPostBody`** (`execute-command.test.ts`); Fetch-Mix / Chain-Fetch — bei Touch **`chain-access`** / **`messenger-fetch`** weiter **`TESTING.md`** + Smoke.  
5. Doku: **`CHANGELOG`** / **`TEST-RUN-LOGBOOK`** bei Release oder größerem Merge nachziehen.

---

*Dieses Dokument ersetzt keine Move-Audit-Checkliste; vor Package-Änderungen weiterhin Move-Tests und Deploy-Prozess beachten.*
