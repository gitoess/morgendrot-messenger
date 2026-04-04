# Gebündeltes ffmpeg (Messenger Opus)

Ziel: **ohne System-PATH** funktionierende Sprachmemo- und Opus-Pipeline – Dateien liegen unter `tools/ffmpeg/bin/`.

## Erwartete Struktur

```
tools/ffmpeg/
  README.md          (diese Datei)
  bin/
    ffmpeg.exe       # Windows (x64)
    ffmpeg           # Linux (aarch64 oder x64, ausführbar)
```

Nach dem Entpacken sollte `POST /api/messenger-audio-to-opus` und `scripts/encode-opus-messenger.mjs` das Binary unter **`tools/ffmpeg/bin/`** finden.

## Windows (x64, static „essentials“ mit libopus)

1. **Builds mit libopus** (Beispiel, je nach Verfügbarkeit):
   - [BtbN FFmpeg-Builds (gpl-shared oder gpl)](https://github.com/BtbN/FFmpeg-Builds/releases) – Release **ffmpeg-master-latest-win64-gpl.zip** o. ä. entpacken.
   - Oder [gyan.dev FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/) → *release builds* → ZIP **full** oder **essentials** (muss **libopus** enthalten; bei „essentials“ in der Doku prüfen).

2. Aus dem Archiv nur **`bin/ffmpeg.exe`** (und ggf. benötigte DLLs, falls nicht static) nach **`tools/ffmpeg/bin/ffmpeg.exe`** kopieren.

   - Wenn der Build **viele** DLLs neben `ffmpeg.exe` braucht, alle in **`tools/ffmpeg/bin/`** ablegen (gleicher Ordner wie `ffmpeg.exe`).

3. API/Terminal **neu starten**.

## Linux (CM4 / Raspberry Pi, aarch64)

1. Passendes **static** oder halb-static Build mit **libopus** (Beispiele):
   - [John Van Sickle static builds](https://johnvansickle.com/ffmpeg/) – Archiv für **arm64** wählen, `ffmpeg` extrahieren.
   - Oder Distribution: `apt install ffmpeg` und statt lokaler Kopie **nur** System-PATH nutzen – gebündelter Pfad hat Vorrang, wenn `tools/ffmpeg/bin/ffmpeg` existiert.

2. Binary nach **`tools/ffmpeg/bin/ffmpeg`** legen, ausführbar: `chmod +x tools/ffmpeg/bin/ffmpeg`.

## Git / Repo-Größe

Die Binaries sind **groß** (oft 50–100+ MiB). Optional in `.gitignore` die Dateien unter `tools/ffmpeg/bin/*` ausnehmen und ffmpeg nur auf dem Zielrechner wie oben ablegen – die **README** bleibt die Anleitung für jedes Deployment.

## Auflösungsreihenfolge (Code)

1. `tools/ffmpeg/bin/ffmpeg` bzw. `ffmpeg.exe`  
2. `MORG_FFMPEG_PATH` oder `FFMPEG_PATH`  
3. Kommando `ffmpeg` (System-PATH)
