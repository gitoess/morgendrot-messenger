# Morgendrot Messenger (Launcher)

Kein zweites Repository: Dieser Ordner enthält nur **npm-Skripte**, die im **übergeordneten** Morgendrot-Projekt starten und dabei `UI_VARIANT=messenger` setzen.

**Eigenes Desktop-Fenster:** [`../morgendrot-messenger-desktop/`](../morgendrot-messenger-desktop/README.md).

**Kopierbarer Messenger-Ordner (ohne ganzes Repo):** Im Hauptrepo `npm run bundle:messenger` → `exports/Morgendrot-Messenger-standalone/` (siehe [`../exports/README.md`](../exports/README.md)).

## Was passiert?

- **Gleiches Backend**, gleiche `.env` wie im Hauptprojekt (liegt in `../`).
- Die **Lite-UI** (`ui/index.html`) blendet Kacheln wie Steuerung, Streams, Tresor usw. aus und zeigt den **Nachrichten**-Ablauf inkl. Handshake, verschlüsselt/Klartext und Posteingang.
- Zusätzlich eine **Minibar**: eigene Adresse, Package-Auswahl, **IOTA überweisen**, Links zu Setup und `.env`.

## Start

Voraussetzung: Im Ordner `..` ist `npm install` bereits ausgeführt.

```bash
cd morgendrot-messenger
npm start
```

Das führt `npm start` im **Hauptprojekt** aus (App + Streams-Mock wie dort), nur mit Messenger-Oberfläche.

Nur Backend ohne zweiten Prozess:

```bash
npm run start:backend
```

## Konfiguration

Optional in der **Haupt**-`.env` (nicht zwingend dieser Ordner):

```env
UI_VARIANT=messenger
```

Dann reicht auch im Hauptverzeichnis `npm start` – die UI ist ebenfalls im Messenger-Modus.

Siehe auch `.env.example` in diesem Ordner.
