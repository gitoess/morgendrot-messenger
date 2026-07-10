# Hobby-Release-Policy — GitHub Releases

**Stand:** 2026-07-10 · Kanonisch mit `DISCLAIMER.md`, `COMMERCIAL-LICENSING.md`, `LICENSE`

---

## Ziel

Öffentliche **experimentelle** Abgaben für Maker, Prepper und Entwickler — **ohne** Produktversprechen und **ohne** kommerzielle Verkaufs-Bundles.

## Was veröffentlicht wird

| Artefakt | Inhalt |
|----------|--------|
| `morgendrot-messenger-pc-standalone.zip` | `exports/Morgendrot-Messenger-standalone` nach `npm run bundle:messenger:standalone` — **ohne** `node_modules` |
| `morgendrot-messenger-android-debug.apk` | Unsigned **debug** build (`assembleDebug`) — Sideload only |
| `SHA256SUMS.txt` | Prüfsummen aller Release-Dateien |
| `LICENSE`, `DISCLAIMER.md`, `COMMERCIAL-LICENSING.md` | Rechtstexte (unverändert vom Tag) |

## Was **nicht** veröffentlicht wird

| Ausgeschlossen | Grund |
|----------------|--------|
| `Morgendrot-Messenger-verkauf` (`sales`) | Kommerzielles Hersteller-Bundle — nur mit Commercial License |
| `.env`, Vault, Session-Keys, Handoff-ZIPs | Secrets / einsatzspezifisch |
| `node_modules` | Plattformabhängig, groß — Nutzer führt `npm install` aus |
| Play Store / App Store Builds | Bewusst vermieden (Regulierung, Erwartungsdruck) |
| Signierte Release-APK (vorerst) | Keys, Haftung, Store-Nähe |

## Tag- und Release-Konvention

- Tag: `v0.x.y-experimental` (z. B. `v0.1.0-experimental`)
- GitHub: **Pre-release** + zuerst **Draft** (manuell prüfen, dann veröffentlichen)
- Release Notes: Pflichtblock aus `DISCLAIMER.md` + Install-Hinweise

## Install (Kurz)

**Android:** APK sideloaden → Handoff vom Boss importieren (nicht aus GitHub).

**PC:** Node.js LTS → ZIP entpacken → `npm install` → `.env` aus `.env.example` oder Boss-Export → `npm start`.

**PWA:** Kein Release-ZIP — Boss-LAN oder eigener Host; siehe `docs/DEV-START.md`.

## CI

Workflow: `.github/workflows/release-hobby-artifacts.yml`

- Trigger: Tag `v*-experimental` oder manuell (`workflow_dispatch`)
- Erzeugt Draft-Release mit Artefakten
- **Kein** Auto-Publish ohne Review

## F-Droid / Stores

Nicht Teil der Hobby-Policy v1. F-Droid erst nach reproduzierbarem Build und Metadaten-Pflege.

## Checkliste vor Publish

- [ ] `LICENSE`, `DISCLAIMER.md`, `COMMERCIAL-LICENSING.md` auf dem Tag-Stand
- [ ] `SECURITY.md` (LAN-API, Restrisiken) auf dem Tag-Stand
- [ ] Release Notes enthalten EU-/Hobby-Disclaimer
- [ ] Keine Secrets in Artefakten (ZIP/APK geprüft)
- [ ] `SHA256SUMS.txt` beigefügt
- [ ] Pre-release + Draft bis manuelle Freigabe
