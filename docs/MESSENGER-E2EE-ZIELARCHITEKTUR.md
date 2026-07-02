# Messenger E2EE — Zielarchitektur (kanonisch)

**Stand:** 2026-06-16  
**Status:** **Architektur-Entscheid** für **§ H.23 Option A** (Session Keys+) — Implementierung **Backlog**, parallel zu laufendem Betrieb.  
**Ersetzt nicht:** Ist-Verhalten (statisches ECDH P-256 + AES-GCM) bleibt bis Migration aktiv.

**Verknüpft:**  
`docs/HANDSHAKE-PERSISTENZ-UND-H23.md` · `docs/CHAT-ECDH-SCHLUESSEL-ERNEUERN.md` · `docs/TRANSPORT-AND-IOTA-LAYERS.md` · `docs/TEAM-MAILBOX-BROADCAST-1TX-KONZEPT.md` · `docs/MESSENGER-STRATEGIC-PRINCIPLES-LOCAL-FIRST-IDEMPOTENCY-PQ.md` · `docs/ROADMAP-FAHRPLAN.md` **§ H.23** · `src/shared/morgendrot-crypto.ts`

---

## 1. Kurzentscheidung

| Frage | Entscheidung |
|-------|--------------|
| **Nächster Schritt (H.23)?** | **Option A — Session Keys+** mit `keyEpoch`, Key-Archiv im Vault, versioniertem Nachrichten-Envelope |
| **Double Ratchet (Option B)?** | **Phase 3** — erst nach stabiler Session-Key-Rotation, Offline-Queue und Vault-Migration |
| **Kurve / AEAD (Phase A)?** | **P-256 ECDH + AES-256-GCM beibehalten** (kein Big-Bang auf X25519/XChaCha); Agilität über `cipherSuite`-Feld |
| **LoRa / Meshtastic?** | **Kanal-PSK on-air**; Morgendrot-E2EE nur über **IOTA** (Delayed Upload / Archiv) — **kein** Mesh-v2-Send reaktivieren |
| **Telegram?** | **Notify-only**, Klartext Bot-API — kein MTProto-Nachbau |
| **Gruppen?** | **Symmetrischer Team-Key** off-chain, **1×** Team-Broadcast on-chain (**§ H.22 M2c**) |
| **Pinnwand?** | **Klartext** — unverändert |
| **Post-Quantum?** | **Phase 4** — hybrid KEM im Envelope; nur wirksam für **neu** gespeicherte Ciphertexte |

---

## 2. Drei Schichten (Transport ≠ Nachricht ≠ Settlement)

```text
┌─────────────────────────────────────────────────────────────┐
│ Schicht 3 — Settlement / Forensik (IOTA)                    │
│   Mailbox store_*, Events, Purge, Metadaten sichtbar        │
├─────────────────────────────────────────────────────────────┤
│ Schicht 2 — Morgendrot-Nachrichten-E2EE (kanalunabhängig)   │
│   Envelope MORG_MSG_* → AEAD-Ciphertext                     │
├─────────────────────────────────────────────────────────────┤
│ Schicht 1 — Transport-Sicherheit (pro Kanal)                │
│   Meshtastic PSK · TLS (Telegram/API) · optional Funk-PSK   │
└─────────────────────────────────────────────────────────────┘
```

**Leitregel:** Schicht 2 ist **ein** Format; Schicht 1 darf pro Kanal unterschiedlich sein. Sensible Inhalte **nie** nur in Schicht 1 vertrauen (Telegram, Klartext-Funk).

---

## 3. Ist vs. Ziel (1:1 IOTA)

| Aspekt | **v1 Ist** (Produktion) | **v2 Ziel** (Session Keys+) |
|--------|-------------------------|-----------------------------|
| Handshake | `store_ecdh_init` / `HsKey`, Peer-Pub on-chain | Unverändert als **Identitäts-/Pairing-Schicht** |
| Ableitung | ECDH → HKDF(`morgendrot-aes-gcm`) → AES-GCM | ECDH → HKDF → **Session-Key** pro `(peer, keyEpoch)` |
| Rotation | Manuell: Peer-Pub löschen + neuer Handshake | **`keyEpoch++`**, alter Key **archiviert** (Vault) |
| Alte Nachrichten | Nach Rotation oft **nicht** mehr lesbar | **Lesbar** via archiviertem Session-Key |
| Forward Secrecy | Nein | **Bei Rotation** (nicht pro Nachricht) |
| Wire | `ciphertext` + `iv` + `tag` (Move/Event) | Gleiche Felder; **Envelope im Ciphertext** (opaque für Chain) |
| Vault | `.handshakes.enc` → `{ peers: { pubKeyRaw, nonce } }` | Erweiterung → **`sessionKeys`** + **`peerPubArchive`** |

**Wichtig:** Move **`EncryptedMessage`** bleibt `{ ciphertext, iv, tag, nonce }` — **kein** Protocol-Break nötig. Das Envelope steckt **in** `ciphertext` (Base64-JSON oder binäres Prefix).

---

## 4. Nachrichten-Envelope `MORG_MSG`

### 4.1 Versionen

| `version` | Name | Inhalt |
|-----------|------|--------|
| **1** | `LEGACY_PLAIN_AES` | Roher AES-GCM-Output (Ist — implizit, kein Header) |
| **2** | `SESSION_AES` | Header + AEAD-Body (Ziel Phase A) |
| **3** | `RATCHET` | Reserviert (Double Ratchet, Phase 3) |
| **4** | `PQ_HYBRID` | Reserviert (klassisch + PQ-KEM, Phase 4) |

### 4.2 Envelope v2 (Session Keys+) — JSON vor AEAD oder als AEAD-AAD

**Empfohlen:** AEAD verschlüsselt den **Nutzer-Plaintext**; Header-Felder als **AAD** (associated data), damit `keyEpoch` / `senderKeyId` nicht manipulierbar sind.

```json
{
  "v": 2,
  "cs": 1,
  "epoch": 3,
  "skid": "a1b2c3d4",
  "msgId": "uuid-or-canonical-ref",
  "ts": 1718550000000
}
```

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `v` | u8 | Envelope-Version (= 2) |
| `cs` | u8 | **Cipher suite** (s. unten) |
| `epoch` | u32 | **keyEpoch** — welcher Session-Key |
| `skid` | hex(4–8 B) | Kurz-ID des sendenden Key-Materials (Debug/Rotation) |
| `msgId` | string | Idempotenz / Dedup (Offline-Queue, Mesh) |
| `ts` | u64 | Client-Zeit (unvertrauenswürdig, nur UI-Sortierung) |

**On-chain gespeichert** (unverändert):

```text
ciphertext = base64( aead_output )   // enthält verschlüsselten Body
iv         = 12 Byte random
tag        = GCM tag (in ciphertext bei Web Crypto oft appended — Ist-Code beibehalten)
```

### 4.3 Cipher suites (`cs`)

| `cs` | Suite | Status |
|------|-------|--------|
| **1** | P-256 ECDH → HKDF-SHA256 → AES-256-GCM | **Ist + Phase A** |
| **2** | X25519 → HKDF → XChaCha20-Poly1305 | Optional später (Interop) |
| **3** | Hybrid ECDH + ML-KEM-768 (PQ) | Phase 4 |

Info-String HKDF (Ist): `morgendrot-aes-gcm`  
Phase A Session-Key: `morgendrot-session-v2:{peer0}:{peer1}:{epoch}` (sortiertes Adresspaar, dokumentiert)

---

## 5. Session Keys+ (Option A — Detail)

### 5.1 Key-Hierarchie

```text
Wallet-Identität     Ed25519 (IOTA-Signer)     — TX signieren, ≠ Chat
Chat-ECDH-Identität  P-256 Priv (1× pro Vault)  — langfristig, Tresor
Peer-Pub             P-256 raw pro 0x-Gegenüber — Handshake / Connect
Session-Key          AES-256-GCM Key            — pro (peer, keyEpoch)
```

### 5.2 Ableitung Session-Key

```text
sharedSecret = ECDH(chatEcdhPriv, peerPubRaw)
sessionKey   = HKDF-SHA256(
                 ikm = sharedSecret,
                 salt = 16×0x00,
                 info = "morgendrot-session-v2:" + sort(peerA, peerB) + ":" + epoch
               ) → AES-256-GCM key
```

**Implementierung (A1):** `sort(peerA, peerB)` = lexikographisch kleinere, dann größere `0x`-Adresse — beide Seiten leiten denselben Key ab.

**Rotation (`keyEpoch` erhöhen):**

1. Beide Seiten behalten **alte** Session-Keys im Vault-Archiv (read-only decrypt).
2. Neuer Handshake **oder** signiertes Rotation-Control-Message (Phase A.2) setzt `epoch+1`.
3. Senden ab sofort mit neuem `epoch`; Empfang probiert `epoch` aus Header, Fallback auf Archiv.

**UI:** „Schlüssel erneuern“ (Ist) → künftig: **`epoch++`** statt blind Peer-Pub löschen (Peer-Pub-Archiv analog).

### 5.3 Forward Secrecy — ehrliche Einordnung

| Modell | PFS |
|--------|-----|
| v1 statisches ECDH | Keine |
| **Session Keys+ mit Rotation** | **Ab Rotation** — kompromittierter Key entschlüsselt nur bis zur letzten Rotation |
| Double Ratchet | Pro Nachricht / Schritt |

Marketing: **kein** „Signal-Level“ bis Option B produktiv ist (`SECURITY-RATING.md`, `PROJECT-FOCUS`).

---

## 6. Vault & Browser-Speicher (Migration)

### 6.1 Dateien

| Datei | Inhalt |
|-------|--------|
| `{vault}.handshakes.enc` | **v1:** `{ peers: { [0x]: { pubKeyRaw, nonce } } }` |
| `{vault}.session-keys.enc` | **neu:** Session-Key-Archiv (verschlüsselt) |
| `localStorage` `morgendrot.directChatEcdh.*` | Browser-Cache (sync mit Vault bei Save) |

### 6.2 `session-keys.enc` (Skizze)

```json
{
  "schema": 1,
  "peers": {
    "0x…": {
      "currentEpoch": 3,
      "peerPubCurrent": "base64(raw65)",
      "peerPubArchive": {
        "1": "base64…",
        "2": "base64…"
      },
      "sessions": {
        "1": { "wrappedKey": "…", "createdAt": "…", "retiredAt": "…" },
        "2": { "…" },
        "3": { "…", "active": true }
      }
    }
  }
}
```

**Regeln:**

- Session-Key-Material **nie** on-chain.
- Nach `/vault-save` und Entsperren: Restore wie heute `peerMap` + **Session-Archiv**.
- Purge/Notfall: siehe `docs/NOTFALL-PURGE-MESSENGER.md` — Session-Archiv mit löschen.

### 6.3 Migration v1 → v2

| Schritt | Aktion |
|---------|--------|
| M1 | Beim Entschlüsseln: fehlendes Envelope → **v1 LEGACY** annehmen |
| M2 | Beim Senden: neues Envelope v2, `epoch=1`, wenn Peer bereits v1-Key hat |
| M3 | Vault-Migration: bestehende Peer-Pubs → `epoch=1` Session ohne Rotation |
| M4 | UI „Schlüssel erneuern“ → `epoch++` + Archiv (ersetzt Peer-Pub-Löschung) |

Kein Big-Bang: **v1- und v2-Ciphertexte** parallel im Posteingang.

---

## 7. Handshake & Connect (unverändert als Pairing)

Die **drei Ebenen** aus `HANDSHAKE-PERSISTENZ-UND-H23.md` bleiben:

1. **On-chain Handshake** (`HsKey`, `store_ecdh_init`) — dauerhaft  
2. **Vault `.handshakes`** — Partner-Pubs + Nonces  
3. **Runtime `peerMap`** — Connect-Session  

Session Keys+ **baut darauf auf** — ersetzt Handshake nicht. Rotation kann ausgelöst werden durch:

- UI „Schlüssel erneuern“
- Optional: Control-Message `MORG_CTRL_KEY_ROTATE_V1` (Klartext-Marker im Composer-Expert, Phase A.2)

---

## 8. Verschlüsselung pro Transport (Zielbild)

| Pfad | Schicht 1 (Transport) | Schicht 2 (Morgendrot) | Schicht 3 (IOTA) |
|------|----------------------|------------------------|------------------|
| **1:1 online** | TLS/API | **MORG_MSG v2** | `store_encrypted_message` |
| **1:1 klartext** | — | — | `store_plaintext_message` |
| **LoRa (Funk)** | **Meshtastic PSK** oder Klartext | **Nein** on-air | Optional Pfad 4 / Delayed Upload → v2 |
| **LoRa + Archiv** | PSK/Klartext | Nach Netz: **v2** | Pfad 4 Marker + Mailbox |
| **Telegram notify** | TLS Telegram | **Nein** (nur Hinweis) | Optional Hash/Link, kein Klartext |
| **Gruppe Team-Broadcast** | — | **Team-Key AEAD** (M2c) | `store_team_broadcast` (geplant) |
| **Gruppe pairwise** | — | N× **1:1 v2** | N× encrypted store |
| **Pinnwand** | — | **Nein** | Plaintext + Whitelist |

### 8.1 Meshtastic

- **Produkt:** Kanal-PSK im Handoff (`docs/TRANSPORT-AND-IOTA-LAYERS.md`).
- **Nicht:** Morgendrot Mesh-v2-E2EE-Versand reaktivieren.
- **Zukunft Funk trägt E2EE:** nur als **Relay-Hülle** für bereits verschlüsselten Blob (`MORG_TX_RELAY_V1`, Phase B) — Entschlüsselung am Gateway/Handy nach IOTA-Sync.

### 8.2 Telegram

- Outbound: `formatTelegramNotifyText` — **kein** Nachrichtentext mit Secrets.
- Inbound: Allowlist — bleibt Klartext.
- Archiv-Backlog: maximal „Neue verschlüsselte Nachricht“ + Deep-Link/Postfach-Hinweis.

---

## 9. Gruppen-E2EE (§ H.22 M2c)

**Ziel:** 1× on-chain TX pro Gruppennachricht.

```text
teamKey (32 B random) — nur off-chain (Vault, QR, Handoff)
ciphertext = AEAD(teamKey, epoch, plaintext, aad=groupId)
on-chain: store_team_broadcast(teamMailboxId, ciphertext, epoch, nonce, …)
```

| Thema | Entscheidung |
|-------|--------------|
| Key-Verteilung | Boss erzeugt → QR / pairwise Wrap mit **1:1 v2** an Mitglieder |
| Rotation | `teamKeyEpoch++`, alter Key im Vault-Archiv (wie 1:1) |
| Move | Siehe `docs/TEAM-MAILBOX-BROADCAST-1TX-KONZEPT.md` |
| 1:1-Ratchet | **Nicht** für Gruppen kopieren |

---

## 10. Phase 3 — Double Ratchet (Option B, Vorbereitung)

**Erst starten wenn:**

- Session Keys+ stabil (Rotation, Archiv, Offline-Queue mit `msgId`)
- Vault-Migration in Feldtest validiert
- Threat-Model bestätigt Bedarf für **per-message PFS**

**Vorgesehen:**

- Envelope `v=3`, separater Ratchet-State in Vault (Prekeys, chains)
- **Nur 1:1 IOTA** — nicht LoRa, nicht Gruppe
- Parallelbetrieb: Empfang erkennt `v=2` vs. `v=3`

Spec-Referenz: Signal Protocol (X3DH + Double Ratchet) — **eigenes** Morgendrot-Wire-Dokument vor Implementierung.

---

## 11. Phase 4 — Post-Quantum (Agilität)

Aus `MESSENGER-STRATEGIC-PRINCIPLES-…`:

- **Harvest-now-decrypt-later** betrifft **heute** gespeicherte Chain-Ciphertexte.
- PQ-Schutz nur für **ab Einführung** hybrid verschlüsselte Nachrichten (`cs=3`).
- Kein „PQ-Schalter“ der alte Daten heilt.

**Minimal viable PQ-Pfad:**

```text
shared = ECDH(P-256) || ML-KEM-768.sharedSecret
sessionKey = HKDF(shared, info="morgendrot-pq-hybrid-v1:…")
```

Partner müssen **beide** PQ-fähig sein; Fallback auf `cs=1`.

---

## 12. Threat Model (kurz)

| Bedrohung | v1 Ist | v2 Session Keys+ | Ratchet |
|-----------|--------|------------------|---------|
| Chain-Observer liest Metadaten | Sichtbar | Sichtbar | Sichtbar |
| Gestohlener aktueller Key | Alle Msg entschlüsselbar | Ab Rotation getrennt | Nur wenige Msg |
| Gestohlener alter Key | — | Nur bis Rotation | Minimal |
| Telegram/LoRa-Leak | Transportabhängig | Schicht 2 schützt auf IOTA | wie v2 |
| Quantencomputer (archivierte CT) | Risiko | Risiko | Risiko → PQ nötig |

---

## 13. Implementierungs-Roadmap

| Phase | Deliverable | Move-Änderung? |
|-------|-------------|----------------|
| **A0** | Dieses Dokument + Review | Nein |
| **A1** | Envelope v2 encode/decode in `morgendrot-crypto-session.ts` | Nein | **Ist 2026-06-16** (Tests `morgendrot-crypto-session.test.ts`; Send-Pfad noch v1) |
| **A2** | Session-Key-Ableitung + `epoch` in Send/Decrypt (Frontend + Nest) | Nein | **Ist 2026-06-16** (`morgendrot-crypto-session-wire.ts`; v1-Legacy-Fallback beim Decrypt) |
| **A3** | Vault `.session-keys.enc` + Migration | Nein | **Ist 2026-06-16** (`vault-local`, `morgendrot-session-keys-archive`, Browser-LS) |
| **A4** | UI Rotation (ersetzt Peer-Pub-Löschung) | Nein |
| **B1** | Team-Key Gruppen-Broadcast | **Ja** (`store_team_broadcast`) |
| **C1** | Double Ratchet Spec + PoC | Nein (Wire in ciphertext) |
| **D1** | PQ hybrid `cs=3` | Nein |

**Parallel erlaubt:** A1–A4 ohne Blockade durch Klartext/Pinnwand/Gruppen-Klartext-MVP.

---

## 14. Code-Anker (Ist)

| Bereich | Datei |
|---------|-------|
| ECDH/AES | `src/shared/morgendrot-crypto.ts` |
| Browser Keys | `frontend/frontend/lib/direct-chat-ecdh-session.ts` |
| Send/Decrypt | `morgendrot-crypto-session-wire.ts`, `direct-iota-encrypted-submit.ts`, `direct-iota-inbox-decrypt.ts`, `messenger-chain-wrap.ts`, `messenger-fetch.ts` |
| Handshake | `handshake-ecdh-txb.ts`, `direct-iota-handshake-submit.ts` |
| Vault Peers | `src/vault-local.ts` → `saveHandshakeCache` |
| Schlüssel erneuern (Phase 1 UI) | `frontend/frontend/lib/peer-key-renewal.ts` |
| Move Events | `move-test/sources/messaging.move` → `EncryptedMessage` |

---

## 15. Offene Punkte (vor A1-Coding)

- [ ] **Rotation-Protokoll:** nur UI-initiiert vs. gegenseitige Control-Message  
- [ ] **max. Archiv-Tiefe** pro Peer (Storage-Policy)  
- [ ] **Team-Key** in `.handshakes` vs. separates `.team-keys.enc`  
- [ ] **SIMPLE_MODE**-Hinweis: Crypto-Tier sichtbar (`composer-encryption-context-hint.ts`)  
- [ ] **Review** Boss/Einsatzleitung — akzeptiertes Sicherheitsversprechen dokumentieren  

---

## 16. Verknüpfungen (Roadmap aktualisieren)

Nach Freigabe dieses Dokuments in `ROADMAP-FAHRPLAN.md` **§ H.23** vermerken:

> **Entscheidung 2026-06-16:** Option **A (Session Keys+)** — SSOT **`docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`**. Option B (Ratchet) Phase 3.

---

*Autor: Architektur-Spec aus Code-Review + Transport-Docs. Nächster Implementierungsschritt: **A1 Envelope v2** in `morgendrot-crypto.ts`.*
