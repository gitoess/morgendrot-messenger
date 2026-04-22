# LoRa / Meshtastic — zuerst am PC (Smoke)

**Ziel:** Eine **Funk-Klartext**-Nachricht zuverlässig über **Web Bluetooth** zum Heltec (Meshtastic) senden — **bevor** parallel am Handy getestet wird.

**Verknüpft:** **`docs/DEV-START.md`** (Ports, `127.0.0.1` vs. LAN), **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**, Routing-Hinweise in **`frontend/frontend/lib/meshtastic-routing-error.ts`**.

---

## 1. Umgebung (PC)

| Check | Hinweis |
|--------|---------|
| Browser | **Google Chrome** oder **Microsoft Edge** (Web Bluetooth). Brave blockiert oft — Flags/Shields siehe Fehlermeldung beim Koppeln. |
| URL | **`http://127.0.0.1:3341`** oder **`http://localhost:3341`** — sicherer Kontext für Web Bluetooth. **`http://0.0.0.0:3341`** ist oft **ungünstig** (siehe UI-Fehlertext beim Connect). |
| Dev-Server | Root **`npm run dev`** → Next **3341**, API **3342**. |
| Heltec | Meshtastic-Firmware, mit **offizieller Meshtastic-App** (Handy) mindestens einmal **Kanal / Region** gesetzt; Gerät per USB-Strom versorgen, Antenne sitzt. |

---

## 2. Gerät / Kanal (Meshtastic-App, nicht Morgendrot)

- **Primärer Kanal** aktiv (nicht deaktiviert), z. B. **LongFast** mit Default-PSK — identisch zum **zweiten** Testgerät, falls du Empfang prüfen willst.
- **Region** (EU_868 etc.) passend zur Hardware.
- Bei Routing-Fehler **NO_CHANNEL** (in der Statuszeile erklärt): Kanal in der App speichern, Node neu starten, dann in Morgendrot **BLE trennen und neu koppeln**.

---

## 3. Morgendrot-Messenger (Chat)

1. **Transport:** **„funk“** (nicht „online“).
2. **Verschlüsselung:** **aus** (Klartext-LongFast / `sendText`).
3. **Privater Chat:** Empfänger **0x…** wie gewohnt; **oder** öffentliche Pinnwand mit Broadcast (kein 0x nötig, wenn „an Node-ID“ aus).
4. **Heltec koppeln:** Partner-Setup / Transport-Karte — **Mit Heltec verbinden** (Web Bluetooth-Picker).
5. **Text:** Kurz — **max. 200 Zeichen** pro Funk-Klartextnachricht (App begrenzt; längerer Text → Fehler / TOO_LARGE am Radio).
6. **Senden** — Erwartung: kein harter Routing-Fehler; **TIMEOUT (3)** kann bei Broadcast **ohne** Empfänger-ACK erscheinen — die Nachricht ist oft **trotzdem** gesendet (siehe Hinweistext in der App).

---

## 4. Typische Fehler → nächster Schritt

| Symptom | Nächster Schritt |
|---------|------------------|
| Web Bluetooth grau / keine Auswahl | URL **127.0.0.1**, HTTPS-Dev oder Enterprise-Policy prüfen. |
| NO_CHANNEL | Meshtastic-App: Kanal aktiv, mit Gerät verbinden, Konfiguration schreiben. |
| TOO_LONG / zu groß | Text kürzen (&lt; 200 Zeichen Klartext); Bilder nur **verschlüsselt** über Mesh v2 oder **online** mit LoRa-Pipeline. |
| NO_ROUTE | Ziel-Knoten an, gleicher Kanal, Reichweite; bei Broadcast zweites Gerät zum Hören nutzen. |
| Verbindung „hängt“ | In Morgendrot **Trennen**, ggf. USB neu; Chromium neu starten. |
| Anderes Gerät hört mit, **Browser-Posteingang** bleibt leer / **RX:** steht | Heltec **USB neu stecken** oder **Trennen** und Web Bluetooth erneut; im Setup **Events:** prüfen (`onMeshPacket`, `onMessagePacket`). Optional **`localStorage.setItem("morgendrot.meshRxDebug","1")`** + Reload → **`[morgendrot mesh]`** in F12. |

---

## 5. Danach: Handy

Erst wenn **am PC** ein Sendeversuch **ohne** Konfigurationsfehler durch ist (idealerweise mit **zweitem** Knoten bestätigt). Dann **`npm run dev:lan`** / **`start:prod:lan`** siehe **`docs/DEV-START.md`**, **`NEXT_ALLOWED_DEV_ORIGINS`**, und dieselbe Kanal-/Klartext-Logik.

---

## 6. Code (Ist)

- Klartext-Funk: **`device.sendText`** (LongFast) in **`use-meshtastic-ble.ts`** — mit **kurzen Retries** bei NO_ROUTE / MAX_RETRANSMIT / NO_RESPONSE.
- **Empfang:** `onMessagePacket` (Klartext) + **`onMeshPacket`** mit Dekodierung **Port 1** und **Port 7** (`TEXT_MESSAGE_COMPRESSED_APP`, Unishox2 in **`mesh-meshtastic-compressed-text.ts`**), weil **`@meshtastic/core`** für Port 7 kein `onMessagePacket` auslöst.
- Zeichenlimit **200** für **alle** unverschlüsselten Funk-Texte (privat + öffentlich): **`use-chat-view-handle-send.ts`** (`MESH_PLAINTEXT_MAX_CHARS`).
