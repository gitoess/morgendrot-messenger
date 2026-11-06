# H.23 C1 — Double Ratchet Spec (Phase 3)

**Stand:** 2026-11-06  
**Status:** Spec gestartet (nach 1-Gerät-Smoke Privacy/B2/Epoch/Burn **PASS**). **Kein** Produktiv-Wire.  
**SSOT Kontext:** `docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md` §10 · Claims `docs/SECURITY-CLAIMS-CHECK-2026-11.md`  
**Fahrplan:** `docs/ROADMAP-FAHRPLAN.md` § H.23

---

## 0. Warum jetzt / warum nicht alles bauen

| Gate | Ist |
|------|-----|
| Session Keys+ A1–A4 | **Ist** (`keyEpoch`, Archiv, UI „Schlüssel erneuern“) |
| B1 Team-Key / B2 NFT P0–P3 | **Ist** (1 Gerät) |
| 1-Gerät-Smoke Anleitung §0 + Epoch/Burn | **PASS** 2026-11-06 (Logbuch) |
| 2-Geräte-Feldtest | **bewusst später** — C1 Spec darf vorab laufen; **Produktiv-Einschalten** erst nach Feldlage oder explizitem Opt-in |

**Produktversprechen heute (ehrlich):** FS **ab Epoch-Rotation**, nicht pro Nachricht.  
**C1 Zielversprechen (erst nach PoC+Feld):** kompromittierter Message-Key entschlüsselt nur **wenige** Nachrichten (Chain Key Advance).

---

## 1. Scope / Non-Goals

### In Scope (C1)

- Nur **1:1 Direktchat über IOTA** (Mailbox `store_encrypted_message*`).
- Envelope **`v=3`**, `cs=1` zuerst (P-256 / AES-GCM wie Ist — Ratchet **über** bestehender Suite).
- Ratchet-State **im Vault** (Browser: AES-GCM-Sidecar; Nest: analog `.session-keys.enc`).
- Parallelbetrieb: Empfang erkennt `v=2` (Session Keys+) und `v=3` (Ratchet).
- Spec + **PoC offline** (Vitest, kein Move-Deploy).

### Out of Scope (explizit nicht C1)

- LoRa / Mesh / Telegram Klartext-E2EE  
- Gruppen / Team-Broadcast (bleibt Team-Key)  
- Pinnwand  
- X3DH-Prekey-Server / Bundles on-chain  
- PQ (`cs=3`)  
- B2-P4 starkes NFT-Gate  
- Decoys / rotierende Outboxes / HW-Fragment  

---

## 2. Bedrohung vs. Ist

| Bedrohung | Session Keys+ (Ist) | Double Ratchet (C1) |
|-----------|---------------------|---------------------|
| Gestohlener aktueller Session-Key | Alle Msg seit letzter Epoch | Nur Fenster um aktuelle Chain-Keys |
| Gestohlener alter Session-Key | Nur bis Epoch | Minimal (skipped keys begrenzt) |
| Chain-Observer Metadaten | Sichtbar | Sichtbar (keine Änderung) |
| Offline Out-of-Order | Epoch-Key reicht | Skipped-Message-Keys (limitiert) |

---

## 3. Wire — Envelope `v=3`

Innerhalb des bestehenden AEAD-Blobs (gleiche on-chain Felder `ciphertext` / `iv` / `tag`):

```json
{
  "v": 3,
  "cs": 1,
  "dh": "<base64url X25519 oder P-256 uncompressed public>",
  "pn": 0,
  "n": 7,
  "msgId": "…",
  "ts": 1730900000000
}
```

| Feld | Bedeutung |
|------|-----------|
| `v` | 3 = Ratchet |
| `cs` | 1 = wie Ist (AES-256-GCM); 2 reserviert X25519/XChaCha |
| `dh` | Öffentlicher DH-Ratchet-Schritt des Senders (nach Signal-Modell) |
| `pn` | Länge der vorherigen Sending-Chain |
| `n` | Message-Nummer in der aktuellen Sending-Chain |
| `msgId` / `ts` | wie v2 (Dedup / Sortierung) |

**AAD:** kanonisches JSON der Header-Felder **ohne** Plaintext (gleiche Regel wie v2-Empfehlung).

**Init:** Erste `v=3`-Nachricht nach Opt-in braucht geteiltes Root-Material aus bestehendem ECDH-Handshake (kein neuer Move-Handshake). Ableitung:

```text
RK_0 = HKDF(ECDH(shared), info="morgendrot-ratchet-root-v1:{peer0}:{peer1}")
```

Adresspaar sortiert lowercase wie Session-Keys+.

---

## 4. State (Vault)

Pro Peer (`0x…`):

```text
RatchetPeerState {
  rootKey
  sendChainKey / sendN
  recvChainKey / recvN
  dhSendPriv / dhSendPub
  dhRecvPub
  skipped: Map<"dhPub|n", messageKey>   // max N (z. B. 64)
  pn
}
```

| Speicherung | Ort |
|-------------|-----|
| Browser | Sidecar `morgendrot.ratchet.enc.v1` (Vault-Passwort), analog Passphrase/Keycard |
| Nest (optional später) | `.ratchet.enc` neben `.session-keys.enc` |
| Lock | RAM leer; Ciphertext bleibt |
| Soft-Lock / Purge | wie Secret-Vaults |

**Kein** Klartext-Ratchet-State in `localStorage` ohne Vault-Wrap.

---

## 5. UX / Rollout

| Stufe | Verhalten |
|-------|-----------|
| **Default** | Weiter `v=2` Session Keys+ |
| **Opt-in** | Direktchat-⋮ „Double Ratchet (Experiment)“ — beide Seiten müssen senden/empfangen können |
| **Fallback** | Unbekannter Peer / nur v2 → weiter v2; kein Hard-Fail |
| **Claims** | UI-Hinweis: Experiment; Marketing darf FS-pro-Msg erst nach Feld-PASS |

---

## 6. PoC-Meilensteine (Code)

| # | Deliverable | Done wenn |
|---|-------------|-----------|
| **C1.0** | Dieses Spec-Dokument | ✅ 2026-11-06 |
| **C1.1** | Envelope v3 encode/decode + AAD roundtrip (Vitest) | ✅ `src/shared/morgendrot-ratchet-envelope.ts` |
| **C1.2a** | Symmetric Ratchet (Root→Chain→Message, Alice↔Bob Vitest) | ✅ `morgendrot-ratchet-session.ts` |
| **C1.2b** | DH-Ratchet (Header `dh` = P-256 SPKI) | ✅ `createDhRatchetSessionPair` |
| **C1.3** | Skipped keys + Out-of-Order (limit) | ✅ in C1.2a enthalten |
| **C1.4** | Vault-Sidecar Persist Roundtrip (Symmetric) | ✅ `ratchet-session-local-store.ts` + Unlock/Lock/Purge |
| **C1.5** | Optional: Direct-Send/Decrypt Hook hinter Feature-Flag | ✅ `ratchet-experiment.ts` + ⋮ Opt-in; Composer bleibt v2 |

Kein Move-Change. Kein Default-on im Composer (C1.5 Hook nur bei Flag + Session).

---

## 7. Testplan (kurz)

1. Vitest: Alice↔Bob 20 Nachrichten, Key compromise Simulation (alter Message-Key entschlüsselt nicht Msg+2).  
2. Out-of-Order: n=5 vor n=3, skipped map.  
3. Parallel: v2-Nachricht an denselben Peer bleibt lesbar.  
4. Soft-Lock: Ratchet-State nach Unlock wieder da; nach Purge weg.  
5. Feld (später, 2 Geräte): Opt-in beiderseits, Explorer zeigt weiter nur Ciphertext.

---

## 8. Abgrenzung B2-P4 / P5

Starkes NFT-Besitz-Gate und Zeitkapsel/Timelock sind **orthogonal** (DEK an Owner + Lease). C1 ändert 1:1-Session-Crypto.  
→ `docs/NFT-SCHLUESSELKARTE-MODI.md` · `docs/NFT-SCHLUESSELKARTE-PUBLIC-VAULT-TIMELOCK.md`

---

## 9. Nächster Implementierungsschritt

~~C1.1–C1.5~~ erledigt (DH-PKCS8-Persist optional später). **Als Nächstes:** **B2-P5** (P4a Ist); **2-Geräte-Feldtest verschoben**.
