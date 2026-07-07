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
- [ ] **Oder Root:** **`npm run smoke:standalone-desk`** (führt H.15-Tests + druckt §0/§A–C Hinweise).
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
| V5 | **Team-Broadcast (verschl. Gruppe):** Handoff enthält `teamBroadcastKeys` in `.morgendrot-handoff-extras.json` (Passwort-ZIP: mitverschlüsselt). Optional 4c+ Gruppen-Send testen. |

---

## A — Ein Gerät: Bootstrap + Klartext (4b)

**Gerät A** — Profil 1

| ID | Schritt | Erwartung | PASS / FAIL / N/A | Notiz |
|----|---------|-----------|-------------------|-------|
| **4b** | Handoff-ZIP → **Handoff übernehmen** (Standalone) | Dashboard-Karte Schritt 1/2; kein API-Fehler | | |
| **4b** | Dialog **Seed einrichten?** → QR oder Mnemonic | Wallet aktiv; Absender-Adresse in Status | | |
| **4b** | App neu starten (kalt) | Handoff + Seed bleiben; optional App-Passwort-Entsperren | | |
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

## Anhang — Ausführliche Vorbereitung (APK + 2× Handoff)

### Was du brauchst

| Was | Warum |
|-----|--------|
| **Windows-PC** mit Repo + Node | APK bauen; Handoff-ZIPs erzeugen |
| **1–2 Android-Geräte** (oder 1 Gerät + später zweites) | 4b–4d: 1 Gerät; 4e–4f: **2 Geräte** mit **verschiedenen Wallets** |
| **WLAN mit Internet** | Fullnode (IOTA RPC) muss vom Handy erreichbar sein |
| **Optional USB-Kabel** | APK installieren per `adb` |
| **Zwei Wallets auf Testnet** | Jede Handoff-ZIP ist für **ein** Handy — aber **zwei verschiedene 0x-Adressen** zum Chatten |

**Nicht in der ZIP:** Seed/Mnemonic/Passwort — das trägst du **nur auf dem jeweiligen Handy** im Puls ein (nach Tresor-Unlock).

---

### Teil 1 — APK erstellen oder holen

**Einmal am PC** (im Ordner `morgendrot`):

```powershell
cd C:\Users\damast\Desktop\morgendrot\frontend
npm run apk:debug:build
```

Dauer: einige Minuten (Next-Build + Gradle). Erfolg, wenn am Ende `BUILD SUCCESSFUL` steht.

**APK-Datei:**

`C:\Users\damast\Desktop\morgendrot\frontend\android\app\build\outputs\apk\debug\app-debug.apk`

**Auf das Handy bringen** (eine Option reicht):

1. **USB + adb:** `adb install -r app-debug.apk` (USB-Debugging an)
2. **Datei teilen:** APK per E-Mail, Drive, Telegram an dich selbst → auf dem Handy öffnen → installieren („Unbekannte Quellen“ erlauben)
3. **Android Studio:** Gerät verbinden → Run (optional)

**Hinweis:** Nach jedem **Code-Update** APK **neu bauen** und auf **allen** Testgeräten **dieselbe** APK installieren (gleicher Commit).

---

### Teil 2 — Was sind die „2 Handoffs“?

Zwei **kleine ZIP-Dateien** (~3 KB), die **öffentliche** Einsatz-Daten enthalten:

- Fullnode-URL (`RPC_URL` / Direkt-RPC)
- `PACKAGE_ID`, `MAILBOX_ID`, Team-Mailboxen
- Partner-Adressen (Telefonbuch-Hints)
- Rolle, Transport, Capabilities

**Jede ZIP = ein Handy / ein Helfer-Profil.**  
Für Peering brauchst du **zwei verschiedene IOTA-Wallet-Adressen** (Gerät A und Gerät B), die sich gegenseitig als Partner kennen.

| ZIP | Gerät | Inhalt (gedanklich) |
|-----|--------|---------------------|
| **`handoff-geraet-a.zip`** | Handy 1 | Netzwerk + Package + Partner **B** vormerken |
| **`handoff-geraet-b.zip`** | Handy 2 | **Gleiches** Package/RPC, Partner **A** vormerken |

**Wichtig:** Beide ZIPs vom **selben** Boss-Einsatz (gleiche `PACKAGE_ID`, gleiche Mailbox-IDs) — nur **Bezeichnung** und **Partner-Checkboxen** unterscheiden sich.

---

### Teil 3 — Handoff-ZIPs am Boss-PC erzeugen

Dafür muss der **Morgendrot-Server kurz laufen** (nur zum Export — **nicht** während des echten Standalone-Tests auf dem Handy).

#### 3.1 Server starten

Im **Repo-Root** `morgendrot`:

```powershell
npm run dev:lan
```

Warten, bis API und Next laufen (Ports **3342** und **3341**).  
Im Browser am PC: **http://127.0.0.1:3341** — Messenger öffnen, **Tresor entsperren** (Boss-Wallet).

#### 3.2 Erste ZIP — Gerät A

1. **Einsatzleitung** (Kachel/Bereich Boss) → Abschnitt **„Export-Assistent“**  
   (Alternativ: Boss-Ansicht / Dashboard → Verweis Export-Assistent — siehe UI.)
2. **Bezeichnung:** z. B. `Smoke Gerät A`
3. **Profil:** z. B. **Helfer**
4. **Schritt 2:** Unter **Partner im Einsatz** die **0x-Adresse von Wallet B** anhaken (die du auf Gerät 2 nutzen wirst). Wenn B noch nicht existiert: Adresse aus zweitem Test-Wallet notieren oder erst ZIP B exportieren und Adresse aus Vorschau kopieren.
5. **Team-Postfach** anhaken (primäre Mailbox), falls vorgesehen.
6. **Experte (optional):** `NEXT_PUBLIC_DIRECT_IOTA_RPC_URL` / RPC = eure Testnet-Fullnode (muss vom Handy erreichbar sein).
7. **ZIP-Paket herunterladen** → speichern als `handoff-geraet-a.zip`

Die ZIP enthält u. a. `morgendrot-standalone-handoff.env` und `README-HANDOFF.txt` — **kein** Seed.

#### 3.3 Zweite ZIP — Gerät B

Gleicher Ablauf, aber:

- **Bezeichnung:** `Smoke Gerät B`
- **Partner:** **0x-Adresse von Wallet A** anhaken
- Download → `handoff-geraet-b.zip`

#### 3.4 Server wieder stoppen (für Standalone-Test)

```powershell
npm run dev:stop
```

(Oder Terminal mit `dev:lan` beenden.)  
Solange der PC-Server läuft und in der APK eine **Basis-URL** steht, testet ihr versehentlich **Relay** statt **Standalone**.

**Referenz:** `docs/EXPORT-ASSISTENT-REFERENZ.md`, `docs/HANDOFF-IMPORT-UX.md`

---

### Teil 4 — APK auf den Geräten einrichten (vor 4b)

**Pro Handy:**

1. App **Morgendrot Messenger** installieren (siehe Teil 1).
2. App öffnen → **Tresor entsperren** mit **dem Seed dieses Geräts** (Wallet A auf Handy 1, Wallet B auf Handy 2 — **nicht** dieselbe Mnemonic auf beiden, wenn ihr Peering testen wollt).
3. **Einstellungen** (Zahnrad / Einstellungen-Kachel).
4. **Basis-URL (APK / Gerät):** Feld **leer** lassen oder **Zurücksetzen** — für Standalone-Test **keine** `http://192.168.x.x:3342` eintragen.
5. Nach unten: **Handoff importieren**
6. ZIP wählen (`handoff-geraet-a.zip` auf Handy 1, `handoff-geraet-b.zip` auf Handy 2).
7. Vorschau lesen → **„Lokal vormerken (ohne Basis)“** tippen (**nicht** „Import bestätigen“, solange kein Server läuft).
8. Meldung abwarten → App **komplett schließen** (aus Recents wischen) → **neu starten**.

---

### Teil 5 — Puls auf dem Handy vollständig machen (für 4b)

**Nachrichten** → aufklappen **„Mailbox · Direkt-RPC · Streams-Puls“**:

| # | Einstellung | Aktion |
|---|-------------|--------|
| 1 | IOTA-Sendeweg | **Direkt** (nicht „Nur Morgendrot-API“) |
| 2 | Fullnode-URL | Aus Handoff oder eintragen → **speichern** (Feld verlassen) |
| 3 | Package / Mailbox / Absender | Aus Handoff übernehmen oder prüfen → speichern |
| 4 | Mnemonic / Session-Signer | **Anwenden** (nur RAM — Test-Seed, nicht produktiv) |
| 5 | Direkt-Mailbox-Drain | **An** |
| 6 | Chat-ECDH-JWK | Für 4c: JWK **anwenden** (später) |

**Dashboard:** Offline-Karte soll **nicht** mehr „Direkt: X offen“ mit langer Bullet-Liste zeigen.

Dann weiter mit **Phase A** (4b) in der Checkliste oben.

---

### Kurz-FAQ

| Frage | Antwort |
|-------|---------|
| Reicht eine Handoff-ZIP für zwei Handys? | **Nein** für 4e — zwei Geräte, zwei ZIPs (Partner kreuzen). Für nur 4b auf einem Gerät: **eine** ZIP reicht. |
| Muss der PC während des Tests laufen? | **Nein** für 4b–4f Standalone. Nur **Internet** für Fullnode. |
| Gleiche APK auf beiden Handys? | **Ja**, gleicher Build. |
| Gleicher Seed auf beiden Handys? | **Nein** für Peering — sonst keine echte Zwei-Partner-Kommunikation. |
| Was ist „Puls“? | Technik-Panel im Chat: Direkt-RPC, IDs, Signer, ECDH — siehe `MESSENGER-CHAT-HANDBUCH.md`. |

---

*Stand: 2026-06-02 — fokussierte Abnahme nach Code-Stand Standalone B.1–B.5 + Purge + Event-Inbox.*
