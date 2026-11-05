# Security-Claims-Check (Ist vs. Marketing-Text)

**Stand:** 2026-11-05 (nach H.23-UX + Lock-Wipe + Burn-on-read + Passphrase-Reuse + Mailbox-Force bei Burn)  
**Kontext:** ImageNFT-Passphrase + Passphrase-Nachrichtenkanal + Session-Epoch.

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
| ImageNFT MORGIMGE1 + lokale Passphrase-Merker (Object-ID nach Mint) | Teilen ohne Handshake | Passphrase Klartext in `localStorage` dieses Geräts |
| Galerie: Auto-Entschlüsselung + pro Eintrag Unlock | Nutzbar ohne Object-ID-Umweg | Nur wenn Passphrase lokal oder eingegeben |
| Passphrase-Nachricht `MORG_PWMSG_V1` | Chat-ähnliches Teilen ohne ECDH; optional **Passphrase wiederverwenden** (Geräte-Standard, neuer Salt/IV pro Wire) | Ciphertext öffentlich; Key off-chain; **kein** FS; Vault-Lock leert Default |
| Gegenseitiger Ausschluss Handshake ↔ Passphrase-Schutz | Weniger Fehlbedienung | — |
| **Vault-/Session-Lock:** leert `evidenceImage.passphrases` + `passphraseMsg` Stores | Weniger Klartext-Reste nach Sperre | Nur dieses Gerät; ECDH separat |
| **H.23 A4 UX:** ⋮ → Schlüssel erneuern (Epoch-Anzeige) + Hinweis nach Enc-Send | Rotation auffindbar | Kein Auto-Ratchet |
| **Burn-on-read Opt-in** (Chat-⋮) | Purge nach Lesen vorschlagen; bei aktiv → Composer erzwingt Mailbox (Event nicht purgebar) | Mit Bestätigung; nur Mailbox-Objekte; Explorer behält TX/Events |

## Bewusst **nicht** in dieser Runde

Double Ratchet, Decoys, rotierende Outboxes, HW-Fragment — großer Architekturaufwand (**§ H.23** Option A zuerst; A4 UX jetzt sichtbarer).

## Kurzfassung

Der zitierte Text ist **Zielbild**. Ehrliche Ist-Stärken: getrenntes Messaging-ECDH, Vault, AES-GCM, Direkt-RPC, Purge, Passphrase-Kanäle, **manuelle Session-Epoch**, Lock-Wipe lokaler Passphrase-Merker. Größte Lücke zum Text: **kein** Double-Ratchet / kein FS pro Nachricht.
