# Dashboard: Erste Schritte & Einrichtung

Diese Seite ersetzt den früher großen Kasten auf der Startseite — hier kannst du in Ruhe lesen (auch offline, nachdem die PWA den Inhalt gecacht hat).

## Adresse, Package-ID, RPC

**Deine Adresse** (`MY_ADDRESS`), **Package-ID** und **RPC** kommen typischerweise aus dem **Bundle der Basis** (Server-`.env`) — nicht alles lässt sich in der Web-App ändern. Über **Einstellungen → .env anpassen** (Config-View) kannst du viele Keys setzen; `MY_ADDRESS` kannst du auf der Startseite auch über **„Eigene Adresse“** aus bekannten Adressen wählen (schreibt `.env` und aktualisiert die laufende Konfiguration).

## Zwei Produkte (Messenger vs. Morgendrot Projekt)

Siehe **`docs/PRODUCT-MESSENGER-VS-PROJEKT.md`**.

- **Morgendrot Messenger**: im Repo-Root `npm run dev:messenger` (Backend + Messenger-UI). Nur UI: `cd frontend && npm run dev:messenger` — dann zusätzlich Backend mit `npm run start:secrets` im Root. Produktion: `npm run build:messenger` (im Ordner `frontend`). Backend oft `UI_VARIANT=messenger`.
- **Morgendrot Projekt**: im Repo-Root `npm run dev` (Backend + Projekt-UI). Volle Plattform inkl. Kachel **Nachrichten**; Messenger-Standalone: `npm run bundle:messenger`.

## Nützliche Links in der App

- **Hilfe (Kurz + Befehle):** `GET /api/help` — im Dashboard über den Hilfe-Button.
- **Handbuch:** `/handbook` — mehrere Markdown-Artikel, u. a. PWA, Ports, Messenger.

## Tresor

Solange der **Tresor gesperrt** ist (Passwort-Dialog), hat die Backend-Sitzung keine Keys im RAM. Entsperren auf der Startseite; Details siehe Tresor-Ansicht und Messenger-Header („Tresor: …“).
