# Handoff-Profil — Anzeige & Wechsel (gestaffelt)

**Stand:** 2026-05-20  
**Verwandt:** **`docs/HANDOFF-IMPORT-UX.md`**, **`docs/HANDOFF-ZIP-ENCRYPTION.md`**, **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** (Backlog Multi-Package)

---

## 1. Kritische Bewertung der Feature-Idee

| Feature | Sinnvoll? | Aufwand | Risiko | Priorität |
|---------|------------|---------|--------|-----------|
| **Aktives Profil anzeigen** | Sehr hoch | Niedrig | Sehr niedrig | **P0 — Ist** |
| **Visueller Indikator** (Farbe / Wasserzeichen) | Hoch | Mittel | Niedrig | **P1 — Ist (light)** |
| **Historie + Wechsel** (2–5 Handoffs) | Hoch | Mittel | Mittel (falsches Profil) | **P2 — Ist (light)** |
| **Echter Live-Wechsel ohne Reload** | Mittel | Hoch | Hoch (Seed, Listener) | **Backlog** |
| **Multi-Account wie Signal** | Mittel | Sehr hoch | Hoch | **Phase C / H.24b** |

**Leitplanke:** Handoff = **Einsatzumgebung** (`.env`, PACKAGE, Rolle), **nicht** Chat-Raum. Wechsel = bewusste Aktion mit Vorschau — kein stilles Umschalten.

---

## 2. Umsetzung (Ist)

### P0 — Aktives Profil

- **`GET /api/status`:** `handoffLabel` (aus `HANDOFF_LABEL=` oder Kommentar `# Einsatz-Bezeichnung:`)
- **Badge** in Dashboard-Kopfzeile und Chat-Kopf: z. B. „THW Einsatz Süd – Arbeiter“
- **Einstellungen → Aktives Profil:** Bezeichnung, Rolle, Transport, Import-Datum

### P1 — Visueller Indikator (light)

- **`deployment-profile-theme.ts`:** Keyword-Erkennung (THW, Polizei, Feuerwehr, Wanderer, …)
- **Hintergrund:** dezenter Farbverlauf + Wasserzeichen (z. B. „THW“) — **keine** echten Logos (Urheberrecht)

### P2 — Historie (light)

- **`localStorage`** `morgendrot.handoff.profileHistory` — max. **5** Einträge, nur **öffentliche** Handoff-`.env`
- **Wechsel:** Vorschau → Merge → **Seiten-Reload** (wie Import; kein Backend-Kill)
- **Kein** Seed-/Vault-Wechsel — gleiches Gerät, andere Einsatz-Config

---

## 3. Boss-Export

Neue Handoffs enthalten `HANDOFF_LABEL=…` in der `.env` (zusätzlich zum Kommentar). Alte ZIPs funktionieren weiter (Kommentar wird beim Import übernommen).

---

## 4. Backlog (bewusst nicht jetzt)

- Echte Hintergrundbilder pro Organisation (Asset-Pipeline, Rechte)
- Verschlüsselte Profil-Historie (IndexedDB + Geräte-PIN)
- Erststart-Wizard „Profil wählen“
- **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** — Multi-Package-Registry, Warn-Dialog „Einsatz wechseln“

---

## 5. Code

| Teil | Pfad |
|------|------|
| Theme + Anzeige | `frontend/frontend/lib/deployment-profile-theme.ts`, `active-profile-display.ts` |
| Historie | `frontend/frontend/lib/handoff-profile-history.ts` |
| UI | `active-profile-badge.tsx`, `active-profile-panel.tsx`, `deployment-profile-backdrop.tsx` |
| Server | `HANDOFF_LABEL` in `src/config.ts`, `src/handoff-env-import.ts` |
