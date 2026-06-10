# Handoff-Import — UX-Analyse & Umsetzung

**Stand:** 2026-05-20  
**Zweck:** Einsatz-Boss → **Untergebener** ohne manuelles `.env`-Umbenennen. Zwei Produktmodi: **`docs/HANDOFF-UND-MODUS-ZIELBILD.md`**.

---

## 1. Problem (früher: manuell)

| Schritt | Hürde |
|---------|--------|
| ZIP speichern | OK für Boss |
| `.env` finden / umbenennen | Fehleranfällig auf dem Handy |
| Backend neu starten | Unklar für Helfer |

**Fazit:** Technisch korrekt, **UX schlecht** — besonders für Arbeiter/Wanderer.

---

## 2. Optionen (Bewertung)

| Lösung | Machbarkeit | Aufwand | Bewertung |
|--------|-------------|---------|-----------|
| **ZIP-Import in der PWA** (Button → Vorschau → speichern → Neustart) | Hoch | Mittel | **Umgesetzt** — bestes Verhältnis Nutzen/Aufwand |
| Drag & Drop (Desktop) | Hoch | Gering | Optional, gleiche Pipeline |
| Automatischer Neustart ohne Hinweis | Mittel | Gering | PWA kann Prozess nicht zuverlässig ersetzen → **expliziter Neustart-Button** |
| Profil/Rolle live wechseln | Mittel | Hoch | **Backlog** — Seed/Session-Risiko |
| Mehrere gespeicherte Handoffs | Mittel | Hoch | **Phase C** |

**Nicht-Ziel (jetzt):** WhatsApp-ähnlicher Account-Switch, Runtime-Rollenwechsel ohne Neustart.

---

## 3. Umsetzung (Kurzfristig)

### Boss Export-Assistent (P0 UX 2026-05-20)

- **Zusammenfassung** unter Titel (Preset, Team, Partner, PSK, IOTA-Archiv)
- **Preset-Karten** mit Farbe + Kurzbeschreibung (Helfer grün, Arbeiter blau, Wanderer grau, …)
- **Partner** als Checkboxen mit **Name + kurzer Adresse** (Telefonbuch)
- **Team-Postfächer** mit lesbarem Label + `…letzte8`
- **Technik** nur unter „Erweiterte Technik“ (RPC, PACKAGE_ID, Partner-Hex manuell)
- **Passwort-Schutz (Phase B):** Checkbox → ZIP mit `handoff.morg.enc` + `handoff.crypto.json` (Krypto **im Browser**, Passwort nie an Server)
- **Per IOTA (Phase C):** Button **Per IOTA an Partner** — gleiche ZIP als `[[MORG_HANDOFF_ZIP_V1:…]]` E2EE an ausgewählte Partner

### Ablauf Helfer

**Empfohlen (Standalone-APK, Boss-Wizard):** `docs/GERAET-PROVISIONIEREN-WIZARD.md` — Boss erzeugt ZIP + Seed-QR; Helfer importiert ZIP → Dialog **Seed einrichten?** (QR oder Eingabe).

1. **Einstellungen → Handoff importieren**
2. Boss-**ZIP** wählen **oder** Posteingang → Nachrichten-Menü **Handoff importieren** (IOTA)
3. Bei Verschlüsselung: **Passwort** eingeben → Entschlüsseln
4. **Vorschau:** Bezeichnung, Rolle, Transport, Simple Mode, Team-Mailboxes, PSK-Hinweis
5. **Import bestätigen** → API merged **nur erlaubte** Keys in lokale `.env` (Basis übernimmt Werte **sofort**)
6. **Seite neu laden** → Tresor entsperren (Seed/Passwort wie gewohnt)

**Kein Backend-Neustart nötig** — `setEnvKey` aktualisiert `.env` und laufende Config. Unter `npm run dev` würde `/api/restart` den API-Prozess oft beenden, ohne dass `concurrently` ihn neu startet.

### Sicherheit

- **Allowlist** öffentlicher Handoff-Keys (`src/handoff-env-import.ts`) — keine Secrets, keine Blocklist-Keys
- Leeres `MY_ADDRESS` im Handoff **überschreibt nicht** bestehende Wallet-Adresse
- Verdächtige Werte (mnemonic, password, …) werden abgelehnt
- **Kein Boss-only** — Helfer muss importieren können; ZIP enthält ohnehin nur öffentliche Werte

### API

| Endpoint | Body | Antwort |
|----------|------|---------|
| `POST /api/apply-handoff-env` | `{ envText, dryRun: true }` | `{ ok, summary, errors }` |
| `POST /api/apply-handoff-env` | `{ envText, dryRun: false }` | `{ ok, applied, requiresPageReload }` |

### Code

| Teil | Pfad |
|------|------|
| Parser + Apply | `src/handoff-env-import.ts` |
| ZIP / Entschlüsselung | `handoff-zip-import.ts`, `handoff-zip-crypto.ts`, `handoff-export-download.ts` |
| UI | `frontend/frontend/components/handoff-import-panel.tsx` |
| Boss-Export | `boss-handoff-export-panel.tsx` — **Einstellungen** (Boss) + **Einsatzleitung** + Boss-Modus |

---

## 4. Was weiterhin manuell bleibt

- **Standalone-Bundle** auf neues Gerät kopieren (`npm run bundle:standalone-smartphone`) — einmalig
- **Seed / Vault** nur auf dem Helfer-Gerät — nie im ZIP
- **Meshtastic-PSK** im Funk-Kanal — außerhalb der App (README-Hinweis)

---

## 5. Später (Backlog)

- **Verschlüsselte Handoff-ZIP** — **Ist:** `handoff.morg.enc` + Passwort-Dialog — **`docs/HANDOFF-ZIP-ENCRYPTION.md`**
- Erststart-Wizard: „Handoff-ZIP?“ direkt nach Unlock
- Mehrere Profile / „Profil wechseln“
- QR statt ZIP für kleine Overlays

**Verknüpfung:** **`docs/FELDTEST-BLOCK2-SIMPLE-HANDOFF.md`**, **`docs/WANDERER-STANDALONE-BUNDLE.md`**, Fahrplan **§ H.7**.

### Handoff-Dokumentation (Index)

| Dokument | Inhalt |
|----------|--------|
| **`HANDOFF-IMPORT-UX.md`** | Import-Flow, API, Ist 2026-05-20 |
| **`HANDOFF-PROFILE-UX.md`** | Aktives Profil, Theme, Historie (light) |
| **`HANDOFF-ZIP-ENCRYPTION.md`** | Passwort-Envelope (**Ist**), IOTA optional (~3 KB) |
| **`HANDOFF-UND-MODUS-ZIELBILD.md`** | Einsatz vs. Privat; Export nur Untergebene |
| **`FELDTEST-BLOCK2-SIMPLE-HANDOFF.md`** | Feldtest-Protokoll Boss → Arbeiter |
