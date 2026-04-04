# Raspberry Pi: Arbeiter installieren & mit Boss (PC) testen

Du hast auf dem Pi einen Ordner mit **`config.json`**, **`.env`** und **`template.json`** (Profil-Export). So geht es weiter.

---

## Wichtig vorweg

| Datei | Rolle auf dem Pi |
|--------|------------------|
| **`.env`** | **Wird von Morgendrot gelesen** (`dotenv`). Alle Laufzeit-Settings müssen hier stimmen. |
| **`config.json`** | **Wird von der Node-App nicht automatisch geladen.** Dient als Referenz / für andere Tools. Wenn du nur `config.json` hast, Werte **manuell in `.env` übernehmen** (oder Export im Wizard erneut mit `.env` machen). |
| **`template.json`** | Profil-Defaults / Dokumentation – optional auf dem Pi. |

Starte die App **immer im Ordner, in dem die `.env` liegt** (oder setze den Pfad explizit, siehe unten).

---

## 1. Raspberry Pi vorbereiten

1. **Node.js** (LTS, z. B. 20 oder 22): [nodejs.org](https://nodejs.org/) oder Paketquelle für Debian/Raspberry Pi OS.
2. **IOTA CLI** (`iota` im `PATH`):
   - Nur nötig, wenn auf dem Pi **`SIGNER=cli`** (oder `sdk`) steht.
   - Bei **`SIGNER=remote`** signiert der **Boss** – auf dem Pi reicht dann **kein** Keystore, aber die App muss trotzdem Transaktionen **bauen/ausführen** können (SDK ruft den Remote-Signer auf). Praxis: **Remote-Signer + gleiche `RPC_URL` / `PACKAGE_ID` wie Boss.**

3. **`npm install` schlägt fehl?** Häufige Ursachen auf dem Pi:
   - **Node-Version:** `node -v` ≥ 20 empfohlen (`curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -` …).
   - **Speicher:** zu wenig RAM → Swap erhöhen oder `export NODE_OPTIONS=--max-old-space-size=512` vor `npm install`.
   - **Netzwerk/Firewall:** Pi muss `registry.npmjs.org` erreichen.
   - Im Projektordner: `npm install --no-audit --no-fund` (weniger Overhead).
   - Falls weiterhin Fehler: **komplette Fehlermeldung** (letzte 30 Zeilen) speichern – oft fehlen Build-Tools (`sudo apt install -y build-essential`).

4. **Projekt auf den Pi bringen** (eine der Varianten):
   - **A)** Gesamtes Repo kopieren/konen (`git clone` …) – empfohlen zum Testen.
   - **B)** Nur das Nötige: mindestens `package.json`, `src/`, `tsconfig.json`, ggf. `scripts/` – dann im Projektroot `npm install`.

5. **Plug-and-play (empfohlen):** Auf dem **Boss-PC** in der `.env` **`BOSS_SIGNER_PUBLIC_URL=http://<LAN-IP-des-Boss>:3340/sign`** setzen. Beim Wizard **Hardware „IoT-Gateway (Raspi)”** wählen → exportierte `.env` enthält dann **`SIGNER=remote`**, **`REMOTE_SIGNER_URL`**, **`RPC_URL`**, **`PACKAGE_ID`**, **`BOSS_ADDRESS`**, **`MY_ADDRESS`** (nach Key-Generierung).

6. **`.env`** in das **Projektroot** legen (dort, wo `package.json` liegt), **oder** nur in deinem Arbeiter-Ordner starten und Env laden:

   ```bash
   cd /pfad/zum/morgendrot
   export $(grep -v '^#' /pfad/zum/arbeiter-ordner/.env | xargs)
   npx tsx src/worker-headless.ts
   ```

   Einfacher: **`.env` ins Repo-Root kopieren** (oder symlink), dann normal starten.

---

## 2. Befehl auf dem Pi (Terminal)

**Headless (kein UI/API auf dem Pi – typisch für Tor/Schloss):**

```bash
cd /pfad/zum/morgendrot
npm install
npm run start:headless
```

Entspricht im Kern: `ENABLE_UI=false` → startet **`wallet-bridge`** ohne API-Server.

**Mit lokalem UI/API auf dem Pi** (selten nötig):

```bash
ENABLE_UI=true npm run start:secrets
# oder: npm run start  (wie in package.json)
```

**Als Systemd-Dienst (optional):** Unit-Datei mit `WorkingDirectory=/pfad/zum/morgendrot`, `ExecStart=/usr/bin/npm run start:headless`, `EnvironmentFile=/pfad/zum/morgendrot/.env`.

---

## 3. Boss auf dem PC (Windows)

1. **Gleiches Repo**, `.env` mit Boss-Rolle, **`WORKER_ADDRESSES`** / Hierarchie wie im Wizard gesetzt.
2. **Boss-Signer** starten (Maschinen ohne eigenes Wallet):

   ```bash
   npm run boss-signer
   ```

   Standard-Port oft **`3340`**. Healthcheck: Browser oder `curl http://127.0.0.1:3340/health`.

3. **Netzwerk:** Pi muss den PC erreichen können:
   - In der **Arbeiter-`.env`** auf dem Pi:  
     `REMOTE_SIGNER_URL=http://<LAN-IP-des-PC>:3340/sign`  
     (nicht `localhost` – das wäre der Pi selbst.)
   - **Windows-Firewall:** eingehend TCP **3340** für das LAN erlauben.

4. **Auf dem Pi** (Arbeiter):
   - `SIGNER=remote`
   - `REMOTE_SIGNER_URL=http://<PC-IP>:3340/sign`
   - `MY_ADDRESS=<Adresse des Arbeiters>` (vom Boss vergeben)
   - `BOSS_ADDRESS=<Boss-Adresse>`
   - `PACKAGE_ID`, `RPC_URL` wie beim Boss / Deployment
   - Für Schloss/Tor: `ROLE=lock` **oder** `ROLE=arbeiter` mit `LOCK_ID` / `MY_ADDRESS` je nach Setup (siehe `wallet-bridge`: Lock-Modus bei `lock`/`arbeiter` + `LOCK_ID` oder `MY_ADDRESS`)

Wenn der Boss-Signer nach Passwort fragt: **Keystore-Passwort** des Boss-Wallets eingeben.

Details: **`docs/BOSS-MODUS.md`**, **`docs/DEMO-4-BOSS-SIGNER-Ablauf.md`**.

---

## 4. „Tor“ simulieren (ohne echtes Relais)

Ziel: Beim gültigen **OPEN**-Befehl (verschlüsselt von autorisierter Adresse) soll auf dem Pi **etwas Sichtbares** passieren.

In der **`.env`** des Arbeiters (Lock):

```env
ENABLE_HARDWARE_OPEN=true
OPEN_COMMAND=echo "TOR_SIMULATION_OPEN $(date -Iseconds)" >> /tmp/morgendrot-tor.log
```

Oder ein kleines Skript:

```env
OPEN_COMMAND=/home/pi/bin/tor-demo.sh
```

`tor-demo.sh` ausführbar machen (`chmod +x`), z. B. Inhalt:

```bash
#!/bin/bash
echo "$(date) TOR OPEN" | tee -a /tmp/morgendrot-tor.log
# optional: gpio via raspi-gpio / pigpio
```

Weitere Optionen:

- **`OPEN_URL`:** HTTP GET (z. B. an einen lokalen Mock-Server auf dem Pi).
- **`OPEN_COMMAND_WORDS`:** welche Wörter nach Entschlüsselung zählen (Default `open,öffnen`).

Voraussetzungen auf dem Lock:

- **`ENABLE_LISTENER=true`**
- Handshake / AccessKey / Ticket je nach deinem Sicherheitsmodell (siehe README, `docs/SCHLOSS-EINRICHTEN.md`)
- **`AUTHORIZED_SENDERS`** oder Hierarchie (`BOSS_ADDRESS` / `KOMMANDANT_ADDRESSES`), damit nur der Boss (oder definierte Adressen) triggern darf

**Ablauf zum Testen:**

1. Boss-Signer auf PC läuft.
2. Arbeiter auf Pi: `npm run start:headless`.
3. Vom **Messenger des Boss** (oder API auf dem PC): verschlüsselte Nachricht mit Öffnen-Wort an die **Lock-Adresse** senden (nach Handshake/Connect, je nach Setup).
4. Auf dem Pi: Log prüfen: `tail -f /tmp/morgendrot-tor.log` und Boss-Signer-Terminal (Signatur bestätigen).

---

## 5. Tests im Repo (Referenz)

- **`npm run test:offline-open`** – Offline-OPEN-Szenario (siehe Skriptbeschreibung).
- **`npm run test:arbeiter-kommandant-boss`** – Hierarchie Boss / Kommandant / Arbeiter.
- Realworld-Tests brauchen oft **zwei Wallets / RPC**; für Pi+PC reicht zuerst der manuelle Ablauf oben.

---

## 6. Checkliste Kurz

| Schritt | Wo | Aktion |
|--------|-----|--------|
| 1 | Pi | Node.js, Repo, `npm install` |
| 2 | Pi | `.env` im Startverzeichnis, `SIGNER=remote`, `REMOTE_SIGNER_URL=http://PC-IP:3340/sign` |
| 3 | PC | `npm run boss-signer`, Firewall Port 3340 |
| 4 | Pi | `npm run start:headless` |
| 5 | PC | Nachricht/Befehl senden → Boss bestätigt Signatur → Pi führt `OPEN_COMMAND` aus |

---

## Siehe auch

- **`docs/M2M-KOORDINATION-EINRICHTEN.md`** – Rollen Boss / Kommandant / Arbeiter  
- **`docs/BOSS-MODUS.md`** – Remote-Signer, Provisioning  
- **`docs/DEMO-4-BOSS-SIGNER-Ablauf.md`** – Schritt-für-Schritt Demo  
- **`docs/SCHLOSS-EINRICHTEN.md`** – Schloss/Tor einrichten  
