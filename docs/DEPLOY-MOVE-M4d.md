# Move-Paket deployen (M4d: private Mailbox + Rebate)

**Stand:** 2026-05-20  
**Enthält:** `create_private_mailbox`, `purge_private_mailbox`, `purge_*_private` (Aufräumen), `store_*_private`, Shared-Mailbox wie bisher.

**Zentrale Checkliste (Deploy → `.env` → Manifest → Test):** **`docs/DEPLOY-CHECKLIST.md`**

---

## Voraussetzungen

| Was | Prüfen |
|-----|--------|
| **IOTA-CLI** | `iota --version` (idealerweise nah an RPC-Version, z. B. Testnet 1.23.x) |
| **Gas** | CLI-Wallet mit IOTA auf dem Netz aus `.env` (`RPC_URL`) |
| **`.env`** | `RPC_URL=https://api.testnet.iota.cafe` (oder Mainnet) |

---

## Schnellweg (empfohlen)

Details und Abhak-Liste: **`docs/DEPLOY-CHECKLIST.md`**.

Im Projektroot:

```powershell
cd c:\Users\damast\Desktop\morgendrot

# 1) Bauen + publizieren → PACKAGE_ID in .env + .morgendrot-package-id
npm run deploy:move-package

**Enthält u. a.:** `create_private_mailbox`, `create_team_mailbox`, **`store_team_plaintext_broadcast`** (M2c), `create_globals`, Rebate-Purge, **§ H.33** `create_einsatz_manifest_registry` / `store_einsatz_manifest` (Registry-Setup: **`docs/DEPLOY-MOVE-H33-EINSATZ-MANIFEST.md`**).

**M2c (Gruppenchat 1× Fee):** **`docs/DEPLOY-MOVE-M2c-TEAM-BROADCAST.md`**

# 2) Shared-Objekte anlegen (einmal pro neuer PACKAGE_ID)
# <PACKAGE_ID> = Ausgabe von Schritt 1
iota client call --package <PACKAGE_ID> --module messaging --function create_globals --gas-budget 50000000 --json
```

Aus dem Event **`GlobalsCreated`** (`parsedJson`) in die **`.env`** eintragen:

```env
MAILBOX_ID=0x…          # mailbox_id  → Einsatz-Mailbox (Shared)
VAULT_REGISTRY_ID=0x…   # vault_registry_id
COMMAND_REGISTRY_ID=0x… # command_registry_id
USE_MAILBOX=true
```

**Optional per Skript** (nach `create_globals`, IDs aus JSON kopieren):

```powershell
node --import tsx -e "import { setEnvKey } from './src/config.js'; setEnvKey('MAILBOX_ID','0x…'); setEnvKey('VAULT_REGISTRY_ID','0x…'); setEnvKey('COMMAND_REGISTRY_ID','0x…');"
```

```powershell
# 3) package-profiles.manifest.json pflegen (REPLACE_* → neue IDs), dann:
npm run sync:package-profiles

# 4) Backend + Frontend neu starten
npm run dev
```

In der PWA: Hard-Refresh → unter **Persistent (Mailbox)** bzw. **Telefonbuch → Meine Mailboxen** prüfen.

---

## Nur Package-ID hot-setzen (laufende API)

Wenn die API schon läuft und nur die ID wechseln soll:

```http
POST /api/command
{ "cmd": "/set-package-id", "args": ["0x…neue PACKAGE_ID…"] }
```

Nach **neuem** Deploy immer noch **`create_globals`** für diese PACKAGE_ID — alte `MAILBOX_ID` gehört zum alten Paket.

---

## Befehle testen (Tresor entsperrt)

| Befehl | Zweck |
|--------|--------|
| `/create-private-mailbox` | Private Mailbox on-chain |
| `/purge-private-mailbox 0x…` | Rebate (Owner, Mailbox leer) |

```powershell
# Smoke gegen laufende API (optional)
$env:UNLOCK_PASSWORD="…"
npx tsx scripts/test-create-private-mailbox-command.ts
```

---

## Manuell (ohne npm-Skript)

```powershell
cd move-test
iota move build
iota client publish --gas-budget 100000000
```

Package-ID aus TX/Explorer → `PACKAGE_ID` in `.env`, dann `create_globals` wie oben.

Ausführlicher Alt-Text: **`docs/PACKAGE-ID-NEU-DEPLOYEN.md`**.

**Mehrere Packages im Messenger (später):** **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** — jedes Deploy = eigene Installation; Standard-Profile (KS, Feuerwehr, Training) ins Bundle-Manifest nach Org-`create_globals`, nicht automatisch durch `npm run deploy:move-package` allein.

---

## Letzter Deploy (dieses Repo, Testnet)

| Key | Wert |
|-----|------|
| **PACKAGE_ID** | `0x50750755dda4661e8dfce3a20ab86b32e533673fd7998bd56694a3e7d174d517` |
| **MAILBOX_ID** | `0x0140d9b206d74c9d0fb5d4e25ac336b23970c5eed717beb83af4479970eb6969` |
| **VAULT_REGISTRY_ID** | `0x656d7af9d0472052c769d017bc48a721a0063ffefe28306b3b28148242745ab1` |
| **COMMAND_REGISTRY_ID** | `0x15b1d53acf02a2e28b2a62de9efc2e06d1dd1f6512319428603519f1900b88ba` |
| **create_globals TX** | `HPowcofzYP4HmQ8N5YedbU9qefB8XkGnpEzQyPLXeUZK` |
| **Neu in Move** | `store_team_plaintext_broadcast` (M2c Gruppenchat) |

Nach `.env`-Update: **API neu starten**, damit `GET /api/status` die neue `mailboxId` liefert.
