# NFT-Schlüsselkarte: Komfort vs. Besitz-Gate

**Stand:** 2026-11-06  
**Kontext:** H.23 B2 Ist = **Komfort-Bindung** (lokal). Echtes kryptografisches Besitz-Gate = Backlog (**B2-P4**).  
**Optional Spec:** Öffentlicher Ciphertext-Vault + NFT-Timelock → **`docs/NFT-SCHLUESSELKARTE-PUBLIC-VAULT-TIMELOCK.md`** (**B2-P5**, nicht Ist).

## 1. Brauchen Sender und Empfänger das NFT?

| Szenario | Sender | Empfänger | Lesen möglich wenn |
|----------|--------|-----------|-------------------|
| **Nur Passphrase** (PWMSG / Enc-Image) | Passphrase teilen | Passphrase kennen | Jeder mit Passphrase — **ohne** NFT |
| **Komfort-Bindung (Ist)** | Karte optional lokal; Passphrase trotzdem der Crypto-Key | Passphrase **oder** lokale Slot-Kopie | NFT-Transfer ändert Crypto **nicht**; lokaler Merker kann weiter entschlüsseln |
| **Paar-Karten (Empfehlung Komfort)** | Karte A | Karte B (2. Mint oder Transfer) | Beide haben eigene Object-ID + denselben Slot-Inhalt (Passphrase) — UX/OPSEC, keine starke Gate |
| **Starkes Besitz-Gate (Ziel)** | DEK wrapped an Besitzbedingung | Nur aktueller Owner | Ohne NFT in Wallet → kein Klartext, auch nicht mit alter Vault-Kopie |

**Kurz:** Für **Verschlüsseln** braucht niemand das NFT — die Passphrase (bzw. später DEK) reicht. Das NFT ist Ist nur **Merkhilfe / Besitz-Hinweis**. Für **starkes „nur Owner liest“** muss der Nachrichtenschlüssel kryptografisch an Besitz gebunden sein (noch nicht gebaut).

## 2. Ist (schwach) vs. Wunsch (stark)

| | Ist (Komfort) | Wunsch (stark) |
|--|---------------|----------------|
| Key | Passphrase AES | DEK + Wrap an Besitz / Seal / Adress-Wrap |
| Vault-Merker | Entschlüsselt auch nach NFT-Weggabe | Merker ohne Besitz nutzlos oder gelöscht |
| Transfer | Besitz wechselt; Lesen oft weiter möglich | Leserecht wandert mit Owner |
| Marketing | Darf **nicht** „nur mit NFT lesbar“ sagen | Darf das erst nach P4 |

**Bug / Inkonsistenz (behoben / ehrlich gemacht):** Spec sprach von „Auto wenn Besitz“ — Chat-Bubble nutzte Bindung kaum und Vault-Remember ohne Besitz-Check. → Soft-Gate: bei Wire-Bindung Auto-Decrypt nur noch bei aktuellem Karten-Besitz; manuelle Passphrase bleibt (Modus „NFT **oder** Passphrase“).

## 3. Messenger-Matrix (stimmig halten)

| Kanal | Crypto | Rolle NFT |
|-------|--------|-----------|
| Direktchat ECDH | Session-Keys | **Keine** — Alltags-Chat |
| PWMSG | Passphrase | Optional Komfort-Bindung; später Gate |
| Enc-ImageNFT | Passphrase in `image_data` | Optional Slot / Paar-Mint |
| Team-Broadcast | Team-Key | **Keine** |
| Burn-on-read | Mailbox-Purge | **Keine** (Nachrichten-Objekt, nicht ImageNFT) |
| Epoch / Schlüssel erneuern | ECDH-Epoch | **Keine** |

## 4. Paar-Mint (optional, Komfort)

Zwei ImageNFTs mit **gleicher** Enc-Payload/Passphrase: eines behalten, eines an Partner senden (oder beide behalten und eines transferieren).  
Nutzen: beide haben ein sichtbares Token + denselben Slot-Inhalt — **kein** starkes Gate.

## 5. Wann „starkes Gate“ angehen?

| Sinnvoll wenn … | Noch warten wenn … |
|-----------------|-------------------|
| Echtes „wer NFT hat, liest / wer nicht, nicht“ Produktversprechen | Nur Komfort/Merker + Passphrase-teilen reicht |
| Transfer = Leserecht weitergeben (ohne dass Altbesitzer mit Vault-Kopie weiterliest) | 1-Gerät-Smoke / Bind-UX / Paar-Mint noch wackeln |
| Seal/Policy oder DEK-Wrap an Owner spezifiziert + Testnetz | Kein Crypto-Budget / kein Move-/Seal-Pfad |

**Produktwunsch (merken):** NFT weggibt / weiterreicht → **niemand** (auch nicht unter Zwang am Gerät) soll die Nachricht noch entschlüsseln können, weil das NFT fehlt. Das ist genau **B2-P4 starkes Gate** — Ist-Komfort erfüllt das **nicht** (Passphrase/Vault reicht weiter).

**Reihenfolge (aktualisiert 2026-11-06):** Komfort-B2 + Smoke + C1 PoC ✅ → **B2-P4a jetzt** (2-Geräte-Feldtest **verschoben** nach P4a) → P4b Seal optional → P5 → 2-Geräte.

## 6. Roadmap starkes Gate (B2-P4)

1. Inhalt mit Zufalls-DEK verschlüsseln.  
2. DEK nur freigeben wenn `Owner(NFT)==Signer` (Seal / Policy / Wrap an Empfänger-Pubkey + Re-wrap bei Transfer).  
3. Vault speichert DEK **nicht** ohne Besitz-Check; bei Transfer Sender-Merker hart löschen.  
4. UI-Modi: `Passphrase` \| `NFT-Besitz` \| `NFT und Passphrase` \| `NFT oder Passphrase`.

| Stufe | Status |
|-------|--------|
| **P4a** App-Gate + Capsule (`MORG_NFTGATE_V1`, NFT-Besitz/Leihe) | **Ist** — ehrlich: stark nur mit ehrlicher App |
| **P4a-dual** Wallet **und** NFT | **Ist** — Composer „Wallet + NFT“; Capsule an `nftId`+`requiredWallet`; App prüft Signer=Adresse **und** NFT-Leserecht |
| **P4a2** Pubkey-Wrap an `requiredWallet` | **Ist** — Gate `nft_and_wallet_pubkey_p4a2`; DEK via ECDH an Peer-Pub; Composer-Checkbox unter Dual |
| **P4b** Seal/Policy + Key-Broker | **Ist (PoC)** — `nft_gate_seal` + `/api/nft-gate-seal/*`; Gate `nft_seal_p4b`; Spec `docs/NFT-GATE-SEAL-P4B-SPEC.md` |

Marketing „auch unter Zwang unmöglich“ nur mit **remote** Broker (nicht Master auf dem Gerät) und ohne Broker-Admin-Zwang — ehrlich bleiben.  
**Klartext-OPSEC:** Einmal entschlüsselt → kopierbar/Screenshot — Gate schützt **Zugriff**, nicht Nachnutzung.

### 6a. Dual-Gate: festgelegte Wallet + NFT (Option)

**Wunsch:** Enc nur lesbar wenn (1) Signer = festgelegte Adresse **und** (2) NFT-Leserecht (Owner oder Zeitkapsel-Borrower).

| Variante | Stärke | Ist |
|----------|--------|-----|
| **App-Dual (P4a-dual)** | Beide Checks in der App; Capsule-HKDF an nft+wallet gebunden (Meta nicht umetikettierbar) | **Ist** |
| **Pubkey-Dual (P4a2)** | DEK via ECDH an Empfänger-Pubkey (+ nft/wallet-Bindung); Wire allein unzureichend | **Ist** |
| **Seal (P4b)** | Chain-Policy `seal_approve*` + Key-Broker (PoC, nicht Mysten-DSM) | **Ist** |

**Zeitkapsel:** parallel denkbar — `requiredWallet` = W2; während Leihe zählt Lease-Borrower als NFT-Leserecht, Signer muss trotzdem = `requiredWallet`.  
**Nicht** mit MeshSleepyChannel/Payments vermischen.

UI: Passphrase-Schutz → Karte binden → Starkes Gate → optional **Wallet + NFT (Dual)** + Adressfeld.

### 6b. Token-2FA: Guarded Purse + Bearer Treasury (S0–S3 Ist)

**Scope:** nur **IOTA/Token**, nicht Klartext.  
**Modus A:** Purse bei X; `spend` nur X∧NFT — Panel Ist.  
**Modus B:** Shared Treasury; `withdraw` wer NFT hat — Panel Ist (`0x10b16597…`).  
**Pflichttext:** Lose Coins außerhalb Purse/Treasury = **ungeschützt**.  
SSOT **`docs/NFT-GUARDED-SPEND-SPEC.md`**. Nicht Leserecht/Zeitkapsel/MeshSleepy.

## 7. Optional: Öffentlicher Vault + NFT-Timelock (B2-P5)

**Idee:** Wallet 1 hält nur Ciphertexte (Seed darf später öffentlich); Leserecht = NFT/Lease; NFT zeitlich an Wallet 2; danach **permissionless Reclaim** (kein stiller Cron).

**Wichtig:** Das NFT **trägt keine Nachrichten**. W2 braucht Ciphertexte separat — typisch unter **On-Chain / NFT** per **Object-ID** oder **Besitzer = W1**, dann Decrypt mit Gate. Details §0a in der Spec.

Vollständige Spec: **`docs/NFT-SCHLUESSELKARTE-PUBLIC-VAULT-TIMELOCK.md`** (P5a/b Ist).

| | Komfort (Ist) | P4a stark | P5 Zeitkapsel |
|--|---------------|-----------|---------------|
| Ciphertext | beliebig | Wire/Image getrennt | typisch W1-Mailbox / Enc-ImageNFT |
| Lesen | Passphrase/Merker | nur NFT-Owner (App) | Leihe: W2 + Ciphertext-Zugriff; danach W1 |
| Zeit | — | — | Lease + reclaim / cancel |

**Nicht:** Unterwallets aus einem Seed; kein Alltags-Chat-Ersatz; NFT ≠ Textarchiv.
