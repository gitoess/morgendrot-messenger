# Handshake-Anfragen — UX (Ist)

**Stand:** 2026-05-21  
**Code:** `GET /api/pending-handshakes` (+ optional `?mailboxIds=`), `use-chat-view-pending-handshakes.ts` (Dashboard + Chat), `chat-view-inbox-handshake-requests.tsx`, `pending-handshake-mailbox-ids.ts`

---

## Verhalten

| Element | Beschreibung |
|---------|----------------|
| **Erkennung** | Backend: `listIncomingHandshakeOffers` + **`listOutgoingHandshakeOffers`** — Mailbox-Union + Client-`mailboxIds` + **EcdhInit**-Events. Gesendet = `sender = MY_ADDRESS`, noch nicht verbunden. |
| **Polling** | Alle **~45 s** auf **Dashboard-Ebene** (Toast/Badge auch ohne geöffneten Chat/Posteingang), sobald `MY_ADDRESS` gesetzt und Tresor **nicht** gesperrt — **unabhängig** von Verschlüsselt/Internet/Kanal. |
| **Anzeige** | **Eingehend:** grüner Block oben im Posteingang (Annehmen/Ablehnen). **Gesendet:** blauer Block „Ausstehende Anfragen (gesendet)“ — Warte auf Partner. |
| **Badge** | Am Posteingang-Titel **und** an der Dashboard-Kachel **„Nachrichten“** (eingehend + gesendet, ohne bereits verbundene). |
| **Toast** | Bei **neuer** Anfrage ab **erstem** erfolgreichen Poll (pro `sender:nonce` einmal pro Browser-Session). |
| **Löschen** | **Löschen** im Posteingang: lokal ausblenden; bei **Mailbox**-Eintrag zusätzlich `/purge-handshake` on-chain (ENABLE_PURGE + MAILBOX_ID). Event-only nur lokal. Eingehend + gesendet. |
| **Annehmen** | Wie „Handshake annehmen“ → Partner setzen + Connect. |

---

## Backlog (Roadmap § H.27)

- Push / System-Benachrichtigung (PWA, Android § H.6f)
- Ablehnen optional mit on-chain Purge
- Eigene Inbox-Zeile „Handshake von …“ (nicht nur Banner)
- Handshake-Anfrage als Klartext-Hinweis an Telegram (`telegramChatId`)

**Verwandt:** `docs/HANDSHAKE-PERSISTENZ-UND-H23.md`, `docs/ROADMAP-FAHRPLAN.md` § **H.27**
