# Handshake-Persistenz (Ist) und § H.23 (Double Ratchet)

**Roadmap:** `docs/ROADMAP-FAHRPLAN.md` **§ H.23** — **Entscheidung 2026-06-16:** Option **A (Session Keys+)**; SSOT **`docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`**. Double Ratchet = **Phase 3** (Backlog).  
**Dieses Dokument:** Was heute (v1) gilt, was „einmalig“ bedeutet, und was **nicht** mit Session Keys+ / Ratchet verwechselt werden darf.

---

## Drei Ebenen (nicht dasselbe)

| Ebene | Was | Persistenz heute | Nach API-Neustart |
|--------|-----|------------------|-------------------|
| **1 — Handshake on-chain** | `HsKey` in der Shared-Mailbox (`/handshake`, Pairing) | **Dauerhaft** auf der Chain (bis Purge/TTL) | **Bleibt** — kein erneutes Senden nötig, wenn Partner-Keys noch da sind |
| **2 — Handshake-Cache (Vault)** | Verschlüsselte Datei `{vault}.handshakes` (`saveHandshakeCache` / `loadHandshakeCache`) | Partner-`pubKey` + `handshakeNonce` | **Bleibt** in der Vault-Datei |
| **3 — Connect-Session (`peerMap`)** | RAM im API-Prozess: Live-Listener, Status `connected` | Nur Laufzeit | **Weg** — bis Wiederherstellung (s. unten) |

**Wichtig:** „Handshake persistent“ in der Roadmap meint langfristig **Ebene 1+2 (+ künftige Ratchet-States in Ebene 2)**. **Connect (Ebene 3)** ist eine **Betriebs-Session**, kein zweiter Handshake.

---

## Ist heute (v1 — vor § H.23)

- **Krypto:** P-256 ECDH → HKDF → **AES-GCM** pro Nachricht; **gleiches** Shared Secret pro Partnerpaar, solange Handshake-Keys unverändert (**kein** Signal-artiges Forward Secrecy).
- **On-chain:** Handshake-Events/`HsKey` — Partner findet `fetchLastMessages` auch **ohne** `peerMap` (Chain-Lookup + Cache).
- **Vault-Cache:** Nach **`/connect`** wird `peerMap` in `.handshakes` gespeichert.
- **Wiederherstellung (2026-05):** Nach **`/vault-load`**, **`/vault-load-from-chain`** und beim **ersten Vault-Laden im API-Start** wird der Handshake-Cache in **`peerMap`** + Status **verbunden** übernommen (`restorePeerMapFromHandshakeCache` in `messenger-connect.ts`).
- **Noch nötig:** Erster **Connect** mit einem Partner **einmal**, damit der Cache befüllt wird (oder Chain-Handshake + Inbox-Fetch füllt Cache beim Lesen).

**Explizit nicht umgesetzt (§ H.23 Backlog):**

| Thema | Option A (Session Keys+) | Option B (Double Ratchet) |
|--------|---------------------------|----------------------------|
| Forward Secrecy | Nur bei **Key-Rotation** | Pro Nachricht / Ratchet-Schritt |
| Offline / LoRa | Einfacher (statische Session) | Wire + State-Machine offen |
| Vault-Layout | Erweiterung `peers` + `sessionVersion` | Ratchet-States, Prekeys, … |
| Gruppen-E2EE | Separat (**§ H.22 M2c**) | Nicht 1:1-Ratchet kopieren |

---

## Handshake-Anfragen (eingehend)

**UX (Ist 2026-05-20):** Posteingang-Banner, Badge, Toast, Ablehnen (lokal) — **`docs/HANDSHAKE-ANFRAGEN-UX.md`**, Roadmap **§ H.27**.

---

## Was du in der UI tun musst (kurz)

1. **Einmal** mit Partner: Handshake auf der Chain (senden/annehmen) **oder** Connect, bis Status **verbunden**.
2. **`/vault-save`** bzw. Tresor mit Handshake-Cache — passiert automatisch nach Connect.
3. **Tresor entsperren** nach Neustart — Cache → wieder **verbunden** (kein neuer Handshake).
4. **Nur** wenn Cache leer / Partner gepurgt: erneut Handshake oder Connect.

Verschlüsselt **senden** braucht weiterhin **verbunden** (oder Direkt-ECDH im Browser laut Handy-first-Flags). **Posteingang lesen** braucht vor allem **entsperrten Tresor** + Handshake-Material (Cache oder Chain).

---

## Zielbild § H.23 (Roadmap)

**Lieferreihenfolge (Roadmap):**

1. Architektur-Entscheid + Threat-Model (1:1 MVP; Pinnwand/Gruppe ausgeklammert oder separat).
2. Spez: Wire, Key-Storage, Rotation — **Migration** von bestehendem `/handshake` + `.handshakes`.
3. Implementierung **parallel** zu M4d/Mailbox, **kein** Blocker für Klartext/Pinnwand.

**Empfehlung in der Doku (kein Code-Zwang):**

- **Kurzfristig:** Option **A** — Session Keys mit dokumentierter **Rotation** (bessere UX, kleinere Migration). **SSOT:** **`docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`**
- **Mittelfristig:** Option **B** nur mit klarer Spec für **IOTA-Mailbox-Transport**, **Offline-Queue** und **Vault** — sonst Doppelprotokoll-Bruch.

Bis **H.23** gilt: Persistenz = **Chain-Handshake + Vault-Cache + Session-Restore** (oben), **nicht** Double Ratchet.

---

## Verknüpfungen

- `docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md` — **Zielarchitektur Session Keys+ (H.23 Option A)**
- `docs/ROADMAP-FAHRPLAN.md` — **§ H.23**, **§ H.24b** (Handshakes pro Package-Profil, Backlog)
- `docs/VAULT-EINRICHTEN.md` — Vault, `/vault-save`, Neustart
- `docs/MESSAGING-MAILBOX-SSOT-SPEC.md` — Handshake ≠ Mailbox-Persistenz
- `SECURITY-RATING.md` — ehrliche Grenzen (kein PFS wie Signal)
- `src/messenger-nest/messenger-connect.ts` — `restorePeerMapFromHandshakeCache`, `applyRestoredPeerMapToSession`
