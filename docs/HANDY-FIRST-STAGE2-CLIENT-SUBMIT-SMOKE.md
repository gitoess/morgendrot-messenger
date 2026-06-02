# H.15 Stufe 2 — Kontrollierter Client-Submit (Smoke / Feldprotokoll)

**Zweck:** Erfolgskriterium aus **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** § 4 Stufe **2** — ergänzt **`docs/TRANSPORT-AND-IOTA-LAYERS.md`** (Online-IOTA; LoRa→Tangle = Delayed Upload / Pfad 4, nicht volle TX über Funk). — ein **nachvollziehbarer** Ablauf: **Browser** → **`@morgendrot/core`** (PTB + Signatur) → **IOTA-RPC**; Node-`/api`-Pfad bleibt Fallback für verschlüsselte Outbox und Relais. **Zentral:** **`frontend/frontend/lib/mailbox-send-hybrid.ts`** (`sendPlaintextMailboxHybrid` / `sendEncryptedMailboxHybrid`) — gleiche Reihenfolge für Composer, SOS-Mailbox, Spiegel, Mirror-/Drain-Hintergrund (Composer-**Delayed-Mirror**-UI entfernt 2026-04-20), LUMA+CHROMA **nur online mit Verschlüsselung** oder **Funk mit Pfad 4 (Klartext)** (Fahrplan Nachtrag 2026-04-20), Einsatzprotokoll-Anker, **Attestation-Manifest-Anker** (`attestation-manifest-anchor.ts` → Klartext an eigene Adresse, **ohne** Mailbox-Offline-Outbox).

**Verwandt:** **`docs/PWA-HANDBUCH-OFFLINE.md`** (Sendeweg § 5), **`TESTING.md`** (Smoke, Merge-Ritual), **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8 (Outbox vs. andere Queues), **`docs/HANDY-TEST-WINDOW.md`** (wann Gerätetest), **`docs/TEST-RUN-LOGBOOK.md`** (letzte dokumentierte Läufe), **`docs/HANDY-LATER-MANUAL-TESTS.md`** (gebündelte manuelle Runde: § 9/§ 10/Handoff/H.15 § 2), **`docs/ROADMAP-FAHRPLAN.md`** (Nachtrag **2026-05-21** — Rollen **`deploymentProfile`**, **§ H.27** Handshake-Badge; **§ H.25a** LoRa-Bild Code-Ist, Feldtest offen).

**Nachtrag 2026-05-21 (Move-Deploy + Rollen):** Nach **`npm run deploy:move-package`** und **`create_globals`** neue **`PACKAGE_ID`** in `.env` — **`create_team_mailbox`** on-chain verfügbar. Backend neu starten. Rollen-Retest: Team-Mailbox erstellen (Kommandant/Boss), Handshake-Badge.

**Nachtrag 2026-05-21 (Schreibtisch vor Feldtest):** Nach **`deploymentProfile`/Team-Gate** und **Handshake-UX** (Badge/Toast) zusätzlich prüfen: Posteingang zeigt Handshake-Banner bei offener Anfrage; **Team-Mailbox erstellen** nur bei Einsatz-Kommandant/Boss sichtbar; Boss: **Einsatz-Profil** unter Posteingang (ausklappbar).

---

## 0. Automatisierte Mindestabdeckung

- **Schnell (Repo-Root):** **`npm run test:h15-direct-submit`** — Plain-Submit, Fehlertexte, Ketten-Snapshot, **Peering-Snapshot**, Hybrid-Merge, Chat-Kopf-Badge (**24** Tests).
- **Voll im Ordner `frontend/`:** **`npm run test:unit`** — gesamter Vitest-Lauf inkl. dieser Datei.
- **Schreibtisch (ohne Browser, 2026-03-28):** Root **`npm run test:smoke`** (36 Modulgruppen) + **`test:h15-direct-submit`** dokumentiert in **`docs/TEST-RUN-LOGBOOK.md`** — ersetzt **nicht** § 2 (Testnet / Puls / Basis aus).
- **Nach grünem PWA-Schreibtisch-Check** (`npm run check:pwa-desk:full`, Fahrplan **§ H.2**): laut **`docs/ROADMAP-FAHRPLAN.md`** **§ C.0b** als Nächstes **§ H.1a** und am Gerät **L1–L5** — **§ 2** dieses Dokuments **danach**, wenn **`docs/HANDY-TEST-WINDOW.md`** passt.

**Letzter automatisierter Lauf (Schreibtisch):** **2026-05-28** — **`npm run test:h15-direct-submit`** (**24** Tests, inkl. B.2 Peering-Snapshot) grün; Eintrag **`docs/TEST-RUN-LOGBOOK.md`**. § 2 weiter **manuell** (**`docs/HANDY-LATER-MANUAL-TESTS.md`** § D).

**Nachtrag 2026-05-28 (Phase 2 + B.1 + B.2 + H.16):** Posteingang/Handshake-RPC; Peering-QR; **Handshake senden + Connect (Partner)** per Fullnode (`connect-hybrid`); Einsatz-Connect (.env) weiter API. Manuelles: **`docs/HANDY-LATER-MANUAL-TESTS.md`** § D/E.

**Nachtrag 2026-06-02 (Autarkie-Bootstrap, Code):** Ketten-IDs einzeln in `localStorage` (Blur im Puls); `getDirectChainIdsReadiness()` für Posteingang + Autarkie-Checkliste; Autarkie-Zeile auf der Offline-Statuskarte. § 2 Smoke weiter manuell.

---

## 1. Voraussetzungen (Testnet / Dev)

| # | Bedingung |
|---|-----------|
| 1 | **`npm run dev`** (API **3342** + Next **3341**), Tresor entsperrt, **`GET /api/status`** zeigt für **Direkt-Klartext** passende Flags (Mailbox-Klartext **ohne** Messenger-Credits-Sperre — siehe Chat-/Puls-Hinweise und **`canUseDirectPlaintextMailboxDrain`**). Bei Port-Kollision zuerst **`npm run dev:stop`**, dann erneut **`npm run dev`**. |
| 2 | In **Chat → Puls:** **IOTA-Sendeweg** = **Direkt (Standard)** (nicht „Nur Morgendrot-API“). |
| 3 | **Fullnode-URL** gesetzt (`NEXT_PUBLIC_DIRECT_IOTA_RPC_URL` oder in Puls **URL speichern**); **Erreichbarkeit prüfen** = OK. |
| 4 | **Ketten-IDs** vorhanden (aus Basis **`/api/current-ids`** übernehmen oder manuell in Puls persistieren): Package, Mailbox, Absender = Session-Signer-Adresse. |
| 5 | **Session-Signer:** Mnemonic/Secret in Puls **anwenden** (nur RAM; kein Screenshot in Support-Tickets). |
| 6 | **Direkt-Mailbox-Drain (Klartext)** = **an**. |
| 7 | Optional: **`localStorage`** **`morgendrot.offlineMailboxQueue`** = **`1`**, um fehlgeschlagene Sends in die Outbox zu legen — Drain testet dann denselben Pfad wie der Chat. |

---

## 2. Protokoll (manuell, abhaken)

1. [ ] **Sicherheit:** Mnemonic nur in vertrauenswürdiger Umgebung; nach Test **Signer löschen** in Puls.
2. [ ] Chat: Transport **Online**, Empfänger gültig, **Klartext**-Nachricht (kurzer Text, eindeutiger Inhalt).
3. [ ] Senden — **Erwartung:** Erfolg **oder** verständliche Fehlermeldung (Gas, Flags, Adresse). Bei Erfolg optional Digest/Explorer prüfen. **Ist (Hybrid Live):** Der Composer nutzt **dieselbe** Reihenfolge wie die Mailbox-Warteschlange — **Direct-IOTA zuerst**, bei Fehler **`/api`** (`sendMessage` / `sendEncryptedMessageWithTimeout`) — **`use-chat-view-handle-send.ts`**; Chat-Kopf zeigt **„Direkt-RPC aktiv“** / **„über Relay“** (`getDirectIotaPathUiState`).
4. [ ] Basis kurz **stoppen** (`npm start` beenden): mit aktivem Drain und gültigem RPC soll **Outbox-Drain** (bzw. verzögerter Spiegel) **Klartext** weiterhin über **Direkt-RPC** versuchen — nicht über `/api` (solange Modus Direkt und Drain an).
5. [ ] Modus auf **Nur Morgendrot-API** stellen: erneuter Klartext-Versuch darf **nicht** still per RPC gehen — Nutzerhinweis / HTTP-Pfad, sobald Basis wieder da.
6. [ ] **`npm run test:unit`** im Ordner **`frontend/`** ausgeführt (grün).
7. [ ] **Verschlüsselt + online (gleicher Ablauf):** privater Chat, Handshake vorhanden, Transport **online**, Verschlüsselung **an**; erst mit Basis/Internet aus senden (erwartbar Fehler/Queue), dann wieder online und Retry/Drain prüfen.
8. [ ] **Pfad 4 Recovery (Funk + eigene Verankerung):** LoRa-Klartext ging raus, Mailbox/IOTA wurde nach Netzrueckkehr automatisch oder per manuellem Refresh nachgezogen (Opt-in Queue: **`morgendrot.offlineMailboxQueue=1`**).

**Status 2026-04-21 (Single-Messenger, Einmaltests):** Punkte 7/8 sowie die zugehörigen Stabilitätsprüfungen (Outbox-Transportlabel, Queue-Einzellöschung, Protokoll-Dialog bei „Vollbericht zu groß“, Online-Adress-Guard) wurden jeweils einmal erfolgreich durchlaufen; offene 2-Client-Interop-Tests bleiben separat im Fahrplan.

---

## 3. Nicht-Ziele dieses Protokolls

- Kein **Ersatz** für **`npm run test:messages`** / Chain-Realworld (Server-Session, verschlüsselte Pfade).
- Kein **Proof** für Multi-Gerät-Konflikte — siehe **§ H.12** / **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**.

---

## 4. Runtime-vs-.env Smoke (Admin-UI / Migration)

**Ziel:** Sichtbar und reproduzierbar pruefen, dass Runtime-Overrides korrekt greifen und nach Neustart bestehen.

| # | Check | Erwartung |
|---|-------|-----------|
| 1 | **Initial-Check:** App starten, **ConfigView** oeffnen, relevante Keys ansehen (`SIGNER`, `WALLET_DERIVATION_PATH`, `USE_MAILBOX`, `MAILBOX_STORE_PLAINTEXT`, `ENABLE_PLAINTEXT_CHANNEL`). | Ohne gesetzte Runtime-Overrides zeigen diese Keys Label **`.env`**. |
| 2 | **Runtime-Override:** Einen Key in der UI setzen (empfohlen: `SIGNER=sdk` oder Bool-Flag wie `USE_MAILBOX=true`) und danach **Aktualisieren**. | Label wechselt auf **`Runtime`**; Wert bleibt in der Zeile sichtbar; `GET /api/status` liefert den Key in `runtimeConfigKeys`. |
| 3 | **Persistenz-Check:** Backend neu starten (oder Seite + Backend neu laden), dann ConfigView erneut oeffnen. | Runtime-Wert bleibt erhalten (Datei **`.morgendrot-runtime-config.json`**), Label bleibt **`Runtime`**. |
| 4 | **Rueckbau-Check:** Runtime-Key in der UI auf leer (bei String) oder Standard zuruecksetzen und erneut laden. | Label faellt auf **`.env`** zurueck, falls kein Runtime-Override mehr aktiv ist. |

**Hinweis fuer Betrieb:** Diese Checks sind Pflicht nach Aenderungen am Runtime-Konfig-Pfad, damit Deploy-Defaults (`.env`) und Live-Overrides nicht verwechselt werden.

---

## 5. Anhang: **Stufe 4** — Direkt vs. Morgendrot-Relay im Ritual

**Zielbild:** **Direkt** bleibt Default; **Relay** = nur **`/api`**, sobald die Basis da ist — siehe **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** Stufe **4**.

| # | Check (Release / größerer Messenger-PR) |
|---|----------------------------------------|
| 1 | **`npm run test:h15-direct-submit`** (Root) **grün**. |
| 2 | **Puls:** Modus **Direkt** → Stufe **2** § 2 Schritte **1–3** mindestens einmal manuell oder dokumentiert erledigt. |
| 3 | **Puls:** Modus **Nur Morgendrot-API** → Klartext **ohne** funktionierenden Fullnode-Pfad (kein stiller RPC-Submit); verschlüsselter Versand weiter über **`/api`**. |
| 4 | Vollständiges Merge-Ritual: **`TESTING.md`** § *Qualitätsritual vor Merge* (inkl. **`test:unit`** / **`test:core`** bei Core-Änderungen). |

---

## 6. Simple Mode & UI-Gates (Helfer / `UI_VARIANT=messenger`)

**Zweck:** Stufe **2** prüft **Direkt-IOTA im Browser** — unabhängig von Funk. Für **Einsatz-Helfer** (`ROLE=arbeiter`, Handoff mit `SIMPLE_MODE=true`, `TRANSPORT_PROFILE=mesh-first`, `UI_VARIANT=messenger`) zusätzlich kurz prüfen, dass die **UI-Gates** greifen (**`getMessengerUiCapabilities`**, **`docs/TRANSPORT-AND-IOTA-LAYERS.md`**). Schreibtisch: **`npm run dev:role:arbeiter`** — Protokoll auch in **`docs/TEST-ROLLE-PROFILES.md`** (Abschnitt *Simple Mode & UI-Gates*).

| # | Check | Erwartung |
|---|--------|-----------|
| 1 | Dashboard-Start (Tresor offen) | **Kein** Action Center (Tickets/Keys/Heartbeat). Kacheln **Nachrichten** + **Tresor** sichtbar — nicht nur Link „Nachrichten & Tresor“. |
| 2 | `GET /api/status` | `simpleMode: true`, `uiMode: simple`, `transportProfile: mesh-first`, `iotaTransportUiEnabled: false`. |
| 3 | Chat-Kopf Sendepfad | **funk** + **online**; **kein** **adhoc** (adhoc = künftiges BLE-Direct, ≠ Web-BT zum Heltec). Default: **funk**. |
| 4 | Chat Simple | Kein Package-ID-Banner; Posteingang **ohne** Filter „Nur IOTA“; Menü Nachrichtenverlauf **ohne** Verankern/Tangle/Relay-Blöcke. |
| 5 | Einstellungen | Kein Block **„Direkt-RPC · IDs · Funk“** (Pulse-Expert) — optional **IOTA auf diesem Gerät** bleibt. |
| 6 | IOTA-Sendeweg (wenn testbar) | Boss/Kommandant oder temporär `iota-anchored`: Stufe **2** § 2 wie bisher; Helfer nutzt Feld primär **Funk** + optional **Pfad 4** (§ 2 Punkt 8). |

**Nicht-Ziel:** Delayed LoRa→IOTA-MVP — **Phase B** Backlog (**`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**). Pfad **4** (eigene Mailbox nach Funk) bleibt separater Smoke-Punkt § 2.8.

---

## 7. Vor dem Feldtest (Stufe 2 — technische Vorprüfung)

- Root: **`npm run test:smoke`**; bei Änderungen unter **`frontend/frontend/`** zusätzlich **`npm run test:frontend-unit`**.
- Schnell nur H.15-Direkt: **`npm run test:h15-direct-submit`**.

---

## 8. Offline-Stand (Nachtrag 2026-05-28)

- **Status/Kontakte/Posteingang:** Bei Ausfall der Basis werden zuletzt bekannte Daten aus lokalem Cache genutzt (TTL aktuell **30 Min.**). UI kennzeichnet den Cache-Modus sichtbar.
- **Inbox-Hinweis im Offline-Fall:** Nutzer sieht klar, dass Live-Refresh nicht moeglich ist und jetzt primär **LoRa/Funk** weiter nutzbar bleibt.
- **Queue-Status:** Wartende Sends zeigen differenziert **queued / retrying / backoff** inkl. Zeit fuer den naechsten Versuch.
- **Handoff-Import:** ZIP-Parsing/Entschluesselung + lokale Vorschau funktionieren auch ohne Basis; **lokales Vormerken** als Offline-Fallback. Nach Reconnect: Hinweis in **Einstellungen → Handoff importieren** und **Import bestätigen** (persistent auf der Basis).
- **Lokal-vorgemerkt sichtbar:** Dashboard/Einstellungen markieren jetzt explizit, wenn ein Handoff nur lokal vorgemerkt ist (Basis-Apply noch offen).
- **Capacitor-Readiness (Update):** Native Basis wurde aktiviert (`@capacitor/cli`, `@capacitor/android`, `capacitor.config.ts`, `frontend/android/`, `cap sync android` gruen). Toolchain lokal funktionsfaehig: `assembleDebug` laeuft erfolgreich.

## 9. Offline->Reconnect Betriebsritual (neu, verpflichtend vor Feldtest)

Ziel: reproduzierbar pruefen, dass der Wechsel **offline/cache -> online** sichtbar ist und der Sofort-Refresh greift.

1. [ ] **Online-Start:** App normal starten, Dashboard + Chat + Einstellungen offen; `OfflineStatusCard` zeigt **online**.
2. [ ] **Basis trennen:** Backend kurz stoppen oder Proxy unterbrechen, dann in Chat **Neu laden** ausloesen.
3. [ ] **Cache-Sichtbarkeit:** Erwartung in UI:
   - Banner/Hinweis auf **Cache-Modus** mit Alter („letzter Stand vor X Min.“),
   - Inbox-Hinweis: Live-Refresh nicht moeglich, LoRa/Funk weiter nutzbar.
4. [ ] **Reconnect:** Backend wieder starten, ohne manuellen Hard-Reload der Seite.
5. [ ] **Sofort-Refresh:** Erwartung in UI:
   - Status wechselt von **cache/offline** zurueck auf **online**,
   - Posteingang und Kontakte ziehen zeitnah nach (ohne auf langes Poll-Intervall zu warten),
   - Cache-Hinweise verschwinden wieder oder werden als aktuell markiert.
6. [ ] **Queue-Konsistenz:** Falls wartende Sends existieren, Status bleibt nachvollziehbar (`queued`/`retrying`/`backoff`) und springt nicht auf leer ohne Grund.
   - Vorbereitung: In der Offline-Statuskarte **„Queue-Opt-in aktivieren“** (oder `localStorage.setItem('morgendrot.offlineMailboxQueue','1')`), dann bei gestoppter Basis senden, damit mindestens ein wartender Eintrag entsteht. Nach Reconnect soll der Drain ohne Hard-Reload starten.
   - Erwartung nach Reconnect: Eintrag bleibt konsistent sichtbar bis erfolgreicher Drain/Retry den Status sauber aktualisiert.

---

## 10. Android-APK Basislauf (Capacitor, reproduzierbar)

Ziel: denselben APK-Basislauf lokal wiederholen, ohne implizite IDE-Schritte.

1. [ ] **Build:** `cd frontend` und `npm run apk:debug:build` (oder einzeln `build:capacitor-web` → `cap:sync:android` → `gradlew assembleDebug`).
2. [ ] **Artefakt:** `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.
3. [ ] **PC im WLAN:** Root `npm run dev:lan` oder `npm run start:prod:lan` (API **3342**, UI **3341** auf `0.0.0.0`); Firewall TCP **3341** + **3342**.
4. [ ] **Basis-URL in der APK (Relay-Modus, optional):** Einstellungen → **Basis-URL (APK / Gerät)** — **PC-LAN-IP**, z. B. `http://192.168.0.10:3342` (**nicht** `127.0.0.1`). Nur nötig für Relay, Telegram, ffmpeg-Sprachmemo, serverseitigen Handoff-Apply.
4b. [ ] **Standalone-APK (ohne Basis, § H.15 Phase 1–2):** Handoff-ZIP → **„Lokal vormerken (ohne Basis)“** (schreibt Fullnode-URL + Ketten-IDs). Erster Start setzt Autarkie-Defaults. Puls: Mnemonic/Signer setzen. Erwartung: `GET /api/status` fällt nicht ins Leere (lokaler Handoff-Fallback), Klartext-Mailbox per **Direkt-RPC** sendbar, Funk unverändert über BLE.
4c. [ ] **Standalone verschlüsselt (§ H.15 B.3):** Persistenz **Mailbox** (APK-Default). Puls: **Chat-ECDH-JWK** anwenden (wird lokal gespeichert). Partner: Handshake/Connect per **Direkt-RPC** (Peer-Pub von Chain). Privater Chat, verschlüsselt, Online — Erwartung **Direkt-RPC**, kein `/api/send`; bei fehlendem Relay keine sinnlose API-Fehlermeldung.
4d. [ ] **Standalone Posteingang (§ H.15 B.4):** Nach Send (4b/4c) **Posteingang → Aktualisieren**. Erwartung: Zeilen von **Fullnode** (`inboxLiveSource` = rpc), kein `/api/inbox`; verschlüsselte Nachrichten lesbar wenn ECDH + Peer-Pub; bei fehlendem RPC klare Meldung statt API-Netzwerkfehler.
4e. [ ] **Standalone Peering (§ H.15 B.5):** Zwei Geräte ohne Basis — A: **Handshake senden** (Direkt-RPC). B: Posteingang zeigt Angebot (RPC), **Handshake annehmen** / Connect (Direkt-RPC, Peer-Pub lokal). Erwartung: kein `/api/handshake`, `/api/connect`, `/api/pending-handshakes`; verschlüsselter Chat danach wie 4c.
4f. [ ] **Peering-QR (§ H.16):** Gerät A: Puls → **Mein Peering-QR** (optional RPC+Package wenn `includeNetworkInQr`). B: **Peering-QR scannen** oder Text einfügen → Partner-0x + Peer-Pub lokal; optional Netzwerk aus QR bestätigen. Danach Handshake/Connect online oder direkt verschlüsselt senden wenn Material vollständig.
5. [ ] **Geräte-Smoke:** App startet; Status/Tresor oder klare Fehlermeldung; Offline-Verhalten ohne Basis prüfbar (Schritt 4b).
6. [ ] **Toolchain bei Fehlern:** `JAVA_HOME`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, `frontend/android/local.properties` (`sdk.dir`).

---

## 11. H.3o random-PSK Feldtest (Meshtastic Secondary + Kanalindex)

Ziel: Schritt **H.3o.6 (4)** praxisnah abhaken (Secondary-Channel mit random PSK, Kanalindex wirkt wie erwartet, falscher Index bricht Empfang reproduzierbar).

1. [ ] **Secondary-Kanal anlegen:** In der Meshtastic-App auf beiden Geräten denselben Secondary-Channel mit random PSK erstellen/teilen (QR/Link), ohne PSK-Secret im Morgendrot-Protokolltext zu notieren.
2. [ ] **Gruppen-Metadaten setzen:** In Morgendrot Gruppenpanel für die aktive Gruppe `channelIndex` (0-7) + optional `channelName` + `pskRef` eintragen und speichern.
3. [ ] **Composer-Expert prüfen:** Sendepfad `funk`, Expert-Eingabe Kanalindex sichtbar; leer = Geräte-Default, gesetzter Wert = gezielter Kanal.
4. [ ] **Positivtest A→B:** Kurztext von Gerät A an B über denselben Secondary-Kanal senden (Erwartung: Empfang OK).
5. [ ] **Positivtest B→A:** Kurztext von B an A senden (Erwartung: Empfang OK).
6. [ ] **Negativtest falscher Index:** Auf einem Gerät absichtlich falschen Kanalindex setzen (Erwartung: kein Empfang).
7. [ ] **Recoverytest:** Richtigen Index wieder setzen (Erwartung: Empfang wiederhergestellt).
8. [ ] **Logbook-Eintrag:** Ergebnis mit PASS/FAIL + Gerät/Firmware + kurzer Setup-Notiz in `docs/TEST-RUN-LOGBOOK.md` ergänzen.

---

*Stand: 2026-06-02 — Stufe 2; § 6 Simple-Mode-Gates; Runtime-vs-.env; Offline-Nachtrag inkl. Reconnect-Betriebsritual; § 11 H.3o random-PSK Feldtest-Template.*
