# Dashboard: Erste Schritte & Einrichtung

Diese Seite ersetzt den früher großen Kasten auf der Startseite — hier kannst du in Ruhe lesen (auch offline, nachdem die PWA den Inhalt gecacht hat).

## Adresse, Package-ID, RPC

**Deine Adresse** (`MY_ADDRESS`), **Package-ID** und **RPC** kommen typischerweise aus dem **Bundle der Basis** (Server-`.env`) — nicht alles lässt sich in der Web-App ändern. Über **Einstellungen → .env anpassen** (Config-View) kannst du viele Keys setzen; `MY_ADDRESS` kannst du auf der Startseite auch über **„Eigene Adresse“** aus bekannten Adressen wählen (schreibt `.env` und aktualisiert die laufende Konfiguration).

## Lite messenger (`UI_VARIANT=messenger`)

- **Boss:** Unter „Arbeitsbereich & Projekte“ kann **Volldashboard** gewählt werden (Arbeitsbereich `full`: Nachrichten, Tresor, Steuerung, Geräte-Radar — ohne Zugangs-/Überwachungs-Kacheln; im `UI_VARIANT=full`-Hauptprojekt weiterhin alle Module). Standard ist schlank wie beim Helfer, wenn du auf **Messenger-Projekt** stellst.
- **Andere Rollen:** Nur **Nachrichten** und **Tresor** (inkl. Notfall) — keine weiteren Kacheln, Einsatz schlank.

## Nützliche Links in der App

- **Hilfe (Kurz + Befehle):** `GET /api/help` — im Dashboard über den Hilfe-Button.
- **Handbuch:** `/handbook` — mehrere Markdown-Artikel, u. a. PWA, Ports, Messenger.

## Tresor

Solange der **Tresor gesperrt** ist (Passwort-Dialog), hat die Backend-Sitzung keine Keys im RAM. Entsperren auf der Startseite; Details siehe Tresor-Ansicht und Messenger-Header („Tresor: …“).
