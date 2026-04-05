# Stripe Test-Integration (lokal oder Staging)

## 1. Dashboard

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **API keys**: **Secret key** `sk_test_…` in `.env` als **`STRIPE_SECRET_KEY`**.  
2. **Products** → Produkt anlegen → **Price** (einmalig) kopieren als **`SHOP_STRIPE_PRICE_MESSAGES_500`** (`price_…`).

## 2. Webhook

**Option A — Stripe CLI (lokal):**

```bash
stripe listen --forward-to http://127.0.0.1:3342/api/shop/webhook/stripe
```

Die CLI zeigt ein **`whsec_…`** — das ist **`STRIPE_WEBHOOK_SECRET`** für diese Session.

**Option B — feste URL (Staging):**

Developers → **Webhooks** → Endpoint `https://<host>/api/shop/webhook/stripe`, Event **`checkout.session.completed`**, Signing secret als **`STRIPE_WEBHOOK_SECRET`**.

## 3. Morgendrot-Env (Auszug)

```
ENABLE_UI=true
ENABLE_SHOP_API=true
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
SHOP_STRIPE_PRICE_MESSAGES_500=price_…
SHOP_PUBLIC_BASE_URL=http://127.0.0.1:3341
```

Next.js leitet `/api/*` auf den API-Port — Shop unter **`http://127.0.0.1:3341/shop`**.

## 4. Optional: direkter Credits-Mint nach Zahlung

```
ENABLE_SHOP_CHAIN_MINT=true
BOSS_ADDRESS=0x…
# Passwort: UI entsperren ODER für Tests:
# SHOP_MINT_BOSS_WALLET_PASSWORD=…
```

Checkout mit **IOTA-Adresse** (Feld in `/shop`) setzt Stripe-Metadata `recipient_iota_address` → Webhook ruft `mint_messenger_credits_batch` auf (Boss signiert, Gas vom Boss).

## 5. Notify-Webhook (E-Mail-Backend)

```
SHOP_CLAIM_NOTIFY_WEBHOOK_URL=https://…/shop-claim
SHOP_CLAIM_NOTIFY_SECRET=…
```

POST-JSON enthält `claimToken`, `sessionId`, `productId`, `customerEmail` — euer Dienst versendet die Mail (nicht im Core-Repo).
