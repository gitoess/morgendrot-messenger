# Betrieb & Lücken — Snapshot 2026-03

**Zweck:** Ein Ort für **Ist-Zustand**, **offene Lücken** und **Git/Logs/Artefakte** — ergänzt **`docs/ROADMAP-FAHRPLAN.md`** § **H.3e**.

---

## Nachtrag (2026-03-28): Doku-Pflege & PWA-Protokoll

| Thema | Pfad / Hinweis |
|--------|----------------|
| PWA-Manual-Protokoll (Tabelle) | **`docs/PWA-MANUAL-CHECKS.md`** — chronologische Sortierung; eine konsolidierte Zeile **2026-03-28** (**§ C.0b** / **§ H.2**: `check:pwa-desk`, `check:pwa-desk:full`, Handbook-Sync, `next-env.d.ts`) |
| Mailbox Event vs. Persistent (SSOT) | **`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`**; API **`messagingPersistenceMode`**, **`sendPlaintextOnly`** / **`forceLegacyPlaintext`**; **`README.md`** Startliste Punkt 2 |
| SOS § H.3n / Tests | **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** (Abgleich); Vitest **`morg-sos-mesh-retry.test.ts`**, **`morg-sos-ack-wire.test.ts`** |
| LoRa-Kompaktbild (Server) | **`prepareImageForLoRaRobust`** — **`src/lora-progressive-image.ts`**, **`POST /api/compact-blob-to-lora-wires`** in **`src/api-server.ts`** |
| Test-Logbuch | **`docs/TEST-RUN-LOGBOOK.md`** — Zeile **2026-03-28** (`test:smoke`, `test:h15-direct-submit`, `check:pwa-desk:full`, Frontend **`test:unit`**) |
| Änderungshistorie (Root) | **`CHANGELOG.md`** — Kurznotizen zu Releases und Doku-Pflege |
| Handy vs. Schreibtisch | Fahrplan **§ C.0b** Stufe **0**/**2**, **§ H.2**: zuerst **`npm run check:pwa-desk`** / **`check:pwa-desk:full`**, danach manuelle **L1–L5** am Gerät (siehe **`docs/PWA-MANUAL-CHECKS.md`**) |

---

## Nachtrag (2026-04-28): H.15 Reihenfolge Stufe 2–3, H.0, H.2

| Thema | Pfad / Hinweis |
|--------|----------------|
| Stufe 2 Client-Submit (Protokoll + Unit) | **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**, **`frontend/frontend/lib/direct-iota-plain-submit.test.ts`**, **`TESTING.md`** |
| Stufe 3 eine Wahrheit (Outbox) | **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8, **`frontend/frontend/lib/api/offline-queue.ts`** (Kopfkommentar) |
| H.0 Wallet & Session in der PWA | **`frontend/frontend/components/views/settings-view.tsx`**, **`docs/ONBOARDING-WALLET-UX-SPEC.md`** § 5 |
| H.2 PWA / Handbuch / SW | **`scripts/sync-pwa-handbook.mjs`** (10 Dateien), **`frontend/public/sw.js`** **`morgendrot-sw-6`**, **`docs/PWA-MANUAL-CHECKS.md`** Protokoll **2026-04-28** |
| H.15 Stufe 4 + Skript | **`TESTING.md`** Ritual **5c**, Root **`npm run test:h15-direct-submit`**, Anhang § 4 **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** |
| H.15 Stufe 3 vertieft | **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8.1 (Backoff/Defer/Bump) |
| § H.1b Mini-Scheibe | **`frontend/frontend/components/views/settings-wallet-session-card.tsx`**, **`frontend/frontend/features/README.md`** |

---

## Nachtrag (2026-04-28): Testläufe & Handy-Fenster

| Thema | Pfad |
|--------|------|
| Dokumentierte Kommando-Läufe (Smoke, Frontend, Core, Realworld-Hinweise) | **`docs/TEST-RUN-LOGBOOK.md`** |
| Entscheidung „ab wann Handy“ | **`docs/HANDY-TEST-WINDOW.md`** |

**Ist-Lauf (lokal):** `test:smoke`, `test:frontend-unit`, `test:core`, `test:h15-direct-submit` **grün**. **`test:messages`** zwei-API ohne zweite Instanz → erwartbar abgebrochen; **`SINGLE_WALLET=1`** → Teilpfade OK, Chain-Senden wegen **`locked`** ausstehend bis UI-Unlock oder konfiguriertes Skript-Unlock.

**Nachziehen (getrennt):** **`npm run test:messages:single`** mit UI-Unlock → **Messenger-Kachel vollständig OK** (siehe **`docs/TEST-RUN-LOGBOOK.md`**). **`npm run test:tickets-accesskey-realworld`** (Alias **`test:realworld`**, **andere Kachel**): weiterhin **CLI/RPC api version mismatch** beim personalisierten Ticket — **Ist-Lücke** Betrieb/Toolchain; Logbuch + **`TESTING.md`** Smoke Punkt 3b — **ohne** Einfluss auf den Messenger-Smoke.

---

## Nachtrag (2026-03-29): Fahrplan & Policy (**Doku**)

| Thema | Pfad / § |
|--------|-----------|
| Backpack-Node, Heltec, Betriebsmodi | **`docs/ROADMAP-FAHRPLAN.md`** **§ H.7b** |
| Boss/Arbeiter-Seed-Custody (Zielbild, kein Implementationszwang) | **`docs/BOSS-WORKER-SEED-CUSTODY.md`**, **§ H.10b**; **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** §6 |
| LoRa/Notfall vs. volle IOTA-TX, Gateway | **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`**, **§ H.3m** |
| Sitzungsreferenz | **`docs/CHAT-PROTOKOLL-2026-03-28.md`** (Nachtrag 2026-03-29) |

**Hinweis:** Doku-Commits inkl. README/Protokoll/Snapshot; **Push** zu **`origin/main`** erledigt (Stand Branch-Tip **`a3afb77`**).

---

## Nachtrag (2026-03-29): Messenger-PWA, Puls, Dev-Netz

| Thema | Pfad / Hinweis |
|--------|----------------|
| PWA **standalone** → Hintergrund → **`/vault-lock`**; Kachel-Wiederherstellung | **`frontend/frontend/components/dashboard.tsx`**, **`chat-view-main-content.tsx`** |
| Posteingang → Telefonbuch | **`chat-view-inbox-list.tsx`**, **`POST /api/contact-label`** |
| Puls Ketten-IDs (Normalize + **`isLikelyIotaHexId`**) | **`chat-view-pulse-settings.tsx`**, **`@morgendrot/core`** |
| Next **16** Dev Cross-Origin | **`frontend/next.config.mjs`** **`allowedDevOrigins`** (Host-Format); **`docs/DEV-START.md`**, **`.env.example`** |
| Protokolle | **`CHANGELOG.md`**, **`docs/TEST-RUN-LOGBOOK.md`**, **`docs/ONBOARDING-WALLET-UX-SPEC.md`** § 2.2.1 |

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
| **Messenger Merge-Ritual / CI** | **`TESTING.md`** § *Qualitätsritual vor Merge*; GitHub **`frontend-checks`** (`lint`, `check:circular`, `tsc`, Vitest) |

---

## 2. Lücken & sinnvolle nächste Schritte

| # | Thema | Priorität | Hinweis |
|---|--------|-----------|---------|
| L1 | **`/api/voucher-claim` Stufe 2** | Hoch (wenn Produkt-Voucher) | Move **Burn/Mint** oder Provisioning an **denselben** Token-Flow koppeln — Spec **`docs/API-VOUCHER-CLAIM-SPEC.md`**. |
| L2 | **Admin „Credits schenken“** | Mittel | Dedizierte geschützte Route + UI optional; **Ist-Workaround:** **`POST /api/provision-device`** mit `mintMessengerCredits` — **`docs/CREDITS-SHADOW-SWEEP-AND-FULFILLMENT.md`**. |
| L3 | **Mehrinstanz-Fulfillment** | Mittel (bei Skalierung) | Shop-/Voucher-State aktuell **Datei-basiert** → später **DB** oder verteilter Store. |
| L4 | **SMTP im Core** | Niedrig / bewusst | Stattdessen **Notify-Webhook** an eigenes Mail-Backend. |
| L5 | **Doku synchron** | Laufend | Veraltete „Stub“-Formulierungen in Specs vermeiden; Tabelle **`docs/API-SHOP-SPEC.md`** = Referenz für On-Chain-Zeile. |
| L6 | **Einsatzleitung / `initialProfile` / Offline-Relay** | **Teil:** Provisioning (`metadata`, `validUntil`), APIs, Lite-UI, Next-PWA — **Offline-Relay-Queue** noch offen | **`docs/API-INITIAL-PROFILE.md`**, **`docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md`**, **`docs/ROADMAP-FAHRPLAN.md` § H.3g–h**. |

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
