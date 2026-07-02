# Chat-ECDH: Schlüssel erneuern (Session Keys+)

**Stand:** 2026-06-16 · **§ H.23 A4**

## Aktuelles Kryptomodell

| Aspekt | Verhalten |
|--------|-----------|
| Kurve | P-256 ECDH (Web Crypto) |
| Session | **Envelope v2** mit `keyEpoch` (HKDF `morgendrot-session-v2:…`) |
| Archiv | `{vault}.session-keys.enc` + Browser `morgendrot.directSessionKeys.v1` |
| Forward Secrecy | **Ab Rotation** (nicht pro Nachricht) |

## Was „Schlüssel erneuern“ bedeutet (A4)

**Ziel:** Verdacht auf Kompromittierung oder bewusster Neustart des Session-Keys — **ohne** alte Nachrichten unlesbar zu machen.

**Ablauf (UI: Chat ⋮ → Schlüssel erneuern):**

1. **keyEpoch++** im Session-Archiv (Peer-Pub bleibt gespeichert).
2. Neuer **Handshake** on-chain (Partner soll antworten).
3. Ab sofort: Send mit neuer Epoch; Empfang nutzt Envelope-`epoch` + Archiv-Fallback.
4. **Alte Nachrichten:** bleiben entschlüsselbar (Epoch + archivierte Peer-Pubs).

**Boss-API (optional):** `/rotate-session-epoch <peer0x>` spiegelt die Rotation in `.session-keys.enc`.

## Grenzen

- **Beidseitigkeit:** Partner sollte Handshake annehmen; bis dahin kann Send blockieren.
- **Kein Double Ratchet** — siehe `docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md` Phase C.

## Code

- `frontend/frontend/lib/peer-key-renewal.ts` — `renewDirectChatPeerEncryption`
- `frontend/frontend/lib/direct-session-keys-archive.ts` — Browser-Archiv
- `src/shared/morgendrot-session-keys-archive.ts` — `rotatePeerSessionEpoch`
- `src/messenger-nest/commands/mailbox-commands.ts` — `/rotate-session-epoch`

**Zielarchitektur:** `docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`
