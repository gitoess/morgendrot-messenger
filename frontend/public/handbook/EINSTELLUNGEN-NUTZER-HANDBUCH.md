# Einstellungen — Kurzhandbuch

**Stand:** 2026-11-12 · Eine Seite, Ist-UI. Keine Spez, keine Geschichte.

---

## Karte der Tabs

| Tab | Für wen | Kern |
|-----|---------|------|
| **Allgemein** | alle | Sprache, Wizard, Erscheinungsbild (Standard/Hell + Farben), App installieren, Expertenmodus, Handoff, Einsatz beenden |
| **IOTA** | alle | Netz (Boss), Gas, Chain-IDs, Tresor-Passwort/Backup, Mailboxen, Schatten (bis Umzug) |
| **Funk** | Einsatz | Meshtastic/Puls — Strategie später (offizielle App vs. eigene UI) |
| **Telegram** | Boss (+ Helfer Join) | Bot, Alarme, optional Gruppenalarm, Hinweis nach Online-Send |
| **Sicherheit** | alle | Notfall-Löschung — später auch Passwort/Backup/Schatten |

**.env:** nur Link ganz unten → „Konfiguration öffnen“. Nicht in Allgemein.

---

## Wo liegt was? (kein Vault-Mythos)

| Ding | Speicherort |
|------|-------------|
| Messaging-Keys, Passwortmanager, Notizen | **Vault-Datei** (+ optional On-Chain-Vault) |
| Package / Mailbox / RPC (aktiv) | Netzprofil + oft Boss-`.env` |
| Telegram Bot-Token, Admin-Chat-ID, Alarmgruppe | **`.morgendrot-runtime-config.json`** (Boss-PC) — **nicht** Vault |
| „Hinweis nach Online-Send“ an/aus | Browser **localStorage** |
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

Pro Netz: Package + Postfach. Unter „Globals“: Vault-Registry / Command-Registry / Upgrade Cap = aktive `.env` (On-Chain-Objekte, **nicht** lokaler Tresor).

### Passwort / Backup / Mailboxen / Schatten

| Block | Kurz | Zielplatz |
|-------|------|-----------|
| Passwort ändern | Vault-Datei neu verschlüsseln; „Tresor sperren“ = Keys aus RAM | → **Sicherheit** (Roadmap T8) |
| Backup | Lokal / Chain sichern & laden | → Sicherheit |
| Meine Mailboxen | Privat/Team-Postfächer ≠ Deploy-Mailbox unter „Wo senden?“ | bleibt IOTA |
| Schatten → Main | Einmal-Sweep temporäre Adresse → Main | → Sicherheit (T9) |

**Helfer ohne Netz-Schalter:** noch „System & Identität“ (Adresse/Package) — Boss nicht mehr.

---

## Telegram

Telegram = **optionaler Push/Hinweis**, kein Chat-Ersatz für IOTA/Funk.

| Einstellung | Bedeutung |
|-------------|-----------|
| **System-Alarme** | Nur Monitor/Sensor → deine Chat-ID. Kann aus bleiben für normalen Chat. |
| **Bot-Token** | Von @BotFather. Ersetzen = alter Token weg (ein Slot). Nur Admin; Klartext in Runtime-JSON + UI. |
| **Persönliche Chat-ID** | Deine User-ID (@userinfobot), nicht die Zahl vor „:“ im Token. Für Alarme + „Test an mich“. |
| **Relay-URL** | Optional für Monitor (`127.0.0.1:8787`). Chat oft ohne Relay. |
| **Eingehende Antworten** | **Long Polling** = Server fragt Telegram (kein Tunnel). Webhook braucht HTTPS. Aus = nur senden. Nur Telefonbuch-IDs. |
| **Test an mich** | An deine Admin-Chat-ID. |
| **Test an Kontakt** | An manuell eingegebene Partner-Chat-ID — nicht dasselbe. |
| **Einsatz-Alarmgruppe** | Boss: eine Telegram-**Gruppe** für SOS/Team. Morgendrot-Einsatz — **nicht** IOTA-Messenger-only. |
| **Hinweis nach Online-Send** | Nach erfolgreichem **IOTA-1:1**: Kurz-Push an den Kontakt, **wenn** dessen Telegram-ID im Telefonbuch steht. Composer-Tab „telegram“ ist ein **anderer** Kanal (direkt Telegram senden). |

Schritt: `TELEGRAM-INTEGRATION-EINRICHTUNG.md` (Schritte Bot/Gruppe). Zielbild/Architektur: `docs/TELEGRAM-INTEGRATION-ZIELBILD.md` (Entwickler).

---

## Sicherheit (Ist)

Nur **Notfall-Löschung** (Scopes: Chain-Vault / lokaler Cache / Sitzung sperren / lokale Geheimnisse).

**Fehlt hier noch (geplant):** Passwort ändern, Backup, Schatten — heute unter IOTA. Privacy Soft-Lock steuert man im Chat-Kopf (Badge), nicht in diesem Tab.

---

## Funk

Kurz: Puls/Geräte-Embed. Entscheidung offizielle Meshtastic-App vs. eigene UI = Roadmap T6 — **noch nicht**.

---

## Vollständigkeit (ehrlich)

| Bereich | Status |
|---------|--------|
| IOTA Boss-Netz + Gas + IDs | ausreichend für Alltag |
| IOTA Passwort/Backup/Schatten | da, aber falscher Tab → umziehen |
| Telegram Bot + 1:1 + Gruppe | ausreichend |
| Telegram Journal/Webhook-URL-UI | fehlt / selten nötig |
| Sicherheit | nur Purge — zu dünn bis T8/T9 |
| Secrets-Landkarte als eigene UI | fehlt (Roadmap T11) |

**Radikal kürzen / aufräumen** der Settings + Handbuch: Roadmap **T12** (am Schluss des Durchgangs oder früher, wenn blockierend).

---

*Bei Konflikt gewinnt die laufende UI; dieses Blatt beschreibt den Ist-Stand 2026-11-12.*
