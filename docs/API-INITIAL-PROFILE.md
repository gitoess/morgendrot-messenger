# API: `initialProfile` (Provisioning)

**Endpoint:** `POST /api/provision-device` (Boss/Messenger-Rolle)

**Doppel-POST / Idempotenz:** **`docs/API-PROVISION-DEVICE-IDEMPOTENCY-SKIZZE.md`** — optionaler **`Idempotency-Key`** (Header) bzw. **`idempotencyKey`** (Body); Boss-Lite-UI sendet den Header. Replay derselben **200**-Antwort (u. a. **`deviceSecretForGateway`** bei Tiny).

**Zweck:** Neben `envContent` / `jsonConfig` optional ein **lokales Einsatzprofil** übergeben: Kontakte (Name + IOTA-Adresse), **Anzeige-Tags** (z. B. „Medic“, „Sektor Nord“). Das ist **kein** On-Chain-Metadaten-Feld — siehe **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`**, **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`**.

## Request (optional)

Feld **`initialProfile`** im JSON-Body:

| Feld | Typ | Pflicht |
|------|-----|---------|
| `version` | `1` | ja |
| `deploymentChannelTag` | string | nein (max. 120 Zeichen, z. B. „Sektor Nord“) |
| `contacts` | Array | ja (darf leer sein) |
| `metadata` | Objekt | nein — **flache** Schlüssel → String-Werte (v1), siehe **`docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md`** |
| `validUntil` | Zahl | nein — Unix-Zeit **ms**; nach Ablauf sollen Clients lokale Daten entsorgen (**Honor-System**) |
| `offlineBriefing` | string | nein — max. **2000** Zeichen; Kurznotiz (z. B. „Was tun bei Funkabbruch?“). **Klartext** im Paket; in der PWA nach Import optional in **localStorage** angezeigt — **kein** automatischer Vault ohne expliziten Vault-Schritt. |

**`contacts[]`:**

| Feld | Typ | Pflicht |
|------|-----|---------|
| `name` | string | ja (1–120 Zeichen nach Trim) |
| `address` | string | ja (`0x` + 64 Hex) |
| `roleTags` | string[] | nein (max. 20 Tags, je max. 48 Zeichen) |

**Grenzen:** Max. **200** Kontakte; serialisiertes Profil max. **65536** Bytes UTF-8; keine doppelten Adressen. **`metadata`:** max. **48** Schlüssel; Schlüssel `[a-zA-Z0-9_.-]{1,64}`; Werte nach Trim max. **2048** Zeichen (Zahl/Bool werden zu String); **keine** verschachtelten Objekte in v1 — komplexe Daten als **JSON-String** in einem Wert.

### Namens-Anker (Team-Konvention, nicht automatisch erzwungen)

Das **„Gesetzbuch“** für freiwillige **`metadata`**-Schlüssel — damit in drei Monaten noch klar ist, was ihr damit meintet. **Kein** Pflicht-Move-Upgrade; Werte bleiben **Strings**. UI-Dropdowns (Label → Key) sind **Roadmap** (siehe **`docs/BOSS-ORIENTIERUNG.md`**).

- **`teamid`** — Beispiel: `sektor-sued`, `zentrale`. Nur nötig, wenn ihr **nicht** nur **`deploymentChannelTag`** für dieselbe Semantik nutzt; **nicht** dieselbe Zuordnung doppelt führen.
- **`gear`** — Beispiel: `funkgeraet`, `sanitaet`. Frei vereinbart; Anzeige in der App = eigene Client-Logik.
- **`sector_label`** — Beispiel: `Sektor Süd` (menschenlesbar); Filter können bei euch `teamid` bevorzugen.

Neue Keys: hier und in **`docs/BOSS-ORIENTIERUNG.md`** kurz dokumentieren.

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

## Client (Helfer-Gerät / Next PWA)

**Einstellungen → „Einsatz-Profil / Kontakte“** (`frontend/frontend/components/views/settings-view.tsx`):

- JSON einfügen oder **`.json`-Datei** laden (vollständiges `jsonConfig` oder nur `initialProfile`).
- **„Jetzt ins Telefonbuch“** → `POST /api/contact-labels/apply-initial-profile`.
- **„Für später merken“** → `localStorage` (`morgendrot.pendingInitialProfileJson`); beim erreichbaren Backend läuft der Import automatisch (`tryApplyPendingInitialProfileFromStorage` in `frontend/frontend/lib/initial-profile-import.ts`, Hinweis-Banner im Dashboard).

**IndexedDB** wird nicht genutzt — eine Quelle der Wahrheit: Backend **`.morgendrot-contact-labels.json`**.

**Code (Server):** `src/initial-profile-provision.ts` (`parseAndValidateInitialProfile`).
