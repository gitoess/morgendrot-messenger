# Posteingang — Zielbild und Umsetzungsplan

**Stand:** 2026-06-02  
**Kontext:** Kritik am boss-zentrierten Pinnwand-/Posteingangs-Flow; Orientierung an Telegram und Einsatz-Messengern.

---

## Problem (Ist)

| Thema | Symptom |
|-------|---------|
| **Pinnwand** | Technisch korrekt (Broadcast-Adresse ≠ Mailbox), aber Helfer sehen Adressen und Boss-.env-Hinweise |
| **Handoff** | `BROADCAST_*` fehlte im Standard-ZIP → Helfer ohne Live-Basis wussten nichts vom Lagebild |
| **Posteingang** | Eine flache Liste: 1:1, Gruppen, Pinnwand, Mesh — schnell unübersichtlich |
| **Ungelesen** | Lokal pro Kategorie (`inbox-overview-unread.ts`, Chips + Lagebild-Streifen) |

---

## Zielbild (Soll)

### Helfer (arbeiter / Simple Mode)

1. **Kein Wissen über Broadcast-Adressen** — Lagebild kommt mit dem Handoff oder Live-Status, nur als „Lagebild“-Karte.
2. **Start: Übersicht** — oben große Lagebild-Karte (letzte Meldungen), darunter gefilterte Direkt-/Funk-Nachrichten.
3. **Einfache Chips:** `Alle | Lagebild | Direkt | Funk` — keine Wire-/Package-Expertenfilter standardmäßig.
4. **Kein Pinnwand-Tab** — Lesen über Streifen + Chip „Lagebild“.

### Führung (Boss / Kommandant)

1. **Pinnwand-Tab** zum Posten (read-only Empfänger im Composer).
2. **Posteingang** mit denselben Chips optional; Expertenfilter weiter über Toolbar.
3. **Pinnen** wichtiger Pinnwand-Posts (bereits im Pinnwand-Kanal).

### Mittelfristig (Backlog)

- Ordner („Einsatz Süd“, „Privat“)
- Suche („alle von Zugführer gestern“)
- Ungelesen-Zähler pro Kategorie (`lastSeenByThread` lokal)
- Gepinnte Chats/Gruppen (Boss)

---

## Umsetzung — Phasen

### Phase 1 (kurzfristig, hoher Impact) — **teilweise umgesetzt**

| Maßnahme | Status |
|----------|--------|
| Lagebild-Adresse **automatisch im Handoff-ZIP** wenn Boss Pinnwand aktiv | **Ist** (`buildStandaloneSmartphoneHandoffEnv`) |
| Handoff-Snapshot + Status-Fallback für `broadcastPinnwand` | **Ist** |
| Helfer: Lagebild-Streifen **ohne** technische Adresse | **Ist** |
| Helfer/Simple: Kategorie-Chips im Posteingang | **Ist** |
| Pinnwand aus „Alle“-Liste wenn Streifen sichtbar (keine Doppelung) | **Ist** |
| **Lagebild-Kanal-Tab:** eigener Feed (nur Brett-Posts), Posteingang bleibt für 1:1/Gruppe | **Ist** (2026-06) |
| Rollen: Helfer ohne Pinnwand-Tab, Führung mit Tab | **überholt** — Helfer haben Tab + Streifen (PINNWAND-ANZEIGE-ZIELBILD) |

### Phase 2

- Ungelesen-Badges (lokal, pro Kategorie) — **Ist** (Chips + Lagebild-Streifen)
- „Übersicht“ als eigener Kanal-Modus oder Default-Tab in der unteren Navigation
- Gepinnte Gruppen im Posteingang
- Ungelesen pro 1:1-Partner/Thread — **Ist** (`inbox-partner-unread.ts`, Partner-Chips, Offene-Chats-Streifen, Zeilen-Markierung)

### Phase 3

- Ordner, Volltextsuche, Archiv

---

## Technische Anker

| Thema | Code / Doku |
|-------|-------------|
| Kategorie-Filter | `frontend/lib/inbox-overview-filter.ts` |
| Chips-UI | `frontend/components/chat-view-inbox-category-chips.tsx` |
| Lagebild-Streifen | `chat-view-pinnwand-inbox-strip.tsx` |
| Rollen / Tab | `messenger-pinnwand-capabilities.ts` |
| Handoff Lagebild | `handoff-local-apply.ts`, `broadcast-pinnwand-handoff-status.ts` |
| Boss-Export | `src/config.ts` → `buildStandaloneSmartphoneHandoffEnv` |
| Pinnwand Server | `docs/BROADCAST-PINNWAND.md` |

---

## Design-Referenzen

- **Telegram:** Chat-Liste + Ordner + Pinned + Suche
- **Einsatz-Apps:** Lagebild/Offiziell immer oben, Team getrennt, Persönliches unten/eigener Tab

Morgendrot wählt **keine** monolithische Liste, sondern **Kategorien + priorisiertes Lagebild** — ohne sofort die gesamte Navigation umzubauen.
