# Produkt-Register — Morgendrot-Familie

**Stand:** 2026-11-05  
**Zweck:** Agent- und Maintainer-Übersicht. Getrennte Repos, getrennte App-IDs. Änderungen immer nur im aktiven Workspace-Root.

## Landschaft

| Produkt | Lokal | Android-ID | Kern | Nicht |
|---------|-------|------------|------|--------|
| **Morgendrot Messenger** | `Desktop/morgendrot` | `de.morgendrot.messenger` | Einsatz, Boss, Handoff, Multi-Transport (IOTA + Funk + Telegram), IoT/Schloss/Monitor | — |
| **Light / IOTA Messenger** | `Desktop/iota-messenger` | `de.iota.messenger` | Wallet, Chat (IOTA+Funk+Telegram), Gruppen, Transfer, Telefonbuch | Boss, Handoff, Einsatzleitung, SOS, Schloss, Shop, Monitor, Geräte-Steuerung |
| **IOTA Mesh** (optional, später) | `Desktop/iota-mesh-messenger` | `de.iota.mesh` | Light + Funk-Stub → später Meshtastic | Boss/Handoff/Telegram/SOS; echtes Funk-Senden erst Phase 2 |

## Light: verbotene Dashboard-Blöcke

Diese Kacheln/Module gehören **nur** Morgendrot-Voll:

- Einsatzleitung / Team / Export (Organisations-Werkstatt)
- Handoff-ZIP, Helfer-QR (WLAN)
- Zugang / Schlüssel / Türschloss / NFT-Berechtigungen
- Zahlung / Freischalten (Shop/Credits)
- Überwachung / Sensoren / Geräte / Heartbeat
- Steuerung / Boss-Modus / Admin-Kanäle

**Nuance Kontakte:** Light **behält** das Chat-Telefonbuch (Name, `0x…`, Peering-QR). Light **verliert** Einsatz-Team-Roster und Boss-Kontaktverteilung.

**Transports in Light:** Funk + Telegram sind **erlaubt** (Sendepfade + Posteingang „Alle“). Boss-/Einsatz-Werkstatt bleibt draußen.

## Light: erlaubtes Zielbild

```
Wallet anlegen/importieren
RPC + PACKAGE_ID + MAILBOX_ID
Peering / Handshake
1:1-Chat (Klartext + E2EE) über IOTA, Funk, Telegram
Gruppen (lokal; pairwise on-chain)
IOTA-Transfer
Einstellungen (API-Basis/APK, Appearance)
Chat-Telefonbuch
```

Technik: `PRODUCT_ID` + Capacitor-`appId` + UI-Gates (`product-identity.ts`, `dashboard-workspace-tile-visibility.ts`). Spec: [`IOTA-MESSENGER-EDITION-V1.md`](./IOTA-MESSENGER-EDITION-V1.md).

## Sync-Modell (Morgendrot ↔ Light)

**Eine Quelle der Wahrheit:** Shared Chat/Wallet/Inbox-Code zuerst in **Morgendrot**. Light ist Fork + Produkt-Patches — nicht parallel doppelpflegen.

| Was | Primär | Light |
|-----|--------|--------|
| Chat, Wallet, Inbox, Telefonbuch, Evidenz-Viewer, Layout | Morgendrot | Re-Sync oder gezielter Port |
| Boss, Handoff, Einsatz, Schloss, Monitor | nur Morgendrot | nie |
| `product-identity`, appId, Runtime-Caps, Hide-Flags | nur iota-messenger | nach Sync erneut patchen |
| `.morgendrot-vault*`, Kontakt-JSON | pro Repo getrennt | nur bewusst kopieren |

**Re-Sync Light:**

```bash
cd Desktop/iota-messenger
node scripts/bootstrap-from-morgendrot.mjs "C:\Users\damast\Desktop\morgendrot"
node scripts/apply-product-patches.mjs
npm run smoke:light-boundary
```

Manuelles File-Copy nur für Hotfixes; Normalweg = Bootstrap + Patches.

## Agent-Regeln

1. **Aktives Repo = einziges Änderungsziel**, außer der Nutzer sagt explizit „in beiden / allen“.
2. Shared Features: **Morgendrot first**, dann Light nachziehen.
3. Light nie wieder Einsatz-/Schloss-/Monitor-Kacheln; Boss-Kram nie nach Light.
4. Light-only-Gates nicht nach Morgendrot „zurücksyncen“.
5. Schulden **produktweise** abarbeiten.
6. Nach Light-Transport-/UI-Änderungen: `npm run smoke:light-boundary`.

## Evidenz-Viewer (beide Produkte)

Posteingang → **Werkzeuge** → **On-Chain Bild anzeigen** (Object-ID, Auto-Erkennung). Spec: [`EVIDENCE-IMAGE-AND-NFT-ATTRIBUTES.md`](./EVIDENCE-IMAGE-AND-NFT-ATTRIBUTES.md).

## Schulden-Status (Schreibtisch)

| Thema | Morgendrot | Light |
|-------|------------|-------|
| Native Chat-Shell (`100dvh`, embedded Nav) | Ist | Ist |
| Viewport `device-width` / `viewport-fit` | Ist | Ist |
| Lokales Kontakt-Speichern (APK ohne Basis) | Ist (`contact-directory-local-store`) | Ist |
| Telefonbuch-Toast + UTF-8-Texte | Ist | Ist |
| APK-Feldverifikation Handy-UI | offen | offen |
