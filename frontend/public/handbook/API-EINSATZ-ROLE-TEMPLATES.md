# API: Einsatz-Rollen-Templates (Boss-PC)

**Zweck:** Auf dem **Boss-Rechner** eine Liste von **Einsatz-Vorlagen** (Anzeigename, `chainRole`, `roleId`, optional Kanal-Tag) persistieren. Die **Lite-UI** lädt sie im Provisioning-Wizard; **keine Chain**, keine Secrets.

**Next-PWA (§ H.3g Paket 6):** Einstellungen → **Einsatz-Rollen-Vorlagen** — UI **`frontend/frontend/components/views/settings-view.tsx`**, API-Client **`frontend/frontend/lib/api/einsatz-role-templates.ts`**, **Client-Validierung** (gleiche Regeln wie Server) **`frontend/frontend/lib/einsatz-role-templates-validate.ts`** vor `POST`. **Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md`** § **H.3g** (Pakete **2**/**6**), Ausführungsreihenfolge **§ C.0b** Stufe **3**.

**Datei (Standard):** `.morgendrot-einsatz-templates.json` im Arbeitsverzeichnis des Prozesses — in **`.gitignore`**, nicht committen.

**Override:** Umgebungsvariable **`EINSATZ_ROLE_TEMPLATES_FILE`** = absoluter oder cwd-bezogener Pfad.

---

## GET `/api/einsatz-role-templates`

**Berechtigung:** `ROLE=boss` oder `ROLE=messenger` (Werkstatt).

**Response:** `{ ok: true, templates: EinsatzRoleTemplate[] }`

### `EinsatzRoleTemplate`

| Feld | Typ | Pflicht |
|------|-----|---------|
| `id` | string | ja (Kleinbuchstaben, Zahlen, Bindestrich, 1–64 Zeichen) |
| `label` | string | ja (max. 120 Zeichen) |
| `iconHint` | string | nein (max. 32, z. B. Farbhinweis für spätere UI) |
| `chainRole` | string | ja — einer von: `kommandant`, `arbeiter`, `lock`, `monitor`, `waerter`, `user` |
| `roleId` | number | ja (0–63) |
| `defaultDeploymentChannelTag` | string | nein (max. 120) |
| `handoffSnapshot` | object | nein — **Phase 4:** voller Handoff-Export-Snapshot (`schemaVersion: 1`) |

### `handoffSnapshot` (optional, Phase 4)

| Feld | Inhalt |
|------|--------|
| `presetId` | `helfer` \| `fuehrer` \| `spezial` |
| `bezeichnungHint` | Standard-Bezeichnung (ohne Datum) |
| `tuning` | `roleId`, `helperRole`, `simpleMode`, `omitTeamMailboxes` |
| `capabilitiesOverride` | wie Handoff-Export / Runtime-JSON |
| `export` | `teamMailboxIds`, `partnerAddresses`, `includeIotaArchivReadme`, optionale Chain-IDs |

**Keine Secrets** (kein Passwort, kein Seed). Parser: `src/shared/einsatz-handoff-template-snapshot.ts`.

**Grenzen:** Max. **100** Templates; gespeicherte Datei max. **256 KiB** UTF-8.

---

## POST `/api/einsatz-role-templates`

**Body:** `{ "templates": [ … ] }` — gleiche Struktur wie oben (ohne Wrapper-Version in jedem Eintrag).

**Response:** `{ ok: true, templates: [...], message }` bei Erfolg.

---

## Beispiel

```json
{
  "templates": [
    {
      "id": "medic-1",
      "label": "Medic",
      "iconHint": "red",
      "chainRole": "arbeiter",
      "roleId": 14,
      "defaultDeploymentChannelTag": "Sektor Nord"
    }
  ]
}
```

**Code:** `src/einsatz-role-templates.ts`
