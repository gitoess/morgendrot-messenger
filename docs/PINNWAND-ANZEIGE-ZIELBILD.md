# Pinnwand / Lagebild — Anzeige-Zielbild

**Stand:** 2026-06-02  
**Bezug:** `docs/BROADCAST-PINNWAND.md`, `docs/INBOX-UX-ZIELBILD.md`, M3 in `MESSENGER-KANAL-MAILBOX-MEILENSTEINE.md`

---

## Grundprinzip

Pinnwand-Nachrichten sind **offizielle Lageinformation** — sie dürfen nicht in der normalen 1:1-Liste untergehen.

---

## Ist (nach Umsetzung)

| Element | Helfer / Simple | Führung |
|---------|-----------------|---------|
| **Lagebild-Streifen** oben im 1:1 | Ja — letzte 1–3 Meldungen, Orange/Rot, Zeit, „Einsatzleitung“ | Nein (Tab genügt) |
| **Kanal-Tab** „Lagebild“ / „Pinnwand“ | Ja — volle chronologische Liste | Ja + Schreiben |
| **Technische Adressen** | Nein | Nur in Kontext-Karte (Boss) |
| **Ungelesen** | Badge am Streifen + Tab + Kategorie-Chip | Kategorie-Chip |
| **„Alle anzeigen“** | Wechsel in Lagebild-Tab | — |

---

## Soll-Backlog (noch nicht)

| Feature | Priorität |
|---------|-----------|
| Push bei neuer Pinnwand-Nachricht | Hoch (Feldtest) |
| Gelesen per Swipe / Button pro Meldung | Mittel |
| Wichtigkeit Normal / Wichtig / Dringend | Niedrig (Wire + UI) |
| Boss: Lese-Statistik (wer hat gelesen) | Mittel (on-chain schwer; lokal zuerst) |
| Eigenes Bottom-Nav-Icon „Lagebild“ | Optional — Kanal-Tab reicht vorerst |

---

## Kritik am früheren Stand

- Helfer **ohne** Pinnwand-Tab → nur Streifen war zu wenig für „volle Liste“
- Streifen in **Blau** → zu wenig Signalwirkung
- Absender als **0x-Kürzel** → zu technisch für Einsatz
- „Alle anzeigen“ öffnete nur Posteingangs-Filter, nicht den **Lagebild-Kanal**

---

## Code-Anker

| Thema | Datei |
|-------|--------|
| Rollen / Tab / Streifen | `messenger-pinnwand-capabilities.ts` |
| Labels & Zeit | `pinnwand-display.ts` |
| Streifen-UI | `chat-view-pinnwand-inbox-strip.tsx` |
| Helfer-Banner im Kanal | `chat-view-pinnwand-reader-banner.tsx` |
| Ungelesen Kategorie | `inbox-overview-unread.ts` |
