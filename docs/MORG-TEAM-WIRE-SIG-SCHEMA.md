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

## Offen (Backlog)

- Server-Signer ohne Browser (`signPersonalMessageWithSdkSigner`) für reine API-Publishes
- Optional: Signatur auch über Boss-`.morg-pkg`-Transport (Spec §10)
