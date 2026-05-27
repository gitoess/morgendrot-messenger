# Block 2 — Feldtest Simple Mode + Handoff (Kurzprotokoll)

**Stand:** 2026-05-20  
**Voraussetzung:** Tranche A (**§ H.0-SIMPLE**) — Doku + UI **weitgehend erledigt**.  
**Leitdokumente:** **`docs/TRANSPORT-AND-IOTA-LAYERS.md`**, **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**, **`docs/ROADMAP-FAHRPLAN.md`** § H.0-SIMPLE.

**Regel:** **Eine Rolle pro Durchlauf** — Backend nach `env:role:*` **neu starten**.

---

## Ablauf (empfohlen)

### 1. Boss — Handoff erzeugen

```powershell
npm run env:role:boss
npm run dev
```

1. Tresor entsperren, `GET /api/status` → `role=boss`, `simpleMode=false`, `iotaTransportUiEnabled=true`.
2. **Einsatzleitung** → **Export-Assistent** (alternativ: **Einstellungen**, Rolle Boss — gleicher Assistent).
3. Preset **Helfer** oder **Arbeiter**; PSK-Hinweis oben lesen.
4. Optional: **IOTA-Archiv im README** (nur bei Funk-Presets) — ergänzt `README-HANDOFF.txt`.
5. **ZIP-Paket herunterladen** (oder Schnell-Handoff).

**Erwartung im ZIP:** `morgendrot-standalone-handoff.env`, `README-HANDOFF.txt` mit PSK + ggf. Archiv-Block; `.env`-Kommentar LoRa/PSK bei `TRANSPORT_PROFILE=mesh-first`. **Größe typisch ~3 KB** (nur Konfig, kein Bundle) — optional später auch per IOTA (Backlog **`docs/HANDOFF-ZIP-ENCRYPTION.md`** § 2.3).

### 2. Arbeiter — Handoff importieren

```powershell
# Backend stoppen (Ctrl+C), dann:
npm run env:role:arbeiter
npm run dev
```

**Empfohlen (PWA):** **Einstellungen → Handoff importieren** → Boss-ZIP wählen → Vorschau → **Import bestätigen** → **Seite neu laden** → Tresor entsperren.  
Details: **`docs/HANDOFF-IMPORT-UX.md`**.

Alternativ (manuell): Handoff-`.env` aus ZIP ins Projekt/Bundle-Root legen und in `.env` umbenennen.

### 3. Chat prüfen (Arbeiter / Simple Mode)

| # | Check | Erwartung |
|---|--------|-----------|
| 1 | Dashboard | Kacheln **Nachrichten** + **Tresor** — **kein** Action Center |
| 2 | Sendepfad | **funk** + **online**; **kein** adhoc; Default **funk** nach Reload |
| 3 | Pfad 4 | **Keine** Checkbox „LoRa + eigene Verankerung“ — nur **Hinweistext** bei Transport funk |
| 4 | Offline-Queue | **Streifen** unter Kopfzeile (auch bei 0 pending mit Opt-in-Hinweis); Posteingang **Wartende Sendungen** wenn pending |
| 5 | Expert aus | Kein Package-Banner, kein „Nur IOTA“, kein Relay/Tangle im Posteingang-Menü |
| 6 | Einstellungen | Kein Pulse-Expert-Block „Direkt-RPC · IDs · Funk“ |

Optional Opt-in Queue testen:

```js
localStorage.setItem('morgendrot.offlineMailboxQueue', '1')
```

Dann Online-Send ohne Basis → Eintrag in Warteschlange → Streifen zeigt Anzahl.

### 4. Wanderer (optional zweiter Durchlauf)

```powershell
npm run env:role:wanderer
npm run dev
```

Gleiche Simple-Checks; kein Einsatzleitung-Tab; Preset **Wanderer** im Boss-Export ohne Team-Mailbox-Multi.

---

## Was bewusst nicht in diesem Block

- **Phase B:** Delayed LoRa → IOTA MVP
- **Zwei Wallets** Handshake empfangen (separat, Fahrplan *Spätere Tests* #1)
- **§ H.15 Stufe 2** Direkt-RPC am Handy — **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** (Boss/Expert oder temporär ohne Simple Mode)
- PWA L1–L5 — **`docs/PWA-MANUAL-CHECKS.md`**

---

## UI-Matrix (Expert vs. Simple) — Kurz

| Element | Boss / Expert | Helfer Simple |
|---------|---------------|---------------|
| Pfad-4-Checkbox im Composer | ✅ | ❌ (nur Hinweis) |
| Handoff „IOTA-Archiv im README“ | ✅ (Export-Assistent) | — (empfängt README) |
| Meshtastic-PSK-Hinweis | ✅ im Export | ✅ in README / .env-Kommentar |

---

*Nach grünem Durchlauf: Eintrag in **`docs/TEST-RUN-LOGBOOK.md`** (Datum, Rolle, Auffälligkeiten).*
