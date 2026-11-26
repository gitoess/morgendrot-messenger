# Anleitung: Privacy, Vault & NFT-Schlüsselkarte

**Stand:** 2026-11-08  
**Für wen:** PC-Test am Schreibtisch (1 Gerät zuerst).  
**SSOT Claims:** `docs/SECURITY-CLAIMS-CHECK-2026-11.md`  
**Spec Schlüsselkarte:** `docs/NFT-SCHLUESSELKARTE-B2.md`  
**E2EE-Zielbild:** `docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`

Diese Anleitung listet **alle Privacy-/Vault-Funktionen, die heute im Messenger nutzbar sind**, wo du sie findest, und was sie **nicht** sind.

### Galerie ≠ Schlüsselkarte / Zeitkapsel

Unter **On-Chain / NFT** zeigt die **Galerie** nur ImageNFTs mit `AddressOwner = deine Wallet jetzt`. Während Leihe/Escrow oder nach Transfer fehlt das NFT dort — lokal gemerkte Schlüsselkarte und Lease-Zeilen bleiben trotzdem sichtbar. NFT-Gate-Lesen braucht aktuellen Besitz oder eine aktive Borrower-Leihe; „schon geclaimt“ ohne Rückgabe an dich = kein Leserecht.

---

## 0. Schnellstart Test (1 Gerät) — in Alltagssprache

Voraussetzung: Messenger offen (http://127.0.0.1:3341/), Tresor schon entsperrt.

### A) Passphrase-Nachricht (ohne Handshake-Verschlüsselung)

1. Links **ich** oder einen Kontakt wählen.  
2. Oben auf **Unverschlüsselt** stellen (oder Passphrase-Schutz anhaken — das schaltet Verschlüsselt automatisch aus).  
3. Haken **Passphrase-Schutz** setzen. Adressfeld `0x…` muss sichtbar sein.  
4. Kurzen Text tippen → **Senden**.  
5. In der Statuszeile steht die Passphrase (und „gemerkt“, wenn **Für mich auf diesem Gerät merken (Absender)** an ist — nur lokal, nicht an den Empfänger).

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
| 10 | Schlüssel erneuern / Burn-on-read | Optionen → Chat · Sicherheit → Nach-Lesen-Modus; echter Burn = Zeilen-⋯ / Auswahl → Von Chain löschen (Confirm) |
| 11 | Passphrase wiederverwenden | Composer Passphrase-Schutz → Checkbox: An = gleiche PW nach Send; Aus = neu würfeln |

**2-Geräte-Feldtest** (Team-Key-Handoff, Erneut-sperren auf Empfängergerät, NFT-Transfer): bewusst **später** — siehe Fahrplan.

**PWA installieren:** Einstellungen → Allgemein (nicht Startseite). **Mehrere Profile:** Ziel = Auswahl beim Unlock (eigener Seed), nie parallel — Ist/Backlog § H.37, `docs/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md` §6.

---

## 1. Was ist der Secret-Vault?

Beim Entsperren des Tresors (Vault-Passwort) werden lokale Geheimnisse **entschlüsselt in den RAM** geladen. At rest liegen sie als **AES-GCM-Sidecars** in `localStorage` (Browser), nie als Klartext.

| Sidecar / Store | Inhalt |
|-----------------|--------|
| `passphraseMsg.enc.v1` | Passphrasen für `MORG_PWMSG` |
| Evidence-Sidecar | Passphrasen für verschlüsselte ImageNFTs |
| `teamKeys.enc.v1` | Team-Broadcast-Keys (Gruppen-Enc) |
| `nftKeycard.enc.v1` | NFT-Schlüsselkarten (Slots + Bindungen) |
| `nftVaultIndex.enc.v1` | Purse/Treasury-Index + Digests |
| `ratchet.enc.v1` | Double-Ratchet Peer-State (Experiment C1) |

| Aktion | Wirkung |
|--------|---------|
| **Unlock** | Sidecars → RAM; Auto-Decrypt wo möglich |
| **Lock / Privacy sperren** | RAM + Tab-Backup weg; Enc-Sidecars bleiben |
| **Purge / Einsatz beenden** | Sidecars + Merker weg |

### Soft vs Hard vs Sidecar (was sperrt was?)

| | Soft (**Privacy sperren**) | Hard (**Tresor sperren**) | Sidecar-Session (C) |
|--|--|--|--|
| Chat **lesen** | ja (Ciphertext/Cache) | eingeschränkt / Unlock | — |
| Chat **schreiben** | nein | nein | Enc-Merken braucht C |
| Frei / Gesichert / NFT sehen | ja | ja (soweit Status da) | Index-Persist braucht C |
| Guthaben **anlegen** / Team-Key **erzeugen** / Schlüsselkarte **merken** | — | — | **nur mit C** |
| Auszahlen / Mint | Signer nötig (Soft löscht Browser-Signer) | Signer weg | Index speichern braucht C |

Begriffe Datei vs Sidecar: `docs/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md` §8. **Kein zweiter Passwort-Tresor.**

### Double Ratchet (Experiment, C1.6)

**Nur 1:1-Direktchat** (IOTA Enc). Chat ⋮ → **Double Ratchet (Experiment)** = Opt-in. **Gruppenchat:** kein Eintrag (weiter Team-Key). **Default bleibt Session Keys+.** Mit Flag an: Direct-Enc legt innere `RATCHET_V3`-Lage (beide Seiten Flag + Handshake). Composer-Hinweis zeigt den Modus. State im Sidecar `ratchet.enc.v1`. **Kein** Produktiv-Default / kein FS-pro-Msg-Marketing ohne Feld-PASS.

**Grenze:** XSS/Malware mit Vault-Passwort kann Sidecars lesen. Kein Hardware-Fragment, kein „nur RAM, nie Disk“ für den Seed (Vault-Blob liegt verschlüsselt auf Disk/LS). Session Keys+ (`directSessionKeys.v1`) sind noch nicht vault-wrapped (bekanntes Backlog).

---

## 2. Passphrase-Nachrichten (`MORG_PWMSG`)

**Zweck:** Nachricht ohne ECDH-Handshake; Ciphertext on-chain; Passphrase separat teilen.

| UI | Funktion |
|----|----------|
| Composer **Passphrase-Schutz** | Enc pro Sendung (oder wiederverwendet) |
| **Passphrase wiederverwenden** | Gleiche Passphrase, neuer Salt/IV |
| **Key an NFT-Schlüsselkarte binden** | Optional: Karte + Slot; Wire-Fingerprint lokal |
| Absender-Remember | Checkbox **„Für mich auf diesem Gerät merken (Absender)“** (Default an): nur lokal auto-Klartext nach Unlock — **nicht** an Empfänger. Aus = bewusst nur Ciphertext. **Wiederverwenden** = Composer-Default bis „Neu würfeln“, entschlüsselt Posteingang **nicht** automatisch |
| Bubble **Verbergen** | Weich ausblenden |
| Bubble **Im Vault löschen** | Hart: Merker für diese Nachricht weg (neben Wire kopieren); wieder Eingabe |
| Posteingang **Optionen → Wire einfügen** | Paste Wire + Passphrase → lokaler Klartext |

**Nicht:** Forward Secrecy, Ersatz für Alltags-ECDH-Chat, Push der Passphrase an andere Geräte.

---

## 3. ImageNFT / On-Chain Evidenz

**Wo:** Hauptmenü → **NFT / Evidenz** bzw. Posteingang → **On-Chain / NFT**. Dialog-Titel oft **NFT & Schlüsselkarte**.

### Tabs (Ist 2026-11-19)

| Bereich | Tabs | Kurz |
|---------|------|------|
| **1 · Schauen** | **Eigene NFT anzeigen** · **NFT Suche** | Eigene Galerie laden (auch zurück aus Guthaben/Verleihen); Suche = `0x…` oder **Aus Telefonbuch wählen** (Liste im Dialog, kein System-Dropdown) |
| **2 · Handeln** | **Minten** · **NFT gesichert** · **Verleihen / Zurückholen** | Mint; Vault; Escrow-Leihe. **NFT-Leserecht** = Composer beim Senden, kein eigener Tab |

### Galerie-Karte (Eigene NFT)

| Element | Bedeutung |
|---------|-----------|
| Name + Thumbnail | On-chain-Name bzw. lokaler Notiz-Name |
| Einsatz-Badges | Mehrere gleichzeitig möglich: **Schlüsselkarte** · **Gesichert** · **Verliehen** · **NFT-Leserecht (zuletzt)** — orthogonal (Leserecht ≠ Guthaben) |
| **Info** | Object-ID (mit Explorer), **Einsatz**, Vault/Lease, Klassifikation, Attribute, Hash, Schlüsselkarte-Slots |
| **Bild groß** → Tippen | Fast-Vollbild; nochmals tippen / X = zu |
| **Entsperren** | Pro NFT eigene Passphrase-Zeile (≥8). Verschiedene PWs möglich — kein „Alle entsperren“ |
| **Senden** (zugeklappt) | Telefonbuch und/oder `0x…`; Besitz wechselt on-chain |
| **Mehr…** | Bild speichern, Shortcuts NFT gesichert / Verleihen, lokaler Name, Schlüsselkarte merken, Vernichten (Object-ID/Explorer → **Info**) |
| Passphrase | Nur zum Entschlüsseln nötig; **weglassen** geht nicht bei Enc-NFTs |
| **Als Schlüsselkarte merken** | Lokal Passphrase+Object-ID für Zeitkapsel/Guthaben/PWMSG — **nicht** nötig nur zum Anschauen |

Mint: PNG/JPEG/WebP, Auto-Resize (~12 KB Ziel / ~98 KB hart). Enc = Ciphertext on-chain; Besitz ≠ Leserecht ohne Passphrase. One-Time / Offline-Index / Partner-Paar **nicht** mehr am Mint (One-Time = Checkbox **Einmal-Auszahlen** im Tab NFT gesichert).

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
| Hauptmenü → **NFT / Evidenz** | Dialog → **Eigene NFT anzeigen** |
| Posteingang → **On-Chain / NFT** | gleiche Galerie / Suche |
| **NFT senden** | Karte: Telefonbuch und/oder `0x…` |
| **Mehr… → Vernichten** | `image_nft::burn` (unwiderruflich); lokale Merker weg |
| **Info** | Object-ID + **Explorer** (nicht doppelt unter Mehr…) |
| **NFT-Aktivität** | Lokales Log: Mint / Gesendet / Empfangen / Vernichtet + TX-Link |

### Bindungen (lokal, sinnvoll)

| Wann | Was |
|------|-----|
| **Vor** Create | Nur Composer-Auswahl einer **bereits existierenden** Schlüsselkarte (Object-ID muss schon da sein) |
| **Beim** PWMSG-Send | Wire-Fingerprint → Slot (automatisch) |
| **Beim/nach** Enc-Mint | neues ImageNFT → Slot; oder **Nachträglich binden** in der Galerie |
| **Lösen** | Einzelne Objekt-/Wire-Bindung; Slot entfernen; ganze Karte vergessen |
| **Löschen NFT** | on-chain **Vernichten** ≠ Bindung lösen (Bindung nur Vault) |

**Wichtig:** Sender/Empfänger brauchen das NFT **nicht** zum Verschlüsseln — nur die Passphrase. NFT-Bindung = Komfort + Soft-Auto bei Besitz. Details: `docs/NFT-SCHLUESSELKARTE-MODI.md`.

### Zeitkapsel / NFT-Leserecht (häufige Fehlannahme)

| Layer | Bedeutung |
|-------|-----------|
| **Ciphertext** | Enc-ImageNFT / `MORG_NFTGATE_V1` / PWMSG — sichtbar on-chain, allein kein Klartext |
| **NFT + Lease** | nur **Leserecht auf Zeit** (Escrow); wandert W1↔W2 |
| **Klartext** | erst Gate + Decrypt in der App |

**Passphrase wiederverwenden** verbindet mehrere Nachrichten **nur lokal** mit derselben PW — **nicht** on-chain mit dem NFT. Für echte Zeitkapsel-Semantik: Enc-ImageNFT oder `MORG_NFTGATE_V1`. Spec: `docs/NFT-SCHLUESSELKARTE-PUBLIC-VAULT-TIMELOCK.md` §0a.

**Composer (einfach):** **+** → **NFT-Leserecht…** (oder Checkbox) → NFT wählen → senden (`MORG_NFTGATE_V1`) → optional **NFT verleihen…** (öffnet Tab Verleihen). Kein Nachrichten-Passwort.

| Job | Wo | Was |
|-----|-----|-----|
| **NFT-Leserecht** | Composer beim Senden | Ciphertext on-chain; Lesen = NFT-Besitz (oder aktive Leihe). **Kein** Reclaim — nichts on-chain zum Zurückholen |
| **Verleihen** | Tab **Verleihen / Zurückholen** · CTA **NFT verleihen…** | Escrow an andere Wallet (Empfänger aus Telefonbuch oder `0x…`) |
| **Zurückholen** | Liste **oben** im Tab | Alle offenen Escrow-Leihen dieser Wallet; Zeile = Auswahl (NFT fehlt in der Galerie — normal) |
| **Vorzeitig zurückgeben** | dieselbe Liste (Entleiher) | NFT sofort an Verleiher |
| **Liste aktualisieren** | Hub | Chain-Scan (auch auto); findet Leihen ohne Galerie-Besitz |
| **Notfall: Lease-ID** | ganz unten unter Leihe starten | Nur wenn „ID fehlt“ / Scan leer — Lease tippen in der Liste oben → Feld unten |
| **Package (Leihe)** | fest Modules-Package | **Nicht** Chat/Vertrag-Package. Override UI entfernt — Leihe nutzt Messaging-Modules (ggf. ältere P5-Events via Scan) |

Ablauf: (1) NFT-Leserecht im Chat (2) optional Verleihen (3) Entleiher liest → vorzeitig zurückgeben **oder** Verleiher nach Ablauf zurückholen. W2 braucht Morgendrot.

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
| **Burn** | Mailbox-Objekt on-chain löschen (Rebate); braucht `chainPurgeable`; **nur Sender/Empfänger** (Team: Sender). TTL bleibt, kein Fremd-Burn |
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
| Double Ratchet Default / FS **pro Nachricht** | § H.23 C1 | Opt-in C1.6 Ist (nur 1:1); Default + 2-Wallet/Feld offen |
| Starkes NFT-Besitz-Gate | B2-P4a | Ist (App-Gate Capsule); optional **Wallet + NFT (Dual)** |
| Dual Wallet∧NFT | P4a-dual | Composer unter Starkes Gate; Klartext danach kopierbar |
| Pubkey-Wrap | P4a2 | Checkbox unter Dual; ECDH-Peer-Pub der erlaubten Wallet nötig |
| Seal / Key-Broker | P4b | Checkbox unter Starkes Gate; **ein API-Broker ≠ Mysten-Seal**; remote nötig für „unter Zwang“ |
| NFT gesichert | S0–S5 Code | Tab **NFT gesichert**; Wallet-Saldo/Send ebenfalls **NFT gesichert**; Discovery unter NFT |
| Zeitkapsel / Verleihen | P5 | Tab **Verleihen / Zurückholen** + Composer **NFT-Leserecht**; Zurückholen-Liste oben |
| NFT-gesichertes Senden (IOTA) | B2-S0–S3 Ist | **nur Token**; Purse ≠ freie Wallet-Balance; lose Coins außerhalb = ungeschützt (`docs/NFT-GUARDED-SPEND-SPEC.md`) |
| Öffentlicher Ciphertext-Vault + NFT-Timelock („Zeitkapsel“) | **B2-P5a/b Ist**; **Soll-Ablauf/P5d hinten** | NFT = Gate, Texte getrennt. End-to-End Borrower-Lesen + UX-Retest **nach** 2-Geräte (Roadmap 2026-11-09). Spec **`docs/NFT-SCHLUESSELKARTE-PUBLIC-VAULT-TIMELOCK.md`** §0a |
| Rotierende Outboxes / voller Dead-Drop | Claims-Check + Architektur | Nicht gebaut |
| Handshake mit Decoys | Claims-Check | Nicht gebaut |
| Hardware-Fragment + Keys nur RAM | Claims-Check | Teilweise Vault-at-rest; kein HW-Fragment |
| Automatisches Burn-on-read | Claims-Check | Nur Opt-in mit Confirm |
| Post-Quantum hybrid | E2EE Phase 4 | Backlog |

Siehe auch Kopf von `docs/ROADMAP-FAHRPLAN.md` (Nachtrag Privacy 2026-11-05): *„Kein Double-Ratchet / Decoys / Outboxes in dieser Tranche.“*

---

## 9. Empfohlene Reihenfolge ab hier

1. ~~Anleitung §0 / Epoch+Burn / C1 / P4a / P5a/b / P4a-dual / S0–S5 Code~~ → **Ist** (Vitest Solo PASS 2026-11-08).  
2. **Jetzt Joint Session A+B** — Checkliste in **`docs/TEST-RUN-LOGBOOK.md`** (Guthaben/Discovery/1-Vault → One-Time/QR → Zeitkapsel).  
3. Fixes + Retest → B2-S6 Smoke PASS (~2–4 Tage inkl. Puffer).  
4. **Danach optional:** 2-Geräte (Session C).  
5. **Später:** MeshSleepyChannel (Phase C); Move One-Time on-chain.  
6. **Nicht parallel:** Decoys, Outboxes, HW-Fragment, Feature-Wildwuchs während Joint.

### Kurz: NFT gesichert (Nutzer)

Zwei Einstiege — nicht verwechseln:

| Ort | Zweck |
|-----|--------|
| NFT → Tab **NFT gesichert** | **Anlegen**, Einzahlen, leeren Vault entfernen, Option Einmal-Auszahlen |
| Wallet → **Überweisen → NFT gesichert** | **Auszahlen** an Empfänger-Wallet |

1. NFT-Dialog → Tab **NFT gesichert** → **Freies NFT** wählen (Tab **Eigene** laden).  
2. Modus **Nur ich** oder **Karteninhaber** → Betrag → **Guthaben anlegen** / **Einzahlen**.  
3. Bei Balance **0**: `destroy_empty` **automatisch** (NFT wieder frei).  
4. Vault-Index auffrischen = Wallet-↻ (**Saldo + Vault-Index**); kein Extra-Button.  
5. **Auszahlen** nur Wallet → Überweisen → Gesichert (nur NFTs mit Guthaben).  
6. **Admin** (nur **Karteninhaber** + Vault): Auszahlen sperren/erlauben; Restguthaben in Admin-Wallet (freeze→reclaim→thaw). Bei 0 Auto-Remove.  
7. **Empfangen**: Häkchen → ein QR/Text (Wallet, mehrere beschriftete Mailboxen, Kontakt inkl. Notiz).

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
