# NFT-gesichertes Ausgeben (Guarded Spend) — Spec / Backlog

**Stand:** 2026-11-06  
**Status:** **Backlog B2-S1** — Entscheidung **nur Modus A (Guarded Purse)**; Modus B später. **Kein** Move-Ist.  
**Scope:** **nur Token/Coins (IOTA)** — **kein** Klartext, kein Chat-Leserecht (das bleibt P4a/P5).  
**Verwandt:** Leserecht P4a-dual (`docs/NFT-SCHLUESSELKARTE-MODI.md` §6a) · Zeitkapsel P5 · **nicht** MeshSleepyChannel.

> **UI-Name:** „2FA-Schlüsselkarte für Token“ / „NFT-gesicherte Purse“  
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

**Produktentscheidung (2026-11-06):**

| | Entscheidung |
|--|----------------|
| **v1** | **Nur Modus A — Guarded Purse** = 2FA-Schlüsselkarte **für Token** |
| **Später** | Modus B Bearer Treasury (optional) |
| **Nicht** | Klartext/Chat-Gate; Mesh-Payments; „NFT allein bewegt fremde Coins“ |

| Modus | Wer signiert? | Wo liegen die Coins? | NFT weg von X → |
|-------|---------------|----------------------|-----------------|
| **A — Guarded Purse (Ist-Ziel)** | immer Wallet X | nur in `GuardedPurse` owned by X | `spend` aus Purse **blockiert**, bis NFT zurück bei X |
| **B — Bearer Treasury (später)** | NFT-Owner | Shared-Vault | Senderecht wandert mit NFT |

**Pflicht-Kommunikation:** Lose / freie Coins **außerhalb** der Purse sind **ungeschützt** — normales Wallet-Senden bleibt möglich. Geschützt ist **nur** das Guthaben in der Purse.

---

## 2. Modus A — Guarded Purse (empfohlen zuerst)

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

## 3. Modus B — Bearer Treasury (Senderecht mit NFT)

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

- Badge: **„NFT-gesichertes Guthaben (Guarded Purse)“** bzw. **„Treasury: wer NFT hat, darf senden“**.  
- Klar: NFT enthält **keine** Coins; Transfer des NFT ≠ Coin-Transfer.  
- Frei liegende Coins außerhalb der Purse = **nicht** geschützt.  
- Kein Marketing „ohne NFT unmöglich“ für Coins, die nie in die Purse kamen.

---

## 6. Lieferphasen (IDs)

| ID | Inhalt | Abhängigkeit |
|----|--------|--------------|
| **B2-S0** | Dieses Spec + Roadmap/Claims | — |
| **B2-S1** | Move Modus A `GuardedPurse` + Vitest/CLI Smoke | Messaging-Package Upgrade |
| **B2-S2** | Messenger-UI Deposit/Spend + Badge | S1 |
| **B2-S3** | Optional Modus B Bearer Treasury | nach S1 Feld |

**Jetzt nicht bauen** — nach Privacy-Feldruhe / bewusst eigene Tranche.

---

## 7. Kanonische Kurzfassung (Produkt)

> **Nur Token, kein Klartext.** Coins und NFT getrennt.  
> **Guarded Purse:** X deponiert IOTA in der Purse; on-chain `spend` nur wenn `sender == X` **und** X besitzt das gebundene NFT (= 2FA-Schlüsselkarte). NFT transferiert weg → kein Purse-Spend.  
> **Lose Coins außerhalb der Purse = ungeschützt** (UI/Claims Pflichttext).  
> Modus B (Bearer) später; nicht mit Leserecht/Zeitkapsel/MeshSleepy vermischen.
