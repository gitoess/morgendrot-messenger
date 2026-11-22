# Ideen-Backlog (nicht umgesetzt)

Kurznotizen für spätere Phasen — **kein** Implementierungsversprechen.

---

## Tresor gesperrt → Messenger-Overlay (Fail-closed)

**Entscheidung 2026-11-20:** Statt vieler Einzel-Gates: bei `locked` Messenger-Hauptfläche ausgrauen/`pointer-events: none`, **nur** Unlock-Dialog bedienbar. Optional Statusleiste sichtbar; SOS nur mit expliziter Whitelist.

**Ist 2026-11-22 (MVP):** `shouldApplyVaultFailClosedOverlay` + `VaultFailClosedSurface` in `messenger-dashboard` / `projekt-dashboard`. Hard-Lock nur; Wizard/Helper-Seed unterdrücken Scrim wie Unlock-Dialog. Soft-Lock unverändert (Chat lesbar). SOS bleibt bei Hard-Lock ohnehin ausgeblendet.

**Nicht:** Soft-Lock (lesen ok / schreiben gesperrt) als zweites Fail-Closed — verdoppelt Logik.

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

## Visitenkarte teilen (QR / Nachricht) — über Empfangen hinaus

**Ist:** Wallet **Empfangen** = IOTA-Adresse-QR; Sidebar **Meine Kontakt-ID** / Peering-QR.  
**Idee:** Eine „Teilen“-Aktion (Info/Ich): wählbare Felder (IOTA, Funk-Node, Telegram, Label) → QR / `.morg` / Klartext → optional als Nachricht senden.  
**Status:** Backlog (2026-11-22).  
**MVP später:** bestehende Peering-/Kontakt-QR erweitern, **nicht** parallele dritte QR-Welt. Wallet-Empfangen unverändert lassen (Freeze).

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
