# Messaging: IOTA-Mailbox als Speicher — Event vs. Persistent (unabhängig von Verschlüsselung)

**Zweck:** Architektur- und UX-Vorgabe für on-chain Nachrichten: **zwei unabhängige Nutzerentscheidungen** (Verschlüsselung × Persistenz) und die daraus resultierenden Move-Pfade. Abgeglichen mit Ist-Code.  
**Stand:** 2026-05-15  
**Verknüpft:** `docs/ROADMAP-FAHRPLAN.md` (**§ H.12**, **§ H.15**, **§ H.22** / **`docs/MESSENGER-KANAL-MAILBOX-MEILENSTEINE.md`** M1–M4), `docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`, `docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`, `docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`, `move-test/sources/messaging.move`, `src/chain-access.ts`, `src/messaging-persistence-resolve.ts`, `src/messenger-nest/messenger-fetch.ts`, `src/messenger-nest/messenger-chain-wrap.ts`, `frontend/frontend/lib/mailbox-send-hybrid.ts`, `frontend/frontend/hooks/use-chat-view-handle-send.ts`, `frontend/frontend/components/chat-view-transport-card.tsx`

---

## 1. Zielbild (Produkt)

### 1.1 Zwei unabhängige Achsen (SSOT-Regel)

Der Nutzer wählt **getrennt**:

| Achse | Optionen | Bedeutung |
|-------|----------|-----------|
| **Vertraulichkeit** | Verschlüsselt / Unverschlüsselt | E2EE (ECDH + AES-GCM) vs. Klartext on-chain |
| **Persistenz** | Flüchtig (Event) / Persistent (Mailbox) | Chain-**Event** vs. Eintrag im **Mailbox-Shared-Object** (`MAILBOX_ID`) |

Die App mappt intern (keine Kopplung „Verschlüsselt ⇒ immer Mailbox“):

| | **Flüchtig (Event)** | **Persistent (Mailbox)** |
|---|---|---|
| **Unverschlüsselt** | `send_plaintext_message` | `store_plaintext_message*` |
| **Verschlüsselt** | `send_encrypted_message` | `store_encrypted_message*` |

**Nutzen Event:** schneller, weniger Storage-Deposit / Mailbox-Last, Live-Chat wenn beide online.  
**Nutzen Mailbox:** Empfänger offline, TTL/Purge-Policy, deterministischer DF-Scan unter `MAILBOX_ID`.

Handshake/ECDH ist **Voraussetzung für verschlüsseltes Senden**, aber **nicht** gleichbedeutend mit „Mailbox speichern“.

### 1.2 Was die Mailbox weiterhin „primär“ sein soll

Für alles, was **zuverlässig abholbar** und **Historie** sein soll, bleibt die Mailbox die **bevorzugte** Quelle — wenn der Nutzer (oder Default-Policy) **Persistent** wählt:

- Verschlüsselte und Klartext-Nachrichten im Modus **mailbox**.
- System-/Dienst-Nachrichten nach einheitlichem Schema (Typ-Flag, TTL), sofern nicht nur ephemer.

**Ausgenommen:** reine **Asset-Transfers** ohne Messaging-Semantik.

**Nicht-Ziele (ohne separates Konzept):**

- **LoRa LUMA/CHROMA** als vollständiger **Primärpfad** in die Mailbox (Volumen, Kosten, PTB-/UTF-8-Limits, Airtime). Funk bleibt **Transport**; optional später **Archiv-/Mirror**-Scheibe mit Budget.
- Ersetzen von **Mesh**, **Offline-Warteschlange** und **Direct-IOTA-Client-Submit** durch Mailbox allein.
- Behauptung „ohne Indexer-Scan“: Abholen bleibt ein **paginierter Scan** der Dynamic Fields unter `MAILBOX_ID` + `multiGetObjects` — gemeint ist **deterministische** Inbox statt „nur zufällig Events querlesen“. **Verschlüsselte Events** können im Posteingang **anders** erscheinen als Mailbox-DFs (Indexer/Event-Subscription) — separates Produkt-/Fetch-Thema.

---

## 2. Ist-Stand (kritisch, code-nah)

### 2.1 Move (`messaging.move`)

Es gibt **keinen** generischen `store_message`-Eintrag; relevant sind u. a.:

- **`MsgKey`** + verschlüsselte Nutzlast (`store_encrypted_message*`, Credits-Varianten) **und** Legacy/Event **`send_encrypted_message`**.
- **`PlainMsgKey`** + Klartext im Objekt (`store_plaintext_message*`) **und** Event **`send_plaintext_message`**.
- **`HsKey`** (Handshake), Purge/TTL/Rebate nach Paket.

**„Generische Blobs“** als neuer DF-Typ = **neues Move-Design** (Limits, Credits, Purge), nicht nur ein UI-Schalter.

### 2.2 `messenger-fetch.ts`

- Mailbox-Modus: **alle** `getDynamicFields` unter `MAILBOX_ID` (paginiert), dann Filter nach **DF-Typ** (`MsgKey` vs. `PlainMsgKey`), **nicht** nach einem Chain-Feld `is_encrypted`.
- Verschlüsselt: Felder `iv` / `ciphertext` / `tag` mit Längen-Checks.
- Klartext: nur wenn **`MAILBOX_STORE_PLAINTEXT`** und passende Move-Pfade aktiv sind.
- **Event-only** Nachrichten (verschlüsselt oder Klartext) erfordern ggf. **zusätzliche** Event-Indexer-/Abhol-Logik — nicht identisch mit Mailbox-DF-Inbox.

### 2.3 Send-Pfade (nach Entkopplung 2026-05)

**API-Feld:** `messagingPersistenceMode`: `event` | `mailbox` (POST `/api/command`, Body neben `/send` und `/send-plain`).

**Auflösung** (`src/messaging-persistence-resolve.ts`):

| Modus | Klartext (`forceLegacyPlaintext`) | Verschlüsselt (`forceLegacyEncrypted`) |
|--------|-----------------------------------|----------------------------------------|
| **`event`** | `true` → `send_plaintext_message` | `true` → `send_encrypted_message` |
| **`mailbox`** | `false` → `store_plaintext_message*` | `false` → `store_encrypted_message*` |
| **Feld fehlt** (CLI/Legacy) | Default **`event`** (wie bisher `/send-plain`-Semantik über API) | Default **`mailbox`** (bisheriges Verhalten wenn `MAILBOX_ID` aktiv) |

**Chain** (`storePlaintextMessage` / `storeEncryptedMessage` in `chain-access.ts`): wählt Store- vs. Event-Pfad anhand der Force-Flags; bei **`mailbox`** ohne gültige Server-Konfiguration → Fehler mit `explainMailboxPlaintextUnavailable` / `explainMailboxEncryptedUnavailable`.

**Nest** (`messenger-chain-wrap.ts`): `sendPlaintextOnly` / `sendEncryptedMessage` reichen die Force-Flags durch; `/send` und `/send-plain` im **`messenger-command-handler.ts`** lesen `opts.messagingPersistenceMode`.

**Frontend:**

- **`localStorage`:** `morgendrot.messagingPersistenceMode` — Default UI **`event`** (`messaging-persistence-mode.ts`).
- **Transport-Card:** Schalter **„Flüchtig (Event)“ / „Persistent (Mailbox)“** bei **online** (1:1/Pinnwand), **sichtbar für verschlüsselt und Klartext**; Kurztext via `describeChainPersistenceRoute()`.
- **Hybrid** (`mailbox-send-hybrid.ts`): reicht Modus an `/send` und `/send-plain` durch; **Direct-IOTA verschlüsselt** nur bei Modus **`mailbox`** (Event → API/Chain-Event).
- **Offline-Warteschlange:** Retry nutzt aktuellen `readMessagingPersistenceModeFromStorage()`.

**CLI** (`wallet-bridge.ts` `/send-plain`): weiterhin explizit **Event** (`forceLegacyPlaintext: true`) — unabhängig von UI-`localStorage`.

---

## 3. Umsetzungsphasen (Engineering)

| Phase | Inhalt | Status |
|-------|--------|--------|
| **A** | Persistenz-Schalter für **Klartext und Verschlüsselt**; `messagingPersistenceMode` → `forceLegacyPlaintext` / `forceLegacyEncrypted`; UI entkoppelt von E2EE; Hybrid + `/send` durchgereicht. | **Umgesetzt** (2026-05-15) |
| **B** | System-Nachrichten-Typ + TTL in Wire/API vereinheitlichen; Boss-/Kommandant-Pfade prüfen; Fetch-Mix Event + Mailbox. | Offen |
| **C** | Optional: große Blob-Typen / LoRa-Archiv — **eigenes** Größen-/Kosten-Paket. | Offen |

---

## 4. UX: Persistenz-Schalter (unabhängig von Verschlüsselung)

**Hinweis:** Konzeptionell an „Eilig vs. Einschreiben“ angelehnt — im Repo als **zweite** Achse neben Verschlüsselung.

### 4.1 UI-Labels (Ist)

| Modus | Label in der App | Chain-Pfad (Kurz) |
|--------|------------------|-------------------|
| **event** | **Flüchtig (Event)** | `send_*_message` |
| **mailbox** | **Persistent (Mailbox)** | `store_*_message*` im Postamt-Objekt |

Begleittext in der Transport-Card: z. B. „Verschlüsseltes Event“ vs. „Verschlüsselt · Mailbox“ / Klartext-Varianten (`describeChainPersistenceRoute`).

### 4.2 Persistenz (lokal)

- **Schlüssel:** `morgendrot.messagingPersistenceMode`
- **Werte:** `event` (Default) | `mailbox`
- **Geltung:** Online/IOTA-Sendungen über Composer (privat, Pinnwand — nicht Gruppen-Kanal-Switch); **nicht** Meshtastic-Funk (Klartext-Transport, eigene Policy).

### 4.3 Verschlüsselung (separate UI-Achse)

- **Verschlüsselt / Unverschlüsselt** — eigener Toggle; Funk erzwingt Klartext.
- **Kontakt & Connect / Gruppe & Connect** nur bei **verschlüsselt** + online (Handshake) — **ohne** Persistenz zu verwechseln.

### 4.4 Events nur für Ephemera (Erweiterung)

**Typing / Read-Receipts** als reine Events: **Zusatz-Epic** — im aktuellen Paket nicht als fertiger Kanal modelliert.

---

## 5. Single Source of Truth (ehrliche Grenze)

- **SSOT** für **„was unter `MAILBOX_ID` als DF liegt“** und von `/fetch` + Direct-Inbox konsistent gelesen werden kann (**Modus mailbox**).
- **Modus event:** SSOT ist die **Transaktions-Event-Historie** / Indexer — **nicht** dieselbe DF-Inbox.
- **Mesh**, lokale Mesh-Zeilen und **Client-Outbox** bleiben **parallel**, bis explizit gespiegelt (`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`).

---

## 6. Kosten / Betrieb

- **Mailbox**-Einträge: Storage Deposit, optional Messenger-Credits, TTL, Purge/Rebate — skaliert mit Volumen.
- **Event**-Pfad: typisch günstiger/schneller, weniger persistente Objektlast — Trade-off bewusst im UI.
- **„Revisionssicher“** (Mailbox-Modus) = zustandsbasiert on-chain abrufbar; rechtliche Archivierung bleibt organisatorisch getrennt.

---

## 7. Roadmap-Übersicht (wo es weitergeht)

| Dokument / Kapitel | Inhalt |
|--------------------|--------|
| **`docs/ROADMAP-FAHRPLAN.md`** | **§ H.12** Sync/SSOT; **§ H.15** Handy-first / Hybrid; Mailbox-Paket (Nachtrag 2026-04-16 + Entkopplung 2026-05) |
| **`docs/MESSENGER-KANAL-MAILBOX-MEILENSTEINE.md`** | M1 Phase A (Persistenz-Schalter) |
| **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** | Offline-Queue, Idempotenz |
| **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** | Direct-RPC vs. Relay |

**Nächste Schwerpunkte nach Phase A:** Phase **B** (einheitliche Systemtypen, **Fetch** für Event+Mailbox-Mix), **§ H.15** Smoke; LoRa-Feldtests bewusst nach stabilem Mailbox/Event-Sendepfad.

---

## 8. Nächste konkrete Schritte (Checkliste)

1. **Produkt:** Default **`event`** vs. **`mailbox`** pro Rolle/Kanal — aktuell **global** (`localStorage`); optional feinere Defaults (z. B. Boss → mailbox).  
2. **Ist:** `resolveForceLegacyPlaintext` + **`resolveForceLegacyEncrypted`**; `storeEncryptedMessage` mit `forceLegacyEncrypted` (`chain-access.ts`).  
3. **Ist:** API `/send` + `/send-plain` mit **`messagingPersistenceMode`**; Frontend Transport-Card + Hybrid + Offline-Retry.  
4. **Offen:** Posteingang/Indexer — **verschlüsselte Events** zuverlässig neben Mailbox-DFs anzeigen (Phase B).  
5. **Tests:** Vitest `messaging-persistence-mode.test.ts`, `execute-command.test.ts`; Root `run-tests.ts` → `messaging-persistence-resolve`; manuell: alle vier Zellen der 2×2-Matrix (siehe § 1.1).  
6. **Doku:** `CHANGELOG` / `TEST-RUN-LOGBOOK` bei Release nachziehen.

---

*Dieses Dokument ersetzt keine Move-Audit-Checkliste; vor Package-Änderungen weiterhin Move-Tests und Deploy-Prozess beachten.*
