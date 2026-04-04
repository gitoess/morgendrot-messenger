# Messenger: Sprachaufnahme (Next-UI)

Ziel: **schnelle Sprachnotiz** direkt im Chat – besonders für **Höhlenrettung / Notfall** (kurze Lagemeldung ohne Tippen).

## Ablauf

1. **Browser** (z. B. Chromium auf **CM4** mit USB- oder MEMS-Mikro): `getUserMedia` + `MediaRecorder` (typisch **WebM/Opus**).
2. **Automatisches Stop** nach **10 Sekunden** bei normalem Memo und bei **SOS**, wenn der Sendepfad **Funk** ist; bei **SOS** mit Sendepfad **Online** bis **35 Sekunden** (gleiches Modell wie der gewählte Transport, kein Netzwerk-Ping).
3. **Backend** `POST /api/messenger-audio-to-opus`: **ffmpeg** mit **libopus** → **Ogg/Opus** (8 kHz Mono, `-application voip`, Standard **8 kbit/s**, siehe Env unten).
4. Die **`.opus`-Datei** wird wie ein normaler **Anhang** in den Composer gelegt; danach wie gewohnt **Senden** (Online oder Funk).

**Wichtig:** Encoding läuft **nur auf dem Rechner mit dem API-Server** (CM4/PC), **nicht** auf **Heltec/ESP32**.

## Voraussetzungen

- **ffmpeg** mit **libopus**. **Empfohlen (portabel):** statisches Binary nach **`tools/ffmpeg/bin/`** legen – siehe **`tools/ffmpeg/README.md`** (Download, Windows/Linux, ggf. DLLs). Der Code nutzt diesen Pfad **zuerst**, ohne System-PATH.
- **Fallback:** `MORG_FFMPEG_PATH` oder `FFMPEG_PATH`, danach Kommando **`ffmpeg`** im PATH des API-Prozesses.
- **HTTPS oder localhost** für Mikrofon-Zugriff (Browser-Policy); auf dem CM4 typisch `127.0.0.1` über Next + Rewrite zum Backend.

## Umgebungsvariablen (optional)

- **`MORG_OPUS_BITRATE`**: z. B. `6k`, `8k`, `12k` (ffmpeg `-b:a`).
- **`MORG_OPUS_USE_SILENCE_REMOVE=1`**: aggressives **silenceremove** (wie `scripts/encode-opus-messenger.mjs`) – nur wenn gewollt.

## Code-Referenzen

- UI: `frontend/frontend/components/chat-view-voice-record.tsx`, Hook `use-chat-view-voice-record.ts`
- Konstante Dauer: `frontend/frontend/lib/messenger-voice-record.ts` (`MESSENGER_VOICE_RECORD_MAX_MS`)
- API: `src/api-server.ts` → `/api/messenger-audio-to-opus`
- Transcode: `src/messenger-audio-opus-encode.ts`
- ffmpeg-Auflösung: `src/ffmpeg-resolve.ts`, Skript: `scripts/ffmpeg-resolve.mjs`

## Offline / ohne ffmpeg

Ohne ffmpeg liefert der Endpoint einen Fehler – weiterhin **Opus-Datei importieren** (Dateiauswahl) oder `scripts/encode-opus-messenger.mjs` auf dem Gerät nutzen.

## Einordnung (Deployment)

Die **direkte Aufnahme** im Browser braucht ein lauffähiges **ffmpeg mit libopus** auf dem API-Host – am einfachsten das **gebündelte** Binary unter `tools/ffmpeg/bin/` (siehe README dort). **Manueller Import** einer vorgefertigten Opus-Datei + ggf. **Skript** bleibt der **robuste Fallback**, besonders wenn der Server kurzzeitig ausgelastet ist oder ffmpeg fehlt. **Qualität in lauter Umgebung** ist mit **Handy-Mikro nah am Mund** oft besser als mit einem **fest verbauten** MEMS im Gehäuse; für den **schnellen** Weg ist trotzdem **ein Knopf im UI + serverseitiges Encoding** die sauberste Architektur, sobald ffmpeg stabil läuft. Kurzfristig: **ffmpeg auf dem CM4 installieren**, Endpoint testen, bei Bedarf **Bitrate** (`MORG_OPUS_BITRATE`) und optional **`MORG_OPUS_USE_SILENCE_REMOVE=1`** setzen.
