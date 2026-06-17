# Ideen-Backlog (nicht umgesetzt)

Kurznotizen für spätere Phasen — **kein** Implementierungsversprechen.

---

## Telegram: verschlüsselter Overlay-Transport (IOTA-Handshake + Payload über Telegram)

**Idee:** Session-Key wie heute über IOTA-Mailbox (`/handshake`, `/connect`); verschlüsselte Blobs (`MORG_TG_V1|…`) nur als Zustell-Hülle über Telegram Bot/Relay.

**Warum nur Backlog:** Telegram ist bei Morgendrot **Hinweis-Kanal** (Klartext, kein Chain-Archiv). Overlay erhöht Krypto-, Replay- und TOS-Risiko; Primärweg bleibt Mesh/IOTA.

**Vorbedingung:** Feldtest zeigt, dass Klartext-Notify nicht reicht.

**Siehe auch:** `docs/TELEGRAM-INTEGRATION-ZIELBILD.md`, Bewertung im Chat 2026-06.

---

## Pinnwand: Push, Wichtigkeit, Lese-Statistik

- Push bei neuer Lagebild-Meldung
- Stufen Normal / Wichtig / Dringend
- Boss: wer hat gelesen (lokal zuerst, on-chain später)

**Siehe:** `docs/PINNWAND-ANZEIGE-ZIELBILD.md`

---

## Team-Member-Update & Einstiegs-Wizard (Einsatz)

**Spec:** `docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md` · Roadmap **§ H.36**

Geführter Erststart + spontaner Helfer-Beitritt mit boss-signiertem Update und Empfänger-Bestätigung. Transport: IOTA speichert, LAN liefert schnell (wenn Boss erreichbar). **Nicht** Ad-hoc/BLE.

**Siehe auch:** `docs/HANDOFF-UND-MODUS-ZIELBILD.md` (Wanderer außerhalb), `docs/ROADMAP-FAHRPLAN.md` § H.16 (Boss-LAN Ist)
