# Modularer Kern, Adapter, Auto-Modus, Interoperabilität

**Zweck:** Eure Vorschläge (**Auto-Detection** am Heltec, **Kern vs. Module**, **Profis bauen aus**) technisch **einordnen** und **schärfen** — ohne zu behaupten, „alles“ sei schon implementiert oder rechtlich frei skalierbar.

**Verknüpft:** **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** (Phasen, Meshtastic-First), **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**, **`docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`** (BLE vs. UART/USB, Web Serial, Ist-Code), **`docs/LORA-EU-FUNK-HARDWARE-EINSATZPROFILE.md`**, **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (Queue vs. Chain, **§ H.12**), **`lora-bridge/README.md`**, **`meshtastic/README.md`**, **`docs/ROADMAP-FAHRPLAN.md`** § **H.3k**, **§ H.3l**, **§ H.12**.

---

## 1. Kern vs. Adapter (Verbesserung gegenüber „ein großer Klumpen“)

| Schicht | Inhalt (Zielbild) | Für Privatnutzer | Für Organisationen |
|---------|-------------------|------------------|-------------------|
| **Kern** | Semantik von Nachrichten, Vault, IOTA-Anbindung wo online, **Emergency-Envelope** / Mesh-Binary, API-Verträge | Eine **verständliche** Standard-Installation (Lite-Messenger, `.env`/Provisioning) | Gleiche **Logik**, andere **Betriebs- und Schlüsselpolicies** |
| **Transport-Adapter** | Anbindung an **Meshtastic** (Web-BT, ggf. Serial), **`lora-bridge`**, später MQTT gemäß Spec | „Handy + Stick“ ohne eigene Protokollbastelei | Relais, **Basis-Gateway**, Monitoring |
| **Regulierungs- / Funk-Adapter** | **Getrennte** HF-Pfade: ISM-LoRa (868/433) vs. **behördliche Bänder** | Nur **ISM-Konfiguration**; keine versteckten „Profimodis“, die Privatnutzer illegal machen | **Eigenes** Funkgerät + **Treiber/Gateway** am Rand; **kein** Kern-Fork nötig, wenn die **Schnittstelle** (z. B. serialisierte Payloads, gleicher Envelope) stabil bleibt |

**Wichtig:** Ein **„BOS-Adapter“** ist in der Praxis fast immer **anderes Funk-Hardware- und Genehmigungs-Universum** — nicht ein npm-Paket, das auf demselben SX1262 „BOS einschaltet“. Der **Modularitätsgewinn** ist: **Morgendrot-Kern** spricht **über definierte Grenzen** (Bytes + Metadaten) mit einem **externen** Funkstack; der Kern bleibt für Privatnutzer **ISM-tauglich dokumentiert**.

**„Verschlüsselungs-Modul“ für Militär:** Der Messenger-Kern bringt bereits **E2EE** (Handshake, Vault). Was Organisationen typischerweise brauchen, ist **Schlüsselverwaltung** (HSM, Smartcard, **getrennte** Signing-Policy) — das ist eher ein **Custody-/Signer-Adapter** als ein **zweites** Krypto-Protokoll neben dem bestehenden. Ein zweites, paralleles Krypto-Layer erhöht **Audit-Aufwand** und **Interop-Brüche**; nur mit **klarer** Anforderung sinnvoll.

---

## 2. Auto-Detection: sinnvoll, aber nicht naiv

### 2.1 Was ihr wollt

- Kein Display → **stummes Relais** (ROUTER/REPEATER-ähnlich, kein Telemetrie-Spam).
- Handy per **USB** → **Messenger-Host**-Modus (Datenpfad zum Telefon/Companion).

### 2.2 Wo die Logik real hängt (kritisch)

Der **Heltec** führt **Meshtastic-Firmware**; die **Morgendrot-Messenger-UI** läuft typischerweise auf dem **Handy/Browser**. „Ich bin Messenger“ ist also **kein** reiner Zustand des Sticks allein, sondern: **Host verbunden** + **App im Chat**.

| Signal | Was es *oft* bedeutet | Fallstrick |
|--------|------------------------|------------|
| **Kein Display** (Board ohne OLED / Display nicht initialisiert) | Tendenz **Headless / Relais** | Manche Relais haben **doch** Display; manche Gateways sind headless aber **kein** reines Flood-Relay |
| **USB CDC aktiv** (Serielle Verbindung zu einem Host) | **Provisioning**, **Bridge**, oder **Messenger-Companion** | Kann auch der **Laptop** zum Flashen sein — **nicht** automatisch „Privatnutzer im Feld“ |
| **BLE mit Morgendrot-Client** | Messenger-Nutzung über Funk | Relais sollte **nicht** dauernd als „Client mit UI“ erscheinen müssen |

**Bessere Lösung als reines Auto-Guess:** **Gestuft**

1. **Expliziter Override** (höchste Priorität): z. B. Firmware-**User-Settings** / `moduleconfig` / gebundene **Provisioning-Datei** („Profil: `relay` | `field_messenger` | `home_gateway`“).
2. **Auto-Vorschlag** (mittlere Priorität): Firmware oder **Companion-Daemon** setzt **Defaults** aus Board-ID + Display-Probe + „USB host connected“.
3. **Sichere Defaults:** Unklar → **konservativ** (z. B. **CLIENT** + kein aggressives MQTT), **nicht** „still stärkstes Relay“, um **Netz nicht zu fluten**.

So bleibt Up-/Downgrade für Privatleute **einfach** (Kabel rein → Wizard schlägt „Messenger“ vor; Kabel raus, Gerät an die Wand → „Relais“), ohne **Fehlklassifikation** bei Entwickler-Laptops.

### 2.3 Umsetzung (Roadmap, nicht Magie)

- **Meshtastic-Firmware (Fork/Modul):** Device-Rolle, Screenless-Optimierung, optional UART-Hinweise — siehe **`meshtastic/PHASE-2-FIRMWARE-SPEC.md`**, **`meshtastic/README.md`**.
- **Host (Node / Companion):** Erkennung „Serial da vs. nur BT“ für **UI-Hinweise** und **Logging** — eng mit **`lora-bridge`** und Phase-B **Delayed Upload** verzahnen.
- **Kein** Alleingang im reinen **TypeScript-Node** ohne Firmware-Mitsprache: der Stick **muss** seine **LoRa-Rolle** selbst **korrekt** melden; sonst driftet das Mesh.

---

## 3. „Komplett modular, frei, voll interoperabel“ — realistische Grenzen

| Anspruch | Machbar | Grenze |
|----------|---------|--------|
| **Modular** | **Ja** in **Schichten** (Kern, Transport, Gateway, optional Signer/Custody) | Kein unbegrenzter **Plugin-Marktplatz** ohne Wartungs- und Sicherheitskonzept |
| **Frei / ausbaufähig** | **Ja** für **offene Schnittstellen** (Envelope, APIs, Meshtastic-Ökosystem) | **Funk und Behördenfunk** sind **rechtlich** und **zertifizierungstechnisch** begrenzt — „frei“ ≠ „ohne Genehmigung alle Bänder“ |
| **Voll interoperabel** | **Nur schichtweise:** Meshtastic↔Meshtastic, Morgendrot↔IOTA, Bridge↔API | **Kein** Produkt spricht **ohne Adapter** mit **allen** Weltsystemen; Interop = **gemeinsame** Payloads + **vereinbarte** Kanäle + **Versionierung** |

**Praktische Interop-Liste (Zielbild):**

- **Gleiches Mesh:** gleiche **Meshtastic-Kanal-/PSK-Policy** (oder definierte DM-Policy) — Wanderer-Handy und **professionelles** Relais **können** zusammenarbeiten.
- **Gleiche Anwendung:** **Emergency Binary / Envelope**-Versionen **explizit** versionieren (bereits angelegt — weiterführen, nicht silent ändern).
- **Organisationen:** Anbindung an **ATAK/CoT** etc. = **eigener Adapter** (Backlog **`docs/ATAK-COT-INTEGRATION-ZIELBILD.md`**), nicht Kern-Pflicht.

---

## 4. Kurz-Fazit für Kommunikation nach außen

- **Privat:** Einfacher Einstieg über **Standard-ISM** + **Lite-UI** + klare **Profile**; Auto-Modus **hilft**, **ersetzt** aber keine **Kurzanleitung** und kein **Kanalabgleich im Team**.
- **Profis:** **Ausbaubar** über **Adapter** und **Infrastruktur**, **ohne** den Kern für alle zu **verkomplizieren** — **nicht** „beliebig“ im rechtlichen Sinn, wohl aber **architektonisch** offen an den Grenzen.
- **Gemeinsame Nutzung:** Technisch möglich im **gemeinsamen Mesh** + **gemeinsamen** Anwendungskonventionen; organisatorisch weiterhin zu klären (wer darf welches Band, welche Schlüssel).

---

*Stand: 2026-03-28 — Architektur-Zielbild; Umsetzung gestaffelt nach Phase B (Transport) und optional Phase 2 Firmware.*
