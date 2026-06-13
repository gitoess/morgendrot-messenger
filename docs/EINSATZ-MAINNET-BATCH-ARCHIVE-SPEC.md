# § H.33e — Mainnet-Batch-Archiv (kritische Bewertung)

**Stand:** 2026-06-02  
**Status:** **Ist (Schreibtisch)** — PTB-Batch über bestehende `store_plaintext_message*`; UI in Einsatzleitung → Erweitert.  
**Verwandt:** `docs/EINSATZ-MANIFEST-MOVE-SKIZZE.md` (Modus A), `docs/PROTOCOL-ANCHOR-VERIFY-SPEC.md`, `docs/MESSAGING-MAILBOX-SSOT-SPEC.md`

---

## 1. Kurzantwort

Dein Vorschlag (**volle Nachrichten gebündelt on-chain, JSON optional**) ist **forensisch stärker** als das reine Manifest-Modell — **aber nicht vollständig neu**: Modus **C** (`mainnet-direct-no-rollup`) speichert ohnehin **jede Mailbox-Nachricht einzeln mit vollem Text** on-chain. Neu ist die **Gebündelung** (eine TX, viele Einträge, ein Digest) und die **strukturierte Forensik-Metadaten-Zeile** (`MORG_FORENSIC_MSG_V1`).

**Empfehlung (Hybrid):**

| Schicht | Wann | Beweis |
|---------|------|--------|
| **Betrieb** | Jeder Send (Mainnet) | Einzel-TX in Mailbox — Explorer |
| **Batch-Archiv (H.33e)** | Alle 5–30 Min / manuell / Einsatz-Ende | 1 TX = bis 25 Nachrichten, voller Text + Meta |
| **Manifest-Rollup (H.33)** | Optional, v. a. Testnet→Mainnet | Mainnet: nur Hash + Merkle; JSON optional |
| **JSON-Export** | Optional für Boss/Lesbarkeit | Kein Beweis allein — Kopie des Manifests |

---

## 2. Kritische Korrektur der Vergleichstabelle

| Kriterium | Manifest (A) | Dein Batch-Vorschlag | **Kritik / Präzisierung** |
|-----------|--------------|----------------------|---------------------------|
| JSON nötig? | „Ja (sehr wichtig)“ | Optional | **Übertrieben:** On-chain liegen `manifest_hash` + `merkle_root`. JSON ist **Bequemlichkeit** + Einzelnachweise — ohne JSON kann man Einträge nicht aus dem Merkle rekonstruieren, **aber** der Anker bindet den Hash. |
| Was on-chain | Hash + Meta | Voller Text + Meta | Stimmt für Batch. **Modus C** hat bereits Voltext pro Send — Batch spart Gas und bündelt den Zeitpunkt. |
| Beweiskraft | Mittel–gut | Sehr gut | Batch + Einzel-Mailbox **> Manifest allein**. Manifest bleibt wertvoll für **Testnet-Quellen** (Modus A). |
| Kosten | Sehr niedrig (1 TX) | „Niedrig durch Batching“ | **Relativ ja, absolut nein:** 25 × 16 KB Klartext ≈ **speicher- und gasintensiv**. Manifest-1-TX bleibt günstiger. |
| Komplexität | Mittel | Etwas höher | Batch nutzt **bestehendes Move** (kein neues Modul nötig) — Komplexität vor allem **Packen/Limits/UX**. |

---

## 3. Harte Grenzen (unabhängig vom Modell)

### 3.1 TX- und Wire-Limits

- Pro Nachricht max. **16 000 Byte UTF-8** (`MESSAGING_WIRE_UTF8_MAX`) — Move/Messenger-Grenze.
- Pro Batch-TX max. **25 Nachrichten** (Default; technisch bis 50, Gas-Risiko).
- **Bilder:** Pixel/LUMA/CHROMA-Wire **nicht** vollständig on-chain — nur `content_sha256_hex` + `payload_mode: hash_only`. IPFS/Arweave optional später (`manifest_uri_hash`-Feld existiert bereits).

### 3.2 Testnet → Mainnet

- Nachrichten, die **nur auf Testnet** oder **nur über Funk** existieren, sind **nicht automatisch** im Mainnet-Batch.
- Pfad: **Pfad-4-Spiegel** / erneutes Archivieren / Batch aus angereichertem Posteingang (`source_tx_digest`).

### 3.3 Datenschutz & Sichtbarkeit

- **Klartext-Batch** = öffentlich im Explorer (Dienstprofil).
- Verschlüsselte Mailbox-Sends bleiben ciphertext — Batch-Archiv ist derzeit **Klartext-Forensik** (`MORG_FORENSIC_MSG_V1` + Body).
- Hash-only reicht für Integrität, nicht für Inhaltsbeweis ohne Off-chain-Kopie.

### 3.4 Wer darf archivieren?

- Batch-TX signiert die **Puls-Wallet** (Boss/Einsatzleitung) — wie Manifest-Anker.
- Nicht „trustless“ gegenüber dem Archivieren selbst; **trust-minimized** gegenüber nachträglicher Manipulation (Chain-Timestamp, Digest).

---

## 4. Implementierung (Ist)

### 4.1 Wire-Format `MORG_FORENSIC_MSG_V1`

```
[[MORG_FORENSIC_MSG_V1:{"v":1,"sender":"0x…","recipient":"0x…","timestamp_ms":…,"channel":"1:1","transport":"lora","content_sha256_hex":"…","canonical_msg_ref":"…","source_tx_digest":"…","payload_mode":"full"}]]
Nachrichtentext …
```

Code: `frontend/frontend/lib/einsatz-forensic-batch-entry.ts`

### 4.2 Eine Mainnet-TX, mehrere `store_plaintext_message*`

Code: `packages/morgendrot-core/src/iota/mailbox-plain-batch-txb.ts`  
Submit: `frontend/frontend/lib/direct-iota-forensic-batch-submit.ts`  
Flow: `frontend/frontend/lib/einsatz-forensic-batch-flow.ts`  
UI: `frontend/frontend/components/einsatz-forensic-batch-panel.tsx` (Einsatzleitung → Erweitert)

### 4.3 Optional: dediziertes Move-Modul (Backlog)

Langfristig könnte `store_einsatz_message_batch` in der Registry **strukturierte Structs** statt Mailbox-DFs halten (günstigeres Event-Indexing, festes Schema). **MVP braucht das nicht** — Mailbox-PTB ist ausreichend.

---

## 5. Betriebsablauf (empfohlen)

```
Send (Mainnet) ──► Einzel-TX (Modus B/C)
        │
        ├─► [optional] Alle 15 Min: Batch-Archiv (25er PTB)
        │
        ├─► [optional] JSON-Manifest + Mainnet-Rollup (Modus A)
        │
        └─► Einsatz-Ende: letzter Batch + optional Manifest-Anker
```

**Verifikation Batch:**

1. Explorer: TX-Digest → N Object-Changes / Events  
2. Pro Eintrag: JSON-Meta parsen, `content_sha256_hex` gegen Body prüfen  
3. `canonical_msg_ref` gegen Posteingang / `@morgendrot/core` `computeCanonicalMsgRefV1`  
4. Optional: `source_tx_digest` auf Testnet/Mainnet nachschlagen  

---

## 6. Entscheidungsmatrix

| Einsatzprofil | Empfohlen |
|---------------|-----------|
| **Produktion Mainnet (Dienst)** | Modus B/C + periodisches **Batch-Archiv**; Manifest optional |
| **Übung Testnet + später Beweis** | Modus A: Testnet-Betrieb + **Manifest-Anker**; Batch auf Mainnet am Ende |
| **Max. Forensik, Budget egal** | Einzel-Sends Mainnet **+** Batch **+** JSON-Export |
| **Min. Kosten** | Nur Modus C (Einzel-TXs), kein Rollup, kein Batch |

---

## 7. Offen / Backlog

- [x] Automatischer Timer (5/15/30 Min) — Opt-in in Einsatzleitung → Erweitert
- [x] Verschlüsseltes Batch (`store_encrypted_message*`) — ECDH für Archiv-Empfänger nötig
- [x] Verify-UI — Posteingang-Badge „Batch-archiviert“ + Vorschau (neu / bereits / übersprungen)
- [x] Dynamisches Packen — bis 50 Nachrichten, ~400 KB Wire-Budget pro TX
- [ ] Move-Registry `EinsatzMessageBatch` (strukturiert statt Mailbox-DF)
- [ ] IPFS/Arweave-URI in `manifest_uri_hash` für Bild-Blobs
- [x] Server-seitiger Batch (Boss-API) — `POST /api/forensic-batch/run`, Scheduler `FORENSIC_BATCH_AUTO_ENABLED=1`
- [x] Registry Export/Import — lokal + `GET/POST /api/forensic-batch/registry`
- [x] Self-ECDH für verschlüsseltes Self-Archiv (`ensureSelfForensicEcdhMaterial`)

---

---

## 8. Boss-API-Batch (Priorität 1 — ohne offene PWA)

**Betrieb:** Boss-PC mit laufender API (`npm run api` / Dienst). PWA darf geschlossen sein.

| Env | Bedeutung |
|-----|-----------|
| `FORENSIC_BATCH_AUTO_ENABLED=1` | Start-Default (wird von Laufzeit-Config überschrieben) |
| `FORENSIC_BATCH_AUTO_INTERVAL_MIN=5\|15\|30` | Intervall-Default (15) |
| `FORENSIC_BATCH_MODE=plaintext\|encrypted` | Modus-Default |
| `FORENSIC_BATCH_AUTO_CONFIG_FILE` | Optional, Default `.morgendrot-forensic-batch-auto.json` |
| `FORENSIC_BATCH_REGISTRY_FILE` | Optional, Default `.morgendrot-forensic-batch-registry.json` |

**Endpunkte:** `GET/POST /api/forensic-batch/auto-config` (PWA-Checkbox), `GET /api/forensic-batch/config`, `POST /api/forensic-batch/run`, `GET/POST /api/forensic-batch/registry`.

**Registry:** Merge-Logik in `@morgendrot/core/forensic-batch` (PWA + Server). Server-Schreibzugriffe serialisiert + atomares Rename.

---

- `docs/ROADMAP-FAHRPLAN.md` § **H.33e** (nachziehen)  
- `docs/TEST-RUN-LOGBUCH.md` — Schreibtisch-Tests Batch  
