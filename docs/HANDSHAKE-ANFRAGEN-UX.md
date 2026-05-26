# Handshake-Anfragen — UX (Ist)

**Stand:** 2026-05-20  
**Code:** `GET /api/pending-handshakes`, `frontend/frontend/hooks/use-chat-view-pending-handshakes.ts`, `chat-view-inbox-handshake-requests.tsx`

---

## Verhalten

| Element | Beschreibung |
|---------|----------------|
| **Erkennung** | Backend listet eingehende `HsKey`/Events für `MY_ADDRESS` (`listIncomingHandshakeOffers`). |
| **Polling** | Alle **~45 s**, sobald `MY_ADDRESS` gesetzt und Tresor **nicht** gesperrt — **unabhängig** von Verschlüsselt/Internet/Kanal. |
| **Anzeige** | Grüner Block **oben im Posteingang** mit Annehmen / Als Partner / **Ablehnen**. |
| **Badge** | Am Posteingang-Titel: Anzahl offener Anfragen. |
| **Toast** | Bei **neuer** Anfrage (pro `sender:nonce` einmal pro Browser-Session). |
| **Ablehnen** | Lokal in `localStorage` (`morgendrot.dismissedHandshakeOffers.v1`) — Eintrag bleibt on-chain bis `/purge-handshake`. |
| **Annehmen** | Wie „Handshake annehmen“ → Partner setzen + Connect. |

---

## Backlog (Roadmap § H.27)

- Push / System-Benachrichtigung (PWA, Android § H.6f)
- Ablehnen optional mit on-chain Purge
- Eigene Inbox-Zeile „Handshake von …“ (nicht nur Banner)
- Handshake-Anfrage als Klartext-Hinweis an Telegram (`telegramChatId`)

**Verwandt:** `docs/HANDSHAKE-PERSISTENZ-UND-H23.md`, `docs/ROADMAP-FAHRPLAN.md` § **H.27**
