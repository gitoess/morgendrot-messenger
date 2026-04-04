# Wo siehst du den Beweis nach „npm run test:arbeiter-kommandant-boss“?

## 1. Nachrichten (On-Chain / Mailbox)

Die drei Texte **„Alles ok“**, **Boss-Anweisung** und **Pinnwand-Bestätigung** sind normale Nachrichten (Mailbox/Chain).

| Wo | Wie |
|----|-----|
| **Next.js-Dashboard** | Start → **Nachrichten** → **Privat** oder **Pinnwand** → Bereich **Posteingang** → Button **„Aktualisieren“** klicken. Es erscheinen die letzten Nachrichten (inkl. der drei Test-Texte). |
| **Lite-UI** | Im Browser `http://127.0.0.1:3342/` (oder dein API-Port) → Tab **Nachrichten** → **Posteingang** → **Aktualisieren**. |

**Explorer (Chain):** Wenn dein Backend mit Mailbox (MAILBOX_ID) und Chain verbunden ist, sind die Nachrichten on-chain. Im **IOTA-Explorer** (Testnet/Mainnet) siehst du die **Transaktionen** der Chain (z. B. Message-Events), nicht eine fertige „Chat-Ansicht“. Die konkreten Texte siehst du in der **UI** (Posteingang).

---

## 2. Heartbeats (Streams L0.5)

Die **Heartbeats** werden über **IOTA Streams** (L0.5) gesendet – also **nicht** als normale Chain-Transaktion. Sie landen im Streams-Kanal (STREAMS_ANCHOR_ID).

| Wo | Wie |
|----|-----|
| **Lite-UI** | `http://127.0.0.1:3342/` → Tab **Streams** (Kachel „Streams – Feeless Datenkanal“) → Button **„Fetch (Empfangen)“** klicken. **Unten auf der Seite** erscheint die Antwort des Backends mit den abgerufenen Streams-Nachrichten – darunter die Heartbeat-Payloads (z. B. `type: "heartbeat"`, `device`, `ts`). |
| **Next.js-Dashboard** | Es gibt **keine** Streams-Ansicht. Heartbeats siehst du nur in der **Lite-UI** unter Streams → Fetch. |

**Explorer (Streams):** Es gibt **keinen** „IOTA-Explorer“ für Streams-Inhalte. Der normale **IOTA-Explorer** zeigt nur **on-chain** (Transaktionen, Objekte). Streams-Daten liegen auf L0.5 und werden über die **Streams-Bridge** (STREAMS_BRIDGE_URL) gelesen/geschrieben. Der **Beweis** für Heartbeats ist also: **Lite-UI → Streams → „Fetch (Empfangen)“** und die angezeigte Antwort.

---

## Kurzfassung

| Beweis | Wo in der UI | Explorer? |
|--------|---------------|-----------|
| Nachrichten (Alles ok, Anweisung, Pinnwand) | **Nachrichten → Posteingang → Aktualisieren** (Next oder Lite-UI) | Chain-Explorer zeigt die zugehörigen TX; die Lesbarkeit der Texte in der UI. |
| Heartbeats | **Lite-UI → Streams → „Fetch (Empfangen)“** (Antwort unten) | Kein Streams-Explorer; Beweis = Fetch-Ausgabe in der Lite-UI. |
