# Integrierter Shop (All-in-One) — API & Betrieb

**Ziel:** Zahlung (Stripe Hosted Checkout) und Fulfillment im **gleichen Node-Prozess** wie die Morgendrot-API — **ohne** Kartendaten auf eurem Server (**PCI:** nur Stripe.js / Hosted Page + Webhook-Signatur).

**Code-Lage (Trennung):**

| Bereich | Pfad |
|--------|------|
| Produktkatalog, Checkout, Webhook | `src/api/shop/` |
| On-Chain nach Zahlung (optional Mint, Notify) | `src/api/iota/shop-fulfillment.ts` (`ENABLE_SHOP_CHAIN_MINT`, `mint_messenger_credits_batch`) |
| Messenger / Relay | unverändert (`src/`, `wallet-bridge`, …) |

**Kritische Einordnung (aus Architekturanalyse):**

- **PCI:** Niemals PAN/CVC speichern. Diese Implementierung nutzt **Stripe Checkout** — der Browser lädt die Zahlungsseite von Stripe; ihr speichert nur `sk_`/`whsec_` serverseitig.
- **Blast-Radius:** Ein Kompromittierung des Hosts betrifft Messenger **und** Shop — HTTPS, Updates, minimale Exposed Surface (`ENABLE_SHOP_API=false` default).
- **Last:** Hoher Shop-Traffic kann die API belasten. Mittelfristig: eigenes Worker-Deployment oder Queue; kurzfristig: Rate-Limits (`SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE`).

---

## Konfiguration

| Variable | Bedeutung |
|----------|-----------|
| **ENABLE_SHOP_API** | `true` aktiviert die Routen unten. Default: **false**. Wie andere `/api/*`-Routen: praktisch nur mit **`ENABLE_UI=true`**. |
| **SHOP_PUBLIC_BASE_URL** | Basis für Stripe `success_url` / `cancel_url` (ohne `/` am Ende). Leer → `http://127.0.0.1:<UI_PORT>`. |
| **STRIPE_SECRET_KEY** | `sk_test_…` / `sk_live_…` |
| **STRIPE_WEBHOOK_SECRET** | `whsec_…` für `POST /api/shop/webhook/stripe` |
| **SHOP_STRIPE_PRICE_MESSAGES_500** | Stripe **Price ID** (`price_…`) für das Beispielprodukt |
| **SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE** | Pro IP; **0** = aus. Default **20**. |
| **ENABLE_SHOP_CHAIN_MINT** | Wenn **true**: nach Zahlung optional **`mint_messenger_credits_batch`** an `recipient_iota_address` (Checkout-Metadata), sofern Boss-Adresse/Passwort gesetzt. Default **false**. |
| **SHOP_CLAIM_NOTIFY_WEBHOOK_URL** / **SHOP_CLAIM_NOTIFY_SECRET** | Optional: HTTPS-POST mit `claimToken` etc. an eigenes Mail-Backend (Header `X-Morgendrot-Shop-Notify-Secret`). |
| **SHOP_MINT_BOSS_WALLET_PASSWORD** | Optional: Boss-Passwort für Shop-Mint, wenn kein UI-Unlock (nur sichere Umgebung). |

**State-Dateien** (nicht committen): `.morgendrot-shop-session-claims.json`, `.morgendrot-shop-stripe-events.json`

**Weitere Doku:** **`docs/STRIPE-TEST-SETUP.md`**, **`docs/CREDITS-SHADOW-SWEEP-AND-FULFILLMENT.md`** (Shadow-Sweep vs. Mint).

---

## Routen

### `GET /api/shop/products`

Öffentliches JSON: Produkte mit `configured: true/false` (Price-ID gesetzt).

### `POST /api/shop/checkout-session`

Body: `{ "productId": "…", "customerEmail": "optional@…", "recipientIotaAddress": "optional 0x+64 Hex" }`  
Wenn `recipientIotaAddress` gesetzt ist, landet sie in Stripe-Metadata als **`recipient_iota_address`** (für optionalen Chain-Mint).  
Antwort: `{ "url": "<Stripe Checkout URL>", "sessionId": "cs_…" }` — Client leitet auf `url`.

### `POST /api/shop/webhook/stripe`

Rohbody + Header `Stripe-Signature`. Nur **`checkout.session.completed`** mit `payment_status === paid` erzeugt einen **Claim-Token** (einmal pro Session, idempotent bei Retry).  
Webhook-Events: Idempotenz über **Stripe-Event-ID** (`evt_…`).

### `POST /api/shop/session-claim`

Body: `{ "sessionId": "cs_…" }` — nach Redirect von Stripe; holt den ausgestellten **Claim-Token**, sobald der Webhook gelaufen ist. **202** mit `pending` wenn Webhook noch nicht da.

---

## Anschluss an Voucher-Claim

Der ausgestellte Token ist dasselbe Format wie im E-Mail-Flow: **`POST /api/voucher-claim`** mit `{ "claimToken" }` (sofern `ENABLE_VOUCHER_CLAIM_API=true`). Zusätzlich kann **`runShopFulfillmentChainStep`** bei **`ENABLE_SHOP_CHAIN_MINT`** und **`recipient_iota_address`** im Checkout bereits **Messenger-Credits** minten; sonst bleibt der On-Chain-Schritt für den Claim-Endpunkt (**Burn/Mint laut Move**) in **`docs/API-VOUCHER-CLAIM-SPEC.md`** offen.

---

## Frontend

PWA: **`/shop`** (`frontend/app/shop/page.tsx`) — listet Produkte, startet Checkout, zeigt Token nach erfolgreicher Zahlung.

---

## Stripe Dashboard

1. Produkt/Price anlegen → Price ID in **SHOP_STRIPE_PRICE_MESSAGES_500**.  
2. Webhook-Endpunkt: `https://<host>/api/shop/webhook/stripe`, Events: `checkout.session.completed`.  
3. Redirect-URLs in Stripe dürfen eure **SHOP_PUBLIC_BASE_URL**-Origin entsprechen (lokal: `http://127.0.0.1:3341`).

Schritt-für-Schritt Test (CLI): **`docs/STRIPE-TEST-SETUP.md`**.

## Notify-Webhook (E-Mail extern)

Wenn **`SHOP_CLAIM_NOTIFY_WEBHOOK_URL`** gesetzt ist, sendet der Server nach erfolgreicher Verarbeitung (Token ausgestellt, Event als verarbeitet markiert) einen **POST** mit JSON:

- `sessionId`, `productId`, `claimToken`, `customerEmail` (kann leer sein)

Header optional: **`X-Morgendrot-Shop-Notify-Secret`**: Wert von **`SHOP_CLAIM_NOTIFY_SECRET`**.

Damit kann ein kleines Mail-Backend den **Claim-Token per E-Mail** versenden, ohne SMTP im Morgendrot-Core.
