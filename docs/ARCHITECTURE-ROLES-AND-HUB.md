# Rollen, Boss-Zentrale und optionaler Kommandanten-Hub

## Boss = Steuerung & Export (logische Zentrale)

Der **Boss** nutzt die volle Morgendrot-Oberfläche (**`ui/`**, Alpine) als **Werkstatt**:

- Kacheln und Funktionen kombinieren (was jeweils fertig ist, z. B. Messenger + Tresor).
- **Messenger** und andere Profile **exportieren** (`exports/`, Stapel, `.env` für Kunden-PCs und Geräte).
- **Konfiguration** und Rollen verteilen (`DEVICE_ROLES`, Provisioning, ggf. Remote-Signer).

Das ist die **organisatorische** Zentrale: Definition, Bundles, Vorgaben.

## Technisch: eine Instanz pro Gerät

Jedes laufende System (Boss-PC, Kunden-Messenger, Raspi, …) hat weiterhin:

- eine **eigene** Node-Prozess-Instanz,
- eine **eigene** `.env` / Adresse / Ports (bei mehreren Instanzen).

Der Boss ist **nicht** ein einziger Server, der alle Endgeräte „von innen“ bedient – es sei denn, ihr baut **bewusst** genau so einen Dienst (siehe unten).

## Kommandant zwischen Boss und Arbeitern (z. B. Raspi)

Ein **Kommandant** kann **zwischen** Boss und vielen **Arbeitern** stehen:

- **Lokales Netz:** ein Raspi sammelt z. B. Schloss, Drohne, Sensoren (viele kleine Endpunkte).
- **Ein Kanal nach oben:** zum Boss, zur Chain, Streams, Monitoring – je nach Setup.
- **Vorteil:** weniger direkte Internet-Endpunkte pro Feldgerät, einfachere Firewall, optional Offline-Puffer.

Rollen und Befehlsfluss im Code: **`ROLE`**, `BOSS_ADDRESS`, `WORKER_ADDRESSES`, `KOMMANDANT_ADDRESSES`; Tests: `npm run test:arbeiter-kommandant-boss`, **`docs/TEST-ARBEITER-KOMMANDANT-BOSS-BEWEIS.md`**.

## „Eine zentrale App für alle Endgeräte“

Das kann **sinnvoll** sein für:

- **Orchestrierung** (Befehle verteilen),
- **Status** (Heartbeats, Radar),
- **Aggregation** (Logs, Alarme),
- ein **einheitliches Dashboard** nach außen.

Es ist eine **Architekturentscheidung** und sollte von der Frage getrennt werden, **wo** signiert wird und **wo** Geheimnisse (Seeds, Vault) liegen – siehe **`docs/DISCUSSION-OPEN.md`**.

## Siehe auch

- **`docs/BOSS-MODUS.md`** – Remote-Signer, Maschinen nur mit Adresse.
- **`README.md`** (Abschnitt Boss / Remote-Signer, Ameisen-Hierarchie).
- **`docs/DEV-START.md`** – Boss-Werkstatt vs. Next-Kunden-UI.
- **`docs/architecture.mmd`** – High-Level-Diagramm.
