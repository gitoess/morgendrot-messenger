# § H.33 — Einsatz-Manifest-API Smoke (Boss-PC)

**Zweck:** Schreibtisch-Check für **`GET /api/einsatz-manifest/*`** nach **`docs/API-EINSATZ-MANIFEST.md`**. Ersetzt keinen Mainnet-Deploy — Registry muss in `.env` stehen.

**Voraussetzungen:**

| # | Bedingung |
|---|-----------|
| 1 | `npm run dev` oder `npm run dev:role:boss` — API **3342** |
| 2 | `ROLE=boss` (oder `kommandant` / `messenger`) |
| 3 | `.env`: `EINSATZ_MANIFEST_REGISTRY_ID`, `MAINNET_PACKAGE_ID` (oder `PACKAGE_ID`), optional `MAINNET_RPC_URL`, `HANDOFF_LABEL` |
| 4 | Mainnet-RPC erreichbar (für `anchors` / `probe`) |

---

## 1. Config

```powershell
curl -s http://127.0.0.1:3342/api/einsatz-manifest/config
```

**Erwartung:** `{ "ok": true, "chainMode", "einsatzIdUtf8", "einsatzIdMoveAddress", "registryConfigured": true|false }`

Optional mit Override:

```powershell
curl -s "http://127.0.0.1:3342/api/einsatz-manifest/config?einsatzId=test-einsatz"
```

---

## 2. Anker auflisten

```powershell
curl -s http://127.0.0.1:3342/api/einsatz-manifest/anchors
```

**Erwartung:** `{ "ok": true, "rows": [ … ] }` — leeres Array wenn noch kein Anker.

**Fehler 400:** Registry oder Package fehlt in `.env`.

**Fehler 403:** Rolle nicht boss/kommandant/messenger.

---

## 3. Sequenz prüfen

```powershell
curl -s "http://127.0.0.1:3342/api/einsatz-manifest/probe?sequence=1"
```

**Erwartung:** `{ "ok": true, "exists": true|false, "sequence": 1 }`

---

## 4. UI-Fallback

1. Boss-Dashboard → Einsatzleitung → **Erweitert** → **Einsatz-Manifest / Mainnet-Anker**
2. **Mainnet-Anker auflisten** — sollte dieselben Zeilen wie API liefern (API zuerst, Direct-RPC bei 403/Offline)
3. **Sequenz prüfen** — konsistent mit `probe`

---

## 5. Mit § H.32b

1. Anker setzen (oder Mock: `manifestLastSequence` in DevTools)
2. **Einsatz beenden** → lokaler Sequenz-Index weg, **Mainnet-Anker unverändert** (Explorer)
3. Neues Handoff → `config` liefert neue `einsatzIdUtf8`

---

## Protokoll

Ergebnisse in **`docs/TEST-RUN-LOGBOOK.md`** (Datum, Rolle, Registry ja/nein, `rows.length`, Probe `exists`).
