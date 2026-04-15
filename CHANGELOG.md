# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert (manuell gepflegt; kein automatischer Diff).

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Messenger (PWA)

- **§ H.15 Stufe 0 — IOTA-Sendeweg:** Chat **Puls**-Einstellungen: Modus **Direkt (Standard)** vs. **Nur Morgendrot-API** (`localStorage` **`morgendrot.iotaSubmitMode`** = `relay` oder leer). Bei „Nur API“: kein Klartext-Mailbox-Upload per Fullnode; Offline-Queue und Drain berücksichtigen den Modus.

### Dokumentation

- **`docs/PWA-MANUAL-CHECKS.md`:** Protokoll-Tabelle chronologisch sortiert; doppelte **2026-03-28**-Zeile zu einer Eintragung zusammengeführt.
- **`docs/OPERATIONS-SNAPSHOT-2026-03.md`:** Nachtrag **2026-03-28** (Doku-Pflege, Verweis PWA-Protokoll / Handy vs. Schreibtisch).
- **`docs/PWA-HANDBUCH-OFFLINE.md`:** Absatz Sendeweg / **`morgendrot.iotaSubmitMode`** (nach **`npm run sync:handbook`** in **`public/handbook/`** spiegeln).
- **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`:** Stufe-0-Erfolgskriterium um **Ist** (Puls-Modus) ergänzt.
- **`CHANGELOG.md`:** neu — zentrale Stelle für Release- und Doku-Notizen neben **`docs/ROADMAP-FAHRPLAN.md`**.

### Hinweis (Fahrplan)

- Operative Reihenfolge und „nächste drei“ Arbeiten: **`docs/ROADMAP-FAHRPLAN.md`** (**§ C.0b**, **§ H.0–H.2**, **§ H.15**).
