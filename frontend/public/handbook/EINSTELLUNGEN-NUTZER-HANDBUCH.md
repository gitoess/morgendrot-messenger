# Einstellungen — Kurzhandbuch

**Stand:** 2026-11-23 · Eine Seite, Ist-UI. Keine Spez, keine Geschichte.

---

## Karte der Tabs

| Tab | Für wen | Kern |
|-----|---------|------|
| **Allgemein** | alle | Sprache, Wizard, Erscheinungsbild (Klack / Klick-Ton / **Eingangs-Ton** / Magnet), Expertenmodus, Handbuch, **Handoff importieren** (Helfer). Kein PWA-„App installieren“ mehr — Browser-Menü / APK / Installer. **Einsatz beenden** → Einsatzleitung (nicht hier). |
| **IOTA** | alle | Netz (Boss/Kommandant), Gas, Chain-IDs, Mailboxen; Boss: **Package & Move-Upgrade** |
| **Funk** | Einsatz | Meshtastic/Puls — Strategie später (offizielle App vs. eigene UI) |
| **Telegram** | Boss (+ Helfer Join) | Bot, Alarme, optional Gruppenalarm, Hinweis nach Online-Send |
| **Tresor** | alle | Ein Passwort: Seed anzeigen, Notizen/Passwörter, Backup lokal/Chain, Schatten, Notfall. Header-Badge = Sitzung. Netz-IDs → **IOTA** |

**.env:** nur Link ganz unten → „Konfiguration öffnen“. Nicht in Allgemein.

---

## Wo liegt was? (kein Vault-Mythos)

| Ding | Speicherort |
|------|-------------|
| Messaging-Keys, Passwortmanager, Notizen | **Vault-Datei** (+ optional On-Chain-Vault) |
| Package / Mailbox / RPC (aktiv) | Netzprofil + oft Boss-`.env` |
| Telegram Bot-Token, Admin-Chat-ID, Alarmgruppe | **`.morgendrot-runtime-config.json`** (Boss-PC) — **nicht** Vault |
| „Hinweis nach Online-Send“ an/aus | Browser **localStorage** |
| Eingangs-Ton (Master + 1:1/Gruppe/Pinnwand) | Browser **localStorage** — nur offener Tab, kein OS-Push |
| Kontakt-Telegram-ID | **Telefonbuch** |
| Chat-Klartext-Cache | `.inbox.enc` — nicht Vault |

---

## IOTA

### Wo senden? (Boss/Kommandant)

| | Übung (blau) | Produktion (violett) |
|--|--------------|----------------------|
| Netz | Testnet | Mainnet |
| Braucht | Package + Mailbox + RPC | **eigenes** Deploy + Postfach (nie Testnet-IDs) |

Ein aktives Netz. Signer-Status darunter (Browser-Signer für Direkt-Send).

**Mainnet einrichten:** Gas → Deploy oder IDs eintragen → Speichern → Produktion wählen. Gemeinsam testen: Roadmap T1.

### Gas

- **Testnet:** „Testnet-Token anfordern“ = Faucet im Browser.
- **Mainnet:** Adresse kopieren → echtes IOTA senden → **Saldo aktualisieren**.

### Chain-IDs zum Sichern

Pro Netz: Package + **Postfach** (= Hauptpostfach/`MAILBOX_ID` zum Backup). Unter „Globals“: Vault-Registry / Command-Registry / Upgrade Cap = aktive `.env` (On-Chain, **nicht** lokaler Tresor).

**Verlauf:** Unter „Frühere Package- / Postfach-IDs“ — lokale Dateien `.morgendrot-package-id-history` / `.morgendrot-mailbox-id-history` auf dem Boss. Wird aktualisiert bei **Neu-Publish** / Package-Wechsel bzw. wenn `create_globals` ein **neues** Postfach setzt. **In-Place-Upgrade** ändert die IDs nicht → kein neuer Verlaufseintrag. Move-Quellcode = Git/`move-test/`, nicht diese Liste.

**Nicht hier:** Team #n / Private #n — **Meine Mailboxen**.

### UpgradeCap (Boss)

| | |
|--|--|
| **Was** | On-Chain-Objekt + Eintrag `UPGRADE_CAP_ID` in Boss-`.env` |
| **Wozu** | Move-Bytecode unter **derselben** `PACKAGE_ID` ersetzen (Bugfix, neue Funktionen) |
| **Wer** | Nur Boss/Kommandant — **nicht** Helfer |
| **Erzeugen** | Automatisch beim Erst-Deploy; sonst Cap-ID aus Explorer/Wallet in `.env` |
| **Fehlt** | Nur Neu-Publish möglich (neue IDs + Handoff) |

### Package & Move-Upgrade (Boss/Kommandant)

**Pfad:** Einstellungen → **IOTA** → **Package & Move-Upgrade**.

| Begriff | Bedeutung |
|---------|-----------|
| **Grün (… speichern / löschen)** | RPC-Probe: Move-Funktionen **existieren** im Package |
| **Move upgraden** | Confirm → Boss-API; braucht UpgradeCap + fehlende Funktionen (oder Probe offen). Danach Backend neu starten. |

Team-Postfächer: **Meine Mailboxen**. Helfer sehen den Block nicht.

### Passwort / Backup / Mailboxen / Schatten

| Block | Kurz | Ort |
|-------|------|-----|
| Passwort ändern | Vault-Datei neu verschlüsseln; „Sitzung beenden“ = Keys aus RAM (wie Abmelden). **Auto-Sperren nach Abwesenheit** = optional, Default aus. F5 sperrt den API-Tresor nicht | **Sicherheit** / Tresor |
| Backup | Lokal / Chain sichern & laden | **Sicherheit** |
| Meine Mailboxen | Privat/Team-Postfächer ≠ Deploy-Mailbox unter „Wo senden?“ | **IOTA** |
| Schatten → Main | Einmal-Sweep temporäre Adresse → Main | **Sicherheit** |

### Meine Mailboxen (T3 — genau)

**Pfad:** Einstellungen → **IOTA** → **Meine Mailboxen** (Tresor offen, Backend/RPC erreichbar).

| Was | Bedeutung |
|-----|-----------|
| **Hauptpostfach (`MAILBOX_ID`)** | Setup-Shared. **Dieselbe ID** wie Chain-IDs → Postfach. Immer im Posteingang. |
| **Senden** | Ziel im **Composer** (Event vs. Postfach). Kein separates „Sendeziel“ mehr unter Meine Mailboxen. |
| **Team** | Beitreten (ID/QR) / Erstellen (Boss). Liste hier. |
| **Privat** | Eigenes Objekt; Posteingang lädt bekannte mit. |
| **Kontakt ↔ Postfach-ID** | **Telefonbuch** → Kontakt bearbeiten → Erweitert · Postfach-ID (optional). |
| **Amber Abfrage-Liste** | Team on-chain ok; fehlt nur in `TEAM_MAILBOX_IDS`. |

**Ablauf Privat (Smoke):**

1. Tresor entsperren.  
2. IOTA → Meine Mailboxen öffnen.  
3. Private Mailbox **anlegen** (oder vorhandene wählen).  
4. Diese Mailbox **aktiv** setzen.  
5. Im Chat Composer prüfen: Ziel unter „Wo senden?“ / Persistenz — klar, welches Postfach gemeint ist.  
6. Testnachricht (Klartext oder Schloss) senden → **Aktualisieren** im App-Header **neben Tresor** → Eintrag sichtbar.  
7. Optional zweite Private `#2` anlegen: nur eine kann aktiv sein — Wechsel bewusst testen.

**Ablauf Team (wenn Rolle Boss):**

1. Team-Postfach anlegen oder ID aus Deploy übernehmen.  
2. Aktiv setzen; Sync-Status / Fehlerhinweise lesen.  
3. Mitglied mit Telefonbuch-Eintrag; Team-Broadcast vs. 1:1 unterscheiden (Handbuch Messenger-Tabelle).

**Nicht verwechseln:** „Wo senden?“ = Ziel für *diese* Nachricht. Meine Mailboxen = welche Postfächer du *besitzt/liest*. Aufräumen/Purge löscht On-Chain-Inhalt — nur bewusst.

**Helfer ohne Netz-Schalter:** noch „System & Identität“ (Adresse/Package) — Boss nicht mehr.

---

## Telegram

Telegram = **optionaler Push/Hinweis**, kein Chat-Ersatz für IOTA/Funk.

**IOTA→Telegram-Klingel (Hinweis nach Online-Send):** Genau das, wofür sie gebaut ist — **Aufmerksamkeits-Ping**, kein zweiter Messenger. Bedeutung: „Es liegt was in Morgendrot“ (Handy vibriert über Telegram, App muss nicht offen sein). Inhalt/Verlauf bleiben in Morgendrot; Telegram ersetzt weder IOTA noch Funk.

**Eingangs-Ton (App):** Einstellungen → Erscheinungsbild — Master + 1:1/Gruppe/Pinnwand. **Stumm pro Chat:** im Chat-Kopf „Ton/Stumm“ — nur der In-App-Chime, kein On-Chain-Block. **Anhang-Vorschau:** Erscheinungsbild → Schalter (Composer-Bild/.txt vor dem Send; Default an). Chat-Kurzblatt: **`MESSENGER-CHAT-HANDBUCH.md`** § *Ton, Stumm, Telegram-Klingel*.

| Einstellung | Bedeutung |
|-------------|-----------|
| **System-Alarme** | Nur Monitor/Sensor → deine Chat-ID. Kann aus bleiben für normalen Chat. |
| **Bot-Token** | Von @BotFather. Ersetzen = alter Token weg (ein Slot). Nur Admin; Klartext in Runtime-JSON + UI. |
| **Persönliche Chat-ID** | Deine User-ID (@userinfobot), nicht die Zahl vor „:“ im Token. Für Alarme + „Test an mich“. |
| **Relay-URL** | Optional für Monitor (`127.0.0.1:8787`). Chat oft ohne Relay. |
| **Eingehende Antworten** | **Long Polling** = Server fragt Telegram (kein Tunnel). Webhook braucht HTTPS. Aus = nur senden. Nur Telefonbuch-IDs. |
| **Test an mich** | An deine Admin-Chat-ID. |
| **Test an Kontakt** | An manuell eingegebene Partner-Chat-ID — nicht dasselbe. |
| **Einsatz-Alarmgruppe** | Boss: eine Telegram-**Gruppe** als Klingel für SOS / „Team alarmieren“. Default **aus** (kein versehentliches Gruppen-Schreiben). Aktiv = Schalter an + **Gruppen-Chat-ID (-100…)** + Speichern; Einladungslink nur für Helfer-Beitritt. |
| **Hinweis nach Online-Send** | Nach erfolgreichem **IOTA-1:1 Online**: optionaler Kurz-Ping (**Klingel**, siehe Absatz oben). Empfänger: **Kontakt / Ich / Beide** + optional **weitere Chat-IDs (CC, max. 5)**. Nicht die Alarmgruppe. Composer-Sendepfad „Telegram“ = **anderer** Kanal (nur Bot, ohne IOTA). |

**Einstieg:** App → **Einstellungen → Telegram** (Handbuch-Karte unter Allgemein → „Öffnen“ führt ins Handbuch; Telegram-Tab = Aktion). Kurz-Setup: `TELEGRAM-INTEGRATION-EINRICHTUNG.md`.

Details: `docs/TELEGRAM-INTEGRATION-ZIELBILD.md` (Einrichtung + Architektur).

---

## Sicherheit (Ist)

**Notfall-Löschung** (Scopes: Chain-Vault / lokaler Cache / Sitzung sperren / lokale Geheimnisse), **Passwort ändern**, **Backup**, **Schatten → Main**, **Tresor-Landkarte** (Stand 2026-11-12, T8/T9/T37). Soft-Lock = Chat-Kopf (Badge), kein volles Vault-Shred.

---

## Funk

Kurz: Puls/Geräte-Embed. Entscheidung offizielle Meshtastic-App vs. eigene UI = Roadmap T6 — **noch nicht**.

## Handoff (kurz)

Boss teilt **Einsatz-Konfig** (Package/RPC/Mailbox/Capabilities, **kein** Seed) als ZIP (~3 KB). Helfer: **Allgemein → Handoff importieren** → neu laden → entsperren.  
**Lassen für Morgendrot-Einsatz** (Helfer/Geräte). Solo/Privat meist ohne. IOTA-Messenger-only: weg (Produkt-Split).

---

## Vollständigkeit (ehrlich)

| Bereich | Status |
|---------|--------|
| IOTA Boss-Netz + Gas + IDs | ausreichend für Alltag |
| IOTA Passwort/Backup/Schatten | → **Sicherheit** (T8/T9 erledigt); IOTA nur Hinweis |
| Telegram Bot + 1:1 + Gruppe | ausreichend |
| Telegram Journal/Webhook-URL-UI | fehlt / selten nötig |
| Sicherheit | Purge + PW/Backup/Schatten/Landkarte |
| Secrets-Landkarte als eigene UI | fehlt (Roadmap T11) |

**Radikal kürzen / aufräumen** der Settings + Handbuch: Roadmap **T12** (am Schluss des Durchgangs oder früher, wenn blockierend).

---

*Bei Konflikt gewinnt die laufende UI; dieses Blatt beschreibt den Ist-Stand 2026-11-12.*
