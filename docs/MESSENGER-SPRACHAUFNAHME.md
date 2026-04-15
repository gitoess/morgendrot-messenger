# Messenger: Sprachaufnahme (Next-UI)

Ziel: **schnelle Sprachnotiz** direkt im Chat – besonders für **Höhlenrettung / Notfall** (kurze Lagemeldung ohne Tippen).

## SOS-Hilferuf: Text vs. Sprache — **was passiert genau?**

Die UI unterscheidet **zwei Hilferufe** (beide nur bei **echtem Bedarf**; kein Ersatz für **112** und keine Garantie, dass Dritte mitlesen):

| Pfad | Du tust | Technisch (vereinfacht) | Was der Empfänger / die Basis sieht |
|------|---------|---------------------------|----------------------------------------|
| **SOS — Hilferuf (Text)** | Text im Composer schreiben, dann roten Button **„SOS — Hilferuf (Text)“** | Vor dem Versand wird der Klartext in einen **`[[MORG_EMERGENCY_V1:…]]`**-Umschlag gepackt (Wire-Notfall). Funk: App sendet mit **höchster Burst-Priorität** (`Flash`), damit der Hilferuf vor großen Bild-/Routine-Paketen rausgeht. | In der Oberfläche erscheint der Inhalt mit **`[SOS]`**-Präfix (siehe `chat-message-display-normalize`). Die **Basis** kann solche Nachrichten **priorisiert** in Warteschlange / später IOTA verarbeiten — Details **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`**. |
| **SOS-Sprache** (orangener Bereich) | **SOS-Sprache** aufnehmen → Opus-Anhang → **„SOS jetzt über LoRa senden“** (wenn Funk aktiv) | Aufnahme wird ebenfalls als **Notfall** (`MORG_EMERGENCY_V1` / `emergencyWire: 'voice'`) gekennzeichnet und mit **kurzer** Nutzlast / nachgelagerter Audio-Logik gesendet — **kein** „beliebig langer Sprachclip = ein LoRa-Frame“. | Empfänger erhält markierte Notfall-Nachricht; genaue Byte-Aufteilung Phase B → **`MORG-EMERGENCY-SOS-WIRE-SPEC.md`** §2.4. |

**Wichtig:** Ein Hilferuf ist **kein** automatischer **Rettungsdienst-Anruf**. Er geht an den **gewählten Chat-Partner** bzw. den **konfigurierten Messenger-/Mesh-Pfad** — Reichweite und Zuverlässigkeit hängen von **Funk, Basis und Einsatzprofil** ab (**`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**).

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

## TTS / STT (Roadmap **§ H.18**)

**Text-to-Speech** (Nachrichten vorlesen) und **Speech-to-Text** (Diktat statt Tippen) sind **sinnvoll** als spätere Ergänzung (Barrierefreiheit, Freihand), stehen aber **nicht** im gleichen Pfad wie **Opus-Sprachmemo** oder **SOS-Wire**. Abwägung: Cloud-Dienste vs. **On-Device**, Offline, Datenschutz — siehe **`docs/ROADMAP-FAHRPLAN.md`** **§ H.18**.

## Einordnung (Deployment)

Die **direkte Aufnahme** im Browser braucht ein lauffähiges **ffmpeg mit libopus** auf dem API-Host – am einfachsten das **gebündelte** Binary unter `tools/ffmpeg/bin/` (siehe README dort). **Manueller Import** einer vorgefertigten Opus-Datei + ggf. **Skript** bleibt der **robuste Fallback**, besonders wenn der Server kurzzeitig ausgelastet ist oder ffmpeg fehlt. **Qualität in lauter Umgebung** ist mit **Handy-Mikro nah am Mund** oft besser als mit einem **fest verbauten** MEMS im Gehäuse; für den **schnellen** Weg ist trotzdem **ein Knopf im UI + serverseitiges Encoding** die sauberste Architektur, sobald ffmpeg stabil läuft. Kurzfristig: **ffmpeg auf dem CM4 installieren**, Endpoint testen, bei Bedarf **Bitrate** (`MORG_OPUS_BITRATE`) und optional **`MORG_OPUS_USE_SILENCE_REMOVE=1`** setzen.
