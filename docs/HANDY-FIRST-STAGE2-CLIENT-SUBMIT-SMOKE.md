# H.15 Stufe 2 — Kontrollierter Client-Submit (Smoke / Feldprotokoll)

**Zweck:** Erfolgskriterium aus **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** § 4 Stufe **2** — ein **nachvollziehbarer** Ablauf: **Browser** → **`@morgendrot/core`** (PTB + Signatur) → **IOTA-RPC**; Node-`/api`-Pfad bleibt Fallback für verschlüsselte Outbox und Relais. **Zentral:** **`frontend/frontend/lib/mailbox-send-hybrid.ts`** (`sendPlaintextMailboxHybrid` / `sendEncryptedMailboxHybrid`) — gleiche Reihenfolge für Composer, SOS-Mailbox, Spiegel, Mirror-/Drain-Hintergrund (Composer-**Delayed-Mirror**-UI entfernt 2026-04-20), LUMA+CHROMA **nur online mit Verschlüsselung** oder **Funk mit Pfad 4 (Klartext)** (Fahrplan Nachtrag 2026-04-20), Einsatzprotokoll-Anker, **Attestation-Manifest-Anker** (`attestation-manifest-anchor.ts` → Klartext an eigene Adresse, **ohne** Mailbox-Offline-Outbox).

**Verwandt:** **`docs/PWA-HANDBUCH-OFFLINE.md`** (Sendeweg § 5), **`TESTING.md`** (Smoke, Merge-Ritual), **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8 (Outbox vs. andere Queues), **`docs/HANDY-TEST-WINDOW.md`** (wann Gerätetest), **`docs/TEST-RUN-LOGBOOK.md`** (letzte dokumentierte Läufe), **`docs/ROADMAP-FAHRPLAN.md`** (Nachtrag **2026-05-21** — Rollen **`deploymentProfile`**, **§ H.27** Handshake-Badge; **§ H.25a** LoRa-Bild Code-Ist, Feldtest offen).

**Nachtrag 2026-05-21 (Schreibtisch vor Feldtest):** Nach **`deploymentProfile`/Team-Gate** und **Handshake-UX** (Badge/Toast) zusätzlich prüfen: Posteingang zeigt Handshake-Banner bei offener Anfrage; **Team-Mailbox erstellen** nur bei Einsatz-Kommandant/Boss sichtbar.

---

## 0. Automatisierte Mindestabdeckung

- **Schnell (Repo-Root):** **`npm run test:h15-direct-submit`** — nur **`frontend/frontend/lib/direct-iota-plain-submit.test.ts`** (Modus „Nur API“, Drain aus).
- **Voll im Ordner `frontend/`:** **`npm run test:unit`** — gesamter Vitest-Lauf inkl. dieser Datei.
- **Schreibtisch (ohne Browser, 2026-03-28):** Root **`npm run test:smoke`** (36 Modulgruppen) + **`test:h15-direct-submit`** dokumentiert in **`docs/TEST-RUN-LOGBOOK.md`** — ersetzt **nicht** § 2 (Testnet / Puls / Basis aus).
- **Nach grünem PWA-Schreibtisch-Check** (`npm run check:pwa-desk:full`, Fahrplan **§ H.2**): laut **`docs/ROADMAP-FAHRPLAN.md`** **§ C.0b** als Nächstes **§ H.1a** und am Gerät **L1–L5** — **§ 2** dieses Dokuments **danach**, wenn **`docs/HANDY-TEST-WINDOW.md`** passt.

**Letzter automatisierter Lauf (Merge-Ritual):** **2026-03-28** — vollständiges **`TESTING.md`** *Qualitätsritual vor Merge* (Root-`tsc` mit bekannter TS6059, Frontend-`tsc`/`lint`/`check:circular`/`test:unit`, **`test:core`**, **`test:h15-direct-submit`**, **`validate:ui`**, **`test:smoke`**) grün; Eintrag **`docs/TEST-RUN-LOGBOOK.md`**. § 2 weiter **manuell** abhaken.

---

## 1. Voraussetzungen (Testnet / Dev)

| # | Bedingung |
|---|-----------|
| 1 | **`npm run dev`** (API **3342** + Next **3341**), Tresor entsperrt, **`GET /api/status`** zeigt für **Direkt-Klartext** passende Flags (Mailbox-Klartext **ohne** Messenger-Credits-Sperre — siehe Chat-/Puls-Hinweise und **`canUseDirectPlaintextMailboxDrain`**). |
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

## 6. Vor dem Feldtest (Stufe 2 — technische Vorprüfung)

- Root: **`npm run test:smoke`**; bei Änderungen unter **`frontend/frontend/`** zusätzlich **`npm run test:frontend-unit`**.
- Schnell nur H.15-Direkt: **`npm run test:h15-direct-submit`**.

---

*Stand: 2026-05-21 — Stufe 2; Nachtrag Rollen/Handshake vor Feldtest; Runtime-vs-.env Smoke + Anhang Stufe 4.*
