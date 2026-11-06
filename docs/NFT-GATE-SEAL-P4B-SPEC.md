# B2-P4b — NFT-Gate Seal / Policy

**Stand:** 2026-11-06  
**Status:** **Ist (PoC)** — Move `nft_gate_seal` + Key-Broker API + Capsule-Gate `nft_seal_p4b`.  
**Scope:** **nur Leserecht** (Klartext-Gate). **Nicht** Token-Spend.

---

## Kanonische Kurzfassung (Produkt)

> **P4b Seal ist ein einzelner API-Broker, kein Mysten-Seal.**  
> „Unter Zwang unmöglich“ gilt **nur**, solange der Broker **remote und unabhängig** vom Gerät ist (Master nicht auf dem Handy).  
> **Token-Spend** (nur NFT vs. NFT+Wallet) bleibt davon **getrennt** und ist weiterhin **optional wählbar** (`docs/NFT-GUARDED-SPEND-SPEC.md`).

---

## 1. Ziel vs. Realität

| Wunsch | Realität IOTA |
|--------|----------------|
| Mysten-**Seal** (dezentrale Key-Server + IBE) | Auf IOTA **nicht** als Produkt-Stack verfügbar |
| „Auch unter Zwang am Gerät unmöglich ohne NFT“ | Braucht Key-Material **außerhalb** der ehrlichen App |

**P4b-PoC:** Seal-**kompatible** On-Chain-Policy (`seal_approve*`) + **einzelner Key-Broker** (Boss/API-Node).  
Broker gibt Wrap-Key nur frei nach NFT-`AddressOwner`-Check (RPC). Wire allein + kompromittierte App ohne Broker → kein DEK.

---

## 2. Architektur

```text
Encrypt:  DEK → AES-Wrap(sealKey) → Wire MORG_NFTGATE_V1 gate=nft_seal_p4b
          sealKey = HKDF(brokerMaster, identity=nftObjectId[+wallet])
Decrypt:  App → POST /api/nft-gate-seal/unwrap-key {nft, requester}
          Broker: addressOwnsObject? → sealKey → App unwrap DEK
Policy:   messaging::nft_gate_seal::seal_approve_nft_owner / _and_wallet
```

| Komponente | Rolle |
|------------|--------|
| `seal_approve*` | Chain-Policy (dry_run-fähig / Doku); Abort = deny |
| Key-Broker | Hält `NFT_GATE_SEAL_MASTER`; Ownership-Check; Key-Release |
| Capsule | DEK nie blank; Wrap nur mit Broker-Key |

---

## 3. Claims (ehrlich)

| Darf man sagen? | |
|-----------------|--|
| Ja | Ohne NFT-Besitz (AddressOwner) gibt der Broker keinen Key |
| Ja | Wire allein reicht nicht (anders als P4a-HKDF) |
| Ja | „Unter Zwang am Gerät“ **wenn** Broker remote/unabhängig und kein Master auf dem Gerät |
| Nein | „Dezentral wie Mysten Seal“ / „auch Broker-Admin zwingt nichts“ |
| Nein | „Unter Zwang unmöglich“ wenn Broker auf demselben Gerät / Master im Vault liegt |
| Weiter | Einmal Klartext = kopierbar (Screenshot) |

**Abgrenzung Token-Spend:** Bearer vs Guarded ist **optional** und **kein** Seal-Thema.

**Zeitkapsel-Borrower:** P4b-v1 nur **AddressOwner** — Lease-Borrower später.

---

## 4. Lieferteile

| ID | Inhalt | Status |
|----|--------|--------|
| P4b-Move | `nft_gate_seal` seal_approve* | Ist |
| P4b-Broker | `/api/nft-gate-seal/*` + Master | Ist |
| P4b-Capsule | Gate `nft_seal_p4b` | Ist |
| P4b-UI | Composer unter Dual/Stark | Ist |

---

## 5. Env

| Key | |
|-----|--|
| `NFT_GATE_SEAL_MASTER` | Base64 32 Byte (oder Hex). Fehlt → Datei `.morgendrot-nft-gate-seal-master` auto |
| Packages | Modules-Package mit `nft_gate_seal` (Upgrade `0x1fb0e9b7…`) |
