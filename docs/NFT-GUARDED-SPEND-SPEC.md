# NFT-gesichertes Ausgeben (Guarded Spend) — Spec / Backlog

**Stand:** 2026-11-08  
**Status:** **B2-S0–S5 Code-Ist** (Smoke offen) — beide Spend-Modi on-chain + UI-Wahl; TBA-Index/Discovery/1-Vault; optionale Mint-Modi One-Time + Offline-Handoff. Modules `0x1fb0e9b7…`; Stamm `0x06e099…`.  
**Fortschritt Tranche (grob):** Code **~78 %** · inkl. Smoke/Abnahme **~62 %** — siehe `docs/ROADMAP-FAHRPLAN.md` (Nachtrag 2026-11-08).  
**Scope:** **nur Token/Coins (IOTA)** — **kein** Klartext, kein Chat-Leserecht (P4a…P4b).  
**Verwandt:** Leserecht P4* (`docs/NFT-SCHLUESSELKARTE-MODI.md`, `docs/NFT-GATE-SEAL-P4B-SPEC.md`) · Zeitkapsel P5 · **nicht** MeshSleepyChannel.  
**Trennung:** Token-Spend-Modus ist **orthogonal** zu P4b Seal — Seal schützt Lesen, nicht Coins.

> Coins und NFT bleiben **getrennte** Objekte. Das NFT enthält **keine** Coins und **keinen** Klartext.

---

## 1. Rohwunsch vs. Chain-Realität

**Roh:** `spend_protected` nur wenn  
`tx_context::sender() == Wallet_X` **und** Sender besitzt gebundenes NFT.

| Annahme | Problem auf IOTA/Move |
|---------|------------------------|
| „Wer das NFT hat, gibt Coins aus Wallet X aus“ | Freie `Coin`s gehören Adresse X — nur **X kann signieren**. NFT bei W2 → W2 ≠ X → **kann X-Coins nicht bewegen**. |
| `sender == X` und „NFT wandert unabhängig“ | Widerspruch, sobald NFT ≠ bei X liegt. |
| NFT als Capability „im Wallet“ | Capability muss **in der Move-Funktion vorgelegt** werden (Objekt-Arg); App-Check allein = kein Chain-Schutz. |

**Produktentscheidung (2026-11-06, nachgeschärft):** Spend-Modus ist **optional wählbar** (nicht fest verdrahtet).

| UI-Label (Produkt) | Move | Wer darf ausgeben? |
|--------------------|------|---------------------|
| **Nur NFT (Bearer)** | `nft_bearer_treasury` | Wer das gebundene NFT besitzt (Senderecht wandert mit NFT) |
| **NFT + Wallet (Guarded)** | `nft_guarded_purse` | Signer = Wallet X **und** NFT bei X (2FA) |

| Chain-Name | Wer signiert? | Wo liegen die Coins? | NFT weg von X → |
|------------|---------------|----------------------|-----------------|
| **Guarded Purse** | immer Wallet X | `GuardedPurse` owned by X | `spend` blockiert, bis NFT zurück |
| **Bearer Treasury** | NFT-Owner | Shared Treasury | Senderecht wandert mit NFT |

**UI:** `NftTokenSpendPanel` — Dropdown Guarded (NFT+Wallet) | Bearer (nur NFT); Live-Balance + Vault-ID + Create-Digest; Empfänger erst beim Auszahlen; Messaging-Module-Package unter Erweitert. Default = Guarded.  

**Wallet-Karte:** `Frei:` und `Purse Guthaben:` gleiche Typo rechts am Titel; Summe aus lokalem Index + RPC.  

**TBA-ähnlicher Index:** Vault-Object-ID + Digest + Package an Schlüsselkarte (`boundVault`) und **im Tresor-Sidecar** (`nft-vault-index-vault` + geparkte Einträge). **Anlegen verlangt entsperrten Tresor** (wie Chat-Geheimnisse/Schlüsselkarte). On-chain Balance = Wahrheit.  

**NFT-Transfer (eigenes Gerät):** Aktiver Index wird **geparkt** (nicht vernichtet); Besitz-Snapshot aktualisiert → Rückkehr = Aktivität „empfangen“ + Restore. Zusätzlich **On-chain-Discovery** (Guarded = `getOwnedObjects`, Bearer = Create-Events) — kein manueller Digest nötig, wenn Signer/RPC da sind. Fremdes Gerät ohne Events: Index-Text oder Digest.  

**Ein NFT → mehrere Vaults?** On-chain erlaubt mehrere `GuardedPurse`/`Treasury` mit derselben `required_nft_id` (kein Uniqueness-Check). **Produkt:** **hart blockiert** in `createNftGuardedPurse` / `createNftBearerTreasury` (`nft-vault-one-per-mode`, inkl. Discovery-Nachzug). UI: Anlegen nur ohne Vault; Hinweis „nur Einzahlen“. **Bearer** `destroy_empty` wie Guarded in der UI. **Empfehlung bleibt:** 1 aktives Vault pro NFT+Modus.  

**Optional beim Mint / an der Karte (App-Ist, 2026-11):**
- **One-Time-Use** (`spend_policy=one_time` in `[morg-attrs]` + `nft-spend-policy-local-store`): nach erstem erfolgreichen Spend/Withdraw Capability lokal entzogen; Standard = **Burn** des ImageNFT (2. TX, weil Move `spend`/`withdraw` nur `&T` nimmt). Folge-Spends in der App scheitern. **Starke On-Chain-Garantie** = Backlog Move `spend_and_consume` / Spent-Registry.
- **Offline-Weitergabe**: Compact `MORG_NFT_V1C:` (Mesh/QR), JSON `MORG_NFT_VAULT_V1:`, optional signiert `MORG_NFT_VAULT_V1S:` — Empfänger importiert Index lokal; Balance on-chain. Kein Mesh-Auto-Send — Text/QR in Chat/Funk einfügen.

**Nicht:** Klartext/Chat-Gate; Mesh-Payments; „NFT allein bewegt fremde lose Coins“; on-chain Multisig-Spend (Backlog).

**Pflicht-Kommunikation:** Lose / freie Coins **außerhalb** Purse/Treasury sind **ungeschützt**.

---

## 2. Guarded Purse — NFT + Wallet (Produkt: „Guarded“)

```text
GuardedPurse has key, store {
  id: UID,
  owner: address,           // = Wallet X (immutable)
  required_nft_id: ID,      // gebundenes NFT-Object
  // Balance: Coin<IOTA> innen oder Balance<IOTA>
}
```

| Entry | Wer | Check | Wirkung |
|-------|-----|-------|---------|
| `create_purse(nft_id, coin)` | X | optional: X besitzt NFT jetzt | Purse owned by X; Coins drin |
| `deposit(purse, coin)` | X | `sender == owner` | mehr Guthaben |
| `spend(purse, nft: &T, amount, recipient)` | X | `sender == owner` **und** `object::id(nft) == required_nft_id` **und** NFT owned by sender (by ref / parent) | Transfer amount → recipient |
| `unlock_emergency` (optional) | X + Timelock/Multisig | Policy | Bypass — spezifizieren oder weglassen |

**Wichtig:** Lose Coins in X bleiben **ungeschützt** — Nutzer muss Guthaben **in die Purse** legen. UI: „Nur NFT-gesichertes Guthaben“ vs. freies Wallet.

**NFT-Typ:** Ideal eigenes leichtes `SpendKeyNft` im Messaging-Package **oder** generisches `T: key + store` mit fester `required_nft_id`. Fremdes ImageNFT-Package: Type-Arg + ID-Check.

---

## 3. Bearer Treasury — nur NFT (Produkt: „Bearer“)

```text
NftGuardedTreasury has key {  // shared
  id: UID,
  required_nft_id: ID,
  // Balance…
  admin: address,             // optional reclaim/policy
}
```

| Entry | Wer | Check | Wirkung |
|-------|-----|-------|---------|
| `withdraw(treasury, nft: &T, amount, recipient)` | beliebiger Signer | Signer **besitzt** NFT mit `id == required_nft_id` | Coins → recipient |
| `admin_freeze` / … | admin | — | optional |

Hier entfällt `sender == Wallet_X`. „Wallet X“ ist nur Label/Admin, nicht der Signer jeder Ausgabe.

Passt zu „NFT = Capability, wandert unabhängig“. **Nicht** dasselbe wie A.

---

## 4. Abgrenzung

| Thema | Bezug |
|-------|--------|
| P4a-dual Lesen | App/Crypto Leserecht — **kein** Coin-Move |
| Zeitkapsel P5 | Leserecht zeitlich — Spend-Capability **orthogonal** (eigenes NFT oder gleiches nur wenn spezifiziert) |
| MeshSleepyChannel | State-Channel-Zahlungen — **andere** Tranche, nicht vermischen |
| MessengerCredits | Prepaid-Msg-Credits — anderes Objekt |

---

## 5. UI / Claims

- Badge / Wallet: **Frei** (native Balance) vs. **Gesichert (Purse/Treasury)** mit Live-Balance + NFT-Bindung.  
- IOTA-Aktivität: create/deposit/spend/withdraw lokal protokollieren.  
- Klar: NFT enthält **keine** Coins; Transfer des NFT ≠ Coin-Transfer.  
- Frei liegende Coins außerhalb der Purse = **nicht** geschützt.  
- Kein Marketing „ohne NFT unmöglich“ für Coins, die nie in die Purse kamen.  
- Optionaler lokaler Anzeigename am Vault (nicht on-chain).

---

## 6. Lieferphasen (IDs)

| ID | Inhalt | Abhängigkeit |
|----|--------|--------------|
| **B2-S0** | Dieses Spec + Roadmap/Claims | — **Ist** |
| **B2-S1** | Move Modus A `GuardedPurse` + Vitest/PTB | Messaging-Package Upgrade — **Ist** (`0x0c94e888…`) |
| **B2-S2** | Messenger-UI Deposit/Spend + Badge | S1 — **Ist** (Panel unter NFT-Galerie) |
| **B2-S3** | Modus B Bearer Treasury Move+UI | S1 — **Ist** (`0x10b16597…`) |
| **B2-S4** | TBA-Index, On-chain-Discovery, Park/Restore, 1-Vault/Modus, Bearer destroy UI | S2/S3 — **Code-Ist** (Smoke offen) |
| **B2-S5** | Optional Mint: One-Time-Use (App+Burn) + Offline Compact/QR/signiert | S4 — **Code-Ist**; Move-Consume / Mesh-Auto = Backlog |
| **B2-S6** | 1-Gerät-Smoke + Logbuch (Joint Session A/B) | S4/S5 — **als Nächstes**; Solo Vitest 59/59 PASS 2026-11-08 |
| **B2-S7** | Move `spend_and_consume` / Spent-Registry (starke One-Time) | Package-Upgrade — Backlog |

### On-Chain (S1 Guarded Purse)

| | |
|--|--|
| Modul | `messaging::nft_guarded_purse` |
| Entries | `create_purse` · `deposit` · `spend` · `destroy_empty` |
| Checks `spend` | `sender == owner` ∧ `object::id(nft) == required_nft_id` (NFT-Arg = Besitz) |
| Coin | generisch `Coin<C>` / Default App `0x2::iota::IOTA` |

### On-Chain (S3 Bearer Treasury)

| | |
|--|--|
| Modul | `messaging::nft_bearer_treasury` |
| Entries | `create_treasury` · `deposit` · `withdraw` · `admin_set_frozen` · `admin_reclaim` · `destroy_empty` |
| Checks `withdraw` | `object::id(nft) == required_nft_id` (kein `sender==admin`) |
| Package | Upgrade `0x10b16597…` (Cap unverändert); Mailbox-Stamm `0x06e099…` |

---

## 7. Kanonische Kurzfassung (Produkt)

> **Nur Token, kein Klartext.** Coins und NFT getrennt.  
> **Wählbar:** Bearer (nur NFT) **oder** Guarded (NFT∧Wallet) — UI-Radio, beide Move-Module Ist.  
> **Lose Coins außerhalb = ungeschützt.** Orthogonal zu P4b Seal (Leserecht).  
> Nicht mit Zeitkapsel/MeshSleepy vermischen.
