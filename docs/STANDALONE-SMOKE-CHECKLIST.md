# Standalone-Smoke (fokussiert) — Variante B ohne Pflicht-Node

**Zweck:** Eine **einzige Abnahme-Runde** für **APK + Handoff + Direkt-RPC** — abgeleitet aus **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** § 10 **4b–4f**, ohne die Relay-/Boss-LAN-Schritte zu vermischen.

**Nicht dasselbe wie:** § 9 Offline/Reconnect, § 10 Schritt 4 (Basis-URL), § 2 Browser-am-PC — die brauchen einen laufenden Morgendrot-Server und stehen in **`docs/HANDY-LATER-MANUAL-TESTS.md`** (A–D). **Diese Liste nur ausführen, wenn ihr bewusst Standalone testet.**

**Quellen:** **`docs/WANDERER-STANDALONE-BUNDLE.md`** Variante B, **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** § 6 B, Roadmap **§ H.15** Stufe 2.

---

## Bewertung: Macht das Vorgehen Sinn?

| Dein Schritt | Bewertung | Verbesserung |
|--------------|-----------|--------------|
| Kurze Checkliste 4b–4f | **Ja** — sonst verliert man sich in § 2–§ 11 des Langprotokolls. | Dieses Dokument; Reihenfolge **0 → Vorbereitung → A → B → C** einhalten. |
| 2–3 reale Geräte | **Ja, aber differenziert:** **4b–4d** reicht mit **1 Gerät** (+ ggf. zweites Profil nur zum Empfang prüfen). **4e–4f** brauchen **mindestens 2 Geräte** (oder 1 Gerät + 1 zweites Profil/Wallet auf demselben Gerät nur als Notlösung). | Minimum **2 APKs**; drittes Gerät nur bei unterschiedlicher Android-Version/Firmware sinnvoll. |
| Logbook | **Ja, Pflicht** — sonst keine Release-Entscheidung. | Eine Zeile **pro Runde** + optional Tabelle unten ausfüllen. |
| Danach Feintuning vs. nächste Phase | **Ja** — mit klaren **Gates** (siehe § Entscheidung). | Nicht „alles grün“ verlangen für Funk/H.25a; nur **Standalone-Online-Kern**. |

**Häufigster Fehltest:** Basis-URL auf LAN-PC gesetzt, `dev:lan` läuft — dann testet ihr **Relay**, nicht Standalone. Für 4b–4f: **keine** Basis-URL (oder leer), PC-API **aus**, nur **Fullnode + Handoff** auf dem Gerät.

---

## 0. Schreibtisch (Blocker — vor dem Handy)

- [ ] `cd frontend` → **`npm run test:h15-direct-submit`** grün (Stand Repo; aktuell **73** Tests).
- [ ] Optional Root: **`npm run test:smoke`**.
- [ ] APK bauen: **`npm run apk:debug:build`** → `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.
- [ ] Zwei **Handoff-ZIPs** (verschiedene Profile/Adressen) vom Boss oder Test-Export — je ~3 KB, **ohne** Secrets im Chat.

**Ergebnis:** nur bei grün → Gerätetest starten.

---

## Vorbereitung (einmal pro Runde)

| # | Check |
|---|--------|
| V1 | Zwei Geräte (oder 1 Gerät + Plan für 4e mit zweitem Gerät später) mit installierter **gleicher** APK-Build (Commit notieren). |
| V2 | **WLAN mit Internet** (Fullnode erreichbar) — Morgendrot-PC **nicht** nötig, aber RPC muss antworten. |
| V3 | PC: **kein** `dev:lan` / keine erreichbare Basis-URL während 4b–4f (Flugmodus-Test optional in separater Runde). |
| V4 | Pro Gerät: Handoff-ZIP bereit; Notizblock für Digest/Fehlertexte. |

---

## A — Ein Gerät: Bootstrap + Klartext (4b)

**Gerät A** — Profil 1

| ID | Schritt | Erwartung | PASS / FAIL / N/A | Notiz |
|----|---------|-----------|-------------------|-------|
| **4b** | Handoff-ZIP → **Lokal vormerken (ohne Basis)** | Dashboard/Status: Handoff/Standalone-Hinweis, **nicht** leerer Fehler | | |
| **4b** | App neu starten (kalt) | Autarkie-/Standalone-Bootstrap; Offline-Karte **ohne** „4 offen“ nach Puls-Pflege | | |
| **4b** | Puls: Fullnode-URL, Package/Mailbox/Absender, **Mnemonic anwenden**, **Direkt-Mailbox-Drain an** | Keine orangene „Direkt: … offen“-Liste (oder leer) | | |
| **4b** | Chat: Online, Klartext an **eigene zweite Adresse** oder Partner (wenn schon da) | Erfolg; Kopf **Direkt-RPC** (nicht „über Relay“) | | |
| **4b** | Optional: Kurz LoRa/Mesh — nur „Funk startet“, kein voller Funk-Smoke | Kein Crash | | |

---

## B — Ein Gerät: Verschlüsselt + Posteingang (4c + 4d)

**Gerät A** (oder A + B, wenn Partner für Empfang schon existiert)

| ID | Schritt | Erwartung | PASS / FAIL / N/A | Notiz |
|----|---------|-----------|-------------------|-------|
| **4c** | Puls: **Chat-ECDH-JWK anwenden** (persistiert) | Gespeichert nach Neustart | | |
| **4c** | Privater Chat, verschlüsselt, Online senden | Erfolg **ohne** `/api/send`; bei totem Relay **kein** irreführender API-Fehler als einzige Meldung | | |
| **4d** | Posteingang → **Aktualisieren** | Nachricht sichtbar; Quelle **RPC** (nicht nur leerer Cache); verschlüsselt lesbar wenn ECDH passt | | |
| **4d** | Optional: Nachricht **Auf Chain löschen** (nur `chainPurgeable`) | Purge über Direkt oder klare Fehlermeldung | | |

---

## C — Zwei Geräte: Peering + QR (4e + 4f)

**Gerät A** (Profil 1) + **Gerät B** (Profil 2) — **ohne** laufende Morgendrot-Basis

| ID | Schritt | Erwartung | PASS / FAIL / N/A | Notiz |
|----|---------|-----------|-------------------|-------|
| **4e** | A: Partner-Adresse B, **Handshake senden** | Erfolg Direkt-RPC | | |
| **4e** | B: Posteingang — Handshake-Angebot sichtbar (RPC) | **Annehmen** / Connect Direkt-RPC | | |
| **4e** | B → A: verschlüsselte Nachricht | Lesbar auf A; wieder **Direkt** | | |
| **4f** | A: Puls → **Mein Peering-QR** (`includeNetworkInQr` optional) | QR enthält Partner + Pub (+ ggf. RPC/Package) | | |
| **4f** | B: **Peering-QR scannen** (oder Text) | Partner-0x + Peer-Pub lokal; optional Netzwerk übernommen | | |
| **4f** | Danach Handshake/Connect oder direkt senden | Wie 4c ohne manuelles Abtippen der Pub | | |

---

## D — Optional (gleiche Runde, nicht Gate für Standalone-Kern)

| ID | Thema | Wann |
|----|--------|------|
| **H.6f** | APK → Basis-URL-Karte → **Android Hintergrund** an; Notification sichtbar; App in Hintergrund | Android 13+: ggf. Benachrichtigungsrecht |
| **H.25a** | LoRa-Bild 2× Heltec | **Eigene** Runde — nicht Blocker für 4b–4f |

---

## Entscheidung nach der Runde

Tragt **eine** Zeile in **`docs/TEST-RUN-LOGBOOK.md`** ein, z. B.:

```text
| **YYYY-MM-DD** | 2× Android APK, Standalone 4b–4f | Checkliste STANDALONE-SMOKE-CHECKLIST.md; Commit … | **PASS** / **FAIL** — Kurz: 4b OK, 4c … |
```

### Gate — Feintuning vs. nächste große Phase

| Ergebnis | Aktion |
|----------|--------|
| **4b + 4c + 4d PASS** und **4e PASS** (4f darf einmal **N/A** sein, wenn 4e Peering ohne QR ging) | **Standalone-Kern abgenommen** → nächste Phase (z. B. Release-Tag, H.25a-Feld, Boss-Relay-Doku, Bundle-Export) — **nicht** automatisch „gesamte Roadmap fertig“. |
| **4b oder 4c FAIL** (Senden/lesen Kern) | **Feintuning** im Code — kein neues Großfeature; Issue mit Fehlertext + Schritt-ID. |
| **4e FAIL**, 4b–4d PASS | Fokus Peering/Handshake-RPC/UI — QR (4f) kann warten. |
| Nur **H.6f / Funk** FAIL | Standalone-Chat trotzdem „go“; H.6f/Funk in separater Runde. |

**Nicht in derselben Runde mischen:** `HANDY-LATER` § A (Reconnect mit Basis), § B (Basis-URL-Test), § D (Browser am PC) — das ist **Variante A** oder Hybrid-Betrieb.

---

## Verweise

- Langprotokoll: **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** § 10 (4b–4f), § 2 (Browser)
- Gebündelt später: **`docs/HANDY-LATER-MANUAL-TESTS.md`**
- Architektur: **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** § 6 B
- Abgabe: **`docs/WANDERER-STANDALONE-BUNDLE.md`**

---

*Stand: 2026-06-02 — fokussierte Abnahme nach Code-Stand Standalone B.1–B.5 + Purge + Event-Inbox.*
