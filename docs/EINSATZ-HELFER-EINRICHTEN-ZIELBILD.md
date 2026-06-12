# Helfer einrichten — Zielbild (kompakt, eine Oberfläche)

**Stand:** 2026-06-02  
**Status:** **Phase 1–4 Ist** (Helfer einrichten kompakt)  
**Ersetzt langfristig:** getrennte Pfade „Provision-Wizard“ + „Export-Assistent“ + eigene Parameter-Karte

---

## Problem

- Dutzende Einsatzfälle (Medic, Reporter, nur Funk, IOTA aus, …) — **keine** endlose Preset-Liste skaliert.
- Wizard und Export-Assistent **doppelten** Profil, Bezeichnung, Handoff-Pipeline.
- Rechte (Lesen/Schreiben pro Kanal) steckten in **Schritt 2 / Experte** — zu versteckt.
- TTL, Hilfetexte und Menüpfade waren **doppelt** und unübersichtlich.

---

## Leitidee

```
Presets = Tastenkürzel, die die Matrix füllen — nicht eigene Produkte.
Die Wahrheit = eine Tabelle Lesen/Schreiben (+ Produkt-Häkchen).
Gespeicherte Vorlagen = eure Org-Standards (Medic Süd, Reporter LoRa, …).
```

| Mechanismus | Rolle |
|-------------|--------|
| **Profil-Karte** (Helfer / Führer / Spezial) | Grobe Defaults (ROLE, UI, Transport) |
| **Capabilities-Matrix** | Kanäle: Funk, Telegram, IOTA, BLE, Streams — je **Lesen** / **Schreiben** |
| **Schnellprofile** (Medic, Reporter, …) | Setzen Matrix + optional ROLE_ID — danach **frei anpassbar** |
| **ROLE_ID-Bits** (Experte) | Chain-Legacy: S, L, P, Gas — nur wenn nötig |
| **Gespeicherte Vorlage** | Boss speichert Kombination für Wiederverwendung |
| **Neues Wallet** | Seed + QR + Registry (Custody B) — eigener Block in derselben Karte |

**Purge / TTL** nur im Block **Bestehende Geräte** (Einsatz-weit, gleiche Wallet — kein Seed).

**WLAN-QR** = nur PWA installieren — **neben** ZIP/IOTA, **kein** Handoff.

---

## UI — eine Karte „Helfer einrichten“

```
┌─ Helfer einrichten ─────────────────────────────────────┐
│ Bezeichnung · Vorlage · Profil [Helfer|Führer|Spezial]  │
│ ▼ Rechte — Matrix + Schnellprofile [Medic|Reporter|…]   │
│ Team-Postfächer · Partner (Checkboxen)                  │
│ [ZIP + Seed + QR] [Nur ZIP] [IOTA] [WLAN-QR]  Passwort   │
│ ── Neues Gerät — Registry (Custody B)                   │
│ ── Bestehende Geräte ── TTL · Purge · [Handoff]         │
│ ▼ Experte (ROLE_ID, RPC, Vorlage speichern)             │
└─────────────────────────────────────────────────────────┘

Einsatzleitung
├── (Titel)
├── Helfer einrichten          ← oben
└── ▼ Erweitert                ← nur Chain / Move-Upgrade
```

**Kein** Schritt 1/2. **Keine** langen Hilfetexte — Labels kurz, selbsterklärend.

---

## Antwort auf „dutzende Fälle“

| Frage | Antwort |
|-------|---------|
| Reporter nur Funk lesen? | Matrix oder Schnellprofil **Reporter nur Funk** |
| Medic, aber IOTA lesen? | Schnellprofil Medic → IOTA **Lesen** ✓ |
| Bestimmte IOTA-Kanäle? | Transport-Zeile **IOTA** + **Team-Postfächer** / Partner |
| Alles anbieten? | **Matrix + Experte**, nicht N Presets |
| Org-Standard wiederholen? | **Als Vorlage speichern** (Experte) |

On-chain **IOTA „Kanäle“** = **Team-Postfach-Checkboxen**, nicht nur die Transport-Zeile.

---

## Rechte vs. Purge (drei Ebenen)

| Ebene | Steuert | Wo im UI |
|-------|---------|----------|
| **ROLE** | Grobe Rolle (`messenger`, `kommandant`, …) | Profil / Experte |
| **ROLE_ID** | Chain-Bits (S, L, P, Gas, …) | Profil + Experte |
| **Capabilities** | Lesen/Schreiben pro Kanal | Matrix **Rechte** |
| **Purge / TTL** | On-chain Löschen, Ablauf | **Bestehende Geräte** — **nicht** Rechte |

Details: `docs/HANDOFF-PERMISSIONS-MATRIX.md`

---

## Umsetzungsphasen

| Phase | Inhalt | Status |
|-------|--------|--------|
| **1a** | Eine Seite `layout=compact`, Matrix unter **Rechte** | **Ist** |
| **1b** | Schnellprofile (Reporter LoRa, LoRa+Telegram lesen, Medic-Funker) | **Ist** |
| **1c** | Export aus Erweitert nach **Helfer einrichten** | **Ist** |
| **1d** | TTL/Purge inline **Bestehende Geräte**; nicht im Export-Experten | **Ist** |
| **1e** | UI ohne Hilfetexte; WLAN-QR neben IOTA; `/api/lan-install-urls` | **Ist** |
| **2** | Ein Export-Knopf **ZIP + Seed + QR** + Registry im gleichen Flow (Formular-Rechte/Partner) | **Ist 2026-06-02** (`provisionNewHandoffDevice`, `BossHandoffExportPanel` compact) |
| **3** | UI + Backend: `canTransportRead/Write` (Composer, Posteingang, Export; Server `send-commands`) | **Ist 2026-06-02** |
| **4** | Vorlagen speichern volles Handoff-Snapshot (Capabilities, Partner, Team-Postfächer, Experten-IDs) | **Ist 2026-06-02** (`handoffSnapshot` in `.morgendrot-einsatz-templates.json`) |

---

## Verwandt

- `docs/HANDOFF-PERMISSIONS-MATRIX.md`
- `docs/CAPABILITIES-MATRIX-ZIELBILD.md`
- `docs/EINSATZ-BOSS-ABLAUF.md`
- `docs/EXPORT-ASSISTENT-REFERENZ.md`
- `docs/ROADMAP-FAHRPLAN.md` (Nachtrag 2026-06-02)
- `frontend/frontend/components/boss-helfer-einrichten-panel.tsx`
