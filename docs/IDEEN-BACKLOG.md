# Ideen-Backlog (nicht umgesetzt)

Kurznotizen für spätere Phasen — **kein** Implementierungsversprechen.

---

## Tresor gesperrt → Messenger-Overlay (Fail-closed)

**Entscheidung 2026-11-20:** Statt vieler Einzel-Gates: bei `locked` Messenger-Hauptfläche ausgrauen/`pointer-events: none`, **nur** Unlock-Dialog bedienbar. Optional Statusleiste sichtbar; SOS nur mit expliziter Whitelist.

**Ist 2026-11-24 / Badge 2026-11-26:** Zwei klare Modi:
- **Abmelden** = Wipe + Unlock-Dialog + Übersicht.
- **Tresor sperren** (Badge bereit→Klick) = Soft-Pause (Scrim, **RAM bleibt**); **Weitersprechen nur nach Passwort**.
- Badge-Text nur **bereit | gesperrt**; Pause/F5 stecken hinter „gesperrt“ + Tooltip.

Auge im Unlock: `mousedown preventDefault` gegen Dialog-Flackern.

---

## Posteingang-Virtualisierung (DOM-Last)

**Ist 2026-11-22:** Reset-Fenster Web 80 (war 500) + kein Auto-Append; PWMSG-Formular lazy („Passphrase eingeben“).  
**Später:** Listen-Virtualizer / Windowing wenn „Weitere laden“ + Zeilen-Actions noch zu schwer — **kein** Big-Bang parallel zu Messenger-Kern.

---

## Context-Help / „Zauberstab“-Inspector

**Idee:** Toggle → Klicks abfangen → Popover aus `data-help` + Handbuch-Strings.  
**Status:** Backlog (2026-11-20) — **nicht** bauen.  
**Kritisch:** Pflegeaufwand (jedes UI-Element), kollidiert mit echten Klicks/Drag, Mobil schlecht; Handbuch-Links + kurze `title`/`aria-description` reichen oft. Nur wenn Handbuch-SSOT stabil und Toggle **Default aus**.

---

## Visitenkarte + Profilbild (Platzierung & Sicherheit)

**Entscheidung 2026-11-26 (UX-Ort):** **Ein** Hub unter Dialog **„Ich“** (`ChatViewSelfProfileDialog`) — nicht ein zweiter Button in der Sidebar und nicht unter Wallet-Empfangen (Freeze).

| Aktion in „Ich“ | Inhalt |
|-----------------|--------|
| **Visitenkarte teilen** (Button) | Checkboxen: Anzeigename, Wallet-ID, optional TG / Funk-Node (Klartext) / Mailbox / ECDH — → **Kontakt-QR** (`k:'mc'`) / Text / **Als Nachricht**. Keine dritte QR-Welt. **Kein** klassisches Telefon/E-Mail. |
| **Mein Profilbild** | **Stufe A Ist 2026-11-27** (lokal in „Ich“/Kontakt); Stufe B teilen = später Opt-in. |

**Ist heute:** „Ich“ = Kontakt-ID + Peering-QR + technische IDs. Empfangen-QR = nur Coins.

**Profilbild — Stufen (nicht jetzt bauen):**

| Stufe | Was | Telegram-ähnlich? |
|-------|-----|-------------------|
| **A lokal** | Empfänger speichert *dein* Bild lokal; du kannst Kontakten auch manuell Bilder zuordnen | Teilweise |
| **B teilen** | Beim Teilen der Visitenkarte / nach Scan: kleines Bild oder Hash mitliefern | Ja |

**Sicherheit / Logik (Pflicht beim Bau):**

- **Kein Vollbild im QR** — QR bleibt klein; Avatar max. ~2–4 KB Thumbnail **außerhalb** QR (z. B. kurze Folge-Nachricht / Datei nach Scan) oder nur **Hash** + späterer Abruf nach Bestätigung.
- **Keine stillen Remote-URLs** als Pflicht (Tracking/SSRF) — Opt-in, lokal speichern.
- Empfänger: **lokales Override** (Spitzname/Bild) schlägt fremdes Profilbild.
- Wallet-Empfangen unverändert.

**Status 2026-11-27:** Share-MVP **Ist**; **Übernehmen-CTA Ist**; **Profilbild A Ist** (lokal + Chat-Thumb). Visitenkarte-Blase zeigt **lesbare Karte** (JSON nur Wire). Stufe B teilen = Backlog.

### Visitenkarte empfangen → Kontakt übernehmen

**Ist 2026-11-27:** Inbox-Button **Als Kontakt übernehmen** → Parse + `saveContactEntry` + optional Peer-Pub; Merge-Confirm wenn Kontakt existiert. Bild kommt **nicht** mit der Karte (nur lokales Profilbild A).

**Nicht-Ziel:** stille Auto-Anlage; Bild in QR; Wallet-Empfangen-QR (Freeze).

---

## Storage-Rebate-Übersicht („offene Rebates“)

**Entscheidung 2026-11-26:** **Nicht bauen** als eigene Wallet-Karte „Rebate bereit“ (Analog zu NFT-Zurückholen).

**Warum:** Auf IOTA/Sui ist Storage-Rebate **kein** separates abholbares Guthaben. Beim Burn/Purge/Vault-Replace fließt der Rebate **in derselben TX** in die Gas-Abrechnung; der Saldo ändert sich still. Es gibt keine Queue „offen und wartet“.

**Ist 2026-11-26:** Burn-Status „Burn ok · Rebate …“ wenn `gasSummary.storageRebate` kommt (kein Claim-Queue).  
**Nicht:** Explorer-Scraping aller löschbaren Objekte nur für Theater.

---

## NFT-Bezug im Posteingang (optional)

**Idee:** Kompakt anzeigen, **welches NFT** eine Nachricht lesbar macht; optional Chip an Zeilen-Aktionen.  
**Ist 2026-11-26:** Lange NFT-Gate-/Passphrase-Prosa entfernt; bei NFT-Gate kurze ID-Zeile — **reicht als MVP**; Extra-Chip an ⋯-Menü nur wenn Live-Schmerz.  
**Nicht:** Essay-Banner; kein Pflicht-NFT an jeder Klartextzeile.

---

## Gruppe verwalten je Sendepfad (H.16 Skizze)

**Wunsch:** drei Einstiege — **IOTA** (Mitglieder/`0x`/Mailbox), **Funk** (Kanalindex/Name/PSK-Ref), **Telegram** (Alarmgruppen-ID) — ein Datenmodell, drei Fenster.  
**Ist 2026-11-26:** Tabs IOTA/Funk/Telegram im Sheet (`H16` S2); gleiche Stores; TG-Tab = Hinweis.  
**Spec:** `docs/H16-GRUPPE-JE-SENDEPFAD-SPEC.md`. Chat-Handbuch FAQ 5–6.

---

## Telegram: kein Bot-Gruppenchat

**Entscheidung 2026-11-22:** **Keinen** Morgendrot-Gruppenchat über den Telegram-Bot bauen (kein Thread/Composer in die Bot-API-Gruppe spiegeln).

**Warum:** Alarmgruppe = **Hinweis/Broadcast** (B4b). Echter Gruppenchat = Morgendrot (Mesh-PSK / Team / IOTA). Bot-Gruppenchat = TOS-/Moderations-/Klartext-Risiko, Doppel-UX, kein Chain-Archiv.

**Bleibt:** Einsatz-Alarmgruppe, 1:1-Notify, Klingel — wie Zielbild. Telegram-App selbst für TG-Gruppenchat ok; nicht unser Produktpfad.

---

## Release: SHA-256 Ist / GPG optional / On-Chain-Manifest optional

**Ist:** Hobby-Release schreibt `SHA256SUMS.txt` (`scripts/package-hobby-release-artifacts.mjs`, Workflow `.github/workflows/release-hobby-artifacts.yml`).  
**Nicht Ist:** GPG-/cosign-Signatur der Artefakte.  
**Später optional:** GPG nur mit Key-Verwaltung + Verifikationszeile in Release-Notes — sonst weglassen.

**Idee (später, nicht Messenger-Kern):** `ReleaseManifest` als frozen Move-Objekt (`publish_release(version, sha256, url)` + `freeze_object`) + Anzeige unter Einstellungen → Über. **Kein** Ersatz für `SHA256SUMS`; Publisher-Key/Gas/Prozess klären — sonst Theater. Entscheidung Roadmap-Durchgang 2026-11-22.

---

## Keine Multi-Adresse im Messenger-Account

**Entscheidung 2026-11-22:** Kein IOTA-Wallet-style „mehrere Adressen / ein Login“ in der Chat-UX (Thread-/Saldo-Chaos). Privat/Geschäft → später **§ H.37 Multi-Profil** (eigene Seeds, nie parallel).

---

## Kanal-Wizards (Telegram / Funk) — getrennt, Hub optional

**Entscheidung 2026-11-22:** Eigene kurze Wizards pro Kanal; **kein** Mega-Wizard „alles hintereinander“. Optional später Einstiegs-Hub, der Einzelwizards anstößt (analog § H.36).

---

## Walletsuche / Gesamtübersicht (Coins + NFT + Text)

**Idee:** Eine Suche/Übersicht über Wallet: Coins, NFTs, Klartext-/Enc-Nachrichten (nicht nur lokale IOTA-Aktivität).  
**Einordnung:** nah an Roadmap **Phase C** (Explorer-Link + gefilterter Aktivitäts-Spiegel) + Utility „Nachricht vom Tangle entschlüsseln“ — **nicht** jetzt; Wallet/Aktivität-Freeze beachten.  
**Siehe:** `docs/ROADMAP-FAHRPLAN.md` Phase C / H.23 C1 (Double Ratchet = separates Backlog, Spec/Codec Ist, kein Default).

---

## Seal / Key-Broker (P4b) — Composer später

**Idee:** DEK nicht im Wire; Boss-API gibt Schlüssel nur nach Chain-Beweis „Wallet besitzt NFT“. Umbenennung z. B. **Boss-Schlüsseldienst**.  
**Warum zurückgestellt:** braucht Boss/Remote-Broker; Solo-Messenger unnötig. Code-Pfade/Prefs bleiben, Composer-UI aus (2026-11-20).  
**Siehe:** `docs/ANLEITUNG-PRIVACY-VAULT-SCHLUESSELKARTE.md` §8 P4b.

---

## Chat: klickbare Links (Linkify) — Zukunftsidee

**Idee:** `https://`-URLs in Posteingangszeilen als Links öffnen (`rel="noopener"`, ggf. Bestätigung).  
**Status:** nur merken — **kein** nächster Schritt, keine Pflicht. (Kein eigener Feature-Ordner im Repo; ggf. später `lib/`-Helfer.)  
**Nicht:** WhatsApp-Verknüpfung, Paywall/Mikrozahlung pro Nachricht — **gestrichen** (2026-11-17).

---

## Telegram: verschlüsselter Overlay-Transport (IOTA-Handshake + Payload über Telegram)

**Idee:** Session-Key wie heute über IOTA-Mailbox (`/handshake`, `/connect`); verschlüsselte Blobs (`MORG_TG_V1|…`) nur als Zustell-Hülle über Telegram Bot/Relay.

**Warum nur Backlog:** Telegram ist bei Morgendrot **Hinweis-Kanal** (Klartext, kein Chain-Archiv). Overlay erhöht Krypto-, Replay- und TOS-Risiko; Primärweg bleibt Mesh/IOTA.

**Vorbedingung:** Feldtest zeigt, dass Klartext-Notify nicht reicht.

**Siehe auch:** `docs/TELEGRAM-INTEGRATION-ZIELBILD.md`, Bewertung im Chat 2026-06.

---

## Pinnwand: Push, Wichtigkeit, Lese-Statistik

- Push bei neuer Lagebild-Meldung
- Stufen Normal / Wichtig / Dringend
- Boss: wer hat gelesen (lokal zuerst, on-chain später)

**Siehe:** `docs/PINNWAND-ANZEIGE-ZIELBILD.md`

---

## Team-Member-Update & Einstiegs-Wizard (Einsatz)

**Spec:** `docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md` · Roadmap **§ H.36**

Geführter Erststart + spontaner Helfer-Beitritt mit boss-signiertem Update und Empfänger-Bestätigung. Transport: IOTA speichert, LAN liefert schnell (wenn Boss erreichbar). **Nicht** Ad-hoc/BLE.

**Siehe auch:** `docs/HANDOFF-UND-MODUS-ZIELBILD.md` (Wanderer außerhalb), `docs/ROADMAP-FAHRPLAN.md` § H.16 (Boss-LAN Ist)

---

## Codec2 / Funk-Audio + IOTA-Sparmodus (kritisch 2026-11-27)

**Status:** Vision / Backlog — **nicht** Alpha-PC, **nicht** parallel zu H.25a-Encode-Freeze. Roadmap: Später (**H.18** ∩ **H.25**/Funk, nach Outdoor-Desk-Stabilität).

### Zielbild (verbessert)

| Sendepfad | Standard | Optional | Budget (Nutzlast) | Ehrliche Grenze |
|-----------|----------|----------|-------------------|-----------------|
| **Funk** (`MORG_SEG_V1`) | Codec2 **1200 bit/s** | Codec2 **700** bei schlechtem Link | ≤ **~3,0 KB** Roh → ~**15–20 s** Sprache | Passt unter Bild-Cap **3,6 KB**; **Airtime ≠ Inhalt**: bei Gap ~580 ms und ~93 B/Seg ≈ **viele Segmente** → Wanduhr oft **~20–40 s+** inkl. NAK — Mesh blockiert währenddessen |
| **Online/IOTA** | Opus **~12 kbit/s** (Ist-Richtung) | Codec2 1200 „Spar-/Lang“ | Opus ~10–40 s (größer); Codec2 länger möglich | Opus bleibt Default-Klang; Codec2 nur Opt-in (Deposit/Gas) |

### Behalten (sinnvoll)

1. **Auto-Trim Stille** Anfang/Ende — billige Byte-Ersparnis, Melodie bleibt.
2. **Einheitlicher Encode:** bevorzugt **Browser-WASM** (`codec2.wasm`) für Standalone/PWA; Server-ffmpeg **nur wenn Build wirklich `libcodec2` hat** (viele Distros: **nicht** „oft nativ“ — vor Bau prüfen, sonst WASM-only).
3. **Abspielen:** Empfänger **muss** Codec2→PCM/WAV (WASM) → Blob; kein natives `<audio>` auf `.c2`.

### Streichen / nicht behaupten

- „15 s Audio = 15 s Sendezeit“ — falsch unter S-ARQ/Gap.
- Cap/Gap am **Bild-Anker** ändern für Audio — **verboten** ohne Live-OK (`lora-h25a-stable-anchor`).
- Audio als Mesh-v2-E2E-Burst — Produkt-Funk bleibt Klartext/Kanal-PSK; Codec2 = Klartext-Nutzlast wie Bild.
- Online-Codec2 als Default — Opus bleibt Standard.

### Bau-Reihenfolge (wenn gebucht)

1. Spec-Scheibe Wire-Tag (z. B. SEG-Phase/`MORG_AUD_V1`) + Budget-Tests — **ohne** Bild-Encode anzufassen.  
2. Encode/Decode WASM + Trim + Inbox-Play.  
3. Funk Live MediumFast Desk; dann Outdoor.  
4. Optional Online-Sparmodus.  
5. 700-bit-Modus erst nach stabilem 1200.

**Vorbedingung:** H.25a Desk weiter STABIL; Outdoor-Feld oder explizites User-OK für Funk-Audio-Scheibe. Parallel bleibt STT/Kurztext die robuste Feld-Alternative (Fahrplan H.18 Phase 1).
