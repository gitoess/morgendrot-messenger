# Messenger: Chat-Verlauf, Posteingang, Datenfluss (Referenz)

**Zweck:** Vollständige Nachvollziehbarkeit für Entwicklung, Review und KI-/Session-Handoffs. Ergänzt **`docs/UI-NACHRICHTEN-STREAMS-ORT.md`** (Ort in der UI) mit **technischer Pipeline** und **Persistenz**.

**Wichtig:** Der „Chat-Verlauf“ im Next-Messenger ist **kein** klassischer Server-Chat mit einer Thread-ID. Sichtbar ist das, was aus **IOTA-Mailbox / Chain-Events** geladen und mit **lokalen Mesh-Zeilen** zusammengeführt wird.

---

## 1. Kurzüberblick

| Begriff | Bedeutung |
|--------|------------|
| **Posteingang (UI)** | Liste im Tab Chat: Nachrichten aus Backend-Fetch + optional Mesh |
| **Chat-Verlauf** | Dieselbe Liste (`messages` → gefilterte Ansicht); keine separate Historien-Tabelle |
| **Mailbox** | On-Chain-Objekt `MAILBOX_ID`; Dynamic Fields mit `MsgKey` / `PlainMsgKey` (Move: `messaging.move`) |
| **Klartext-Kanal** | Zusätzlich Events `PlaintextMessage` / `EncryptedMessage` am `PACKAGE_ID` (Legacy-Pfad ohne nur-Mailbox) |

---

## 2. Datenfluss (Ende-zu-Ende)

```
Chain (Mailbox + Events)
    → fetchLastMessages (src/messenger-nest/messenger-fetch.ts)
    → CLI/API: /fetch bzw. /inbox (messenger-command-handler.ts)
    → JSON: { messages, data } mit sender, text, recipient?, nonce, ts, …

Frontend
    → fetchInbox (frontend/frontend/lib/api.ts) → POST /api/command … /fetch …
    → pickInboxRawMessages + mapInboxApiRowsToMessages (inbox-map-messages.ts)
    → Message[] { id, from, content, recipient?, transports, dedupKey, … }
    → mergeAllMessages / mergeMessageByDedup (message-dedup.ts) inkl. Mesh-Zeilen
    → filterInboxMessagesByPartnerAndDirection (inbox-partner-filter.ts)
    → UI: ChatViewInboxList, Partner-Strip, Richtung Alle|Eingang|Ausgang
```

**Mesh:** Eingehende Funk-Nachrichten hängen `transports: ['mesh']` an; beim Reload werden Mailbox-Zeilen mit Mesh-Zeilen per Dedup-Key zusammengeführt (gleicher Inhalt/Zeitfenster → eine Zeile, mehrere Transport-Icons).

---

## 3. Backend: Was wird geladen?

**Datei:** `src/messenger-nest/messenger-fetch.ts` — `fetchLastMessages`.

- **Eingehend:** Mailbox-Einträge / Events, bei denen **Empfänger = MY_ADDRESS** (bzw. Key-Feld `recipient` = ich).
- **Ausgehend:** Einträge / Events, bei denen **Absender = MY_ADDRESS** (gesendete Nachrichten an einen Partner).
- **Entschlüsselung:** Bei eingehenden Nachrichten ist der ECDH-Partner der **Absender**; bei ausgehenden der **Empfänger** (Nachricht wurde mit dem Schlüssel des Gegenübers verschlüsselt).
- **Optional:** Merge mit lokalem Klartext-Cache `.inbox.enc` (Vault), wenn `mergeLocalInbox` gesetzt ist.
- **Boss-Ansicht:** Sonderpfad mit `fetchPlaintextOnlyForRecipient` für Kommandanten — siehe Handler in `messenger-command-handler.ts` (`bossView`).

**CLI-Kompatibilität:** `/inbox` wird intern auf `/fetch` gemappt (wallet-bridge / Handler).

---

## 4. Frontend: Identität und Filter

**Eigene Adresse**

- Dashboard setzt nach `GET /api/status` bevorzugt **`myAddressFull`** (volle `0x`+64 Hex), fallback maskierte `myAddress`.
- Vergleich Chain-Adresse ↔ UI: `addressMatchesIdentity` in **`frontend/frontend/lib/inbox-partner-filter.ts`** (exakter Match; bei maskierter Kurzform nur mit **ausreichend langem** Kopf- und Schwanz-Stück, keine degenerierten Treffer wie nur `0x`).

**Richtung**

- `isMessageOutgoing(msg, myAddress)`: `from` entspricht der eigenen Identität.
- `isMessageSelfToSelf`: `from` und `recipient` entsprechen beide der eigenen Adresse → erscheint unter **Eingang**, **Ausgang** und **Alle**.

**Partner-Filter**

- `messageCounterpartyAddress`: bei Ausgang der Empfänger, bei Eingang der Absender.

---

## 5. Persistenz: Wo lebt „Historie“?

| Ort | Inhalt |
|-----|--------|
| **Chain** | Mailbox-Objekte + Events — Quelle der Wahrheit für `/fetch` |
| **`.inbox.enc`** (neben Vault) | Optionaler Klartext-Cache nach erfolgreicher Entschlüsselung (Backend) |
| **Browser** | Keine dauerhafte Chat-DB; Liste = frischer Fetch + Session-State (ausgeblendete IDs in `sessionStorage`) |
| **Mesh** | Nur laufende Sitzung / Kontaktverzeichnis; Merge in die gleiche `messages`-Liste |

Exporte (Einsatzbericht, Protokoll) nutzen die zusammengeführten Messages — siehe **`docs/EINSATZBERICHT-EXPORT.md`**.

---

## 6. Wichtige Dateien (Checkliste)

| Bereich | Pfad |
|--------|------|
| Fetch / Entschlüsselung | `src/messenger-nest/messenger-fetch.ts` |
| API-Befehl /fetch | `src/messenger-nest/messenger-command-handler.ts` |
| Inbox-Hook | `frontend/frontend/hooks/use-chat-view-inbox.ts` |
| Filter & Identität | `frontend/frontend/lib/inbox-partner-filter.ts` |
| API-Zeilen → Message | `frontend/frontend/lib/inbox-map-messages.ts` |
| Dedup | `frontend/frontend/lib/message-dedup.ts` |
| Status / Adresse UI | `frontend/frontend/components/dashboard.tsx`, `frontend/frontend/lib/api.ts` (`ApiStatus`) |
| Inbox-Liste | `frontend/frontend/components/chat-view-inbox-list.tsx` |
| Orchestrierung Chat | `frontend/frontend/hooks/use-chat-view-core.ts` |

---

## 7. Nicht verwechseln

- **Vault-Datei (`.morgendrot-vault`)** enthält **keinen** Chatverlauf — nur Messaging-Keys, Notizen, optional Signer-Import und **Passwortmanager-Einträge** (`personalSecrets`) im selben verschlüsselten Blob. Chat-Historie = Chain + optional **`.inbox.enc`** + Browser; siehe **`docs/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md`**.
- **IOTA Streams (L0.5)** ≠ Posteingang. Streams sind eigener Kanal (Lite-UI Tab „Streams“); siehe **`docs/UI-NACHRICHTEN-STREAMS-ORT.md`**.
- **Pinnwand vs. Privat** ändert Kontext/Variante in der UI, nicht die grundlegende Mailbox-Pipeline (solange dieselbe Wallet/Package-Konfiguration gilt).

---

## 8. Tests & Abnahme

Manuelle Checks: **`TESTING.md`** → Abschnitt „Next-Messenger Chat“ inkl. Posteingang-Filter.

Automatisch: `npm run test:smoke` (UI-Refs + Modultests) — ersetzt keine Chain-E2E für Inbox.

---

## 9. Änderungshistorie (kurz)

| Thema | Inhalt |
|-------|--------|
| Posteingang Ausgang sichtbar | Backend lädt gesendete Nachrichten (Absender = ich) zusätzlich zu empfangenen |
| UI Richtung korrekt | Volle Adresse / sicherer Maskenvergleich; keine falsche „nur Eingang“-Zuordnung |
| Selbstnachrichten | In allen drei Filtern (Alle / Eingang / Ausgang) sichtbar |

Für git-genau: `git log --oneline -- docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md` und Commits mit Message `fix(messenger): Posteingang …`.

---

*Bei Architektur-Änderungen an Fetch oder Inbox-UI dieses Dokument und **`docs/UI-NACHRICHTEN-STREAMS-ORT.md`** mitpflegen.*
