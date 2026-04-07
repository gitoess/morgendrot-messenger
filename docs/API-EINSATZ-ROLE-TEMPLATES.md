# API: Einsatz-Rollen-Templates (Boss-PC)

**Zweck:** Auf dem **Boss-Rechner** eine Liste von **Einsatz-Vorlagen** (Anzeigename, `chainRole`, `roleId`, optional Kanal-Tag) persistieren. Die **Lite-UI** lädt sie im Provisioning-Wizard; **keine Chain**, keine Secrets.

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
