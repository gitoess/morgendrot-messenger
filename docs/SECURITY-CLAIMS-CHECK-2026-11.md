# Security-Claims-Check (Ist vs. Marketing-Text)

**Stand:** 2026-11-06 (Vault-Sidecars + H.23 B2 NFT-Schlüsselkarte P0–P3 + Lock/Purge)  
**Kontext:** ImageNFT-/Chat-Passphrase + Session-Epoch + Team-Key + NFT-Schlüsselkarte.  
**Nutzer-Anleitung:** `docs/ANLEITUNG-PRIVACY-VAULT-SCHLUESSELKARTE.md`

| Claim | Morgendrot Ist | Urteil |
|-------|----------------|--------|
| **Double Ratchet / Forward Secrecy** | Statisches P-256-ECDH pro Partner → HKDF → AES-GCM; **kein** Signal-Double-Ratchet. **Teil-FS:** bewusste `keyEpoch`-Rotation (`Schlüssel erneuern`, § H.23 A4) — FS **ab Rotation**, nicht pro Nachricht. | **Zielbild falsch;** Ist: manuelle Session-Epoch. |
| **Asynchrone Dead-Drop, Discovery-Tags, rotierende Outboxes** | Feste `MAILBOX_ID` / Package-IDs; DFs unter Mailbox; Events | **Nur teilweise.** Keine rotierenden Outboxes. |
| **Handshake mit Decoys** | Ohne Decoy-Rauschen | **Stimmt nicht.** |
| **Lokale Schlüsselableitung (HW-Fragment + Passphrase, nur RAM)** | Vault PBKDF2+AES-GCM auf Disk; ECDH im Vault | **Teilweise.** Kein HW-Fragment; Seed kann verschlüsselt auf Disk liegen. |
| **Burn-on-read / object::delete** | Purge/Rebate; ImageNFT `burn` im Experiment; **Opt-in** „Burn-on-read“ im Chat-⋮ (Vorschlag + Bestätigung, kein Auto) | **Teilweise.** Bewusstes Löschen / Opt-in-Hinweis. |
| **Kein klassischer Server für Metadaten** | Direkt-RPC möglich; Boss optional | **Teilweise.** Fullnode sieht Queries; Boss kann Meta sehen. |

## Was wir bewusst umgesetzt haben (besser als Claims, aber enger)

| Feature | Nutzen | Grenze |
|---------|--------|--------|
| ImageNFT MORGIMGE1 + lokale Passphrase-Merker (Object-ID nach Mint) | Teilen ohne Handshake | Passphrasen at rest vault-verschlüsselt (`evidenceImage…enc.v1`); Klartext nur RAM |
| Galerie: Auto-Entschlüsselung + pro Eintrag Unlock | Nutzbar ohne Object-ID-Umweg | Nur wenn Passphrase lokal oder eingegeben |
| Passphrase-Nachricht `MORG_PWMSG_V1` | Chat ohne ECDH; optional **Reuse**; Wire-Paste | Ciphertext öffentlich; Key off-chain; **kein** FS |
| Passphrase-Msg-Keys at rest | `passphraseMsg.enc.v1` AES-GCM + Vault-Passwort; Klartext nur RAM; Legacy-Migration | Nicht in API-Vault-Datei; XSS/Malware mit Vault-PW kann entschlüsseln |
| Gegenseitiger Ausschluss Handshake ↔ Passphrase-Schutz | Weniger Fehlbedienung | — |
| **Vault-/Session-Lock:** Chat- + ImageNFT-Passphrasen + Team-Keys aus RAM; Enc-Sidecars bleiben; Purge/Einsatz-Ende löscht Sidecars | Weniger Klartext-Reste; Keys nach Unlock wieder da | Nest-Datei `.team-keys.enc` optional später; Browser = `teamKeys.enc.v1` |
| **H.23 A4 UX:** ⋮ → Schlüssel erneuern (Epoch-Anzeige) + Hinweis nach Enc-Send | Rotation auffindbar | Kein Auto-Ratchet |
| **Burn-on-read Opt-in** (Chat-⋮) | Purge nach Lesen vorschlagen; bei aktiv → Composer erzwingt Mailbox (Event nicht purgebar) | Mit Bestätigung; nur Mailbox-Objekte; Explorer behält TX/Events |
| **H.23 B1 Team-Key** | Enc Team-Broadcast + Handoff; UI erzeugen/rotieren; Enc-Send ohne Auto-Fork; Browser-Sidecar `teamKeys.enc.v1` (Nest `.team-keys.enc` optional später) | Legacy-Klartext wird beim Unlock migriert/gelöscht; 2-Geräte-Feldtest bewusst später |
| **H.23 B2 NFT-Schlüsselkarte** | Enc-Store + Galerie Multi-Slot + Composer-Bindung + Mint→Slot + Besitz-Check + `[morg-keycard]` + **P4a** DEK-Capsule (`MORG_NFTGATE_V1`) | Zusätzlicher Zugriffsmodus; Secrets off-chain; P4a = App-Gate (ehrlich); P4b Seal fehlt |

## Bewusst **nicht** in dieser Runde (weiterhin Backlog)

| Thema | Roadmap | Hinweis |
|-------|---------|---------|
| Double Ratchet / FS pro Nachricht | § H.23 Phase 3 / E2EE **C1** | Spec+PoC C1.1–C1.5 (Opt-in Hook); Composer v2 Default |
| Starkes NFT-Besitz-Gate | B2-P4a Ist (App-Capsule); P4a-dual Wallet∧NFT Ist; P4b Seal später | Kein Marketing „unter Zwang unmöglich“ vor P4b; Klartext kopierbar |
| NFT-Zeitkapsel / Timelock | B2-P5a/b Ist (Move+UI); NFT=Gate, Ciphertext getrennt | Kein Auto-Rücklauf ohne reclaim-TX; NFT allein ≠ Nachrichten |
| MeshSleepyChannel / Offline-Zahlung Mesh | Phase-C Backlog | Nicht Ist; kein Watchtower-Claim |
| NFT-gesichertes Ausgeben (Guarded Purse) | B2-S1+S2 Ist (`nft_guarded_purse` + Panel); nur Token | 2FA: X∧NFT; **lose Coins außerhalb Purse ungeschützt**; kein Klartext-Claim |
| Öffentlicher Vault + NFT-Timelock | B2-P5 Spec | `NFT-SCHLUESSELKARTE-PUBLIC-VAULT-TIMELOCK.md` — **kein** stiller Auto-Transfer |
| Decoys im Handshake | Claims / Architektur | Nicht spezifiziert als nächste Scheibe |
| Rotierende Outboxes / voller Dead-Drop | Claims / M4-Erweiterung | Feste Mailbox-IDs Ist |
| HW-Fragment + Keys nur RAM | Claims | Vault-at-rest Enc; kein Secure Element |
| Auto Burn-on-read | Claims | Nur Opt-in + Confirm |

Double Ratchet, Decoys, rotierende Outboxes, HW-Fragment — großer Architekturaufwand (**§ H.23** Option A + B1/B2 Ist; C1 erst nach 1-Gerät-Smoke und idealerweise 2-Geräte-Feldtest).

## Kurzfassung

Der zitierte Text ist **Zielbild**. Ehrliche Ist-Stärken: getrenntes Messaging-ECDH, Vault, AES-GCM, Direkt-RPC, Purge, Passphrase-Kanäle, **manuelle Session-Epoch**, Lock-Wipe lokaler Passphrase-Merker. Größte Lücke zum Text: **kein** Double-Ratchet / kein FS pro Nachricht.
