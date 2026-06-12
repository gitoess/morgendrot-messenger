# Consumer: Handshake empfangen — Feldtest (Spätere Tests #1)

**Zweck:** Zwei Wallets — Wallet **A** sendet Handshake, Wallet **B** (Consumer/Wanderer) sieht Toast, Badge und kann im Posteingang annehmen.  
**Stand:** 2026-06-02  
**Code:** `use-chat-view-pending-handshakes.ts`, `direct-iota-handshake-fetch.ts`, `chat-view-inbox-handshake-requests.tsx`

---

## Voraussetzungen

| | Wallet A (Sender) | Wallet B (Empfänger / Consumer) |
|--|-------------------|----------------------------------|
| Profil | Beliebig (z. B. Kommandant oder zweiter Consumer) | `npm run env:role:consumer` + `npm run dev:role:consumer` |
| Tresor | Entsperrt, Keys geladen | Entsperrt, Keys geladen |
| IOTA | Gleiche `PACKAGE_ID` + RPC (Testnet oder Mainnet) | Handoff oder Puls: RPC + Package-ID + Session-Signer |
| Mailbox | Optional | **Keine Pflicht** — Event-Handshake (`EcdhInit`) reicht |

**Zwei Browser-Profile** (Chrome Profil 1 + Profil 2) oder ein Gerät + ein PC.

---

## A — Mit Morgendrot-Basis (einfacher)

1. Basis läuft (`npm run dev`), beide Consumer-Instanzen zeigen auf dieselbe API (LAN-IP wenn Handy).
2. **B:** Dashboard → Tresor entsperren → `MY_ADDRESS` sichtbar.
3. **A:** Nachrichten → 1:1 → Partner = Adresse von **B** → Verschlüsselt + online → **Handshake senden** (Transport-Panel).
4. **B** (ohne Chat geöffnet): innerhalb ~45 s:
   - [ ] Toast **„Handshake-Anfrage“** mit Button **Posteingang**
   - [ ] Kachel **Nachrichten** (Dashboard) zeigt grünen Badge
   - [ ] Bottom-Nav **Nachrichten** zeigt Badge (Consumer-Layout)
5. **B:** Toast **Posteingang** oder Nachrichten → Posteingang:
   - [ ] Block **Handshake-Anfragen (eingehend)** mit **Annehmen** / **Als Partner** / **Löschen**
6. **B:** **Annehmen** → Status „verbunden“ → verschlüsselte Testnachricht von **A** empfangen.

---

## B — Standalone / Consumer ohne Basis (Direkt-RPC)

1. **B:** Handoff oder Puls vollständig (RPC, Package-ID, Signer, optional ECDH-JWK).
2. **Keine** private/Team-Mailbox nötig — Scan nutzt **EcdhInit-Events**.
3. **A** sendet Handshake (Direkt-RPC oder über eigene Basis).
4. **B:** Polling per Fullnode — gleiche Checks wie A.4–A.6.

---

## C — Negative Checks

- [ ] Tresor **gesperrt** → kein Poll, keine Anfragen sichtbar
- [ ] **Löschen** → Anfrage verschwindet lokal (Event-only ohne on-chain Purge)
- [ ] Nach **Annehmen** → Badge/Toast für dieselbe `sender:nonce` nicht erneut

---

## Logbuch

Ergebnis in **`docs/TEST-RUN-LOGBOOK.md`** (Datum, A/B/C, PASS/FAIL, Notiz).

**Verwandt:** `docs/HANDSHAKE-ANFRAGEN-UX.md`, `docs/TEST-ROLLE-PROFILES.md`, `docs/STANDALONE-SMOKE-CHECKLIST.md` § 4e.
