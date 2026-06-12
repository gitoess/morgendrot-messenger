# API: Einsatz-Manifest Mainnet (§ H.33)

**Zweck:** Boss/Kommandant/Werkstatt können **Mainnet-Anker** der `EinsatzManifestRegistry` über die lokale API abfragen — ohne Browser-Direct-RPC (Tor/SOCKS, CORS, fehlende `MAINNET_RPC_URL` im Client).

**Client:** `frontend/frontend/lib/api/einsatz-manifest-api.ts`  
**Server:** `src/api/routes/handle-einsatz-manifest-routes.ts`  
**Kern-RPC:** `@morgendrot/core/iota` (`fetchEinsatzManifestAnchorsForEinsatz`, `probeEinsatzManifestAnchorOnChain`)

**Fallback:** UI-Funktionen `listEinsatzManifestAnchorsOnMainnet` / `probeEinsatzManifestSequenceOnChain` versuchen zuerst die API; bei **403** oder **Offline** Direct-RPC wie bisher.

---

## Berechtigung

`ROLE=boss`, `ROLE=kommandant` oder `ROLE=messenger` (Werkstatt). Andere Rollen: **403**.

---

## GET `/api/einsatz-manifest/config`

Liefert aufgelöste Einsatz-ID, Registry-/Package-Hinweise und Kettenmodus.

**Query (optional):** `einsatzId` — UTF-8-Einsatz-ID überschreiben (sonst `${HANDOFF_LABEL}-${PACKAGE_ID[0:10]}`).

**Response (200):**

| Feld | Bedeutung |
|------|-----------|
| `chainMode` | `EINSATZ_CHAIN_MODE` (Default `mainnet-direct`) |
| `showManifestAnchorUi` | `false` bei `mainnet-direct-no-rollup` |
| `einsatzIdUtf8` | Aufgelöste Einsatz-ID |
| `einsatzIdMoveAddress` | SHA-256 → 32-Byte Move-Adresse |
| `einsatzManifestRegistryId` | aus `EINSATZ_MANIFEST_REGISTRY_ID` |
| `mainnetPackageId` | `MAINNET_PACKAGE_ID` oder `PACKAGE_ID` |
| `mainnetRpcUrl` | nur Boss/Kommandant (sonst nur `mainnetRpcUrlLabel`) |
| `registryConfigured` / `mainnetPackageConfigured` | Booleans |

---

## GET `/api/einsatz-manifest/anchors`

Listet Dynamic-Field-Anker (`EinsatzManifestKey`) für einen Einsatz.

**Query (optional):** `einsatzId`

**Response (200):** `{ ok: true, einsatzIdUtf8, einsatzIdMoveAddress, rows: EinsatzManifestAnchorRow[] }`

**Fehler:** **400** fehlende Registry/Package; **502** Mainnet-RPC-Fehler.

---

## GET `/api/einsatz-manifest/probe`

Prüft, ob Sequenz **N** unter der Registry existiert.

**Query:** `sequence` (Pflicht, ≥ 0), optional `einsatzId`

**Response (200):** `{ ok: true, exists: boolean, sequence, einsatzIdUtf8, einsatzIdMoveAddress }`

---

## Umgebungsvariablen (Server)

| Variable | Verwendung |
|----------|------------|
| `EINSATZ_MANIFEST_REGISTRY_ID` | Registry-Objekt (Mainnet) |
| `MAINNET_PACKAGE_ID` | Move-Package auf Mainnet (Fallback: `PACKAGE_ID`) |
| `MAINNET_RPC_URL` | Mainnet-RPC (Fallback: `https://api.mainnet.iota.cafe`) |
| `HANDOFF_LABEL` / `PACKAGE_ID` | Default-Einsatz-ID |
| `EINSATZ_CHAIN_MODE` | Modus A/B/C |

---

## Siehe auch

- **`docs/DEPLOY-MOVE-H33-EINSATZ-MANIFEST.md`** — Registry deployen
- **`docs/ROADMAP-FAHRPLAN.md`** § **H.33e** Phase 4
- **`docs/EINSATZ-MANIFEST-MOVE-SKIZZE.md`** — Move-Semantik
