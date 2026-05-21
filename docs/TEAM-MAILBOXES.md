# Team-Mailboxes (Shared pro Einsatzgruppe)

**Stand:** 2026-05 — UI + `create_team_mailbox` (Move), lokale Liste im Browser.

## Typen

| Typ | On-chain | UI | Posteingang | Senden (Persistent) |
|-----|----------|-----|-------------|---------------------|
| **Server-Shared** | `Mailbox` aus `.env` `MAILBOX_ID` | Immer sichtbar, nicht umschaltbar | Immer | Fallback wenn nichts aktiv |
| **Team** | `Mailbox` via `create_team_mailbox` | Liste + Beitreten (ID/QR) | Mit **aktiver** Team-ID | Wenn Team aktiv |
| **Privat** | `PrivateMailbox` | wie M4d | Mit **aktiver** Privat-ID | Wenn Privat aktiv |

## Befehle (API)

- `/create-team-mailbox` — neues Shared-Postfach (Boss/Admin-Wallet, Gas)
- `/create-private-mailbox` — private Mailbox (M4d)
- Beitritt: nur lokale Object-ID speichern (kein Chain-Befehl)

## Deploy

Nach Änderung an `messaging.move`:

```bash
npm run deploy:move-package
```

`PACKAGE_ID` in `.env` setzen. Ohne Redeploy liefert `/create-team-mailbox` „function not found“ — **Beitreten per ID** funktioniert trotzdem für bestehende `Mailbox`-Object-IDs.

## Dateien

- Move: `move-test/sources/messaging.move` (`create_team_mailbox`)
- Store: `frontend/frontend/lib/my-team-mailbox-store.ts`, `my-mailbox-active.ts`
- UI: `frontend/frontend/components/chat-view-my-mailboxes-panel.tsx`
