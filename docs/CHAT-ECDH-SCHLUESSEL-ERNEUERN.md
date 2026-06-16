# Chat-ECDH: Schlüssel erneuern (Phase 1)

## Aktuelles Kryptomodell (Stand 2026)

| Aspekt | Verhalten |
|--------|-----------|
| Kurve | P-256 ECDH (Web Crypto) |
| Eigenes Material | Ein Chat-ECDH-Privatkey pro entsperrter Tresor-Sitzung |
| Peer-Material | Pro Gegenüber (0x) ein **roher Peer-Public-Key** (65 Byte) in `localStorage` |
| Shared Secret | `deriveBits(ECDH, ownPriv, peerPubRaw)` → AES-GCM für Mailbox-Nachrichten |
| Handshake | Angebot/Antwort über IOTA-Mailbox/Chain; `/connect` übernimmt Peer-Pub |
| Forward Secrecy | **Nein** — kein Double Ratchet, keine rotierenden Message Keys |

## Was „Schlüssel erneuern“ bedeutet

**Ziel:** Verdacht auf Kompromittierung, Gerätewechsel beim Partner oder bewusster Neustart des verschlüsselten Kanals.

**Ablauf (UI: Chat ⋮ → Schlüssel erneuern):**

1. Lokaler **Peer-Pub** für diese 0x-Adresse wird gelöscht (`clearDirectChatEcdhPeerPubForRecipient`).
2. Neuer **Handshake** wird gesendet (eigenes Pub erneut on-chain angeboten).
3. Partner muss **Handshake annehmen** bzw. antworten — bis dahin blockiert verschlüsseltes Senden.
4. Nach erfolgreichem Connect liegt ein **neuer Peer-Pub** vor; ab dann gelten neue ECDH-Secrets für ausgehende Nachrichten.

## Grenzen (Phase 1)

- **Alte Nachrichten:** Ciphertext im lokalen Verlauf bleibt erhalten, kann nach Erneuerung **ohne alten Peer-Pub nicht mehr entschlüsselt** werden. Vor Erneuerung ggf. **Verlauf exportieren**.
- **Beidseitigkeit:** Sicher ist der Kanal erst, wenn **beide** Seiten den neuen Handshake abgeschlossen haben.
- **Kein automatisches Löschen** on-chain alter Handshake-Objekte (optional manuell im Handshake-Panel).

## Phase 2 (geplant, nicht implementiert)

| Feature | Nutzen |
|---------|--------|
| Double Ratchet (Signal-ähnlich) | Forward Secrecy pro Nachricht |
| Key-Version im Ciphertext-Header | Alte + neue Nachrichten parallel entschlüsselbar |
| Archiv-Peer-Pubs (read-only) | Entschlüsselung historischer Nachrichten nach Rotation |

**Empfehlung bis Phase 2:** Schlüssel erneuern nur bei konkretem Anlass; Verlauf vorher exportieren.

**Zielarchitektur (Session Keys+, Envelope, Vault):** **`docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`**

## Implementierung (Code)

- `frontend/frontend/lib/peer-key-renewal.ts` — `renewDirectChatPeerEncryption`
- `frontend/frontend/lib/chain-handshake-probe-cache.ts` — stabile Handshake-UI ohne Chain-Spam
- Chat-Menü: `ChatViewConversationMenu` → `onRenewEncryptionKeys`
