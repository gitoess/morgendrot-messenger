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
| 4 | **Erneut sperren** | Passphrase-Bubble | Confirm → Passphrase erneut nötig |
| 5 | ImageNFT verschlüsselt minten | Posteingang → **On-Chain / NFT** → Mint | Passphrase lokal gemerkt |
| 6 | NFT als Schlüsselkarte | Galerie → **Als Schlüsselkarte merken** | Vault-Sidecar `nftKeycard.enc.v1` |
| 7 | Optional Slot / Mint an Slot | Galerie Multi-Slot; Mint → Karte wählen | Slot `img` o. ä.; optional `[morg-keycard]` in Description |
| 8 | Composer Key binden | Passphrase-Schutz → Karte + Slot | Wire lokal an Karte gebunden |
| 9 | Schlüssel erneuern | Direktchat-⋮ | `keyEpoch++` (FS ab Rotation, nicht pro Msg) |
| 10 | Burn-on-read (opt-in) | Direktchat-⋮ | Nur mit Bestätigung; Composer erzwingt Mailbox |

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
| Bubble **Erneut sperren** | Hart: Merker weg, wieder Eingabe |
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

## 7. Burn-on-read

| Ist | Grenze |
|-----|--------|
| Opt-in im Chat-⋮ | Vorschlag + Bestätigung, **kein** Auto-Purge |
| Aktiv → Composer **Mailbox** | Event-Pfad ist nicht purgebar |
| Explorer | behält TX/Events |

---

## 8. Was bewusst **noch nicht** da ist (steht in der Roadmap)

| Wunsch | Roadmap-Ort | Status |
|--------|-------------|--------|
| Double Ratchet / FS **pro Nachricht** | § H.23 Phase 3 / E2EE **C1** | Backlog — erst nach stabiler Session Keys+ + Feldvalidierung |
| Rotierende Outboxes / voller Dead-Drop | Claims-Check + Architektur | Nicht gebaut |
| Handshake mit Decoys | Claims-Check | Nicht gebaut |
| Hardware-Fragment + Keys nur RAM | Claims-Check | Teilweise Vault-at-rest; kein HW-Fragment |
| Automatisches Burn-on-read | Claims-Check | Nur Opt-in mit Confirm |
| Post-Quantum hybrid | E2EE Phase 4 | Backlog |

Siehe auch Kopf von `docs/ROADMAP-FAHRPLAN.md` (Nachtrag Privacy 2026-11-05): *„Kein Double-Ratchet / Decoys / Outboxes in dieser Tranche.“*

---

## 9. Empfohlene Reihenfolge ab hier

1. **Diese Anleitung am PC durchklicken** (Tabelle §0) — Befunde ins `docs/TEST-RUN-LOGBOOK.md`.  
2. Kleine Fixes aus dem Smoke.  
3. **Entscheidung:**  
   - **A)** 2-Geräte-Feldtest (Team-Key + Passphrase + Lock) — validiert Ist, bevor große Krypto-Baustellen.  
   - **B)** Start **C1 Double-Ratchet Spec + PoC** — großer Aufwand, nur 1:1 IOTA; braucht vorher stabile A4/B1-Feldlage.  
4. Decoys / rotierende Outboxes / HW-Fragment: **nicht** parallel zu Ratchet oder Feldtest starten.

---

## 10. Verwandte Docs

| Doc | Inhalt |
|-----|--------|
| `docs/ROADMAP-FAHRPLAN.md` | Gesamtfahrplan |
| `docs/SECURITY-CLAIMS-CHECK-2026-11.md` | Marketing vs. Ist |
| `docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md` | A/B/C/D Phasen |
| `docs/NFT-SCHLUESSELKARTE-B2.md` | B2 Spec |
| `docs/MESSENGER-CHAT-HANDBUCH.md` | Chat-Bedienung allgemein |
| `docs/START-ANLEITUNG.md` | App starten |
| `docs/TEST-RUN-LOGBOOK.md` | Testergebnisse |
