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

## Kontakte lokal übernehmen (Boss oder Messenger-Instanz)

**POST `/api/contact-labels/apply-initial-profile`**

- **Body:** dasselbe JSON wie **`initialProfile`** (Root: `version`, `contacts`, …).
- **Wirkung:** schreibt Kontakte in **`.morgendrot-contact-labels.json`** (Merge pro Adresse), inkl. optionaler **`roleTags`** pro Kontakt — siehe `src/contact-labels.ts` (`applyInitialProfileToContacts`).

Die **Lite-UI** bietet nach erfolgreichem Provisioning einen Button **„Kontakte ins Boss-Telefonbuch übernehmen“**, wenn das Paket Kontakte enthält.

---

## Client (Helfer-Gerät / Next)

Import auf dem **Helfer-Gerät** aus Export/ZIP ist weiterhin **optional** (Roadmap § H.3g, Next-PWA) — hier zuerst Boss-seitige Übernahme und Lite-UI.

**Code:** `src/initial-profile-provision.ts` (`parseAndValidateInitialProfile`).
