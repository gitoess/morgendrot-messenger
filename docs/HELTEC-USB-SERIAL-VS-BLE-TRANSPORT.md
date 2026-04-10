# Heltec: USB-Serial vs. Bluetooth (Transport, Code, Fahrplan)

**Zweck:** Eure Diskussion **technisch schärfen** (was stimmt, was übertrieben ist, was der Code heute kann).  
**Ist im Repo:** Messenger-Frontend nutzt **Web Bluetooth** + `@meshtastic/core` (`frontend/frontend/hooks/use-meshtastic-ble.ts`). **USB-Serial** für LoRa existiert am **PC** in **`lora-bridge`** (`serial-lora-driver.ts`, `serialport`, Baudrate aus Config) — **nicht** als Web-Serial-Pfad in der PWA.

**Verknüpft:** **`heltec/README.md`**, **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**, **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`**, **`docs/LORA-EU-FUNK-HARDWARE-EINSATZPROFILE.md`**, **`meshtastic/PHASE-2-FIRMWARE-SPEC.md`**, **`docs/ROADMAP-FAHRPLAN.md`** § **H.3l**.

---

## 1. Was Kabel (Serial/USB) **tatsächlich** besser macht — und was nicht

### 1.1 Durchsatz Handy ↔ Heltec (z. B. viele kleine Pakete / große LUMA-Chunks)

| Aussage | Einordnung |
|---------|------------|
| **BLE ist für niedrigen Verbrauch optimiert, nicht für hohen Durchsatz** | **Stimmt** im Groben: praktischer Durchsatz BLE ist oft **niedriger** als bei USB-CDC/UART in typischen Setups. |
| **„4 KB LUMA in Millisekunden per Kabel“** | **Plausibel** für die **USB-Strecke** allein — aber der **Ende-zu-Ende-Engpass** bleibt oft **LoRa-Airtime** und **Mesh**. Schnelleres Handy↔Radio hilft **nur dort**, wo die **Schleife** „senden → evtl. NACK/Retry“ über den **Host** läuft. |
| **Selective NACK braucht deshalb zwingend Kabel** | **Zu stark:** Wenn NACK und Chunk-State **auf dem Heltec** (Firmware) liegen, ist die Host-Verbindung weniger kritisch. Wenn NACK **in der App** entschieden wird, **hilft** schnelleres Serial **spürbar** — ist aber **ein Architektur-Entscheid**, keine Naturgesetz. |

### 1.2 Firmware-Updates „vom Handy per USB aufzwingen“

| Aussage | Einordnung |
|---------|------------|
| **Über Bluetooth zuverlässig flashen** | Für **ESP32 + Meshtastic** ist **OTA/serielles Flashen** üblich; **BLE** ist dafür **kein** Standardweg. |
| **Vom Handy per Kabel „einfach“ neu flashen** | **Überinterpretiert:** braucht typ. **USB-OTG**, **Treiber/Permissions**, oft **Bootloader-Modus** / **esptool-ähnlichen** Ablauf oder **eingebaute** OTA-Logik in der Firmware. Das ist **machbar** als **spezielles** Werkzeug (App/Script), aber **nicht** „steckt Kabel an = fertig“ für jedes Teammitglied ohne Schulung. |

### 1.3 Logs / Debugging

| Aussage | Einordnung |
|---------|------------|
| **Serial-Konsole: Logs in Echtzeit** | **Stimmt** als übliches ESP32-/Firmware-Debugging. |
| **BLE: nur „Verbindung abgebrochen“** | **Zu schwarz-weiß:** Meshtastic/BLE kann **Telemetrie** und **Status** liefern, wenn die Firmware es ausgibt — nur **rohe UART-Debug-Zeilen** sind oft **Serial-first**. |

### 1.4 Strom / „Turbo 500 mW“ / Akkus

| Aussage | Einordnung |
|---------|------------|
| **Nur per Kabel exakten Heltec-Akkustand + Turbo sperren** | **So nicht haltbar:** Der **Heltec-Akkustand** kennt nur die **Firmware** (oder ein Fuel-Gauge); die App bekommt Zahlen nur, wenn das Gerät sie **reportet** — **egal ob BLE oder Serial**. **Turbo** (Sendeleistung) ist **ISM-/Thermik-/Policy-Thema**; eine **gemeinsame Policy** „Handy schwach → weniger TX“ ist **Design**, nicht „nur USB“. USB kann **Laden** des Heltec vom Handy-Batteriepool ermöglichen (OTG), das ist ein **anderes** Argument als „Messgenauigkeit“. |

---

## 2. Was am Code vorbereitet werden muss (korrigiert)

### 2.1 Wo läuft was?

- **Heute:** Die **BLE-Anbindung** sitzt im **Frontend (Browser/PWA)** über **Web Bluetooth**, nicht „das Backend auf dem Handy“ im Sinne von Node.js auf dem Telefon.  
- **Node/Morgendrot-API** läuft typischerweise auf **PC/Pi**; das **Handy** spricht per **HTTP** mit der API und per **Web Bluetooth** mit dem Heltec.

Ein **Serial-Pfad** wäre also primär:

- **Variante A:** **Web Serial API** in der **PWA** (Chromium), **oder**  
- **Variante B:** **Native** Android-Schicht (z. B. später Companion-App), **oder**  
- **Variante C:** **PC + lora-bridge + Serial** (bereits vorhanden) — Handy nur als UI ohne direkten UART.

### 2.2 Web Serial auf dem Smartphone

**Kritisch:** Unterstützung und **USB-OTG**-Fähigkeit sind **geräte- und browserabhängig**. **Nicht** pauschal „Android Chrome = Web Serial wie Desktop“ annehmen — **Matrix testen** (Gerät, Chrome-Version, USB-C-Rolle). Wo Web Serial fehlt, bleibt **BLE** oder **native Bridge**.

### 2.3 Protokoll / Framing / Baudrate

- **Meshtastic** spricht über Serial typischerweise **definierte** Protobuf-/CLI-Protokolle — **kein** freies „wir erfinden Header+Payload“, wenn ihr **kompatibel** mit Meshtastic bleiben wollt.  
- **lora-bridge** nutzt einen **eigenen** Roh-Serial-Pfad (`SerialLoraDriver` — Kommentar: kein Meshtastic-Protobuf-Framing); das ist **ein anderer** Modus als „Meshtastic-App-Client über UART“.  
- **Baudrate:** mit **Meshtastic-Doku/Firmware-Default** abstimmen (häufig **115200**; höhere Raten nur nach **Stabilitätstest** und **Kabellänge/EMV**).

---

## 3. „Transport-agnostisch“ + Weiche — verbesserte Formulierung

**Richtig:** Chunking/NACK-**Logik** sollte **nicht** mit `if (ble) …` vermischt werden.

**Besser als `if (USB) send_fast else send_ble_safe` überall:**

- Eine **kleine Transport-Schnittstelle** (z. B. `send(bytes)`, `onReceive`, `maxPayload`, `latencyClass`) mit **zwei Implementierungen** (BLE, Serial).  
- **Eine** oberhalb liegende **Schicht** (Fragmentierung, Retries nach **Policy**), die nur die **Schnittstelle** kennt.

So bleibt **`MODULAR-KERN-ADAPTER-INTEROP.md`** konsistent: Transport **Adapter**, Domänenlogik **Kern**.

---

## 4. Kurzfazit

| Originalthese | Fazit |
|---------------|--------|
| Kabel = viel mehr Durchsatz Handy↔Heltec | **Größtenteils ja**; E2E oft limitiert durch **LoRa**. |
| Kabel = Selective NACK **zwingend** | **Nein** — abhängig davon, wo NACK lebt. |
| Feld-Flash vom Handy trivial | **Nein** — möglich mit **Werkzeug + Prozess**, nicht „out of the box“. |
| Nur Kabel für Turbo/Akku-Policy | **Nein** — **Telemetrie/Policy** kann auch anders; USB hilft fürs **Laden**. |
| Backend auf Handy auf Serial umbauen | **Präzisieren:** **Frontend/Companion** + ggf. **gleiche API**; **lora-bridge** bleibt PC-seitig sinnvoll. |

---

## 5. Arbeitspaket: Spike „Web Serial auf Android“ (Vorbereitung, **§ H.3l**)

**Priorität:** **Mesh/BLE Phase B** bleibt **zuerst** — dieser Spike **blockiert** keinen Mesh-MVP. Er soll nur klären, ob **USB auf den Ziel-Handys** als **schneller Kanal** für **viele Bytes zum Heltec** taugt, **bevor** ihr Serial ins Protokoll **hart** einplant.

**CM4:** Läuft **Linux**, nicht Android — **kein** `navigator.serial`-Spike. Stattdessen: **`lora-bridge`** / **`serialport`** am Pi; optional separat **Baud/Durchsatz** messen (anderes Kapitel als Handy-Web-Serial).

### 5.1 Schritte (manuell; Ergebnisse hier oder im Team-Wiki festhalten)

| # | Schritt | Notiz |
|---|---------|--------|
| **1** | Zielgeräte notieren: Modell, Android-Version, Chrome-Version, Kabel/OTG. | Ohne das ist der Spike nicht reproduzierbar. |
| **2** | Auf jeder Kombination prüfen: **`navigator.serial`** verfügbar? (HTTPS oder `localhost`.) | Wenn **nein** → Spike-Ergebnis = „PWA-Web-Serial auf diesem Stack nicht nutzbar“; ggf. **Companion-App**-Pfad statt Browser. |
| **3** | Heltec per **USB-OTG** ans Handy; im Browser **Port auswählen** (CDC-ACM o. ä.). | Erst **Lesen** (Logs) als Rauchtest, dann **Schreiben**. |
| **4** | **Durchsatz:** z. B. **16–64 KB** in festen Chunks schreiben (und ggf. Echo/Firmware-Loopback, falls vorhanden); Zeit messen. | Optional: gleiche Nutzlast **über BLE** (Meshtastic) grob vergleichen — nur wenn ohne großen Aufwand. |
| **5** | **Fazit** in 2–3 Sätzen: taugt Serial für **Bild-/Chunk-Last** auf dem Feldgerät? **Blocker** (Strom, Kabel, Chrome-Build)? | Erst danach: Transport-Interface + Protokoll-Freeze für Serial **planen**. |

### 5.2 Optionales Test-HTML (später im Repo)

Wenn der Spike ohne Mini-Seite zu mühsam ist: kleine **statische** Seite unter z. B. `frontend/public/` oder `scripts/` (nur Entwicklung), die **Chunk-Schreiben** + **Zeitstempel** loggt — **kein** Produktcode im Chat-Flow, bis Schritt **5** ein **Go** gibt.

---

*Stand: 2026-03-28 — § 5 / Spike ergänzt (Fahrplan **§ H.3l**).*
