# API: `initialProfile` (Provisioning)

**Endpoint:** `POST /api/provision-device` (Boss/Messenger-Rolle)

**Zweck:** Neben `envContent` / `jsonConfig` optional ein **lokales Einsatzprofil** übergeben: Kontakte (Name + IOTA-Adresse), **Anzeige-Tags** (z. B. „Medic“, „Sektor Nord“). Das ist **kein** On-Chain-Metadaten-Feld — siehe **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`**, **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`**.

## Request (optional)

Feld **`initialProfile`** im JSON-Body:

| Feld | Typ | Pflicht |
|------|-----|---------|
| `version` | `1` | ja |
| `deploymentChannelTag` | string | nein (max. 120 Zeichen, z. B. „Sektor Nord“) |
| `contacts` | Array | ja (darf leer sein) |

**`contacts[]`:**

| Feld | Typ | Pflicht |
|------|-----|---------|
| `name` | string | ja (1–120 Zeichen nach Trim) |
| `address` | string | ja (`0x` + 64 Hex) |
| `roleTags` | string[] | nein (max. 20 Tags, je max. 48 Zeichen) |

**Grenzen:** Max. **200** Kontakte; serialisiertes Profil max. **65536** Bytes UTF-8; keine doppelten Adressen.

## Response

Bei Erfolg zusätzlich (wenn `initialProfile` gesendet und gültig):

- **`initialProfile`** — normalisiertes Objekt (gleicher Inhalt wie in **`jsonConfig.initialProfile`**).

## Beispiel

```json
{
  "role": "arbeiter",
  "address": "0x…64hex…",
  "packageId": "0x…",
  "rpcUrl": "https://api.testnet.iota.cafe",
  "initialProfile": {
    "version": 1,
    "deploymentChannelTag": "Sektor Nord",
    "contacts": [
      {
        "name": "Einsatzleitung",
        "address": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "roleTags": ["Einsatzleiter", "Medic"]
      }
    ]
  }
}
```

## Client

Import in die lokale Kontaktliste ist **noch** separat umzusetzen (Lite-UI / Next) — Roadmap **`docs/ROADMAP-FAHRPLAN.md` § H.3g**, Pakete 3–4.

**Code:** `src/initial-profile-provision.ts` (`parseAndValidateInitialProfile`).
