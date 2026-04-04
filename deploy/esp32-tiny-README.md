# ESP32 / „Tiny“ – ohne Morgendrot-Repo auf dem Chip

## Fakten

- Ein **ESP32** hat typisch **320 KB RAM** und **4 MB Flash** (Varianten abweichend).  
- Dieses Morgendrot-**Node**-Projekt ist **mehrere hundert MB** mit `node_modules` – das kommt **nicht** auf den ESP32.  
- Stattdessen: **eigene Firmware** (Arduino / ESP-IDF / PlatformIO), **nur Kilobyte bis wenige MB**.

## Was der Wizard liefert

- Beim Provisioning **„Embedded/Tiny“** erhältst du einen **C-Header** (`identity.h` / eingebetteter Text) mit u. a. **DEVICE_ID**, **GATEWAY_URL**, **DEVICE_SECRET** (HMAC).  
- Der ESP32 spricht **HTTP(S)** mit dem **Gateway** (meist ein **Raspi** mit dem Paket **Morgendrot-Raspi-headless** oder einem kleinen HTTP-Forwarder), nicht direkt mit der kompletten IOTA-SDK.

## Architektur (typisch)

```
[ESP32] --HTTPS/HMAC--> [Gateway Raspi: /api/tiny-message o.ä.] --> [IOTA / Morgendrot-Logik]
```

## Checkliste

1. Firmware auf dem ESP32: WiFi, Zeit (NTP), HTTP-Client, HMAC wie in der Doku zum Tiny-Protokoll.  
2. **GATEWAY_URL** im Header auf die erreichbare Adresse des Raspberry Pi setzen.  
3. Auf dem Raspi: Morgendrot mit **ENABLE_UI** optional + erreichbare API, oder dedizierter Gateway-Dienst.  
4. **Kein** `npm install` auf dem ESP32.

Weitere Hinweise: UI-Wizard Text „Tiny ohne WLAN? Config per AP-Modus“ und `docs/` zum Thema Gateway.
