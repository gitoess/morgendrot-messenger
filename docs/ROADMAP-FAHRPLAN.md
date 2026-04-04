# Fahrplan Morgendrot (Arbeitsliste & Status)

**Zweck:** **Priorisierte** Lieferliste – nur was **Nutzen** bringt; **geringer Aufwand** oben.  
**Übergeordnet:** Phasen **A → B → C** in **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** (Meshtastic-First, kein Feature-Wildwuchs).  
**Stand:** 2026-03 (Abschnitt **H** unten: nächste Arbeitspakete fortlaufend aktualisieren).  
**Nächste konkrete Schritte:** → **§ H**.

---

## A. 8-Punkte-Liste (Checkliste)

| # | Thema | Aufwand | Stand / Hinweis (2026-03) |
|---|--------|---------|---------------------------|
| 1 | Stabilität Bild + Audio | — | Basis; bei Änderungen testen. |
| 2 | Einsatzprotokoll / Export (ZIP) | Mittel | **Erledigt:** vollständiger Posteingang, ZIP, `.zip.enc.json`, Decrypt-Seite → **`docs/EINSATZBERICHT-EXPORT.md`**. |
| 3 | Shadow-Sweep in Next-UI | Mittel | **Erledigt:** Setup-Panel (`chat-view-shadow-sweep.tsx`), POST `/api/shadow-sweep`. |
| 4 | Code-Struktur `chat-view` + Send-Flow | Hoch | Laufend (Phase A). |
| 5 | PWA-Grundlage (Manifest, SW) | Mittel–Hoch | Offen; `npm run bundle:standalone-smartphone`. |
| 6 | Fehlerbehandlung / Status | Mittel | Laufend. |
| 7 | Heltec / LoRa Firmware | Hoch | Spez-lastig (`meshtastic/`). |
| 8 | Kabel-Bridge | Hoch | Spec-nah. |

---

## B. Ergänzende Linien (Kurz)

| Thema | Status |
|--------|--------|
| Basis vs. Vortrupp-UI | Geheimnisse serverseitig an der Basis. |
| Standalone-Smartphone-Bundle | `exports/morgendrot-standalone-smartphone/`. |
| Posteingang 50 + „Weitere laden“ | Umgesetzt. |
| Opcodes / QoS | `src/shared/opcodes.ts` (`MacroOpcode`, **`MacroPriorityClass`**) – für spätere Sendewarteschlange. |
| Reticulum / **LXMF** (nur Inspiration) | Chunking/Priorität lesen, **kein** Stack-Wechsel → **`docs/LORA-LXMF-RETICULUM-INSPIRATION.md`**. |
| Doku / Policy | Hybrid, bidirektional, **TX vs. Streams §7**, LXMF-Inspiration – siehe **D.** |

---

## C. Priorisierte Reihenfolge (**was wirklich zuerst**)

### C.1 Pflichtpfad (größter Nutzen)

1. **Phase A** – Stabilität, `chat-view`-Refactor, kleine Schritte, `tsc`/Tests.  
2. **Phase B** – zuverlässiges Mesh v2, **Delayed LoRa → IOTA** (MVP laut Spec).  
3. **Phase C / Macro-Epic** – erst danach: Gateway, Interpreter, Opcodes aus Spec (kein Parallel-Bau zu B).

### C.2 Schnelle Erfolge (**wenig Aufwand**, klarer Nutzen)

| Maßnahme | Aufwand | Nutzen |
|----------|---------|--------|
| **`MacroPriorityClass`** in `opcodes.ts` bei Implementierung der Sende-/Macro-Queue nutzen | gering (API schon da) | Saubere Priorität ohne Hex-Umnummerierung. |
| **Heartbeat-Doku** für Teams: wann Streams, wann nicht (siehe **F**) | sehr gering | Weniger falsche Erwartung „Messenger = Heartbeat-Chat“. |
| **Chat-Header: „Puls an Basis“** (Streams bereit/fehlt, Heartbeat an/aus, Intervall, S-Bit-Hinweis) | umgesetzt | `chat-view-chat-header.tsx`, GET `/api/status` liefert `heartbeat` + `streams`. |
| **`/heartbeat` + Streams** nur aktivieren, wenn `STREAMS_BRIDGE_URL` + Anchor da sind (bestehend) | kein neuer Code | Boss sieht „online“ ohne neue Features. |
| **Projekt-Doku verlinken** (dieser Fahrplan + `MACRO-OPERATIONAL-PATTERNS`) | gering | Onboarding. |

### C.3 Bewusst **nicht** vor B priorisieren

- Volle **bidirektionale Macro-Pipeline** (0x40–0xB0), **Geofence/Totmann**, **OTA-DFU**, **Mesh-Map-UI** – bleiben **Backlog** (`docs/MACRO-BIDIRECTIONAL-SPEC.md`, `docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`).  
- **Remote-Voll-Purge per Makro** – siehe **G** (hohes Risiko; kein Sprint ohne Sicherheitskonzept).

---

## D. Verwandte Dateien

- **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** – Phase A/B/C.  
- **`docs/MACRO-OPERATIONAL-PATTERNS.md`** – Hop/QoS/ACK/Akku, Heartbeat/Streams.  
- **`docs/PROTOCOL-CHANNELS-TX-VS-STREAMS.md`** – TX vs. Streams vs. Audit; DID/Twin/Gas; **§7 festgeschriebene Kanal-Policy**.  
- **`docs/LORA-LXMF-RETICULUM-INSPIRATION.md`** – LXMF-Ideen vs. Luma/Chroma + Mesh-v2, ohne Reticulum-Ökosystem.  
- **`docs/MACRO-BIDIRECTIONAL-SPEC.md`** – Wald↔Netz-Opcodes.  
- **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`** – Gateway, Interpreter.  
- **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/EINSATZBERICHT-EXPORT.md`**.  
- **`docs/CHAT-PROTOKOLL-2026-03-28.md`**  
- **`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`** – vor großem Commit lesen

---

## E. Macro-Backlog (Kurzfassung)

Nach Phase-B-Kern: **Registry** (`src/shared/opcodes.ts`) → **Gateway** → **Interpreter** → einzelne Makros; Details und Szenarien nur in den verlinkten Docs pflegen, nicht alles parallel implementieren.

---

## F. Heartbeat – sinnvolle Umsetzung (**IOTA** vs. **LoRa**)

| Pfad | Wie | Wann sinnvoll |
|------|-----|----------------|
| **Streams (feeless, „Internet“)** | Bereits: **`/heartbeat`** → JSON auf **`STREAMS_ANCHOR_ID`** via Bridge (`messenger-command-handler.ts`). Braucht **S-Bit**, `STREAMS_BRIDGE_URL`, Anchor. | Basis/Boss soll **„Gerät lebt“** sehen, solange Uplink da ist. **Nicht** jede Heartbeat als Chat-Nachricht. |
| **IOTA Mailbox** | Optional später: minimaler Klartext-/Status-Tick **nur** wenn Streams nicht gewünscht; meist **teurer/schwerer** als Streams für reinen Puls. | Nur wenn strategisch nötig. |
| **LoRa / Mesh** | **Kein** Ersatz für denselben Streams-Heartbeat: anderes Medium. Sinnvoll: **seltene**, **kleine** „OK“- oder **Macro-Ping**-Nutzlaste (eigenes Konzept, Airtime) – **nach** Macro-Basis. | Wald ohne Internet: **Delayed Upload**, **Mailbox** bei Kontakt zur Basis; dedizierter LoRa-Heartbeat = **Phase Macro**, nicht MVP-Pflicht. |

**Messenger-UI:** Eher **eine** kompakte Stelle (Status / Einstellung „Puls an Basis“) als volle **Kachel** wie in der Boss-**Werkstatt**, wenn ihr Chat schlank halten wollt – siehe **`docs/MACRO-OPERATIONAL-PATTERNS.md`** §7.

---

## G. Notfall-Purge / „Purge-Button“ per Befehl – **kritisch**

### Was der Code **schon** kann

- **`/emergency-purge`** (CLI/API): Vault **on-chain** Notfall-Purge (PTB), wenn `ENABLE_PURGE` und `VAULT_REGISTRY_ID`; lokaler **Inbox-Klartext-Cache** wird geschreddert (`messenger-command-handler.ts`).  
- **`POST /api/clear-local-history`**: nur **lokaler Inbox-Cache** (`.inbox.enc`), kein vollständiger Vault-Chain-Purge.  
- **UI „Notfall“**: `VaultView` + `emergencyPurge()` – inkl. Scope-Wahl (`full` / `local_cache` / `lock_session`).

### Fern-Befehl / Makro „alles löschen“

| Aspekt | Bewertung |
|--------|-----------|
| **Wunsch** | Einsatzleitung soll Gerät aus der Ferne **wischen** (verlorenes Handy). |
| **Risiko** | **Destruktiv**, irreversibel; Spoofing/Kompromittierung der Basis → **Massenverlust**. |
| **Makro** | Erst sinnvoll mit: **signiertem** IOTA-Befehl, **Allowlist** Absender, optional **zweite Bestätigung** (Code, zeitlich begrenzt), **Audit-Log**. → **Phase Macro**, nicht „schnell nachziehen“. |
| **Geringer Aufwand / sicherer** | Gerät physisch oder **SSH/Terminal** am Node: bestehendes **`/emergency-purge`**. Boss erreicht Gerät **online** über bestehende **API**, sofern **ohnehin** vertrauenswürdig und abgesichert (nicht öffentliches Internet ohne Auth). |

**Fazit fürs Projekt:** **Nicht** als Quick-Win priorisieren. In den Fahrplan als **optionales Phase-C-Thema** mit **Security-Review**; bis dahin: **lokaler** Purge + dokumentierte **Operatoren-Prozedur**.

---

## H. Nächste Arbeitspakete (**weiter im Fahrplan**)

Ziel: **Phase A** abschließen bzw. stabil halten, dann **Phase B** starten – ohne neue Großthemen dazwischen.

### H.1 Jetzt – Phase A (Code-Qualität & Messenger-UI)

| # | Paket | Hinweis |
|---|--------|---------|
| 1 | **`chat-view`** weiter verdünnen | Nur noch Verdrahtung + Hooks; Rest siehe **`PROJECT-FOCUS-AND-PRIORITIES.md`** §2 (Liste der Module). Nach jedem Schritt **`tsc`** / relevante **`npm run test`**. |
| 2 | **Regression** Bild/Audio/LoRa-Sendepfad | Bei Änderungen an Chat/Send kurz manuell oder E2E prüfen. |
| 3 | **Exports** | Keine manuellen Edits in **`exports/Morgendrot-Messenger-*`** – Bundle aus **`src/`** / `frontend/` bauen (`MESSENGER-BUNDLE-SOURCE-OF-TRUTH`). |

### H.2 Als Nächstes – aus 8-Punkte-Liste (nach Stabilität)

| Priorität | # | Thema |
|-----------|---|--------|
| 1 | **5** | **PWA-Grundlage** (Manifest, Service Worker), ggf. mit `bundle:standalone-smartphone` abstimmen. |
| 2 | **6** | Fehlermeldungen/Status konsistent (laufend). |
| 3 | **8** | **Kabel-Bridge** (hoch, spec-nah) – siehe §A.8; Backlog, nicht parallel zu Phase-B-Kern. |

### H.3 Phase B – wenn A „genug“ stabil ist

| Paket | Quelle |
|--------|--------|
| **Mesh v2** zuverlässig (Senden/Empfangen, Web-BT) | `PROJECT-FOCUS` Phase B, Tests/Handbuch |
| **Delayed LoRa → IOTA MVP** | **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** – Queue, Gateway, Custody |
| **Kein** paralleler Start: volles Macro-Gateway, Reticulum, DID/Twin-Produkt | Nur Doku/Specs pflegen |

### H.4 Kurz-Check vor jedem größeren Merge

- **`npx tsc`** (Root)  
- **`npm run test`** oder gezielte Skripte aus **`TESTING.md`**  
- Bei Messenger-UI: **`npm run validate:ui`** wenn refs/TREE betroffen

### H.5 Aufräumen & Git-Commit (nach stabilem Kern)

Was behalten, was nicht zurückbauen, Commit-Reihenfolge: **`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`**.

---

*Bei Konflikt mit `PROJECT-FOCUS-AND-PRIORITIES.md` gewinnen die **Phasen A/B/C** dort; dieser Fahrplan priorisiert **Inhalt und Reihenfolge** innerhalb der Projektentscheidungen.*
