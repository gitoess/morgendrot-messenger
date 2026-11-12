# B2-P4/P5 — Öffentlicher Ciphertext-Vault + NFT-Timelock (Spec-Entwurf)

**Stand:** 2026-11-06  
**Status:** **P5a Move + P5b UI PoC Ist** — Modul on-chain (erst `0x42b10c99…`, aktuell Modules-Package `0x0c94e888…` inkl. Guarded Purse); Stamm-Chat `PACKAGE_ID`/`MAILBOX` unverändert. Panel unter NFT-Galerie.  
**Einordnung:** Erweiterung von **starkem NFT-Besitz-Gate** (`docs/NFT-SCHLUESSELKARTE-MODI.md` §6) + zeitlich begrenzte Leserechte.  
**Eltern:** `docs/NFT-SCHLUESSELKARTE-B2.md` (Komfort P0–P3 + P4a Ist) · Claims `docs/SECURITY-CLAIMS-CHECK-2026-11.md`

> **Produktname (UI):** „Zeitkapsel / NFT-Leserecht“ — **nicht** „normaler Chat“, **nicht** Passphrase-only.  
> **Kern:** Das NFT ist der **Schlüssel/Gate**, nicht der Textspeicher. Ciphertexte liegen **getrennt** (Mailbox / Enc-ImageNFT).

---

## 0. Kurzbild (Soll)

```text
Wallet 1 (öffentlich / Archiv)          Wallet 2 (privat / Leihe)
─────────────────────────────          ─────────────────────────
Ciphertexte „an mich“ (Mailbox)        Lease-Borrower (NFT in Escrow)
  und/oder Enc-ImageNFTs               Klartext nur mit Gate + Ciphertext
Seed darf später öffentlich werden     Ciphertexte holt W2 separat (s. §0a)
jeder sieht Ciphertext, niemand        nach Ablauf → reclaim → NFT → W1
  den Klartext ohne NFT-Besitz
```

| Phase | Wer hat Leserecht (Gate)? | Wer kann entschlüsseln? |
|-------|---------------------------|-------------------------|
| **Leihe** | W2 = Lease-Borrower (Escrow) | W2, **wenn** Ciphertext erreichbar + App-Gate ok |
| **Nach Reclaim** | W1 besitzt NFT wieder | W1 (+ öffentlicher Seed) mit NFT |
| **Timelock widerrufen** | bleibt W2 (kein reclaim) | bleibt privat bei W2 |

### 0a. Wo sind die Texte? (häufige Fehlannahme)

| Layer | Inhalt | Wer „hat“ es? |
|-------|--------|----------------|
| **Ciphertext** | `MORG_NFTGATE_V1` / PWMSG / Enc-`image_data` | On-chain sichtbar (Mailbox an W1, oder ImageNFT-Object) — **kein** Geheimnis |
| **NFT / Lease** | Leserecht (P4a App-Gate / später Seal) | W1 oder W2 je Phase |
| **Klartext** | erst nach Gate + Decrypt | nur berechtigter Signer in ehrlicher App |

**W2 bekommt die Texte nicht „mit dem NFT mitgeliefert.“** Ohne Ciphertext-Zugang nur Gate → nichts zu lesen.

**Optional (empfohlen, UX):** W2 holt Ciphertexte über **On-Chain / NFT**:

1. **Object-ID** einer bekannten Enc-Nachricht / Enc-ImageNFT laden, **oder**  
2. **Besitzer-Adresse = W1** (Archiv) → Galerie/Liste der ImageNFTs / bekannte Objects, **dann**  
3. Entschlüsseln nur wenn Lease-Borrower bzw. NFT-Besitz (P4a/P5 Badge).

Mailbox-Chat an W1: W2 braucht Inbox-Scan der **W1-Mailbox** / geteilte Object-IDs (nicht automatischer Push an W2). Das ist **bewusst optional** — kein Alltags-Chat-Ersatz.

| Variante | Ciphertext-Quelle | Gate | Ist |
|----------|-------------------|------|-----|
| A Enc-ImageNFT | `image_data` am NFT-Object; laden per Object-ID / Besitzer W1 | Lease oder Owner | Galerie **Ist**; Gate+Lease **Ist** |
| B NFTGATE-Wire in Mailbox | Posteingang / Wire an W1 | Lease oder Owner | P4a Wire **Ist**; W2-Fremdmailbox-Scan **optional Backlog** |
| C Nur NFT transferiert | — | — | **Reicht nicht** allein |

**Passphrase wiederverwenden** ≠ NFT-Bindung: gleiche PW für mehrere PWMSG ist nur Komfort; die Leihe ändert daran nichts. Starkes Gate = `MORG_NFTGATE_V1` oder Enc-ImageNFT-Besitz.

**UI (2026-11-09):** Panel heißt „Zeitkapsel (Leserecht)“ mit 3-Schritt-Hinweis — Ciphertext bleibt getrennt.

---

## 1. Ziele / Nicht-Ziele

### Ziele

1. **Öffentlicher Speicher:** Verschlüsselte Nachrichten liegen in einer einsehbaren Mailbox (typisch W1 → self).  
2. **Starkes Gate:** DEK nur freigeben, wenn `Owner(NFT) == aktuelle Signer-Adresse` (kein Vault-Merker ohne Besitz).  
3. **Zeitlich begrenzte Privatlesung:** NFT wandert W1 → W2 für Dauer T; danach zurück zu W1.  
4. **Widerruf vor Ablauf:** Berechtigte können den **automatischen Rücklauf** abbrechen (NFT bleibt bei W2) und/oder **früh zurückgeben**.  
5. **UI-Ehrlichkeit:** klare Badges („nur mit NFT“, „wird am DATUM öffentlich sofern nicht widerrufen“).

### Nicht-Ziele (explizit)

| Nicht | Warum |
|-------|--------|
| Unterwallets / abgeleitete Adressen aus demselben Seed | Komplexität, OPSEC-Verwirrung; zwei **getrennte** Wallets |
| Ersatz für Alltags-Direktchat (ECDH) oder einfache PWMSG-Passphrase | Bleibt Komfort-Pfad |
| Hintergrund-Cron ohne TX | Move/IOTA führt **keine** stillen Transfers aus — nur `entry`-Aufrufe |
| Geheimnis on-chain | DEK/Passphrase nie im NFT-Description-Feld |
| Garantie gegen Screenshots/Klartext-Kopieren | OPSEC Nutzer |

---

## 2. Review des Rohkonzepts — Korrekturen

| Rohformulierung | Problem | Spec-Korrektur |
|-----------------|---------|----------------|
| „NFT wird automatisch zurückgesendet“ | Kein Chain-Daemon | **`reclaim` nach `unlock_ms`** — **permissionless** (jeder zahlt Gas); UI/Relayer kann erinnern |
| „Starkes Gate“ nur App-Check | Vault-Kopie würde weiterlesen | DEK **wrap** an Besitz; lokale Merker **ohne** frischen Owner-Check nutzlos; bei Transfer Alt-Merker löschen |
| „Seed öffentlich → jeder entschlüsselt“ | Nur wahr, wenn NFT **wieder in W1** und Gate = Besitz | Nach Reclaim: W1-Owner kann unwrap; mit öffentlichem Seed = jeder kann W1-Signer sein |
| „Widerrufen“ unklar | Abbruch Rücklauf vs. früh zurück | Zwei Aktionen: **`cancel_reclaim`** (bleibt privat) / **`return_early`** (sofort zu W1) |
| Ciphertexte in W1 | Wer darf Mailbox purgen? | Mit öffentlichem Seed kann jeder als W1 **auch burnen** — OPSEC-Hinweis in UI |

---

## 3. Rollen & Wallets

| Rolle | Wallet | Verantwortung |
|-------|--------|----------------|
| **Archiv (W1)** | Öffentlich / später Seed leak ok | Hält Ciphertexte; mintet/escrow’t NFT; empfängt Reclaim |
| **Leihnehmer (W2)** | Privat | Temporärer NFT-Besitz → Lesen; kann `cancel_reclaim` / `return_early` |
| **Berechtigter** (optional) | Adresse im Lease-Objekt | Zusätzlich Cancel/Return laut Policy (z. B. Notar) |

**Trennung:** W1 ≠ W2 (zwei Seeds). Kein HD-Unterkonto aus W1 als „W2“ in v1.

---

## 4. Krypto (starkes Gate) — B2-P4 Kern

```text
DEK = random 32 B
ciphertext = AES-GCM(DEK, plaintext)     // in W1-Mailbox / ImageNFT image_data
capsule   = Wrap(DEK, policy=Owner(nftId)) // Seal / object-lock / App-PoC
```

| Regel | Umsetzung |
|-------|-----------|
| Entschlüsselung | Nur wenn Chain sagt: Signer besitzt `nftId` **jetzt** |
| Vault | Speichert höchstens **capsule**, nie blank DEK ohne Besitz-Session |
| Transfer W1→W2 | Altgerät: lokale Session-DEK hard wipe |
| Nach Reclaim zu W1 | W1-Signer (oder öffentlicher Seed) besitzt NFT → Unwrap möglich → „öffentlich“ |

**Phasen Crypto:**

| | | Move/Seal? |
|--|--|------------|
| **P4a** | App-enforced Gate + Capsule lokal; Owner-RPC-Check; ehrlich als „stark nur mit ehrlicher App“ | Nein |
| **P4b** | Seal / Policy / Move-Wrapper — marketingfähig „ohne NFT kein Klartext“ | Ja / Seal |

Ohne P4b keine Marketing-Aussage „auch unter Zwang unmöglich“.

---

## 5. Timelock-Lease (Move-Skizze)

Kein Silent-Cron. Anlehnung an IOTA Kiosk-Rent / Escrow-Muster (`reclaim` nach Zeit, Cancel vorher).

```text
struct NftTimeLease has key {
  id: UID,
  nft_id: ID,           // oder NFT im Escrow gehalten
  lender: address,      // W1
  borrower: address,    // W2
  unlock_ms: u64,       // ab wann reclaim erlaubt
  reclaim_cancelled: bool,
  // optional: authorized_cancel: vector<address>
}
```

| Entry | Wer | Wann | Wirkung |
|-------|-----|------|---------|
| `create_lease` | W1 | Start | NFT in Escrow/Lease; W2 als Borrower |
| `return_early` | W2 (oder Berechtigter) | vor/nach unlock | NFT → W1; Lease zu |
| `cancel_reclaim` | W2 (oder Berechtigter) | vor unlock | `reclaim_cancelled=true` — **kein** permissionless reclaim; bleibt privat bei W2 |
| `reclaim` | **jeder** | `now >= unlock_ms` ∧ ¬cancelled | NFT → W1 |

**Gas:** Reclaim zahlt der Aufrufer (Relayer/Archiv/W1-Freund). UI: „Öffentlich-werden braucht eine Chain-TX nach Datum“.

**Clock:** `Clock` shared object / epoch_timestamp — wie andere Move-Module im Repo.

---

## 6. Nachrichtenablauf (Soll-UX)

1. Nutzer legt **W1**-Archiv an (oder nutzt vorhandene Adresse).  
2. Schreibt Enc-Inhalte **an W1** (Mailbox und/oder Enc-ImageNFT minten), Modus **„NFT-Zeitkapsel“** / P4a-Gate.  
3. Mint/Bind **Schlüssel-NFT** + Capsule; UI: „Aktuell nur mit NFT lesbar“.  
4. `create_lease` → NFT in Escrow, Borrower = W2.  
5. Badge: „Wird am **{Datum}** öffentlich (Reclaim), sofern nicht widerrufen.“  
6. **W2 liest:** Ciphertext beschaffen (Object-ID / Besitzer=W1 in On-Chain/NFT, optional Mailbox) → Decrypt mit Gate.  
6a. W2: `cancel_reclaim` → bleibt privat.  
6b. W2: `return_early` → sofort Archiv.  
6c. Nach Datum: irgendwer `reclaim` → NFT in W1; optional Seed W1 veröffentlichen.

---

## 7. UI-Hinweise (Pflichttexte)

| Zustand | Badge / Hinweis |
|---------|-----------------|
| Leihe aktiv | „Nur mit NFT in dieser Wallet lesbar“ |
| Timelock läuft | „Geplante Veröffentlichung: {Datum} (Reclaim), sofern nicht widerrufen“ |
| cancel_reclaim | „Timelock widerrufen — bleibt privat bei aktuellem NFT-Besitzer“ |
| nach reclaim | „Archiv-Modus: wer W1 (Seed) und NFT besitzt, kann lesen“ |
| Ist-Komfort-Karte | Weiter **nicht** diese Texte — Komfort ≠ Zeitkapsel |
| W2 ohne Ciphertext | „NFT allein enthält keine Nachrichten — Object-ID / Besitzer W1 unter On-Chain/NFT laden“ |

---

## 8. Bedrohungsmodell (kurz)

| Angreifer | Leihe | Nach Reclaim + Seed leak |
|-----------|-------|---------------------------|
| Chain-Observer | Ciphertext + Lease-Meta | wie links + W1-Aktionen möglich |
| Diebstahl W2-Gerät + Vault-PW | Liest, solange NFT in W2 | Nach Transfer/Reclaim: Gate blockiert ohne NFT |
| Diebstahl nur Vault-Merker ohne NFT | **Muss scheitern** (P4) | — |
| Früher Reclaim-Spam | Erst nach `unlock_ms` | — |
| W1 Seed öffentlich vor Reclaim | Kann Ciphertexte **sehen**/ggf. Mailbox-Purge; **nicht** DEK ohne NFT | Nach Reclaim: volle Lesung |

---

## 9. Lieferphasen (Roadmap-IDs)

| ID | Inhalt | Abhängigkeit |
|----|--------|--------------|
| **B2-P4a** | Starkes Gate App PoC (Capsule, Owner-Check, kein Blank-DEK) — **Ist 2026-11-06** | — |
| **B2-P5a** | Move `NftTimeLease` + Unit-Tests (create / return_early / cancel / reclaim) — **Ist** | P4a ✅ |
| **B2-P5b** | Messenger-UI Zeitkapsel-Panel + Badges + PTB — **Ist**; Chain nach Package-Publish | P5a ✅ |
| **B2-P5c** / **P4b** | Seal/Policy — marketingfest | optional später |
| **B2-P5d** | Optional: W2-UX „Ciphertext von W1 holen“ (Object-ID / Besitzer-Galerie + Gate-Hinweis) + **Soll-Ablauf-Retest** | **Backlog ganz hinten** (Roadmap 2026-11-09: nach Session C 2-Geräte); P5b ✅; Mailbox-Fremdscan später |
| **P4a-dual** | Wallet+NFT-Gate parallel zur Leihe (`requiredWallet` = W2) | **Ist** (App) |
| **P4a2** | Pubkey-Wrap | **Ist** |
| **P4b** | Seal Policy + Key-Broker PoC | **Ist** (`docs/NFT-GATE-SEAL-P4B-SPEC.md`) |

**Reihenfolge gesamt:** … → **P4a ✅** → **P4a-dual ✅** → **P5a/b ✅** → **P4a2 ✅** → **P4b ✅** → P5d optional → 2-Geräte.

**Nicht hier:** MeshSleepyChannel / Offline-Zahlungen — Phase C (`docs/MESH-SLEEPY-CHANNEL-SPEC.md`).

---

## 10. Abnahme-Ideen (Feld, später)

1. W1 self-Enc + NFT; W2 mit NFT liest; W1 ohne NFT liest **nicht**.  
2. Vor unlock: `cancel_reclaim` → `reclaim` abortet.  
3. Nach unlock: fremde Adresse `reclaim` → NFT in W1; W1-Seed entschlüsselt.  
4. Claims-Check: keine Lüge „automatisch ohne TX“.

---

## 11. Verwandte Docs

| Doc | Rolle |
|-----|--------|
| `docs/NFT-SCHLUESSELKARTE-MODI.md` | Komfort vs. stark + Verweis Zeitkapsel |
| `docs/NFT-SCHLUESSELKARTE-B2.md` | P0–P3 Ist |
| `docs/ROADMAP-FAHRPLAN.md` | § H.23 Nachtrag |
| `docs/ANLEITUNG-PRIVACY-VAULT-SCHLUESSELKARTE.md` | Nutzer: „geplant / nicht Ist“ |
| `docs/SECURITY-CLAIMS-CHECK-2026-11.md` | Marketing-Grenzen |
| IOTA Docs | Kiosk Rent / Escrow-Beispiele (Muster, nicht Copy-Paste) |
