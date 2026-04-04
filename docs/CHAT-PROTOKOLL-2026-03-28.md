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
| Boss | Bundle bauen, **`.env`** pro Einsatz/Kunde **manuell** anpassen (RPC, Package-IDs, Partner/Boss) — **keine** Seeds auf SD/USB. |
| Helfer | `npm install`, ggf. `npm run build:next`; **Seed/Vault-Passwort nur auf dem Gerät**. |
| Später | Optional **Boss-Export-Assistent** (ZIP + vorgefüllte `.env`) → **Fahrplan § H.7**. |

**Doku:** `docs/ROADMAP-FAHRPLAN.md` (**§ B** Zeile Standalone, **§ H.7**), `README.md` (Einleitung + Skripttabelle `bundle:standalone-smartphone`).

*Manuell gepflegt; bei weiteren Meilensteinen Datum oder neue Datei ergänzen.*
