# Deploy-Pakete: Was braucht man wirklich?

## Kurzüberblick

| Szenario | Ordner / Inhalt | Größe (ohne `node_modules`) | `node_modules` auf dem Gerät |
|----------|-----------------|----------------------------|------------------------------|
| **Raspi Headless** (Schloss, Arbeiter, Monitor ohne Browser-UI) | `src/`, `package.json`, `package-lock.json`, `tsconfig.json`, `.env.example` | wenige MB | `npm install` (mit **`tsx`** in dependencies → optional `npm ci --omit=dev` geht, sobald Lockfile passt) |
| **Raspi + Lite-UI** (Browser-UI wie auf dem PC, kein Next.js) | wie oben **+** `ui/` **+** `profiles/` (Wizard) | `ui/` typisch **&lt; 20 MB** (kein `frontend/`!) | wie oben |
| **Next-Frontend** (`frontend/`) | nur für Entwicklung am PC; **nicht** auf typischem Raspi nötig | **400 MB+** mit `.next` | weglassen |
| **ESP32 / Tiny** | **Kein** Morgendrot-Node-Repo auf dem Chip | nur **Kilobyte** Firmware + `identity.h` / C-Header aus dem Wizard | — |

**Wichtig:** Auf dem ESP32 läuft **kein Node.js** und **nicht** dieses Repository. Der Chip bekommt nur eine **kleine Firmware** und die **Config als C-Code** (Provisioning-Schritt „ESP32“). Ein optionaler **Gateway** (oft wieder ein Raspi mit dem **headless**-Paket) nimmt HTTPS/HMAC entgegen und spricht mit der Chain.

---

## Unbedingt nötig (Node / Raspi)

1. **`package.json`** + **`package-lock.json`** – Abhängigkeiten festnageln.  
2. **`tsconfig.json`** – `tsx` kompiliert/interpretiert die `src/`-Dateien.  
3. **`src/`** – kompletter TypeScript-Code (Messenger, Chain, Lock, API, …).  
4. **`.env`** (oder `.env.example` als Vorlage) – Konfiguration.  

**Produktion / VPS (Sponsor-Seed & Co.):** Klartext-Secrets nur auf der Platte ist ein Betriebsrisiko. **Optionen:** (1) **`ENCRYPTED_ENV_FILE`** + `npm run start:secrets` (lokal verschlüsselt, siehe **`docs/SECRETS-OPTIONS.md`** Option B); (2) **externer Secret-Manager** (z. B. Doppler: `doppler run -- npm start`) — Einordnung, Grenzen („RAM ist kein absoluter Tresor“) und kleine Schritte: **`docs/SECRETS-OPTIONS.md`** Option C. **GitHub Secrets** allein ersetzen keinen Laufzeit-Tresor auf dem Server — sie dienen primär **CI/CD**.

**Nicht** nötig für reines Headless-Betreiben:

- `frontend/` (Next.js)  
- `ui/` – nur wenn `ENABLE_UI=true` (Lite-UI über die API)  
- `profiles/` – nur für Boss-Wizard (`/api/profiles`, ZIP-Export mit Template)  
- `move-test/` – nur zum **Move-Package bauen/publishen** (meist am PC)  
- `ai-training/`, `docs/`, `scripts/` – nicht zur Laufzeit des Workers  

---

## Pakete erzeugen

### Windows (Desktop-Ordner)

```powershell
cd pfad\zu\morgendrot
npm run pack:deploy
```

Legt auf dem **Desktop** an (Standard):

- `Morgendrot-Raspi-headless`
- `Morgendrot-Raspi-lite-ui`
- `Morgendrot-ESP32-Tiny` (nur Doku + Platzhalter)

Anderes Zielverzeichnis:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/pack-deploy-bundles.ps1 -OutputRoot "D:\deploy"
```

### Linux / macOS

```bash
chmod +x scripts/pack-deploy-bundles.sh
./scripts/pack-deploy-bundles.sh
# oder mit Ziel:
./scripts/pack-deploy-bundles.sh "$HOME/Desktop"
```

---

## Auf dem Raspi nach dem Kopieren

```bash
cd Morgendrot-Raspi-headless   # oder lite-ui
npm ci --omit=dev              # oder: npm install --omit=dev
cp .env.example .env           # anpassen
npm run start:headless         # ENABLE_UI=false
```

Mit Lite-UI-Paket: in `.env` **`ENABLE_UI=true`** setzen, dann startet die API und bedient die Dateien unter `ui/`.

---

## ESP32

Siehe Ordner **`Morgendrot-ESP32-Tiny`** bzw. **`deploy/esp32-tiny-README.md`** im Repo: nur Konzept + Checkliste, **kein** 200 MB Code auf dem Chip.
