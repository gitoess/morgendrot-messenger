# IOTA Messenger

**Eigenständiges Projekt** — Wallet + Mailbox-Chat + Gruppen + IOTA senden.  
**Kein** Boss, Helfer, Handoff, LoRa, Telegram, SOS.

Technische Basis: Move-Messenger-Protokoll (aus Morgendrot abgeleitet, siehe `UPSTREAM.md`).

## Voraussetzungen

- Node.js 20+
- Deployed `PACKAGE_ID` + `MAILBOX_ID` auf Testnet oder Mainnet

## Ersteinrichtung

```bash
npm install
cd frontend && npm install && cd ..
cp .env.example .env
# .env: PACKAGE_ID, MAILBOX_ID, RPC_URL eintragen
npm run dev
```

- **UI:** http://127.0.0.1:3341  
- **API:** http://127.0.0.1:3342 (optional — Kernflows laufen auch per Direkt-RPC)

## APK (Android)

```bash
cd frontend
npm run apk:debug:build
```

## Was Phase 1 enthält

- Produkt-Identität `product-identity.ts` — Boss/Handoff/LoRa/Telegram/SOS ausgeblendet
- Capabilities-Preset (`.morgendrot-runtime-config.json`) — nur IOTA-Transport
- Env-Preset — `SIGNER=sdk`, kein Remote-Signer
- Solo-Onboarding (Wallet auf Gerät, Peering-QR)

## Nicht in Phase 1

- Eingebaute Testnet-Chain-IDs im APK
- App-Store-Release
- Separates Move-Package

## Lizenz

AGPL-3.0-or-later — siehe `LICENSE` und `UPSTREAM.md`.
