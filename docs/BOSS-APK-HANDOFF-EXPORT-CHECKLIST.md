# Boss-APK — Handoff-Export ohne PC (Weg A, Scheibe 1)

**Zweck:** Vor dem manuellen Test prüfen, ob das Boss-Handy einen Handoff-ZIP **clientseitig** bauen kann (`getApiBase()` leer, kein laufender Boss-Server).

**Nicht dasselbe wie:** Helfer-Standalone-Smoke (`docs/STANDALONE-SMOKE-CHECKLIST.md`) — hier exportiert der **Boss**. **Schritt-für-Schritt-Test:** [`BOSS-APK-WEG-A-MANUAL-TEST.md`](BOSS-APK-WEG-A-MANUAL-TEST.md).

---

## 0. Umgebung (Pflicht)

| # | Check | Wo prüfen |
|---|--------|-----------|
| E1 | **Basis-URL leer** — kein Eintrag unter Einstellungen → „Basis-URL (APK)“, kein `NEXT_PUBLIC_API_BASE` im Build | Einstellungen / `localStorage['morgendrot.apiBaseOverride']` leer |
| E2 | **Boss-Rolle** — APK/Wizard als Boss, nicht Helfer-Handoff-Profil | Onboarding-Pfad `boss` |
| E3 | **Kein Boss-PC nötig** — während Export: PC-API aus oder unreachable | Flugmodus + WLAN aus optional |

---

## 1. Wallet / Signer (Pflicht)

| # | Check | localStorage / Session |
|---|--------|------------------------|
| W1 | Mnemonic/Signer **entsperrt** (Tab-Session oder Tresor) | RAM: `getDirectIotaSessionSignerAddress()` ≠ null |
| W2 | Boss-Adresse **0x + 64 Hex** | `morgendrot.directChain.senderAddress` **oder** Session-Signer |

**Wizard-Schritte:** Wallet anlegen → Mnemonic eingeben → „Signer aktiv“.

---

## 2. Direct-Chain-IDs (Pflicht für `bossContext.ready`)

| # | Check | localStorage-Key |
|---|--------|------------------|
| C1 | **Package-ID** gültig | `morgendrot.directChain.packageId` |
| C2 | **Mailbox-ID** gültig | `morgendrot.directChain.mailboxId` |
| C3 | **Fullnode-URL** gesetzt | `morgendrot.directIotaRpcUrl` (Fallback: `NEXT_PUBLIC_DIRECT_IOTA_RPC_URL`) |
| C4 | Snapshot **frisch genug** (optional Hinweis) | `morgendrot.directChain.savedAtMs` |

**Wizard-Schritte:** Netzwerk-Profil wählen → Deploy/IDs übernehmen (oder manuell Package + Mailbox setzen).

**UI-Hinweis:** Karte „Direct-Chain“ / Autarkie-Zeile — „Package, Mailbox, RPC, Absender“ grün.

---

## 3. Netzwerk-Profil (empfohlen)

| # | Check | localStorage-Key |
|---|--------|------------------|
| N1 | Aktives Profil Testnet/Mainnet | `morgendrot.einsatz.networkProfiles.v1` → `active` |
| N2 | Profil-RPC = Direct-RPC | `testnet`/`mainnet`.rpcUrl ↔ `morgendrot.directIotaRpcUrl` |
| N3 | Kettenmodus (Handoff `.env`) | `morgendrot.einsatz.chainMode.v1` (Default: `mainnet-direct`) |

---

## 4. Export-Parameter (automatisch / Defaults)

| Feld | Quelle offline | Default wenn leer |
|------|----------------|-------------------|
| TTL (`DEFAULT_TTL_DAYS`) | `morgendrot.directChain.ttlDays` | **30** |
| Purge (`ENABLE_PURGE`) | UI-Body / später LS | **true** |
| Boss-Adresse im ZIP | Body oder C3/W2 | — |
| RPC im ZIP | Body oder C3 | Testnet-Default nur wenn RPC fehlt (Export bricht vorher ab) |
| CmdReg / VaultReg | `morgendrot.directChain.commandRegistryId` / `.vaultRegistryId` | leer bis Deploy/create_globals |
| Lagebild (Pinnwand) | Server-.env heute; offline oft leer | optional |
| Telegram-Extras | `morgendrot.handoff.extras.v1` | optional |
| Team-Broadcast-Keys | Client beim ZIP-Build (`enrichHandoffExtrasFromEnvContent`) | auto |

---

## 5. Export auslösen (Abnahme Scheibe 1)

| # | Aktion | Erwartung |
|---|--------|-----------|
| X1 | Boss-Dashboard → **Helfer einrichten** / Handoff-Export → „Nur ZIP“ (ohne Passwort) | Kein Fetch gegen leere URL / kein „Network error“ |
| X2 | ZIP enthält `morgendrot-standalone-handoff.env` | `PACKAGE_ID`, `BOSS_ADDRESS`, `MAILBOX_ID`, `RPC_URL`, `NEXT_PUBLIC_DIRECT_IOTA_RPC_URL` gesetzt |
| X3 | README + ggf. `.morgendrot-runtime-config.json` | wie Server-Pfad |
| X4 | Fehlende Pflicht-ID (z. B. Mailbox löschen) | Klare Meldung: „… fehlt — zuerst Wallet & Netzwerk einrichten“ |

**Negativ:** Basis-URL auf LAN-PC gesetzt → weiterhin **Server-Pfad** (bewusst).

---

## 5b. Schnell-Provision (Abnahme Scheibe 2)

| # | Aktion | Erwartung |
|---|--------|-----------|
| X5 | **Helfer einrichten** → neues Gerät (Mnemonic + ZIP + QR) | Kein `/api/generate-mnemonic`; Adresse + Secret im Browser erzeugt |
| X6 | Seed-QR / Registry-Eintrag | wie mit Server (lokal verschlüsselt in Boss-Registry) |

---

## 6. Explizit **nicht** Scheibe 1–2

- ~~Neues Helfer-Mnemonic ohne Server~~ → **Scheibe 2 (Ist)**
- Unverschlüsseltes ZIP ohne `buildHandoffZipPayload` → **Scheibe 3 (teilweise Ist)**
- ~~Autofill CmdReg/VaultReg ohne `/api/current-ids`~~ → **Scheibe 4 (Ist)**
- Greenfield Move-Deploy nur vom Handy → Backlog — Skizze: [`BOSS-APK-WEG-A-MANUAL-TEST.md`](BOSS-APK-WEG-A-MANUAL-TEST.md) Teil II

---

## Schnell-Debug (DevTools)

```javascript
// Browser-Konsole auf Boss-APK
const ls = (k) => localStorage.getItem(k)
;({
  apiBase: ls('morgendrot.apiBaseOverride'),
  pkg: ls('morgendrot.directChain.packageId')?.slice(0, 12),
  mb: ls('morgendrot.directChain.mailboxId')?.slice(0, 12),
  sender: ls('morgendrot.directChain.senderAddress')?.slice(0, 12),
  rpc: ls('morgendrot.directIotaRpcUrl'),
  ttl: ls('morgendrot.directChain.ttlDays'),
})
```

---

*Pflege: Bei neuen LS-Keys oder Wizard-Schritten diese Liste und `resolveBossHandoffExportContext` synchron halten.*
