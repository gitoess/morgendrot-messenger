# Deploy-Checkliste — Nach neuem Move-Package

**Zweck:** Zentrale „Nach dem Deploy“-Anleitung für dieses Repo. Bei jedem neuen **`PACKAGE_ID`** (Testnet/Mainnet) diese Liste der Reihe nach abarbeiten.

**Stand:** 2026-05-20  
**Verknüpft:** **`docs/DEPLOY-MOVE-M4d.md`** (M4d-Funktionen, letzte Testnet-IDs), **`docs/PACKAGE-ID-NEU-DEPLOYEN.md`** (Erst-Deploy ohne ID), **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** § **8** (Manifest), **`docs/examples/package-profiles.manifest.json`** (Referenz-JSON).

---

## Kurzüberblick (Reihenfolge)

| # | Schritt | Pflicht |
|---|---------|---------|
| 1 | Move-Package deployen → **`PACKAGE_ID`** | Ja |
| 2 | **`create_globals`** → Registry-IDs | Ja (pro neuer PACKAGE_ID) |
| 3 | **`.env`** aktualisieren | Ja |
| 4 | Backend **neu starten** | Ja |
| 5 | **`package-profiles.manifest.json`** pflegen + Sync | Ja (Bundle/Helfer) |
| 6 | Messenger testen (Hard-Refresh) | Empfohlen |

---

## 1. Move-Package deployen

Im **Projektroot** (PowerShell: Befehle **einzeln**, kein `&&`):

**Erst-Deploy oder bewusst neues Package:**

```powershell
cd c:\Users\damast\Desktop\morgendrot
npm run deploy:move-package
```

**Code-Fix / neue Funktion — gleiche PACKAGE_ID und Mailbox-IDs:**

```powershell
npm run upgrade:move-package
```

Entscheidungshilfe: **`docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md`**.

**Ergebnis Publish:** Neue **`PACKAGE_ID`** + **`UPGRADE_CAP_ID`** in **`.env`** (Skript `scripts/deploy-move-package.ts`).

**Ergebnis Upgrade:** Gleiche **`PACKAGE_ID`** — kein neues Handoff, kein `create_globals`.

**Manuell:** `cd move-test` → `iota move build` → `iota client publish` — siehe **`docs/PACKAGE-ID-NEU-DEPLOYEN.md`**.

**Enthält aktuell u. a.:** Shared-Mailbox, **`create_private_mailbox`**, **`create_team_mailbox`**, **`store_team_plaintext_broadcast`**, **`purge_team_plaintext_broadcast`** (M2c Team-Broadcast Rebate), **`purge_private_mailbox`**, **`purge_*_private`** (Aufräumen vor Rebate), `store_*_private`.

**M2c Team-Broadcast:** Nach Deploy zusätzlich **`docs/DEPLOY-MOVE-M2c-TEAM-BROADCAST.md`** (Gruppe ↔ Team-Mailbox, Smoke).

---

## 2. `create_globals` — Shared-Objekte anlegen

**Einmal pro neuer `PACKAGE_ID`.** Alte `MAILBOX_ID` / `VAULT_REGISTRY_ID` gehören zum **alten** Paket.

```powershell
iota client call --package <PACKAGE_ID> --module messaging --function create_globals --gas-budget 50000000 --json
```

Aus dem Event **`GlobalsCreated`** (`parsedJson`) notieren:

| `.env`-Key | Event-Feld |
|------------|------------|
| `MAILBOX_ID` | `mailbox_id` |
| `VAULT_REGISTRY_ID` | `vault_registry_id` |
| `COMMAND_REGISTRY_ID` | `command_registry_id` |

Zusätzlich in `.env`:

```env
USE_MAILBOX=true
```

**Optional (Node):**

```powershell
node --import tsx -e "import { setEnvKey } from './src/config.js'; setEnvKey('PACKAGE_ID','0x…'); setEnvKey('MAILBOX_ID','0x…'); setEnvKey('VAULT_REGISTRY_ID','0x…'); setEnvKey('COMMAND_REGISTRY_ID','0x…');"
```

---

## 3. `.env` aktualisieren

Mindestens:

```env
RPC_URL=https://api.testnet.iota.cafe
PACKAGE_ID=0x…
MAILBOX_ID=0x…
VAULT_REGISTRY_ID=0x…
COMMAND_REGISTRY_ID=0x…
USE_MAILBOX=true
```

**MY_ADDRESS**, Partner, Signer, Gas usw. unverändert lassen, sofern dieselbe Wallet weiter genutzt wird.

Vorlage: **`.env.example`** (alle Keys kommentiert).

**Referenz (letzter Testnet-Stand im Repo):** Tabelle in **`docs/DEPLOY-MOVE-M4d.md`** § „Letzter Deploy“.

---

## 4. Backend neu starten

Laufende API beendet und neu starten, damit **`CFG`** die neuen IDs lädt:

```powershell
npm run dev
```

(oder `npm run start:secrets` / Messenger-Bundle: `npm start` im Export-Ordner.)

**Prüfen:**

- `GET /api/status` → `packageId`, **`mailboxId`** (voll, nicht nur maskiert)
- Posteingang / „Meine Mailboxen“: Shared-Zeile zeigt neue **`MAILBOX_ID`**

**Nur PACKAGE_ID hot-setzen (ohne Neustart):** `POST /api/command` mit `/set-package-id` — **ersetzt nicht** `create_globals` und **nicht** Schritt 5 (Manifest).

### Alte Nachrichten / Bilder nach neuem Deploy

| Quelle | Wo liegt sie? | Warum UI nur wenige Zeilen zeigt |
|--------|----------------|----------------------------------|
| **Shared-Mailbox (IOTA)** | Im **Mailbox-Objekt** `MAILBOX_ID` von **diesem** `create_globals` | Neues Deploy = **neues** leeres Postamt; alte ~100 Zeilen hängen an der **alten** `MAILBOX_ID` |
| **Package-ID im Posteingang-Filter** | Wechselt nur Events / Paket-Modul | **Scannt nicht** automatisch die alte Mailbox — dafür brauchst du die **alte** `MAILBOX_ID` |
| **Mesh (Funk)** | `localStorage` (`morgendrot.meshLocalMessages.v1`) | Unabhängig von Mailbox; nur auf **diesem** Browser |
| **Telegram** | `.morgendrot-telegram-journal.json` (Server) | Eigener Pfad — kann sichtbar sein, obwohl Mailbox fast leer ist |
| **Bilder / Dateien** | In der **Nachricht** (`[[MORG_COMPACT_IMG_V1:…]]`, `.morg-pkg`, …) | Ohne Laden der **richtigen** Mailbox-Zeilen fehlen die Anhänge in der Liste |

**Alte Mailbox wieder lesen (Boss):**

1. Alte `MAILBOX_ID` aus alter `.env` / Explorer / Notizen (zum **alten** `PACKAGE_ID`-Deploy).
2. Kurz in Server-`.env` eintragen **oder** Eintrag in `package-profiles.manifest.json` mit **Paar** `packageId` + `mailboxId` (siehe `docs/examples/…`).
3. API neu starten, Posteingang laden (ggf. Package-ID aus Verlauf wählen).

**Typische Mailbox-Fehler:** `MAILBOX_ID` = `PACKAGE_ID` („move package passed“), falsche/leere `MAILBOX_ID`, RPC-Timeout bei `getDynamicFields` — prüfe `GET /api/status` → `configHints`.

**Pflege-Tabelle (empfohlen, lokal — nicht ins Git):**

| Deploy-Datum | PACKAGE_ID | MAILBOX_ID | Notiz |
|--------------|------------|------------|--------|
| 2026-05-20 | `0xf817…e504` | `0xd140…b3a4` | siehe `docs/DEPLOY-MOVE-M4d.md` |
| … | … | … | alte Zeilen vor neuem Deploy |

Kopie der **alten** Zeile vor `.env`-Überschreiben — sonst fehlen Mailbox-Inhalte (Bilder/Dateien in DF), auch wenn Events über Package-Verlauf wieder kommen.

---

## 5. `package-profiles.manifest.json` aktualisieren

**Warum:** Standard-Einsatzprofile (**Katastrophenschutz**, **Feuerwehr Standard**, **Training**) im Bundle brauchen **echte** IDs — `REPLACE_*` oder veraltete `0x…` führen zu leeren Profil-Wechseln (Roadmap **§ H.24b**).

### 5.1 Vorlage bearbeiten

Datei öffnen:

`frontend/public/templates/package-profiles.manifest.json`

Pro Profil (oder mindestens für **Training** / euren Haupt-Einsatz):

- Alle **`REPLACE_*`** durch Werte aus Schritt 2–3 ersetzen (`packageId`, `mailboxId`, `vaultRegistryId`, `commandRegistryId`)
- **`rpcUrl`** passend zum Netz (z. B. Testnet: `https://api.testnet.iota.cafe`)
- **`apiBaseUrl`** = URL **dieser** Installation (z. B. `http://127.0.0.1:3342`)
- Optional: **`label`**, **`description`**, **`color`** anpassen

**Kopie als Referenz:** `docs/examples/package-profiles.manifest.json` (Beispiel mit Testnet-IDs + `_labNote`).

**Produktion:** Feuerwehr und Katastrophenschutz = **getrennte Installationen** mit **eigenen** `create_globals`-IDs — nicht nur andere Labels bei gleichen Chain-IDs (siehe **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** § 7.5).

### 5.2 Sync / Bundle

**Entwicklung (PWA + Lite-UI-Kopie):**

```powershell
npm run sync:package-profiles
```

(Kopiert die Vorlage nach `ui/package-profiles.manifest.json` und `frontend/public/package-profiles.manifest.json`. Läuft auch automatisch vor `npm run build:next`.)

**Messenger-Standalone / Verkaufs-Bundle:**

```powershell
npm run bundle:messenger
```

Legt u. a. ab:

- `exports/Morgendrot-Messenger-standalone/package-profiles.manifest.json`
- `exports/…/config/package-profiles.manifest.json`
- `exports/…/docs/examples/package-profiles.manifest.json` (Referenz)

---

## 6. Testen

| Check | Erwartung |
|-------|-----------|
| Browser **Hard-Refresh** (PWA) | Kein alter `PACKAGE_ID`-Cache |
| Setup / Status | `packageId` + `mailboxId` stimmen mit `.env` |
| Chat / Posteingang | Fetch gegen neue Shared-Mailbox |
| **Telefonbuch → Meine Mailboxen** | Shared-Zeile + private Mailboxen |
| Private Mailbox **löschen** | Dialog: Inhalt zählen → **Aufräumen** → Rebate (TX im Explorer unter **txblock**) |
| **M2c Team-Broadcast** (nach Publish) | `TEAM_MAILBOX_ID=0x… npx tsx scripts/test-team-broadcast-smoke.ts` — siehe **`docs/DEPLOY-MOVE-M2c-TEAM-BROADCAST.md`** |

Funktions-Checkliste: **`TESTING.md`**. Deploy-Logbuch: **`docs/TEST-RUN-LOGBOOK.md`**.

---

## Checkliste zum Abhaken

```
[ ] npm run deploy:move-package → PACKAGE_ID notiert
[ ] create_globals → MAILBOX_ID, VAULT_REGISTRY_ID, COMMAND_REGISTRY_ID in .env
[ ] USE_MAILBOX=true, RPC_URL korrekt
[ ] Backend neu gestartet
[ ] GET /api/status: mailboxId + packageId OK
[ ] package-profiles.manifest.json: REPLACE_* ersetzt
[ ] npm run sync:package-profiles oder bundle:messenger
[ ] Messenger Hard-Refresh + Kurztest Senden/Fetch
```

---

## Häufige Fehler

| Symptom | Ursache | Fix |
|---------|---------|-----|
| „MAILBOX_ID fehlt“ in UI | `.env` leer / API alt | Schritt 2–4 |
| Posteingang leer / falsches Paket | Alte PACKAGE_ID | Schritt 1–4, Banner **`docs/MESSENGER-PACKAGE-ID-BANNER.md`** |
| Rebate Private Mailbox schlägt fehl | Mailbox nicht leer | UI **„Private Mailbox löschen“** → Aufräumen + löschen |
| Profil-Button nutzlos | Manifest mit Platzhaltern | Schritt 5 |
| Explorer zeigt keine TX | Nur Object-URL geöffnet / TX failed | **txblock**-Link; Status in API-Antwort prüfen |

---

## Weitere Dokumentation

| Thema | Datei |
|-------|--------|
| M4d private Mailbox + letzte IDs | **`docs/DEPLOY-MOVE-M4d.md`** |
| **M2c Team-Broadcast Publish** | **`docs/DEPLOY-MOVE-M2c-TEAM-BROADCAST.md`** |
| Erstes Deploy ohne Package-ID | **`docs/PACKAGE-ID-NEU-DEPLOYEN.md`** |
| Einsatzprofile (Konzept) | **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** |
| Messenger-Bundle | **`exports/README.md`**, **`deploy/README-DEPLOY-BUNDLES.md`** |
| ID-Bedeutungen | **`docs/ID-UEBERSICHT-WANN-WELCHE-ID.md`** |
