# Chat-Protokoll / Abstimmung (2026-03-28)

**Inhalt:** Dokumentation einer **Projektabstimmung** (nicht automatisiert aus Cursor-Logs). Dient als **Referenz**, was besprochen und welche Repo-Dokumente angelegt/aktualisiert wurden.

---

## Anliegen

1. **README aktualisieren** – Verweise auf aktuellen Fahrplan, Protokolle, Hybrid-Macro-Review.  
2. **Fahrplan abspeichern** – 8-Punkte-Liste + Status + Verknüpfung zu `PROJECT-FOCUS-AND-PRIORITIES.md`.  
3. **Chat protokollieren** – dieses Dokument.  
4. **Kritische Prüfung** des Konzepts „Hybrid-Mesh-Gateway & IOTA-Macros“ (IOTA als Kontroll-Log, Basis-Station → LoRa, Edge-Execution am Handy).

---

## Ergebnis / Artefakte

| Artefakt | Pfad |
|----------|------|
| Fahrplan (8 Punkte + Stand) | `docs/ROADMAP-FAHRPLAN.md` |
| Hybrid-Konzept-Review | `docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md` |
| README-Anpassung | `README.md` (Abschnitt Roadmap & Dokumentation) |
| Einsatzbericht (Export-Stand) | `docs/EINSATZBERICHT-EXPORT.md` (kurze Ergänzung zum ZIP-/Posteingang-Verhalten) |

---

## Kurzentscheidungen (inhaltlich)

- **Roadmap:** Zwei Ebenen – **`PROJECT-FOCUS-AND-PRIORITIES.md`** (Phasen A/B/C) bleibt die technische Leitplanke; **`ROADMAP-FAHRPLAN.md`** hält die **8-Punkte-Checkliste** und den **Ist-Stand** der Einsatz-/Export-Themen.  
- **Hybrid-Macros:** Sinnvoll als **Evolutionsrichtung**, aber **nicht** identisch mit dem aktuellen Implementierungsstand; Details und Risiken siehe Hybrid-Dokument.  
- **Export / Posteingang:** Bereits im Code: vollständiger API-Export, Pagination, ZIP Klartext + verschlüsselte JSON-Hülle – in Doku verankert.

---

## Folge (gleicher Tag): Macro-Idee einplanen, **Reihenfolge beibehalten**

**Anliegen:** Macro-Konzept in den Fahrplan aufnehmen; **zuerst** weiter am bisherigen Plan (Phase A → B); drei Steuerungsebenen (Heltec, PWA, OTA-Anstoß), fünf+ Szenarien (Geofence, Totmann, Relay, Key-Rotation, OLED-Text), **Macro-Interpreter** – inhaltlich **prüfen und protokollieren**, was sich lohnt.

**Entscheidung:** **Ja** – **erst** Phase A/B fortsetzen (Stabilität, Kern LoRa+IOTA MVP), **Macro-Epic** als **Phase-C-/nach-B-Thema** in **`PROJECT-FOCUS-AND-PRIORITIES.md`**, Priorisierte Liste in **`docs/ROADMAP-FAHRPLAN.md`** (C/E), ausführliche Einordnung in **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`** §6–8.

**Kurz – was als sinnvoll festgehalten wurde:** Heltec-Parameter und kurze Funkbefehle (Meshtastic-First); PWA-Steuerung nach PWA-Basis; OTA nur als **Trigger + Download bei Internet**, nicht per LoRa; Geofence/Totmann/Relay/OLED/Key-Rotation jeweils mit **klaren Grenzen** (Background-Web, Ethik, Mesh-Key-Design, Firmware-APIs); **Interpreter = Whitelist**, kein `eval`.

---

## Folge: Bidirektionale Macro-Erweiterung (0x40–0xB0)

**Anliegen:** Opcodes für Wald→Netz (Events, Presence, Data-Query) und Netz→Wald (Beacon, Infrastruktur, Power, Breadcrumb, Topology), plus Technik (`api-server`, Accelerometer, Delta-Encoding, Mesh-Map).

**Ergebnis:** Ausgearbeitet in **`docs/MACRO-BIDIRECTIONAL-SPEC.md`** (Registry, Risiken, realistische Wetter/Info-Variante über **Basis-Allowlist**, **correlation_id**, Rate-Limits, Custody-Anbindung). **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`** §9 verweist darauf.

**Reihenfolge-Empfehlung:** **Weiter am Fahrplan** (Phase A → B). Bidirektionales Macro-Paket **nach** stabiler Basis und nach erster **Interpreter-/Gateway-**Grundlage umsetzen – siehe Spez §6.

---

## Folge: `.env` per `postinstall`, SIGNER-Hinweis, Boss-Adressen (2026-03-28)

**Anliegen:** Kein manuelles „`.env.example` → `.env` kopieren“; Kommentar bei **SIGNER** für PWA/Android; README/Doku; Klarstellung: **Boss legt Geräte-Adressen an** (eigene `MY_ADDRESS` pro Gerät), nicht dieselbe Adresse wie der Boss.

**Ergebnis:**

| Artefakt | Inhalt |
|----------|--------|
| `scripts/ensure-env.mjs` | Legt `.env` aus `.env.example` an, nur wenn `.env` fehlt. |
| `package.json` | `postinstall` → `node scripts/ensure-env.mjs`. |
| `.env.example` | Kommentare zu Boss-provisionierten Adressen + **PWA/Android → SIGNER=sdk**. |
| `README.md` | `postinstall`, portable/prepare, Rollen-Absatz (Boss erzeugt Geräte-Adressen), §2 Konfiguration, PC2-Schritt 3. |
| `docs/CONFIG-REFERENCE.md`, `docs/ENV-ERKLAERUNG.md` | SIGNER / erste `.env` ergänzt. |

---

## Folge: Standalone-Smartphone-Bundle, Einsatz-Abgabe, Fahrplan **H.7** (2026-03-28)

**Anliegen:** Bundle soll **vollständige** `.env`-Vorlage + automatische **`.env`** nach `npm install` bieten (wie Hauptrepo). Protokoll: **Boss → Medium → Helfer** (Tester/Käufer). README/Fahrplan konsistent halten.

**Ergebnis (technisch):**

| Artefakt | Inhalt |
|----------|--------|
| `scripts/bundle-standalone-smartphone.ts` | Schreibt **`.env.example`** = komplette `/.env.example` des Hauptrepos + **PWA-Override-Block** am Ende; kopiert **`scripts/ensure-env.mjs`**; **`postinstall`** im Bundle-`package.json`. |
| `exports/morgendrot-standalone-smartphone/` | Wird beim Bündeln erzeugt (Ordner oft **gitignored**); Nutzer: `npm run bundle:standalone-smartphone` neu bauen. |

**Ergebnis (Prozess):**

| Schritt | Hinweis |
|---------|---------|
| Boss | Bundle bauen, **`.env`** pro Einsatz/Kunde **manuell** anpassen (RPC, Package-IDs, Partner/Boss) — **keine** Seeds auf SD/USB. **Optional:** Next **Boss-Modus → Export-Assistent** — **`POST /api/standalone-smartphone-handoff-zip`** (ZIP mit Handoff-`.env` + README, § **H.7**, **`docs/WANDERER-STANDALONE-BUNDLE.md`**). |
| Helfer | `npm install`, ggf. `npm run build:next`; **Seed/Vault-Passwort nur auf dem Gerät**. |

**Doku:** `docs/ROADMAP-FAHRPLAN.md` (**§ B** Zeile Standalone, **§ H.7**), `README.md` (Einleitung + Skripttabelle `bundle:standalone-smartphone`).

*Manuell gepflegt; bei weiteren Meilensteinen Datum oder neue Datei ergänzen.*

---

## Nachtrag (2026-03-28) – UX-Schritt, Tests, Doku

**Anliegen:** Schrittweise UX aus **`docs/UX-MESSENGER-INVENTORY.md`** / **§ H.0** umsetzen; Stabilität wahren; testen; README & Protokoll aktualisieren.

**Umgesetzt:**

| Thema | Pfad / Hinweis |
|--------|----------------|
| Wald-Check (grün/blau/rot) | `frontend/frontend/lib/chat-wald-connection.ts`, Anzeige in `chat-view-chat-header.tsx` |
| Rollenzeile im Chat | „Rolle: Wanderer/Boss/…“ unter dem Titel |
| Toast bei Basis-Wiederherstellung | `use-chat-view-api-status-poll.ts` + `sonner`, `components/app-toaster.tsx`, `app/layout.tsx` |
| Modultest | `scripts/run-tests.ts` → `computeWaldConnectionTier` |
| Doku | `docs/UX-MESSENGER-INVENTORY.md`, `README.md` (Verweis UX) |

**Tests:** `npx tsc` (Root + `frontend/`), `npm run validate:ui`, `npm run test` (Modultests).

---

## Nachtrag (2026-03-28) – Rollenwechsel im Team (Ist-Abgleich)

**Anliegen:** Narrativ prüfen: „Boss ändert `ROLE_ID` per Knopf / Trägerbild = neue Rolle / gleiche Hardware“.

**Ergebnis:**

| Thema | Kurz |
|--------|------|
| **Provisioning** | `POST /api/provision-device` setzt u. a. `ROLE_ID` in der **generierten** Geräte-`.env`; **kein** automatischer Remote-Push auf das Helfergerät — Übergabe manuell (siehe `docs/BOSS-ORIENTIERUNG.md`). |
| **`/set-role` am Boss** | Pflegt **Hierarchie-Slots** (`DEVICE_ROLES` …), **nicht** identisch mit dem **Bitfeld** auf dem Endgerät. |
| **Trägerbild** | Zielbild-Dokumentation; vollständiger Endnutzer-Flow „Vault aus JPEG“ **nicht** als überall fertiges Produkt-Feature behauptet. |
| **Gleiche Software** | **Stimmt** — Rechte/Identität aus `.env` + Vault. |

**Artefakt:** `docs/ROLLENWECHSEL-TEAM-EINSATZ.md`; Verweise in `docs/ROADMAP-FAHRPLAN.md` (§ D), `README.md`.

---

## Nachtrag (2026-03-29) – Fahrplan: Backpack, Seed-Custody, LoRa/Notfall

**Kontext:** Cursor-Session — Inhalte aus Chat in **kanonische Doku** und **Fahrplan** übernommen; **kein** neuer Produktcode für Team-/Dezentral-Modus oder Emergency-Payload.

| Thema | Artefakt / § |
|--------|----------------|
| **Feld-Architektur** (Pi/CM4 im Rucksack, Heltec, PWA, Online/Hybrid/Degraded) | `docs/ROADMAP-FAHRPLAN.md` **§ H.7b**; Querverweise `WANDERER-STANDALONE-BUNDLE`, `README` |
| **Boss speichert Worker-Seed?** Policy, Team vs. dezentral, E2E-Fußnote, Audit **ohne** Geheimnisse in Logs | `docs/BOSS-WORKER-SEED-CUSTODY.md`; `docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md` §6; Fahrplan **§ H.10b** |
| **Feinschliff** Custody-Doku | Commit `01112c8` (Tabellen, Fußnote E2E / `SECURITY-RATING`) |
| **LoRa: keine volle IOTA-TX über Funk**; Gateway + Delayed Upload | `docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`; Fahrplan **§ H.3m**; Verweise in `LORA-IOTA-DELAYED-UPLOAD-SPEC`, `NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG` |
| **Git** | Commits `2e62acf` … `6732ac5` plus Nachziehen **README/Protokoll/Snapshot** → `cf97468`; **`git push origin main`** erledigt (Remote aktualisiert). |

**Merge-Ritual / CI:** Unverändert — **`TESTING.md`** § *Qualitätsritual vor Merge*, **`.github/workflows/frontend-checks.yml`**. Die genannten Commits betrafen überwiegend **`docs/`**; vor nächsten **Code**-Änderungen an Messenger/LoRa Ritual vollständig ausführen.

**README / Snapshot:** Eintragspunkt 6 + *Roadmap & Sitzungsprotokolle* um **§ H.10b**, **§ H.3m**, **§ H.7b** ergänzt; **`docs/OPERATIONS-SNAPSHOT-2026-03.md`** diesen Nachtrag mitverlinkt (gleicher Commit wie Protokoll-Update).

---

## Nachtrag (2026-03-30) – Sync-Check & Offline-Mailbox-Outbox (§ H.3g 7a / H.6c)

**Kontext:** Abgleich GitHub/README/Logs/Chatverlauf mit dem Ist-Code; anschließend Doku nachgezogen.

| Thema | Kurz |
|--------|------|
| **Git** | Branch **`main`**, **`origin/main`** abgeglichen, Arbeitsbaum **sauber** (keine offenen Änderungen zum Zeitpunkt der Prüfung). |
| **Logs** | Verzeichnis **`logs/`** steht in **`.gitignore`** — nicht versioniert; lokale Laufzeitlogs separat pflegen. |
| **Offline-Mailbox-Outbox** | Opt-in **`localStorage`**-Schlüssel **`morgendrot.offlineMailboxQueue`**; Implementierung **`frontend/frontend/lib/api/offline-queue.ts`**; Drain/Status über Spiegel-Poll; Send-Panel-Banner; **`timeIsTrusted`** und monotones **`clientOutSeq`** (**§ H.6c**). |
| **Commits (Beispiel)** | `8be765d` … `03ede59` (Banner, `timeIsTrusted`, `clientOutSeq`). |

**Artefakt:** dieser Nachtrag; Verweise in **`README.md`**, **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**, **`TESTING.md`** (Protokollzeile).

---

## Nachtrag (2026-03-31) – Android: Foreground Service + minimale Sync-Ehrlichkeit (**§ H.6f**)

**Kontext:** Abstimmung „FG-Service + klare Nutzererwartung“ vs. Überkomplexität (Watchdog-/Modul-Zoo); kanonische **Mittelweg**-Doku ins Repo übernommen.

| Thema | Artefakt |
|--------|-----------|
| **Spez / Zielbild** | **`docs/ANDROID-FOREGROUND-SERVICE-MINIMAL-SYNC.md`** — OS-Ebene (nativ) vs. Mesh/Mailbox-Logik (bestehende Pfade); PWA ohne FG-Versprechen |
| **Fahrplan** | **`docs/ROADMAP-FAHRPLAN.md`** neuer Abschnitt **§ H.6f** + Verweiszeile Stand 2026-03-31; §-Tabelle **H** |
| **README / TESTING** | Einstiegspunkt 6 + Roadmap-Zeile; **`TESTING.md`** Protokoll-Absatz (manuelle Android-Checks nach Hülle) |
| **Code** | **Kein** neuer `android/`-Tree — nur Doku; Umsetzung = späterer Meilenstein (Capacitor/Kotlin o. ä.) |

**Tests (lokal):** nach Doku-Änderungen **`npm run test:smoke`** (validate:ui + Modultests, alle grün) und **`cd frontend && npm run test:unit`** (Vitest **211** Tests). **`npm run test:realworld`** ausgeführt: Prozess endete mit Exit **0**, aber einzelne Schritte **[FAIL]** wegen **IOTA CLI ↔ RPC „Client/Server api version mismatch“** (personalisiertes Ticket / AccessKey-Teil) — lokal **IOTA-CLI-Version an den RPC-Server angleichen**, dann erneut laufen lassen. **Commit:** siehe **`git log -1 --oneline`** (Nachricht beginnt mit „docs: Android FG …“).

---

## Nachtrag (2026-04-15) – Messenger-Tests, Tickets/Gate, PWA-Schreibtisch (**§ H.2**)

| Thema | Kurz |
|--------|------|
| **Messenger Realworld** | **`scripts/run-messages-chat-realworld.ts`**: `/vault-save` mit leeren Args nutzt **UI-Unlock-Sitzung** auf dem API-Prozess; **`purge-handshake`**-Log bei fehlendem **`MAILBOX_ID`** als erwartbarer Noop; Kopfkommentar + **`TESTING.md`** |
| **Tickets vs. Messenger** | **`package.json`**: **`test:tickets-accesskey-realworld`**; **`README.md`** / **`TESTING.md`** — `test:realworld` = Tickets/Keys, **`test:messages*`** = Messenger |
| **Gate / Liste** | **`src/chain-access.ts`**: **`hasValidTicket`** / **`hasValidAccessKey`** — **`normalizeAddress`**, Pagination; **`getOwnedTickets`** / **`getOwnedAccessKeys`** — normalisierte IDs |
| **Ticket-Realworld-Skript** | Retries Schritte 4/6; ECONNREFUSED-Hinweis; Kopfkommentar |
| **PWA § H.2** | **`npm run check:pwa-desk`** (A+B); Protokollzeile **`docs/PWA-MANUAL-CHECKS.md`** |
| **Fahrplan** | **`docs/ROADMAP-FAHRPLAN.md`** — Nachtragzeile + Stand **2026-04-15** |

**Tests (lokal, diese Runde):** **`npm run test:smoke`**, **`npm run test:frontend-unit`** (211), **`npm run test:messages:single`** (inkl. `/vault-save` + **hasLocal**), **`npm run check:pwa-desk`** (**§ H.2** A+B). **Commit/Push:** siehe **`git log -1 --oneline`** (Nachricht beginnt mit „feat: Messenger/ticket realworld …“).
