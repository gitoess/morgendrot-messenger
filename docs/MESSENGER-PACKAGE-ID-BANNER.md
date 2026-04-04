# Messenger: Package-ID-Banner („Neue Protokoll-Version“)

## Zweck

Wenn die **Basis** (`GET /api/status` → `packageId`) eine andere gültige **0x…-64-Hex-ID** meldet als das **explizite** Posteingangs-Feld im Messenger, zeigt die Chat-View einen schmalen Hinweis mit **„Jetzt updaten“**.

- **Leeres** Posteingangs-Feld = Backend-Default (kein eigener Filter) → **kein Banner** (kein Konflikt zweier expliziter Werte).
- **Offline** (`basisUnreachable`): kein Banner, damit nicht über fehlende Status-Daten gemahnt wird.

Logik: `frontend/lib/package-id-compare.ts` → `shouldShowPackageIdMismatchBanner`.

## Aktion „Jetzt updaten“

Ruft dieselbe Kette wie **Setup → Als aktiv speichern**: `applyPackageIdBackend` → `/set-package-id` auf dem **Morgendrot-Server**, `refreshApiStatus`, Filter setzen, `loadMessages('reset')`. Das ersetzt die frühere manuelle „clear inbox“-Idee: der Posteingang wird serverseitig mit der neuen ID neu gezogen; Mesh-lokale Zeilen bleiben im Merge erhalten.

## Sicherheit (Kurz)

Nur sinnvoll bei **vertrauenswürdigem** Backend (TLS, bekannter Host). Kein reines „LocalStorage ohne Server“ – die kanonische ID kommt von `/api/status`.

## Tests

- Modul: `npm run test` enthält `package-id-compare` (siehe `scripts/run-tests.ts`).
- Manuell: vier Checks in **TESTING.md** (Abschnitt Next-Messenger).
