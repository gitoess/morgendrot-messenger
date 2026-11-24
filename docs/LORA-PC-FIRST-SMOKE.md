# LoRa / Meshtastic — zuerst am PC (Smoke)

**Ziel:** Eine **Funk-Klartext**-Nachricht zuverlässig über **USB (Web Serial)** oder **Web Bluetooth** zum Heltec (Meshtastic) senden — **bevor** parallel am Handy getestet wird.

**PASS-Regel (UI):** Ausgang in Morgendrot allein reicht **nicht**. UI-Send gilt nur als **PASS**, wenn der **Empfänger-Heltec** (2. Gerät / CLI `--listen`) ein `TEXT_MESSAGE` mit dem gleichen Klartext zeigt. Stall ohne Paket-ID → **Fehler** in der UI (kein Fake-Ausgang).

**Verknüpft:** **`docs/DEV-START.md`**, **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**, **`docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`**, Routing in **`frontend/frontend/lib/meshtastic-routing-error.ts`**, Stall in **`meshtastic-outbound-race.ts`**.

---

## 1. Umgebung (PC)

| Check | Hinweis |
|--------|---------|
| Browser | **Google Chrome** oder **Microsoft Edge** (Web Bluetooth **und** Web Serial). Brave blockiert oft BT — Flags/Shields siehe Fehlermeldung. |
| URL | **`http://127.0.0.1:3341`** oder **`http://localhost:3341`**. |
| Dev-Server | Root **`npm run dev`** → Next **3341**, API **3342**. |
| Heltec | Meshtastic-Firmware; **Kanal/Region/PSK** in der **Meshtastic-App** setzen (nicht in Morgendrot). |
| USB-Besitz | **Ein COM-Port = ein Programm.** Config: Meshtastic-App → dort trennen. Chat: Morgendrot **USB verbinden**. Parallel: App auf USB, Morgendrot per **Bluetooth**. |
| **Hardware-Minimum** | **1 Radio** = koppeln + senden. **Empfang beweisen** → **2. Knoten** (2. Heltec oder Meshtastic-App). |

---

## 2. Gerät / Kanal (Meshtastic-App, nicht Morgendrot)

- **Primärer Kanal** aktiv (nicht deaktiviert), Default-PSK — **identisch** auf beiden Testgeräten (inkl. **Modem-Preset**).
- **Region** (EU_868 etc.) passend zur Hardware.
- Bei Routing-Fehler **NO_CHANNEL** (in der Statuszeile erklärt): Kanal in der App speichern, Node neu starten, dann in Morgendrot **BLE trennen und neu koppeln**.

### 2a. Modem-Preset — Reichweite vs. Tempo (Schreibtisch)

Meshtastic setzt Preset **nur in der App** (Radio Config → LoRa → Modem Preset), **nicht** in Morgendrot. **Beide** Heltecs müssen denselben Preset haben.

| Preset (EU868) | Airtime / Tempo | Reichweite | Empfehlung |
|----------------|-----------------|------------|------------|
| **LongFast** (häufig Default) | langsam (~1 kbps-Klasse) | **besser** | Feld, Distanz, Wandern |
| **MediumFast** | ~3× schneller als LongFast | mittel | **Schreibtisch / Bild-Burst** (2 Heltecs nah) |
| **ShortFast** / **ShortTurbo** | sehr schnell | kurz | nur Labor, wenig Abstand |
| **LongSlow** / **VeryLongSlow** | sehr langsam | maximal | Notfall-Reichweite, **nicht** Bild |

**Für Morgendrot-Bild am PC:** **MediumFast** auf beiden Nodes — weniger `MAX_RETRANSMIT`, kürzere Sendezeit. Zurück auf **LongFast**, sobald Distanz/Feld zählt.

Weitere Hebel (App, beide Geräte gleich halten):

| Parameter | Wirkung | Vorsicht |
|-----------|---------|----------|
| **Hop Limit** | weniger Hops = weniger Mesh-Last | Desk: oft **3** reicht; Broadcast ohnehin lokal |
| **TX Power** | etwas mehr ERP | EU-Limits / Hitze; nah am Tisch selten nötig |
| **Ignore MQTT / Rebroadcast** | weniger Fremdverkehr | nur wenn du das Mesh verstehst |
| **Kanal-Name / PSK** | Interop | bei Mismatch: gar kein RX |

SDK-Konsole `Error received for packet …: undefined` = oft fehlendes Mesh-ACK (`TIMEOUT`/`MAX_RETRANSMIT` / unbekannter Enum). Ausgang **weich**; Dev-Overlay wird per outermost-`console.error`-Filter + `MeshtasticDevNoiseGuard` geschluckt (Next würde sonst „44 issues“ zählen).

---

## 3. Morgendrot-Messenger (Chat)

1. **Sendepfad:** **Funk**.
2. **Verschlüsselung:** **aus** (Klartext-LongFast / `sendText`).
3. **Heltec:** **USB verbinden** (PC-Default, Port frei) **oder** **Bluetooth** (wenn Meshtastic-App den USB hält).
4. **Ziel:** „An alle“ = Broadcast; Kontakt mit `meshNodeId` / sichtbare Nodes = Direkt.
5. **Text:** max. **200 Zeichen**.
6. **Senden** — UI braucht **bestätigte Paket-ID**; sonst Fehler „nicht bestätigt“. Empfang am **2. Heltec** prüfen (CLI oder Posteingang).

---

## 4. Typische Fehler → nächster Schritt

| Symptom | Nächster Schritt |
|---------|------------------|
| USB-Port belegt / Picker abgebrochen | Meshtastic-App/CLI trennen **oder** Morgendrot per Bluetooth. |
| „Funk-Sendung nicht bestätigt“ (Stall) | Verbindung/Kanal prüfen; USB statt BLE; 2. Gerät hören — **kein** Fake-Ausgang mehr. |
| Web Bluetooth grau | URL **127.0.0.1**, Policy/Brave Flags. |
| NO_CHANNEL | Meshtastic-App: Kanal aktiv, Config schreiben, neu koppeln. |
| TOO_LARGE / zu lang | Text &lt; 200 Zeichen. |
| NO_ROUTE | Ziel an, gleicher Kanal, Reichweite. |
| MAX_RETRANSMIT / Console `undefined` | Oft LongFast + Bild-Burst. Beide Nodes **MediumFast**. SDK-`console.error` wird gefiltert (kein Next-Overlay-Spam). Soft am Ausgang; bei Abbruch **Nochmals senden**. |
| Anderes Gerät hört, Posteingang leer | Trennen/neu koppeln; Events `onMeshPacket`/`onMessagePacket`; optional `morgendrot.meshRxDebug=1`. |

---

## 5. Bild über Funk — zwei Heltecs am **selben PC** (ohne Handy)

Handy-UX ist für diesen Feldtest **nicht nötig**. Zwei USB-Radios + zwei Browser-Fenster reichen.

| Schritt | Aktion |
|--------|--------|
| Hardware | **2 Heltecs**, **2 freie COM-Ports**, gleicher Kanal/PSK/Region/**Modem-Preset** (Schreibtisch: **MediumFast**). |
| Fenster A (Sender) | Chrome/Edge → `http://127.0.0.1:3341` → **Funk** → **USB verbinden** → Port **1**. |
| Fenster B (Empfänger) | **Zweites Fenster** (oder anderes Chrome-Profil) → gleiche URL → **Funk** → **USB verbinden** → Port **2**. |
| Senden | Fenster A: **+** → **Bilder über Funk…** → Bild wählen → normales **Senden**. Bei Abbruch: Posteingang **Nochmals senden**. Cap **≤ 3,6 KB** JPEG-Paar (Luma ≤ 2,8 KB, Chroma ≤ 1 KB). |
| Empfang | Fenster B: Posteingang **Funk** — Fortschritt **ohne Tab-Wechsel** (Live-Store); zuerst **S/W (Luma)**, dann **Farbe** wenn Chroma voll. Speichern = **ein** fused JPEG (nicht 3 Einzeldateien). |

**Hinweise:** Ein COM-Port = ein Client. Nicht parallel Meshtastic-App auf demselben Port.

**Bild-Format:** Zwei **MozJPEG**-Dateien (Luma S/W + kleines Chroma), **kein** AVIF/WebP auf dem Mesh-Text-Wire (Base64 + 200‑B-Limit). Encoder **airtime-first** (klein→groß bis Cap), Summe ≤ **~3,6 KB** → Baseline ~**210×280**, typisch **~20–40 Segmente** gesamt. **Datei-KB ≠ Funk-JPEG.** Mesh-Klartext ≤ **200 B UTF-8** → ~93 Rohbyte/Segment.

**UI vs. Heltec:** Gap **580 ms**; Luma→Chroma-Settle **~1 s**; NAK-Wartefenster **~3,5 s**. Bei Firmware-**RATE_LIMIT (38)** Pause **2 s** und **nur dieses** Segment nochmal. Peer-NAK = nur Masken-Lücken. **Kein** Blind-Alles-nochmal. Statuszeile: „nur Lücke k/n“.

**Warum fehlen Segmente?** Halbduplex + Rate-Limit (Paket wurde **nicht** gesendet, UI zählte früher trotzdem „ok“). Math: 1. Burst 1×n, dann |rateLimited| + |nakMissing| Nachsend — nicht 2×n.

### Stabil-Anker **STABIL** (Live 2026-11-23/24 — User: schöner Lauf + Qualitäts-Plateau)

Baseline: Cap **≤ 3,6 KB**, Gap **580 ms**, Settle **1 s**, MediumFast, Nur-Lücken-Repair, Live-RX-Fortschritt. Typische Schreibtisch-Sendezeit **~1:30–1:45**. **Encode + Tempo eingefroren** (kein 1‑min-Push; Gap unter ~500 nur mit neuem Live-Beweis). Rule `lora-h25a-stable-anchor.mdc`.

**Luma→Chroma vs. ein Farb-JPEG:** progressiv besser (S/W früh, Farbe nach, Abbruch nutzbar); Vollfarbe = alles-oder-nichts, oft mehr Bytes.

**Duty Cycle:** **kein** Live-Restkontingent in der App. LongFast = langsam; Schreibtisch: **MediumFast** (beide Nodes).

**Zwei Fenster, gleiche Header-Adresse:** Beide Tabs teilen Backend-`MY_ADDRESS`. Für zwei Seeds: `localStorage.setItem('morgendrot.dualWalletDev','1')` **oder** zwei API-Instanzen. Funk-Bildtest braucht keine zwei IOTA-Adressen.

„Anderes Bild wählen…“ ohne Haken-Toggle. USB-Reconnect still. **Audio über Funk:** nur Online/IOTA.

**Videos (kritisch):** Generische LoRa-/Reticulum-Demos sind kein Drop-in. Übernehmbar: kleine Bilder, sequentielle Pakete, k/n-Fortschritt — nicht fremdes Stack/Firmware.

---

## 6. Danach: Handy

Erst wenn **am PC** ein Sendeversuch **ohne** Konfigurationsfehler durch ist (idealerweise mit **zweitem** Knoten bestätigt). Dann **`npm run dev:lan`** / **`start:prod:lan`** siehe **`docs/DEV-START.md`**, **`NEXT_ALLOWED_DEV_ORIGINS`**, und dieselbe Kanal-/Klartext-Logik.

---

## 7. Code (Ist)

- Klartext-Funk: **`device.sendText`** (LongFast) in **`use-meshtastic-ble.ts`** — Retries bei NO_ROUTE / MAX_RETRANSMIT / NO_RESPONSE; Stall ohne Bestätigung → **Fehler** (`meshtastic-outbound-race.ts`).
- Transport: Web Serial **und** Web Bluetooth; sticky Reconnect nur Bluetooth.
- **Empfang:** `onMessagePacket` + **`onMeshPacket`** Port 1/7 (Unishox2); NodeDB → sichtbare Nodes im Composer.
- Zeichenlimit **200**: **`MESH_PLAINTEXT_MAX_CHARS`**.
