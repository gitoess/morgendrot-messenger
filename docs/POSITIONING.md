# Morgendrot — Positionierung (GitHub / Außenwirkung)

**Stand:** 2026-07-08 — kanonisch mit **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** und **§ H.0-SIMPLE**.

---

## Hobby-Release & Lizenz (öffentliche Außenwirkung)

- **Experimentelles Hobby-Projekt** — kein fertiges Produkt (`DISCLAIMER.md`)
- **Lizenz:** AGPL-3.0 — **kommerzielle Nutzung** nur mit Erlaubnis (`COMMERCIAL-LICENSING.md`)
- **GitHub Releases:** nur `standalone` + debug APK, **kein** Verkaufs-Bundle (`docs/HOBBY-RELEASE-POLICY.md`)
- **Keine App Stores** — Sideload / direkter Download
- **EU:** explizit nicht Chat-Control-konform positioniert

---

## Einzeiler (Repository-Beschreibung)

**Boss-geführtes Einsatz-Messenger:** LoRa/Meshtastic (Feld-Default) + IOTA (Mailbox, Archiv, Delayed LoRa→Tangle) + Handoff in unter 20 Sekunden.

**GitHub „About“ (Web-UI):** Copy-Paste für Description, Website und Topics → **`.github/REPOSITORY-ABOUT.md`** (Repo: `gitoess/morgendrot-messenger`). Per CLI: `gh repo edit` — Befehl dort.

---

## Was Morgendrot ist

- **Einsatz-Kommunikation** für trainierte Teams (Feuerwehr, THW, Bergrettung) — Boss provisioniert **nur Untergebene**
- **Privat/Solo:** Wanderer, Prepper — **eigener** Messenger, **ohne** Einsatz-Boss (**`docs/HANDOFF-UND-MODUS-ZIELBILD.md`**)
- **Funk-Default im Feld:** Meshtastic zuerst; **IOTA gekoppelt** (Mailbox, Pfad 4, geplant Delayed Upload)
- **Boss bereitet vor:** Export-Assistent (Einsatz), Stufen Helfer/Arbeiter/Führer, PACKAGE_ID/RPC
- **PWA + Node:** Next-Messenger + IOTA-Rebased-Layer (**`docs/TRANSPORT-AND-IOTA-LAYERS.md`**)

## Was Morgendrot nicht ist

- Kein **fertiges Produkt** oder kommerzielles Endnutzer-Angebot ohne separate Lizenz (Hobby-Releases: `DISCLAIMER.md`)
- Kein Ersatz für **Signal**, **ATAK** oder **Meshtastic-Frontends** in deren Kern
- Kein universelles „Alles-in-einem“-Hybrid-Produkt für Endnutzer ohne Vorbereitung
- Kein Signal-Niveau-E2EE-Versprechen (§ H.23: Session Keys+ geplant, Ratchet Phase 3 — bis Umsetzung transport-strong)

## Technische Schwerpunkte (Topics / Tags)

Empfohlene GitHub-Topics:

`emergency-comms` · `meshtastic` · `lora` · `pwa` · `offline-first` · `team-messaging` · `iota` (optional layer) · `experimental` · `hobby-project` · `agpl-3.0`

## Dokumentation — Einstieg

| Ziel | Dokument |
|------|----------|
| Hobby-Releases & Disclaimer | **`docs/HOBBY-RELEASE-POLICY.md`**, **`DISCLAIMER.md`**, **`COMMERCIAL-LICENSING.md`** |
| Einführung (ohne Fachjargon) | **`docs/EINFUEHRUNG-MORGENDROT-LAIEN.md`** |
| Transport & IOTA-Schichten | **`docs/TRANSPORT-AND-IOTA-LAYERS.md`** |
| Strategie & Prioritäten | **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** |
| Fahrplan & Simple Mode | **`docs/ROADMAP-FAHRPLAN.md` § H.0-SIMPLE** |
| Entwickler-Start | **`docs/DEV-START.md`** |
| Messenger vs. Projekt (Next) | **`docs/PRODUCT-MESSENGER-VS-PROJEKT.md`** — `npm run dev` vs. `npm run dev:messenger` |
| Rollen testen | **`docs/TEST-ROLLE-PROFILES.md`**, `npm run dev:role:*` |
| Zwei Modi (Einsatz vs. Privat) | **`docs/HANDOFF-UND-MODUS-ZIELBILD.md`** |
| Handoff Einsatz | Export-Assistent → Untergebene; **`docs/HANDOFF-IMPORT-UX.md`** |
| Privat / Wanderer | **`docs/WANDERER-STANDALONE-BUNDLE.md`** — kein Boss-Export |

## Env-Profile (Kurz)

```env
# Standard-Helfer (Einsatz)
DEPLOYMENT_PROFILE=einsatz
TRANSPORT_PROFILE=mesh-first
UI_VARIANT=messenger
SIMPLE_MODE=true

# Boss / Kommandant
TRANSPORT_PROFILE=iota-anchored   # oder iota-full (Boss)
SIMPLE_MODE=false
UI_VARIANT=full
```

Rollen-Overlays: **`env/roles/*.env`** → `npm run env:role:boss|kommandant|arbeiter|consumer`

---

*Bei Widerspruch zwischen README-Fließtext und dieser Datei gilt **PROJECT-FOCUS** + **§ H.0-SIMPLE**.*
