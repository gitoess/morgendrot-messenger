# Anleitung: Privacy, Vault & NFT-Schlüsselkarte

**Stand:** 2026-11-06  
**Für wen:** PC-Test am Schreibtisch (1 Gerät zuerst).  
**SSOT Claims:** `docs/SECURITY-CLAIMS-CHECK-2026-11.md`  
**Spec Schlüsselkarte:** `docs/NFT-SCHLUESSELKARTE-B2.md`  
**E2EE-Zielbild:** `docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`

Diese Anleitung listet **alle Privacy-/Vault-Funktionen, die heute im Messenger nutzbar sind**, wo du sie findest, und was sie **nicht** sind.

---

## 0. Schnellstart Test (1 Gerät) — in Alltagssprache

Voraussetzung: Messenger offen (http://127.0.0.1:3341/), Tresor schon entsperrt.

### A) Passphrase-Nachricht (ohne Handshake-Verschlüsselung)

1. Links **ich** oder einen Kontakt wählen.  
2. Oben auf **Unverschlüsselt** stellen (oder Passphrase-Schutz anhaken — das schaltet Verschlüsselt automatisch aus).  
3. Haken **Passphrase-Schutz** setzen. Adressfeld `0x…` muss sichtbar sein.  
4. Kurzen Text tippen → **Senden**.  
5. In der Statuszeile steht die Passphrase (und „gemerkt“, wenn Checkbox an).

### B) Privacy sperren (Chat bleibt sichtbar)

1. Rechts oben auf das grüne Badge **Tresor: bereit** klicken → bestätigen.  
2. Es erscheint **kein** großes Login-Fenster. Der Chat bleibt offen.  
3. Die Passphrase-Nachricht zeigt nur noch Kauderwelsch (Ciphertext), kein Klartext.  
4. Badge heißt jetzt **Privacy: gesperrt**.  
5. Badge erneut tippen → Passwort eingeben → Klartext ist wieder da.

### C) Empfänger ändern

Unter dem Namen (**ich** / Kontakt) auf **Empfänger leeren / ändern** klicken → Adressfeld erscheint → neue `0x…` eintippen oder Kontakt neu wählen.

| # | Kurz | Erwartung |
|---|------|-----------|
| 1 | Passphrase senden | Wire + Hinweis gemerkt |
| 2 | Privacy sperren | Chat offen, nur Ciphertext, kein Login-Overlay |
| 3 | Badge + Passwort | Klartext wieder |
| 4 | Empfänger leeren | Adressfeld editierbar |
| 5 | **Im Vault löschen** (Bubble, neben Wire kopieren) | Confirm → Merker weg, Passphrase erneut nötig |
| 6 | ImageNFT verschlüsselt minten | Posteingang → On-Chain/NFT → Mint; Passphrase lokal gemerkt |
| 7 | NFT als Schlüsselkarte | Galerie → Als Schlüsselkarte merken → Sidecar `nftKeycard.enc.v1` |
| 8 | Optional Slot / Mint an Slot | Galerie Multi-Slot; Mint → Karte; optional `[morg-keycard]` |
| 9 | Composer Key binden | Passphrase-Schutz → Karte + Slot |
| 10 | Schlüssel erneuern / Burn-on-read | Direktchat-⋮ → Epoch bzw. Burn nur mit Confirm |

**2-Geräte-Feldtest** (Team-Key-Handoff, Erneut-sperren auf Empfängergerät, NFT-Transfer): bewusst **später** — siehe Fahrplan.

---

## 1. Was ist der Secret-Vault?

Beim Entsperren des Tresors (Vault-Passwort) werden lokale Geheimnisse **entschlüsselt in den RAM** geladen. At rest liegen sie als **AES-GCM-Sidecars** in `localStorage` (Browser), nie als Klartext.

| Sidecar / Store | Inhalt |
|-----------------|--------|
| `passphraseMsg.enc.v1` | Passphrasen für `MORG_PWMSG` |
| Evidence-Sidecar | Passphrasen für verschlüsselte ImageNFTs |
| `teamKeys.enc.v1` | Team-Broadcast-Keys (Gruppen-Enc) |
| `nftKeycard.enc.v1` | NFT-Schlüsselkarten (Slots + Bindungen) |

| Aktion | Wirkung |
|--------|---------|
| **Unlock** | Sidecars → RAM; Auto-Decrypt wo möglich |
| **Lock** | RAM + Tab-Backup weg; Enc-Sidecars bleiben |
| **Purge / Einsatz beenden** | Sidecars + Merker weg |

**Grenze:** XSS/Malware mit Vault-Passwort kann Sidecars lesen. Kein Hardware-Fragment, kein „nur RAM, nie Disk“ für den Seed (Vault-Blob liegt verschlüsselt auf Disk/LS).

---

## 2. Passphrase-Nachrichten (`MORG_PWMSG`)

**Zweck:** Nachricht ohne ECDH-Handshake; Ciphertext on-chain; Passphrase separat teilen.

| UI | Funktion |
|----|----------|
| Composer **Passphrase-Schutz** | Enc pro Sendung (oder wiederverwendet) |
| **Passphrase wiederverwenden** | Gleiche Passphrase, neuer Salt/IV |
| **Key an NFT-Schlüsselkarte binden** | Optional: Karte + Slot; Wire-Fingerprint lokal |
| Absender-Remember | Checkbox **„Auf diesem Gerät merken“** (Default an): nur diese Nachricht auto-Klartext nach Unlock. Aus = nach Lock nur Ciphertext (manuell eingeben). **Wiederverwenden** = Composer-Default bis „Neu würfeln“, entschlüsselt Posteingang **nicht** automatisch |
| Bubble **Verbergen** | Weich ausblenden |
| Bubble **Im Vault löschen** | Hart: Merker für diese Nachricht weg (neben Wire kopieren); wieder Eingabe |
| Posteingang **Wire einfügen** | Paste Wire + Passphrase → lokaler Klartext |

**Nicht:** Forward Secrecy, Ersatz für Alltags-ECDH-Chat, Push der Passphrase an andere Geräte.

---

## 3. ImageNFT / On-Chain Evidenz

**Wo:** Chat → Posteingang-Menü → **On-Chain / NFT** (Object / Besitzer / Wire / Mint / Klartext-MB).

| Funktion | Kurz |
|----------|------|
| Object-ID laden | Einzelnes NFT anzeigen |
| Besitzer-Galerie | Eigene ImageNFT/SimpleNFT |
| Mint (+ optional Enc) | `MORGIMGE1` Ciphertext on-chain |
| Passphrase nach Mint | Anzeigen/kopieren; lokal merken |
| Alle entsperren & merken | Galerie mit eingegebener Passphrase |
| Als Schlüsselkarte merken | Siehe §4 |
| Multi-Slot | Mehrere Passphrasen pro Karten-NFT |
| Mint → Schlüsselkarte-Slot | Passphrase in Slot `img` (o. ä.) + `boundObjects` |
| `[morg-keycard]` | Öffentlicher Description-Hinweis (Karten-OID + Slot, **keine** Secrets) |

Details Attribute: `docs/EVIDENCE-IMAGE-AND-NFT-ATTRIBUTES.md`.

---

## 4. NFT-Schlüsselkarte (H.23 B2)

**Zusätzlicher Zugriffsmodus** für spezielle Enc-Inhalte — **kein** Ersatz für Passphrase-Komfort und **nicht** für Alltags-Direktchat.

### Slots (`default` vs `img`)

Nur **lokale Namen** im Vault — on-chain steht nichts davon (außer optionaler öffentlicher `[morg-keycard]`-Hinweis).

| Slot | Üblich für |
|------|------------|
| `default` | Erste / allgemeine Passphrase der Karte |
| `img` | Passphrase vom **verschlüsselten ImageNFT-Mint** |
| `pwmsg` o. ä. | Passphrase für Passphrase-Chat (`MORG_PWMSG`) |

**Als Schlüsselkarte merken** = NFT als Karte anlegen + ersten Slot speichern.  
**Slot speichern / aktualisieren** = weitere Slot-ID oder Passphrase in bestehendem Slot überschreiben (Karte existiert schon).

### Enc-Mint / „Mint → Slot“

| Begriff | Bedeutung |
|---------|-----------|
| **Enc-Mint** | ImageNFT minten mit **On-chain verschlüsseln** → `image_data` = Ciphertext (`MORGIMGE1`); Passphrase nur off-chain |
| **Mint → Slot** | Nach Enc-Mint: Passphrase zusätzlich in einen Slot der gewählten Schlüsselkarte schreiben (`img` o. ä.) |

### Senden / Vernichten / Aktivität

| Ort | Aktion |
|-----|--------|
| Hauptmenü → **NFTs / Evidenz** | Galerie öffnen |
| Posteingang → **On-Chain / NFT** → Besitzer | gleiche Galerie |
| **NFT senden** | Besitz on-chain an `0x…`-Adresse |
| **Vernichten** | `image_nft::burn` (unwiderruflich); lokale Merker weg |
| **NFT-Aktivität** | Lokales Log: Mint / Gesendet / Empfangen (Galerie-Diff) / Vernichtet + TX-Link |

### Bindungen (lokal, sinnvoll)

| Wann | Was |
|------|-----|
| **Vor** Create | Nur Composer-Auswahl einer **bereits existierenden** Schlüsselkarte (Object-ID muss schon da sein) |
| **Beim** PWMSG-Send | Wire-Fingerprint → Slot (automatisch) |
| **Beim/nach** Enc-Mint | neues ImageNFT → Slot; oder **Nachträglich binden** in der Galerie |
| **Paar-Mint** | 2. Enc-NFT gleiche Passphrase → an Partner senden (beide Token, gleicher Key) |
| **Lösen** | Einzelne Objekt-/Wire-Bindung; Slot entfernen; ganze Karte vergessen |
| **Löschen NFT** | on-chain **Vernichten** ≠ Bindung lösen (Bindung nur Vault) |

**Wichtig:** Sender/Empfänger brauchen das NFT **nicht** zum Verschlüsseln — nur die Passphrase. NFT-Bindung = Komfort + Soft-Auto bei Besitz. Details: `docs/NFT-SCHLUESSELKARTE-MODI.md`.

| Modus | Klartext wenn |
|-------|----------------|
| Passphrase | Nutzer kennt / Vault hat Slot |
| NFT-Besitz | Signer besitzt Karten-Object-ID **und** lokaler Slot passt |
| Beides (optional) | Besitz **und** Passphrase |

| Ort | Aktion |
|-----|--------|
| Galerie | Karte merken, Slots anlegen/aktualisieren/entfernen, Besitz-Check |
| Composer | PWMSG an Karte+Slot binden |
| Mint Enc | Optional Passphrase in Slot schreiben + Marker |

**Phasen Ist:** P0 Enc-Store · P1 Galerie/Composer · P2 Multi-Slot/Mint · P3 Description-Marker. **Kein** eigenes Move-Paket.

---

## 5. Session-ECDH / „Schlüssel erneuern“

| Ist | Bedeutung |
|-----|-----------|
| Pairwise ECDH + AES-GCM | Alltags-Direktchat nach Handshake |
| **Schlüssel erneuern** (⋮) | `keyEpoch++` — Forward Secrecy **ab Rotation**, nicht pro Nachricht |
| Badge / Hinweis | Kein Signal-Double-Ratchet behaupten |

---

## 6. Team-Key (H.23 B1)

Gruppen-Enc ohne Auto-Fork: Team-Key erzeugen/rotieren, Handoff, Vault-Sidecar. **2-Geräte-Feldtest** später.

---

## 7. Burn vs. lokal ausblenden

| Aktion | Was passiert |
|--------|----------------|
| **Lokal ausblenden** | Nur UI/Session — Chain unverändert |
| **Burn** | Mailbox-Objekt on-chain löschen (Rebate); braucht `chainPurgeable` |
| **Burn-on-read (Modus)** | Opt-in: Composer erzwingt Mailbox; burnbare Zeilen orange + Badge **Burnbar**; Burn mit Confirm |

Intern heißt der Chain-Call weiter `/purge-msg` — in der UI nur noch **Burn**. „Emergency Purge“ in den Einstellungen ist etwas anderes (Vault/Cache).

**Abort 10 (`E_MSG_MISSING`):** MsgKey fehlt in der angesprochenen Mailbox — oft Shared vs. private. Fix: Posteingang speichert `chainMailboxObjectId`; Burn probiert bekannte Mailboxen.

**Aktivität:** Hauptmenü → **IOTA-Aktivität** (Msg-Burn + NFT Ein/Aus/Burn). **NFT** im IOTA-Wallet (neben Empfangen) öffnet die eigene Galerie (+ Besitzer-Adresse für andere Wallets).

| Grenze |
|--------|
| Event-Pfad („Nur Wallet-Adresse“) = **nicht burnbar** — nur lokal ausblendbar |
| Explorer behält Send-TX / Events (Ledger unveränderlich) |
| Kein Auto-Burn ohne Bestätigung |

---

## 8. Was bewusst **noch nicht** da ist (steht in der Roadmap)

| Wunsch | Roadmap-Ort | Status |
|--------|-------------|--------|
| Double Ratchet / FS **pro Nachricht** | § H.23 Phase 3 / E2EE **C1** | Spec + PoC C1.1/C1.2a; kein Composer-Default |
| Starkes NFT-Besitz-Gate | B2-P4a | Ist (App-Gate Capsule); optional **Wallet + NFT (Dual)** |
| Dual Wallet∧NFT | P4a-dual | Composer unter Starkes Gate; Klartext danach kopierbar |
| Pubkey-Wrap | P4a2 | Checkbox unter Dual; ECDH-Peer-Pub der erlaubten Wallet nötig |
| Seal / Key-Broker | P4b | Checkbox unter Starkes Gate; **ein API-Broker ≠ Mysten-Seal**; remote nötig für „unter Zwang“ |
| Token-Spend | S0–S3 | Radio: **Nur NFT (Bearer)** oder **NFT+Wallet (Guarded)** — wählbar |
| NFT-gesichertes Senden (IOTA) | B2-S0 Spec | Backlog — **nur Token**; Purse-2FA (X∧NFT); lose Coins außerhalb = ungeschützt (`docs/NFT-GUARDED-SPEND-SPEC.md`) |
| Öffentlicher Ciphertext-Vault + NFT-Timelock („Zeitkapsel“) | **B2-P5a/b Ist** | NFT = Gate, Texte = Ciphertext getrennt. Borrower: optional Object-ID / Besitzer=Archiv unter On-Chain/NFT laden, dann lesen. Spec **`docs/NFT-SCHLUESSELKARTE-PUBLIC-VAULT-TIMELOCK.md`** §0a |
| Rotierende Outboxes / voller Dead-Drop | Claims-Check + Architektur | Nicht gebaut |
| Handshake mit Decoys | Claims-Check | Nicht gebaut |
| Hardware-Fragment + Keys nur RAM | Claims-Check | Teilweise Vault-at-rest; kein HW-Fragment |
| Automatisches Burn-on-read | Claims-Check | Nur Opt-in mit Confirm |
| Post-Quantum hybrid | E2EE Phase 4 | Backlog |

Siehe auch Kopf von `docs/ROADMAP-FAHRPLAN.md` (Nachtrag Privacy 2026-11-05): *„Kein Double-Ratchet / Decoys / Outboxes in dieser Tranche.“*

---

## 9. Empfohlene Reihenfolge ab hier

1. ~~Anleitung §0 / Epoch+Burn / C1 / P4a / P5a/b / P4a-dual~~ → **Ist** (Logbuch 2026-11-06).  
2. **Als Nächstes (optional):** 2-Geräte-Feldtest; P4b Seal PoC Ist (`0x1fb0e9b7…`, Spec `docs/NFT-GATE-SEAL-P4B-SPEC.md`).  
3. **Feld:** Zeitkapsel-Panel Leihe + Ciphertext per Object-ID/Besitzer; optional P5d.  
4. **Später:** MeshSleepyChannel (Phase C).  
5. **Nicht parallel:** Decoys, Outboxes, HW-Fragment.

---

## 10. Verwandte Docs

| Doc | Inhalt |
|-----|--------|
| `docs/ROADMAP-FAHRPLAN.md` | Gesamtfahrplan |
| `docs/SECURITY-CLAIMS-CHECK-2026-11.md` | Marketing vs. Ist |
| `docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md` | A/B/C/D Phasen |
| `docs/NFT-SCHLUESSELKARTE-B2.md` | B2 Spec |
| `docs/NFT-SCHLUESSELKARTE-MODI.md` | Komfort vs. stark / Dual / Token-2FA |
| `docs/NFT-SCHLUESSELKARTE-PUBLIC-VAULT-TIMELOCK.md` | Zeitkapsel / Timelock (P5) |
| `docs/NFT-GUARDED-SPEND-SPEC.md` | Guarded Purse Token-2FA |
| `docs/MESSENGER-DOUBLE-RATCHET-C1-SPEC.md` | C1 Double Ratchet |
| `docs/MESH-SLEEPY-CHANNEL-SPEC.md` | Mesh-Payment Backlog |
| `docs/MESSENGER-CHAT-HANDBUCH.md` | Chat-Bedienung allgemein |
| `docs/START-ANLEITUNG.md` | App starten |
| `docs/TEST-RUN-LOGBOOK.md` | Testergebnisse |
