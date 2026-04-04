# AI-Copilot: Lean Linux / Industrie / unter 500 MB

Für später: Auf schlankem Linux (Raspberry Pi, Industrie-PC, Docker) das Gesamtsystem auf **unter 500 MB** bringen.

## „Lean Linux“-Kalkulation (ca. 470 MB gesamt)

| Komponente | Größe | Hinweis |
|------------|--------|---------|
| **Ollama Binary** | ca. 120 MB | Nur die ausführbare Datei, **ohne** schwere Grafiktreiber (CUDA/NVIDIA). CPU-only. |
| **Qwen2-0.5B Modell** | ca. 350 MB | Bereits quantisiert, konstanter Platz. |
| **Betriebssystem** | 0 MB zusätzlich | Minimales System (Alpine, minimales Debian/Ubuntu Server) läuft im RAM / wenig auf SD-Karte. |

**Gesamt:** ca. 470 MB.

## Profi-Weg (Siemens / Industrie)

- **Nicht** den Standard-Installer mit allem: stattdessen **Docker**.
- Image: `ollama/ollama` (CPU-Version) oder spezifische CPU-Variante.
- **Vorteil:** KI isoliert; IOTA-Boss-Signer (ca. 20–50 MB) läuft daneben.
- **Footprint:** Inkl. OS unter **1 GB** auf der Festplatte, **600–800 MB** im RAM.

## Warum „kleinstmögliches“ System

- **Kosten:** Günstigere Hardware (weniger Speicher).
- **Geschwindigkeit:** 500-MB-System bootet in Sekunden, reagiert sofort.
- **Sicherheit:** Weniger Code (MB) = weniger Angriffsfläche.

## Vergleich

- **Windows:** viele GB – „Panzer“.
- **Linux Lean:** Skalpell – für die 5 Kategorien (💬 Chat, 🔒 Lock, 👁️ Monitor, 👑 Boss, 🛡️ Sicherheit) ausreichend.

## Umgebungsvariablen (Ollama)

- `OLLAMA_KEEP_ALIVE=5m` – Modell nach 5 Min. Inaktivität aus dem RAM.
- `OLLAMA_NUM_GPU=0` – nur CPU (spart Grafikspeicher).
- CPU-only Binary unter Linux nutzen (kein CUDA-Paket).

---

## Optional: Fetch.ai („AI-Agent-Gateway“)

Wenn du Fetch.ai (uagents) hinzufügst, wächst das System nur minimal, die Funktionalität verdoppelt sich (autonome Agenten/Verhandlung).

### Linux – „All-in-One“ (ca. 600–650 MB gesamt)

| Komponente | Größe |
|------------|--------|
| Ollama + Qwen-0.5B | ca. 470 MB |
| Fetch.ai uagents (Python-Library) | ca. 30 MB |
| Python-Runtime | ca. 100 MB |
| Morgendrot/Boss-Signer | < 5 MB |

**Rollen:** Lokale KI (Qwen) in Säule 3 übersetzt z. B. „Vermiete die Garage“ in einen Auftrag. Fetch-Agent nimmt den Auftrag, sucht/verhandelt im Netz. IOTA Rebased: Boss-Signer besiegelt PTB (Zahlung + Key). System bleibt unter 1 GB.

### Windows (Zusatz Fetch: ca. 30–50 MB)

- `pip install uagents` – Library winzig; ggf. Python-Umgebung ca. 200 MB.
- Gesamt Windows (Ollama inkl. Grafiktreiber groß): ca. 5–5,4 GB; Fetch fügt nur wenig hinzu.
- Windows eignet sich gut zum Testen (KI + Fetch parallel), bevor das schlanke Paket auf Linux (Industrie) geht.

### Vorteile (Siemens & Co.)

- Keine Cloud-Abhängigkeit (autark).
- Geringe Hardware-Kosten (Gerät 50–100 €).
- Agenten lokal; nur anonymisierte Angebote ins Fetch-Netz.
