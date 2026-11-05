# Team-Wire Boss-Signatur (`sig`) — Freeze 2026-07-03

**Spec:** `docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md` §3.1, §3.5  
**Code:** `src/shared/morg-team-wire-signature.ts`

## Schema

| Feld | Wert |
|------|------|
| Algorithmus | **Ed25519** via IOTA `signPersonalMessage` / `verifyPersonalMessageSignature` |
| Nachricht **M** | UTF-8: `MORG_TEAM_WIRE_SIG_V1:` + kanonisches JSON **ohne** Feld `sig` |
| Kanonisch | Rekursiv sortierte Objekt-Keys (`stableTeamWireJsonStringify`) |
| `sig` (Wire) | Base64-String (SDK-Ausgabe von `signPersonalMessage`) |
| Gültigkeit | Signer-Adresse (aus Pubkey) muss **`boss`** im JSON entsprechen (lowercase 0x+64 Hex) |

## Betroffene Wires

- `MORG_TEAM_MEMBER_UPDATE_V1` — **`sig` Pflicht** ab Freeze (Boss setzt beim Senden)
- `MORG_TELEGRAM_ALARM_GROUP_V1` — **`sig` optional**, empfohlen bei Rotation

Nicht signiert: `MORG_TEAM_JOIN_REQUEST_V1` (Antragsteller), `MORG_TEAM_UPDATE_PING_V1` (nur Hinweis).

## Empfänger-UI

| Status | Verhalten |
|--------|-----------|
| **valid** | „Boss-Signatur verifiziert“ — „Daten übernehmen“ normal |
| **missing** | Legacy — Hinweis, Übernahme weiter möglich |
| **invalid** / **boss-mismatch** | Übernahme **blockiert** |

## Server-Signer (echte Boss-Sig ohne Browser)

Neuer Endpunkt `POST /api/team-sync/sign-team-wire` (nur Boss/Kommandant):

- Body `{ payload }` (Team-Wire-JSON **ohne** `sig`).
- Baut **M** via `buildTeamWireSignBytes`, signiert mit dem In-Process-SDK-Signer (`signPersonalMessageWithSdkSigner`, benötigt `SIGNER=sdk` + entsperrten Tresor).
- Antwort `{ ok, sig }` — Base64 wie SDK-`signPersonalMessage`; passt zu `verifyTeamWireSignature`.
- `409`, falls kein SDK-Signer bereit (gesperrt / anderer Signer-Modus).

Damit entstehen echte Boss-`sig` auch für **API-Publishes** (LAN-Push/`.morg-pkg`), nicht nur bei Boss-Browser-Publish (`trySignTeamWirePayload`).

## Offen (Backlog)

- Optional: Signatur auch über Boss-`.morg-pkg`-Transport (Spec §10)

## Feldtest-Stand (2026-07-07)

- **`sig`-Freeze verifiziert** (`apk-h36-join-queue-sig-fieldtest.mjs`): gültige Sig → „verifiziert", ungültige → „Übernahme blockiert". UI-Logik **PASS**.
- **Echte Boss-Sig E2E — PASS (headless):** `scripts/h36-real-boss-sig-verify.mjs` gegen entsperrten Boss (`signer=sdk`): echte Server-Signatur (`/api/team-sync/sign-team-wire`) → `verifyPersonalMessageSignature` liefert Signer-Adresse **== `boss`**; Fake-Sig wird abgelehnt. Signieren + Verifizieren des Freeze-Schemas kryptografisch bestätigt (unabhängig von der Geräte-UI). Logbuch 2026-07-07.
