# Move-Deploy § H.33 — `EinsatzManifestRegistry` (Mainnet)

**Stand:** 2026-06-02  
**Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md` § H.33** Phase 2  
**Move-Spec:** **`docs/EINSATZ-MANIFEST-MOVE-SKIZZE.md`**  
**Boss-Keys im Handoff:** **`docs/EXPORT-ASSISTENT-REFERENZ.md`** § Boss-only

---

## Wann ist das nötig?

| `EINSATZ_CHAIN_MODE` | Registry auf Mainnet? |
|----------------------|------------------------|
| **mainnet-direct** (B) | Optional (Rollup am Einsatz-Ende) |
| **testnet-with-mainnet-anchor** (A) | **Ja** — forensischer Kern |
| **mainnet-direct-no-rollup** (C) | **Nein** — nur Einzel-TXs im Explorer |

Die Funktionen liegen im Modul **`messaging`** (nicht separates Paket):

- `create_einsatz_manifest_registry`
- `store_einsatz_manifest`
- `set_manifest_authorized_anchorer`

Sie sind Teil von **`npm run deploy:move-package`** / **`npm run upgrade:move-package`** (`move-test/sources/messaging.move`).

---

## Kurzweg (Boss, Mainnet)

Im **Projektroot** (PowerShell: Befehle **einzeln**):

```powershell
cd c:\Users\damast\Desktop\morgendrot

# 1) .env auf Mainnet + Wallet mit Gas
#    RPC_URL=https://api.mainnet.iota.cafe
#    PACKAGE_ID=0x…   (Mainnet-Deploy)
#    BOSS_ADDRESS=0x… (wird authorized_anchorer)
#    MY_ADDRESS=0x…   (gleiche Wallet wie CLI-Signer)

# 2) Falls Package noch ohne H.33-Funktionen: deploy oder upgrade
npm run deploy:move-package
# oder bei gleicher PACKAGE_ID:
# npm run upgrade:move-package

# 3) create_globals wie gewohnt (Messenger-Betrieb)
#    siehe docs/DEPLOY-CHECKLIST.md
```

**Schritt 4 — Registry anlegen (einmal pro Mainnet-PACKAGE_ID):**

**Ohne Terminal (Boss-UI):** Einsatzleitung → **Erweitert** → **Einsatz-Protokoll verankern** → **Mainnet-Registry anlegen** (Puls-Wallet, Gas auf Mainnet — nicht Testnet-Betrieb). Schreibt `EINSATZ_MANIFEST_REGISTRY_ID` per API in `.env`.

**Mit Terminal:**

```powershell
npm run print:create-einsatz-manifest-registry
```

Ausgabe kopieren oder direkt:

```powershell
iota client call --package 0x…PACKAGE… --module messaging --function create_einsatz_manifest_registry --args 0x…BOSS… --gas-budget 20000000 --json > registry-tx.json

npm run apply:einsatz-manifest-registry-from-tx -- registry-tx.json
```

**Backend neu starten.** Prüfen:

- `GET /api/status` → `einsatzConfig.einsatzManifestRegistryId`
- Einsatzleitung → **Einsatz-Protokoll verankern** → **Mainnet-Anker prüfen**

---

## Modus A — Testnet-Betrieb + Mainnet-Anker

Zwei Deployments, zwei RPCs:

| Rolle | Netz | `.env`-Keys |
|-------|------|-------------|
| Helfer-Betrieb | Testnet | `RPC_URL` (Testnet), `PACKAGE_ID` (Testnet) |
| Boss-Anker | Mainnet | `MAINNET_RPC_URL`, `MAINNET_PACKAGE_ID`, `EINSATZ_MANIFEST_REGISTRY_ID` |

**Ablauf:**

1. Testnet: `deploy:move-package` + `create_globals` → Handoff/ZIP für Helfer (wie **`docs/DEPLOY-CHECKLIST.md`**).
2. Mainnet: separates `deploy:move-package` mit `RPC_URL=…mainnet…` → eigene `PACKAGE_ID`.
3. Mainnet: `create_einsatz_manifest_registry` (dieses Dokument) → `EINSATZ_MANIFEST_REGISTRY_ID`.
4. Boss-`.env` **nicht** ins Helfer-ZIP — nur lokal / Export-Assistent Boss-Profil.

```env
# Helfer / Betrieb (Testnet)
EINSATZ_CHAIN_MODE=testnet-with-mainnet-anchor
RPC_URL=https://api.testnet.iota.cafe
PACKAGE_ID=0x…testnet…

# Nur Boss (Mainnet-Anker)
MAINNET_RPC_URL=https://api.mainnet.iota.cafe
MAINNET_PACKAGE_ID=0x…mainnet…
EINSATZ_MANIFEST_REGISTRY_ID=0x…registry…
BOSS_ADDRESS=0x…
```

`authorized_anchorer` = `BOSS_ADDRESS` aus dem **Registry-Call** — nur diese Adresse darf `store_einsatz_manifest` signieren.

---

## Registry-ID aus JSON lesen

Event **`EinsatzManifestRegistryCreated`**:

| Feld | `.env` |
|------|--------|
| `registry_id` | `EINSATZ_MANIFEST_REGISTRY_ID` |
| `authorized_anchorer` | sollte = `BOSS_ADDRESS` sein |

**Skript (empfohlen):** `npm run apply:einsatz-manifest-registry-from-tx -- registry-tx.json`

**Manuell:** In `registry-tx.json` unter `events[]` suchen — `type` endet mit `::EinsatzManifestRegistryCreated`, `parsedJson.registry_id`.

---

## Erster Anker (Smoke)

Nach Registry + laufendem Boss mit Session-Signer (Puls):

1. Einsatzleitung → **Einsatz-Protokoll verankern**
2. **Manifest bauen** (Posteingang mit Nachrichten)
3. **Auf Mainnet ankern** (PTB `store_einsatz_manifest` — Client **`direct-iota-einsatz-manifest-anchor.ts`**)
4. **Mainnet-Anker prüfen** — RPC-Probe `probeEinsatzManifestAnchorOnChain`

Alternativ Schreibtisch ohne UI: Manifest-JSON importieren → Verifizieren.

---

## Fehlerbilder

| Symptom | Ursache | Fix |
|---------|---------|-----|
| `Function not found` | Altes Package ohne H.33 | `upgrade:move-package` oder neues `deploy:move-package` |
| `E_MANIFEST_NOT_AUTHORIZED` (80) | Falscher Signer | Registry mit richtiger `BOSS_ADDRESS` anlegen; Puls-Wallet = Boss |
| Mainnet-Anker prüfen: „nicht gefunden“ | Falsche Registry / Sequenz / Einsatz-ID | `EINSATZ_MANIFEST_REGISTRY_ID`, `MAINNET_PACKAGE_ID`, Manifest-Sequenz |
| Registry fehlt in `/api/status` | `.env` / Neustart | Key setzen, API neu starten |
| CLI vs. RPC Netz mismatch | Testnet-CLI, Mainnet-RPC | `iota client active-env` / RPC_URL angleichen |

---

## Verknüpfung

- **`docs/DEPLOY-CHECKLIST.md`** — Standard-Deploy (Schritt 1–6)
- **`docs/DEPLOY-MOVE-M4d.md`** — M4d-Funktionen im gleichen `messaging`-Modul
- **`docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md`** — Upgrade vs. neues Package
- **`npm run print:create-einsatz-manifest-registry`** — CLI-Befehl aus aktueller `.env`
- **`npm run apply:einsatz-manifest-registry-from-tx`** — `registry_id` → `.env`

---

*Registry ist **unveränderlich** pro `(einsatz_id, sequence)` — Re-Anchor mit gleicher Sequenz schlägt mit `E_MANIFEST_SEQUENCE_EXISTS` (83) fehl.*
