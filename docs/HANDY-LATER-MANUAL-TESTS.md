# Spätere manuelle Testrunde (Fahrplan-Vormerkung)

**Zweck:** Offene **manuelle** Punkte aus dem Fahrplan gebündelt — bewusst **nicht** bei jedem Code-Schritt, sondern in einer geplanten Runde (Browser + optional APK + ggf. zwei Heltecs).

**Stand:** 2026-05-28 — Code-Scheiben (Capacitor, Offline, Handoff-Reconnect, `dev:lan`, H.15 Phase 2 Fehler/Hybrid/Chat-Kopf) sind vorbereitet; diese Liste ist die **Abnahme**. **Nicht** bei jedem Code-Schritt — nur geplante Runde.

---

## Voraussetzungen (einmal pro Runde)

- [ ] PC: `npm run dev:lan` (API `0.0.0.0:3342`, UI `0.0.0.0:3341`) oder `start:prod:lan` nach Build
- [ ] Firewall: TCP **3341** + **3342** (privates Netz)
- [ ] APK (falls Gerätetest): Basis-URL = `http://<PC-LAN-IP>:3342` (**nicht** `127.0.0.1`)
- [ ] Logbuch: Ergebnisse in **`docs/TEST-RUN-LOGBOOK.md`** eintragen

---

## A — Offline/Reconnect (§ 9 in `HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`)

- [ ] Schritte 1–5: Online → Offline/Cache → Reconnect → Sofort-Refresh
- [ ] **Schritt 6 (Queue):** `Queue-Opt-in aktivieren` → Send bei gestoppter Basis → Reconnect → Status `queued`/`retrying`/`backoff` → Drain

---

## B — APK (§ 10)

- [ ] `cd frontend` → `npm run apk:debug:build` → installieren
- [ ] Einstellungen → Basis-URL (LAN) → **Verbindung testen** = OK
- [ ] Offline-Shell / Basis weg: Verhalten dokumentieren

---

## C — Handoff Basis-Apply

- [ ] Lokal vormerken → Basis trennen → Reconnect → Einstellungen → grüner Hinweis → **Import bestätigen**
- [ ] `fromLocalHandoff` verschwindet; Profil persistent auf Basis

---

## D — H.15 Stufe 2 § 2 (Browser/Testnet)

- [ ] Puls: Direkt-RPC, Ketten-IDs, Session-Signer
- [ ] Klartext-Send; Basis stop → Outbox/Direct; Modus „Nur API“
- [ ] Optional verschlüsselt + Pfad 4 (§ 2.7–8)

---

## E — Optional / Backlog (nur wenn Zeit)

- [ ] **§ H.25a** LoRa-Bild Feldtest (zwei Heltecs)
- [ ] PWA installiert: Hintergrund → Tresor-Sperre (45 s)

---

*Bei PASS/FAIL jeweils Datum + Kurznotiz ins Logbook. Automatisiert vorher: `npm run test:smoke`, `npm run test:h15-direct-submit`, `npm run test:frontend-unit`.*
