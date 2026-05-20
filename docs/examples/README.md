# Beispiel-Dateien (Manifeste, Vorlagen)

## `package-profiles.manifest.json`

Referenz für **§ H.24b** Einsatzprofile: drei bundled Profile (**Katastrophenschutz**, **Feuerwehr Standard**, **Training**) mit den Testnet-IDs aus **`docs/DEPLOY-MOVE-M4d.md`** (Stand 2026-05-20).

- **`meta.notes`** und **`_labNote`** pro Profil erklären Lab vs. Produktion.
- Bearbeitbare **Vorlage** (Platzhalter `REPLACE_*`): **`frontend/public/templates/package-profiles.manifest.json`**
- Sync: **`npm run sync:package-profiles`** → `ui/package-profiles.manifest.json`, PWA **`/package-profiles.manifest.json`**
- Messenger-Bundle: **`npm run bundle:messenger`** kopiert Vorlage + dieses Beispiel nach `exports/…/`

Spezifikation: **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** § **8**. Deploy-Reihenfolge: **`docs/DEPLOY-CHECKLIST.md`**.
