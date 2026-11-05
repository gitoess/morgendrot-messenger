# SOS Wanderer v1 — Produkt & Umsetzung

**Zweck:** Verbindliche **v1-Produktspec** für **Wanderer/Solo** (Tour, QR, Registrierung, SOS). Ergänzt **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** §9 (Zivil-SOS, Fan-out, Klartext) — ersetzt sie nicht.

**Stand:** 2026-07-07  
**Status:** **Produktentschieden** — Umsetzung **§ H.3n B2.6**, Roadmap-**Schluss** (nach Block-2 / H.15 / H.36 / H.25a Feld). **Verfeinerung 2026-07-07:** gestufte Standortkette + **Standort-QR/Wegpunkt** (§3.3.1, §3.5) — GPS bleibt primär, Wegpunkt ist Ergänzung/Fallback.  
**Primärer Use Case:** **Wanderer** (Tour-QR / „Für Wanderung registrieren“). Einsatz-Helfer nutzen denselben SOS-Button mit Stammdaten aus Handoff/Roster — **ohne** Tour-QR in v1.

**Verwandt:** **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`**, **`docs/WANDERER-STANDALONE-BUNDLE.md`**, **`docs/HANDOFF-UND-MODUS-ZIELBILD.md`**, **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`**, Fahrplan **`docs/ROADMAP-FAHRPLAN.md`** § H.3n B2.5.

---

## 1. Leitprinzip

> Unterwegs mit **einem Knopf** Hilfe rufen. Betreuung/Leitung erkennt **wer**, **welche Tour**, **wo** und **was** — über **alle gerade erreichbaren** Wege, **absichtlich unverschlüsselt** (Reichweite vor Diskretion).

| Explizit **nicht** | |
|--------------------|---|
| Automatischer **112**-Ruf | Organisatorisch getrennt — **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`** |
| QR = App-Installation | Messenger muss **vorher** installiert sein |
| Verschlüsseltes SOS (Simple Mode) | Backlog OPSEC-Profil |
| Beliebige Datei / Funk-Foto im SOS | v1: nein — Foto nur Online Backlog (§7) |
| Mnemonic, Passwort, Private Keys im SOS | Verboten |

---

## 2. Voraussetzungen

| # | Vor der Tour / vor SOS |
|---|------------------------|
| 1 | Morgendrot-Messenger **installiert** |
| 2 | **Tresor** eingerichtet; für **Online-Leg** vor SOS **entsperrt** |
| 3 | Optional: **Meshtastic** verbunden (sonst Funk-Leg entfällt) |
| 4 | Empfohlen: **„Für Wanderung registrieren“** (Button oder Tour-QR) |

---

## 3. Wanderungs-Registrierung

### 3.1 Einstieg

- **Primär:** Button **„Für Wanderung registrieren“** (Dashboard oder Einstieg Wanderer)
- **Sekundär:** **Tour-QR scannen** → gleiches Formular, vorausgefüllt

Speicherort (Arbeitstitel): **`WanderSosContext`** in `sessionStorage` oder `localStorage` (Implementierung wählt eine Quelle; Tour-Kontext überlebt App-Neustart bis `validUntilMs`).

### 3.2 Formularfelder

| Feld | Pflicht | Quelle |
|------|---------|--------|
| **Anzeigename / Callsign** | Ja | Nutzer; QR kann `suggestedCallsign` vorschlagen |
| **Tour-Name** | Ja | Nutzer / QR |
| **Tour-ID** | Ja | QR oder manuell (Organisator-Vorgabe) |
| **Betreuung `0x`** | Ja | QR oder manuell — **eine** Wallet der Leitung |
| **Organisator (Label)** | Nein | Anzeige nur |
| **Gültig bis** | Empfohlen | `validUntilMs` — nach Ablauf Warnung bei SOS |
| **Notfall-Telefon** | Nein | Nur Anzeige im Bundle — **kein** Auto-Anruf |
| **Freitext-Stammdaten** | Nein | z. B. „Gruppe von 4, Start Hütte X“ |

### 3.3 GPS bei Registrierung (Entscheidung A)

| Zeitpunkt | Verhalten |
|-----------|-----------|
| **Registrierung** | **Einmalig** Standort-Berechtigung anfragen; optional **Startpunkt** speichern (Parkplatz, Hütte) |
| **SOS** | Standort **live** lesen (Timeout ~10 s), **ohne** erneutes Permission-Dialog wenn Erlaubnis noch gilt |
| **Fallback** | Kein GPS beim SOS → Text *„GPS beim SOS nicht verfügbar“* + ggf. gespeicherter Startpunkt; SOS **trotzdem** senden |

#### 3.3.1 Gestufte Standortkette (Entscheidung A-2)

**Grundsatz:** Live-GPS bleibt **primär** — der Notfall passiert meist **zwischen** benannten Punkten (Absturz/Sturz abseits vom Weg), ein zuletzt gescannter Ort ist dann veraltet. Der **Standort-QR/Wegpunkt** ist **Ergänzung und Fallback**, **kein Ersatz** für GPS. Das Lage-Bundle füllt die Ort-Zeile in dieser **Reihenfolge** mit dem jeweils Verfügbaren:

| Prio | Quelle | Anzeige |
|------|--------|---------|
| 1 | **Live-GPS** beim SOS (Timeout ~10 s) | Koordinaten + Zeit — aktuell, weg-unabhängig |
| 2 | **Letzter GPS-Fix** (Cache mit Zeitstempel) | „zuletzt HH:MM, ±Xm“ |
| 3 | **Standort-QR / Wegpunkt** (§3.5) | „zuletzt gescannt: Waldhütte 3, HH:MM“ |
| 4 | **Startpunkt** aus Registrierung | benannter Startpunkt |
| 5 | **Freitext** des Nutzers | „oberhalb der Hütte am Bach“ |

**Breadcrumb (optional):** Werden unterwegs Standort-QRs gescannt, wird der **jeweils letzte** benannte Wegpunkt (mit Zeit) als „letzte gesicherte Station“ gehalten — hilft bei totem GPS und/oder bewusstloser Person. **Kein** Tracking-Log, nur der **letzte** Punkt (OPSEC: kein Bewegungsprofil im Bundle).

### 3.4 Tour-QR-JSON

Payload-Typ: `morg.wanderung.register`, Version `v: 1`.

```json
{
  "v": 1,
  "type": "morg.wanderung.register",
  "tourId": "ALPEN-2026-07-12-M",
  "tourName": "Alpenüberquerung — Gruppe Mitte",
  "organizerLabel": "Alpenverein Sektion Musterstadt",
  "betreuung0x": "0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5",
  "validUntilMs": 1752336000000,
  "suggestedCallsign": "Teilnehmer 7",
  "telegramAlarmHint": null,
  "meshChannelHint": null,
  "locale": "de"
}
```

| Feld | Regeln |
|------|--------|
| `betreuung0x` | Pflicht, `0x` + 64 Hex (klein normalisieren) |
| `validUntilMs` | Optional; Unix-ms UTC |
| **Verboten im QR** | Keys, Passwörter, Medizin, Ausweisdaten |

**Transport:** URL `morg://wanderung/v1?payload=…` oder HTTPS-Landing mit Base64-JSON — Scan öffnet Registrierungs-UI.

**QR-Erzeugung v1:** **externes Mini-Tool** (Web/PDF-Generator für Organisatoren) — **nicht** Boss-Export, **nicht** In-App-Generator. Boss-Integration = Backlog.

**Betreuung v1:** **genau eine** `betreuung0x` pro Tour. Zweite Adresse / Stellvertreter = Backlog (`betreuung0xBackup`).

### 3.5 Standort-QR / Wegpunkt (Entscheidung A-2)

**Eigener QR-Typ**, **getrennt** vom Tour-QR (§3.4). Trägt **nur einen benannten Ort**, **keine** Registrierungsdaten. Anbringung durch Organisator/Betreiber an festen Punkten (Hütte, Wegkreuzung, Schutzraum).

Payload-Typ: `morg.wanderung.waypoint`, Version `v: 1`.

```json
{
  "v": 1,
  "type": "morg.wanderung.waypoint",
  "waypointId": "HUETTE-3",
  "label": "Waldhütte 3",
  "gps": "47.4213,10.9812",
  "locale": "de"
}
```

| Feld | Regeln |
|------|--------|
| `waypointId` | Pflicht, kurzer Slug (`[A-Z0-9-]`), z. B. `HUETTE-3` |
| `label` | Pflicht, menschenlesbar für die Leitstelle („Waldhütte 3“) |
| `gps` | Optional; `lat,lon` (4 Dezimalen genügen) — falls vorhanden, dient als **GPS-Fallback** (Prio 2/3 §3.3.1) |
| **Verboten im QR** | Keys, Passwörter, Personendaten, `betreuung0x` |

**Verhalten beim Scan:** setzt/aktualisiert `lastWaypoint` (`{waypointId, label, gps?, scannedAtMs}`) im `WanderSosContext` — **überschreibt** den vorherigen (nur letzter Punkt, §3.3.1 Breadcrumb). **Kein** Öffnen der Registrierung, **kein** Ändern von Tour/Betreuung.

#### Abgrenzung Tour-QR ↔ Standort-QR

| | **Tour-QR** (§3.4) | **Standort-QR / Wegpunkt** (§3.5) |
|--|--------------------|-----------------------------------|
| Typ | `morg.wanderung.register` | `morg.wanderung.waypoint` |
| Zweck | **Wer/welche Tour** — Registrierung | **Wo** — benannter Ort/Fallback |
| Trägt | `tourId`, `betreuung0x`, Callsign … | `waypointId`, `label`, optional `gps` |
| Scan-Effekt | öffnet Registrierungs-Formular | setzt `lastWaypoint` (still) |
| Häufigkeit | **einmal** vor der Tour | **mehrfach** unterwegs |
| `betreuung0x` | **Ja** (Pflicht) | **Nie** (verboten) |

---

## 4. SOS ohne Registrierung

SOS wird **nicht** hart blockiert.

```
⚠ Keine Wanderung registriert
Helfer wissen evtl. nicht, wer du bist und welche Tour du machst.

[ Jetzt registrieren ]   [ Trotzdem SOS ]
```

| Pfad | Verhalten |
|------|-----------|
| **Jetzt registrieren** | Formular / QR → zurück zum SOS |
| **Trotzdem SOS** | Reduziertes Bundle: Freitext + eigene `0x` + Funk-Node — **keine** Tour-ID, **keine** `betreuung0x` aus Tour |

Online ohne `betreuung0x`: Status *„Online: kein Tour-Ziel — nur Funk/Telegram wenn verfügbar“* (Ziel nur wenn Partner/Telefonbuch oder Peering).

---

## 5. SOS-Sheet (UI)

### 5.1 Ablauf

1. **„SOS — Hilferuf“** (Dashboard oder Chat)
2. Sheet: Freitext + **Lage-Bundle-Vorschau** + Kanal-Hinweis
3. Bestätigung **„SOS senden“**
4. Fan-out + Status pro Kanal

### 5.2 Sheet-Inhalte

| Bereich | Editierbar beim SOS? |
|---------|----------------------|
| Freitext „Was ist passiert?“ | **Ja** (min. ein Wort) |
| Lage-Bundle (auto) | **Nein** (Vorschau) |
| Warnung Klartext/Funk | Fix |
| „Funk: kurz · Online: vollständig“ | Fix |
| Anhang | **v1: nein** |

### 5.3 Lage-Bundle — Felder

| Feld | Quelle | Funk | Online |
|------|--------|------|--------|
| `MORG_EMERGENCY_V1` | System | Ja (minimal) | Ja |
| Freitext | Nutzer | Gekürzt | Voll |
| Callsign | Registrierung / Profil | Ja | Ja |
| Tour-ID / Tour-Name | Registrierung | Nur ID | Beides |
| Eigene IOTA `0x` | Session | Gekürzt | Voll |
| Funk-Node `!…` | Telefonbuch/Gerät | Wenn da | Ja |
| GPS live | Gerät beim SOS | ~4 Dezimalen | Voll + Zeit |
| Letzter GPS-Fix (Fallback) | Geräte-Cache | Wenn kein live-GPS | Ja + Zeit |
| Wegpunkt (Standort-QR) | Letzter Scan (§3.5) | Label + Zeit, wenn kein GPS | Label + `waypointId` + Zeit |
| Startpunkt (Fallback) | Registrierung | Wenn kein GPS/Wegpunkt | Ja |
| Betreuung `0x` | Registrierung | Gekürzt | Voll |
| Package-ID | Session | Nein | Optional |
| Telegram | Konfig | Nein | Notify-Hinweis |

Ist-Code heute: **`frontend/frontend/lib/sos-lage-bundle.ts`** — Tour-Felder, GPS live und **Wegpunkt-Fallback (§3.5)** sind **Lücke** gegen diese Spec.

---

## 6. Funk-Kürzel (~200 Zeichen Budget)

Normale Klartext-Funk-Nachrichten: **`MESH_PLAINTEXT_MAX_CHARS = 200`**. SOS ist im Send-Hook von dieser Kappe **ausgenommen** (`!isEmergencySend`), bleibt aber durch **Meshtastic-Airtime** (~200–237 B/Frame) begrenzt — deshalb **aktives Kürzen** in der App.

### 6.1 Streich-Reihenfolge

1. Freitext kürzen (Wörter)
2. Tour-Name weg → nur `tourId`
3. Package / Telegram weg
4. `0x` auf `0x` + 8 Hex … letzte 8 Hex
5. GPS auf 4 Dezimalen
6. Ort-Zeile: bei fehlendem GPS **Wegpunkt-`label`** statt Koordinaten (kurz, z. B. „Waldhütte 3“); `waypointId` nur Online (§7)

### 6.2 Funk-Einzeiler (Beispiel)

```
[SOS] ALPEN-07-12-M | Max M | Knöchel, stehen nicht | !a1b2c3d4 | 47.42,10.98 | 0x671b…15c5
```

Optional kompakter JSON im Marker (nur wenn Budget reicht):

```json
{"v":1,"kind":"text","tour":"ALPEN-07-12-M","who":"Max M","s":"Knöchel","node":"!a1b2c3d4","gps":"47.42,10.98","to":"0x671b…"}
```

### 6.3 Funk v1 — nicht

- Fotos, Dateien, langer Freitext, medizinische Volltexte

---

## 7. Online-Nutzlast (vollständig)

Klartext-Mailbox an **`betreuung0x`** (aus Registrierung) mit vollem Bundle + `MORG_EMERGENCY_V1`-Marker — siehe **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** §7.

**Backlog v2:** ein Foto **nur** Online-Leg (nicht Funk).

---

## 8. Fan-out

| Kanal | Bedingung | Inhalt |
|-------|-----------|--------|
| **Funk** | Mesh verbunden | §6 Funk-Kürzel |
| **Online** | Netz + Tresor offen + `betreuung0x` | §7 Voll-Bundle |
| **Telegram** | Alarmgruppe konfiguriert | Kurzhinweis (Tour-ID, Callsign, „Details Mailbox“) |

**UI-Pflicht:** Status pro Kanal — z. B. *„SOS — Funk OK · Online OK · Telegram …“*

Ist-Code: **`chat-view-emergency-fanout.ts`**, **`use-chat-view-handle-send.ts`** (`emergencyWire`, `emergencyPartnerOverride`).

---

## 9. Abgrenzung Einsatz-Helfer

| | Wanderer v1 | Einsatz-Helfer |
|--|-------------|----------------|
| Stammdaten | Tour-Registrierung / QR | Handoff + Roster |
| SOS-Ziel Online | `betreuung0x` aus Tour | Boss-0x aus Handoff |
| Tour-QR | **Ja** | Nein in v1 |
| SOS-Button / Fan-out / Wire | Gleich | Gleich |

---

## 10. Umsetzungsreihenfolge (Code)

**Roadmap:** **`docs/ROADMAP-FAHRPLAN.md`** § **H.3n B2.6** — **nicht** vor laufendem Plan (§ H.15 4e/4f, § H.36 Feld, § H.25a Feld). Spec steht; Code **erst am Fahrplan-Schluss**.

Reihenfolge **strikt**: Registrierung → Sheet → Fan-out-Härtung. Kein QR-Generator vor lauffähiger Registrierung in der App.

### Scheibe 1 — Registrierung (`WanderSosContext`)

| # | Lieferung | Akzeptanz |
|---|-----------|-----------|
| 1.1 | Typ + Store `WanderSosContext` (parse/validate, `validUntilMs`) | Vitest: Roundtrip, abgelaufene Tour |
| 1.2 | UI: Button **„Für Wanderung registrieren“** + Formular | Speichern, Anzeige „Tour aktiv bis …“ |
| 1.3 | QR-Import: `parseWanderungRegisterQr` → Formular vorausfüllen | Vitest mit Beispiel-JSON §3.4 |
| 1.4 | GPS: Permission bei Registrierung + optional Startpunkt | Kein SOS-Code in dieser Scheibe |
| 1.5 | Dashboard-Badge: registriert / nicht registriert | Sichtbar auf Wanderer-Home |
| 1.6 | Standort-QR: `parseWanderungWaypointQr` (§3.5) → `lastWaypoint` im Context (still, kein Formular) | Vitest mit Beispiel-JSON §3.5; überschreibt letzten Punkt |

**Nicht in 1.x:** Boss-Tour-Export, zweite `betreuung0x`, Web-Generator (kann parallel als **Doku/HTML** ohne App-Release).

### Scheibe 2 — SOS-Sheet + Lage-Bundle

| # | Lieferung | Akzeptanz |
|---|-----------|-----------|
| 2.1 | `sos-lage-bundle.ts`: Tour-Felder aus `WanderSosContext` | Vorschau zeigt Tour-ID, Betreuung, Organisator |
| 2.2 | GPS live beim SOS + **gestufte Standortkette §3.3.1** (live → letzter Fix → Wegpunkt → Startpunkt → Freitext) | Bundle-Zeile Ort zeigt beste verfügbare Quelle mit Zeit |
| 2.3 | Sheet: Kanal-Hinweis „Funk kurz / Online voll“ | Text im Sheet §5.2 |
| 2.4 | **Ohne Registrierung:** Warn-Dialog §4 | „Trotzdem SOS“ mit reduziertem Bundle |
| 2.5 | `emergencyPartnerOverride` / Ziel: `betreuung0x` wenn registriert | Online an Leitung, nicht nur Boss-Heuristik |

### Scheibe 3 — Fan-out + Funk-Kürzel + Feldtest

| # | Lieferung | Akzeptanz |
|---|-----------|-----------|
| 3.1 | `formatFunkSosLine` / Trim-Policy §6 | Vitest: langer Input → ≤ Budget |
| 3.2 | Fan-out: Funk + Online mit unterschiedlicher Nutzlast | Statuszeile mit Funk + Online |
| 3.3 | Klartext erzwingen bei `emergencyWire` (Spec §9 Lücke schließen) | Verschlüsselung im Composer ignoriert |
| 3.4 | CDP: `apk-h36-sos-fanout-fieldtest.mjs` mit registrierter Tour | PASS: Status + optional Boss-Inbox |
| 3.5 | Handbuch: `MESSENGER-CHAT-HANDBUCH.md` § SOS Wanderer | `npm run sync:handbook` |

### Backlog (nach v1)

- Web-Tool Tour-QR-Generator (Organisator)
- Web-/PDF-Tool **Standort-QR-Generator** (Hütten/Wegpunkte, §3.5) — extern, kein App-Release
- Foto nur Online an SOS
- `betreuung0xBackup`
- Boss-Integration Tour-QR
- Funk-Foto nach SOS (separater Vorgang, § H.25a)

---

## 11. Tests & Abnahme

| Ebene | Was |
|-------|-----|
| **Vitest** | QR-Parse, Context-Store, Funk-Trim, Lage-Bundle mit Tour |
| **CDP/APK** | Registrierung → SOS → Fan-out-Status (mit `betreuung0x`) |
| **Manuell** | QR scannen, SOS ohne Registrierung, GPS verweigert |

Eintrag **`docs/TEST-RUN-LOGBOOK.md`** nach erstem grünen Wander-SOS-Lauf.

---

*112 / Leitstelle: kein automatischer Anruf durch diese Spec.*
