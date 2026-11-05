# Standalone-APK — Morgendrot Messenger

**Vollständiger Einsatz-Messenger** mit Boss, Handoff, Funk (LoRa), optional Telegram — als **autarke APK** ohne Pflicht-PC-Server.

**Paket-ID:** `de.morgendrot.messenger`

---

## 0. Schreibtisch

```bash
cd Desktop/morgendrot
npm run smoke:standalone-desk
```

Erwartung: `test:h15-direct-submit` grün (73+ Tests).

---

## 1. APK bauen

```bash
cd frontend
npm run apk:debug:build
```

**Ausgabe:** `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 2. Standalone-Flow (ohne Morgendrot-Server)

**Kanonische Checkliste:** [`STANDALONE-SMOKE-CHECKLIST.md`](STANDALONE-SMOKE-CHECKLIST.md)  
**Kurzstart:** [`STANDALONE-HANDY-SCHNELLSTART.md`](STANDALONE-HANDY-SCHNELLSTART.md)

| Phase | Inhalt | Geräte |
|-------|--------|--------|
| **A (4b)** | Handoff-ZIP → Seed → Klartext-Send (Direkt-RPC) | 1 |
| **B (4c–4d)** | ECDH + verschl. Send + Posteingang RPC | 1 |
| **C (4e–4f)** | Peering + QR | **2** |

**Wichtig:** Keine Basis-URL / kein `dev:lan` während Standalone-Test — sonst testet ihr Relay, nicht Autarkie.

---

## 3. Boss-APK (Handoff exportieren)

Boss exportiert Handoff-ZIP **ohne PC** nach Install der gleichen APK:

[`BOSS-APK-HANDOFF-EXPORT-CHECKLIST.md`](BOSS-APK-HANDOFF-EXPORT-CHECKLIST.md)

---

## 4. Paralleler Vergleich mit IOTA Messenger

| | **Morgendrot Messenger** | **IOTA Messenger** |
|---|---|---|
| Repo | `gitoess/morgendrot-messenger` | `gitoess/iota-messenger` |
| `applicationId` | `de.morgendrot.messenger` | `de.iota.messenger` |
| Einstieg Standalone | Handoff vom Boss | Solo-Wizard + Testnet-Starter |
| Funk / Boss / SOS | ja | nein |
| Standalone-Doku | dieses Dokument | `iota-messenger/docs/STANDALONE-APK.md` |

Beide APKs können **gleichzeitig** auf einem Handy installiert sein.

---

## 5. Gate „Standalone fertig“

| Kriterium | Code | Feldtest |
|-----------|------|----------|
| `apk:debug:build` | ✓ | APK bauen |
| `smoke:standalone-desk` | ✓ | vor jedem Feldtest |
| STANDALONE-SMOKE A–C | ✓ | **offen** (2 Geräte) |
| Logbuch-Eintrag | — | `docs/TEST-RUN-LOGBOOK.md` |

**Release-Hinweis:** Debug-APK für Feldtest — Play-Store-Signing separat.

---

## 6. Verwandte Doku

- [`HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`](HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md) §10 — Langform
- [`ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`](ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md) — Zielbild Direkt-RPC
- [`ROADMAP-FAHRPLAN.md`](ROADMAP-FAHRPLAN.md) § H.15 — Standalone-Stufen
