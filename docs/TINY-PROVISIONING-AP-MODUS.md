# Tiny-Provisioning ohne WLAN: AP-Modus

**Stand:** März 2025. Kontext: Wizard erzeugt `identity.h` / Config – ein ESP32 (Tiny) ist beim ersten Einsatz oft noch nicht im WLAN. Ablauf: Gerät im AP-Modus → User verbindet sich → Config per HTTP aufs Gerät.

---

## 1. Ablauf (Übersicht)

1. **Wizard (Morgendrot)** erzeugt wie bisher Config (z. B. `identity.h` oder JSON) und zeigt Anleitung/QR.
2. **Tiny (ESP32)** startet beim ersten Boot ohne WLAN-Credentials und öffnet einen **eigenen Access Point** (z. B. SSID `MORGENDROT_SETUP`).
3. **User** verbindet Smartphone/PC mit dem WLAN `MORGENDROT_SETUP`.
4. **User** öffnet im Browser eine Konfigurationsseite (Captive Portal des Geräts oder Morgendrot-Setup-Seite).
5. **Config** wird per **HTTP-POST** an das Gerät gesendet (z. B. `http://192.168.4.1/config`); Tiny speichert in Flash und wechselt danach in den normalen Betrieb (Station-Modus mit gespeichertem WLAN).

---

## 2. Was das Gerät (Tiny-Firmware) braucht

- **AP-Modus:** Beim Start ohne gespeicherte Config WLAN mit fester SSID starten (z. B. `MORGENDROT_SETUP`), optional mit Passwort.
- **IP:** Typisch `192.168.4.1` (ESP32 Standard-Gateway im AP-Modus).
- **HTTP-Server:** Mindestens eine Route, z. B.:
  - `POST /config` – Body: JSON oder Text (Inhalt von `identity.h` / Wizard-Config). Gerät parst und speichert (Flash/NVS).
  - Optional: `GET /` – minimale HTML-Seite mit Formular „Config-Datei auswählen“ und „Hochladen“.
- **Nach Upload:** WLAN-Credentials und Morgendrot-Parameter sind gespeichert; Gerät neu starten oder in Station-Modus wechseln.

Die **Firmware** (C/Arduino/ESP-IDF) liegt typischerweise in einem eigenen Embedded-Repo; Morgendrot dokumentiert nur das **Format** und den Ablauf.

---

## 3. Was Morgendrot anbietet

- **Modell:** `identity.h` ist **Gateway-Identität** (HMAC gegen euer Morgendrot-Gateway), **kein** eingebetteter IOTA-Rebased-Fullnode-Client. `PACKAGE_ID` / `RPC_URL` liegen auf dem Gateway.
- **Wizard:** Unverändert: Config/identity generieren. Zusätzlich **kurze Anleitung** ausgeben:
  - „Tiny starten → WLAN MORGENDROT_SETUP verbinden → Browser öffnen → Config hochladen (Setup-Seite oder Gerät-URL).“
- **Optional: Setup-Seite** (z. B. unter `/setup-tiny` oder in der Lite-UI):
  - Eingabe: **Geräte-URL** (z. B. `http://192.168.4.1/config`).
  - Eingabe/Upload: **Config-Inhalt** (vom Wizard kopiert oder als Datei).
  - Button „Config senden“ → POST an Geräte-URL mit dem Config-Body.

---

## 4. Beispiel-Payload (Wizard → Gerät)

Das Gerät kann ein **JSON** erwarten, z. B.:

```json
{
  "gateway_url": "https://mein-gateway.example/api/tiny",
  "device_id": "tiny-001",
  "secret_hmac_b64": "...",
  "wifi_ssid": "MeinWLAN",
  "wifi_pass": "..."
}
```

Oder den **Roh-Text** von `identity.h` (C-#defines), je nachdem was die Firmware parst.

---

## 5. Sicherheit

- AP nur für Setup nutzen; nach erfolgreicher Konfiguration in Station-Modus wechseln.
- Optional: AP mit Passwort schützen; HTTPS im AP-Modus ist auf dem Gerät aufwendig, daher typischerweise nur im lokalen Setup-Netz.
- Geheimnisse (HMAC, WiFi-Passwort) nur über die gesicherte Verbindung zum Gateway nutzen; im Setup-Netz kurzzeitig sichtbar.
- **Trust Boundary:** Das Gateway muss HMAC prüfen und nur vertrauenswürdige Aktionen an die Kette weiterreichen; kompromittiertes Geräte-Secret = kompromittierte Geräteidentität bis zum Secret-Wechsel auf Gateway + Neuflash.

---

## 6. Referenzen

- Konzept: `docs/ROLLE-BASIERTES-UI-KRITIK-UND-ZUSAMMENFASSUNG.md` (Abschnitt 4).
- Wizard: Steuerung → „Gerät hinzufügen“ / Provisioning; Ausgabe von identity/Config.
- Optionale UI: `ui/setup-tiny.html` (minimale Seite zum Senden der Config an eine konfigurierbare Geräte-URL).
