# Betrieb & Lücken — Snapshot 2026-03

**Zweck:** Ein Ort für **Ist-Zustand**, **offene Lücken** und **Git/Logs/Artefakte** — ergänzt **`docs/ROADMAP-FAHRPLAN.md`** § **H.3e**.

---

## 1. Kurz: was im Repo **fertig** ist (Shop / Voucher / Credits)

| Bereich | Ist (Code/Doku) |
|---------|------------------|
| **Voucher-Idempotenz** | `POST /api/voucher-claim`, `.morgendrot-voucher-claim-state.json`, **`docs/API-VOUCHER-CLAIM-SPEC.md`** |
| **Stripe-Shop** | `GET/POST /api/shop/*`, PWA **`/shop`**, Webhook, Session-Claim — **`docs/API-SHOP-SPEC.md`**, **`docs/STRIPE-TEST-SETUP.md`** |
| **PWA-Icons** | `npm run build:pwa-icons` erzeugt PNG aus `frontend/public/icon.svg` (192/512, Apple, 32×32); Manifest siehe **`frontend/app/manifest.ts`** |
| **Credits nach Zahlung (optional)** | `ENABLE_SHOP_CHAIN_MINT`, `mint_messenger_credits_batch` in **`src/api/iota/shop-fulfillment.ts`** |
| **Notify (E-Mail extern)** | `SHOP_CLAIM_NOTIFY_WEBHOOK_URL` / `SHOP_CLAIM_NOTIFY_SECRET` |
| **Shadow-Sweep vs. Mint** | **`docs/CREDITS-SHADOW-SWEEP-AND-FULFILLMENT.md`** |
| **Onboarding / Wallet / Session** | **`docs/ONBOARDING-WALLET-UX-SPEC.md`** — Unlock-Flow, Credits vs. Adresse, Backlog L1–L6; UX-Abgleich **`docs/UX-MESSENGER-INVENTORY.md`** §1 |
| **Recovery Phrase / Signer-Backup** | **`docs/RECOVERY-PHRASE-BACKUP.md`** — Befehl **`/vault-show-signer-import`**, Next **Einstellungen → Wallet & Backup** (`SIGNER=sdk` + Vault mit Import); kein zentraler Key-Speicher |

---

## 2. Lücken & sinnvolle nächste Schritte

| # | Thema | Priorität | Hinweis |
|---|--------|-----------|---------|
| L1 | **`/api/voucher-claim` Stufe 2** | Hoch (wenn Produkt-Voucher) | Move **Burn/Mint** oder Provisioning an **denselben** Token-Flow koppeln — Spec **`docs/API-VOUCHER-CLAIM-SPEC.md`**. |
| L2 | **Admin „Credits schenken“** | Mittel | Dedizierte geschützte Route + UI optional; **Ist-Workaround:** **`POST /api/provision-device`** mit `mintMessengerCredits` — **`docs/CREDITS-SHADOW-SWEEP-AND-FULFILLMENT.md`**. |
| L3 | **Mehrinstanz-Fulfillment** | Mittel (bei Skalierung) | Shop-/Voucher-State aktuell **Datei-basiert** → später **DB** oder verteilter Store. |
| L4 | **SMTP im Core** | Niedrig / bewusst | Stattdessen **Notify-Webhook** an eigenes Mail-Backend. |
| L5 | **Doku synchron** | Laufend | Veraltete „Stub“-Formulierungen in Specs vermeiden; Tabelle **`docs/API-SHOP-SPEC.md`** = Referenz für On-Chain-Zeile. |

---

## 3. Git & Was **nicht** committen

| Muster | Grund |
|--------|--------|
| **`.env`**, `**/.env` mit Secrets | Stripe, RPC, Passwörter |
| **`.morgendrot-*.json`** (State) | Shop-Sessions, Voucher-Claim, ggf. Vault-Handshakes — siehe **`.gitignore`** |
| **`logs/*.log`** | Betrieb; optional nur Muster/Rotations-Policy dokumentieren |
| **`node_modules/`** | Dependencies |

Vor größeren Commits: **`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`**.

---

## 4. Logs

| Mechanismus | Konfiguration |
|-------------|----------------|
| **Winston** | `ENABLE_FILE_LOGGING`, `LOG_MAX_FILES`, `LOG_MAX_SIZE` — siehe **`docs/CONFIG-REFERENCE.md`** |
| **Ausgabe** | Typisch **`logs/morgendrot-*.log`** im Projektroot |
| **Hygien** | Keine **Claim-Tokens**, **Mnemonics**, **Stripe-Rohpayloads** in Support-Tickets kopieren; Shop-Logs nur Präfixe (`claimKeyPrefix`). |

---

## 5. Checks vor Merge / Release

- `npx tsc` (Root)  
- `npm run test`  
- Bei UI-Änderungen: `npm run validate:ui` (siehe **`docs/ROADMAP-FAHRPLAN.md`** § **H.4**)

---

*Dieses Dokument ist ein Snapshot; bei größeren Releases Titel/Datum anpassen oder neue Datei `OPERATIONS-SNAPSHOT-YYYY-MM.md` anlegen.*
