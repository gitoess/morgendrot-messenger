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
| **Kanal-Tab** „Pinnwand“ | Ja — **eigener Feed** (nur Pinnwand-Posts, orange Panel) | Ja + Schreiben + Moderation |
| **Posteingang 1:1/Gruppe** | Ohne Pinnwand-Doppelung (Chip „Alle“ filtert Brett aus) | Voller Posteingang |
| **Technische Adressen** | Nein | Moderation-Karte (autorisierte Sender) |
| **Ungelesen** | Badge am Streifen + Tab + Kategorie-Chip | Kategorie-Chip + Tab |
| **„Alle anzeigen“** | Wechsel in Lagebild-Tab (dedizierter Feed) | — |

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

- **Brett = MY_ADDRESS:** Alle Klartext-1:1-Nachrichten an die eigene 0x wurden fälschlich als Pinnwand gezählt — Fix: `messageBelongsToPinnwand` nutzt Whitelist (`BROADCAST_AUTHORIZED_SENDERS`) bzw. schließt Team-Broadcast aus.
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
| **Dedizierter Lagebild-Feed** (Kanal-Tab) | `chat-view-pinnwand-feed-panel.tsx`, `pinnwand-feed-messages.ts` |
| Moderation (Führung) | `chat-view-pinnwand-moderation-card.tsx` |
| Ungelesen Kategorie | `inbox-overview-unread.ts` |
