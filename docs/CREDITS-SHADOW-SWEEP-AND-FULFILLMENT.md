# Credits, Shadow-Sweep, Shop & „Gutschein per Admin“

## Kollidiert der Ablauf mit Shadow-Sweep?

**Kurz: nein — es sind getrennte Mechaniken**, aber **Reihenfolge und Adresse** müssen zur UX passen.

| Mechanismus | Was passiert? |
|-------------|----------------|
| **Shadow-Sweep** (`/shadow-sweep`, `executeShadowSweep`) | Überträgt **IOTA-Coins** (und transferierbare **Nicht-Coin-Objekte**) von der **Schatten-Adresse** auf eine **neu erzeugte Main-Adresse** (einmaliger Sweep). Betroffen: Gas-Reserve (`SHADOW_SWEEP_GAS_RESERVE_MIST`), kein Shop-Code. |
| **Shop / Claim-Token** | Server stellt nach Zahlung einen **Claim-Token** aus; optional **Mint** auf eine **explizit angegebene** `0x`-Adresse (`ENABLE_SHOP_CHAIN_MINT` + Checkout-Feld). |
| **Admin „Credits schenken“** (siehe unten) | Boss signiert **`mint_messenger_credits_batch`** an eine **vorgegebene Empfängeradresse** — gleiche Move-Funktion wie im Provision-Flow, anderer Trigger. |

**Typische Verwechslung:**  
Wenn du Credits auf die **Schatten-Adresse** mintest und der Nutzer **danach** Shadow-Sweep macht: **Messenger-Credits-Objekte** sind Owned Objects — der Sweep versucht, **transferierbare** Nicht-Coins mit auf die neue Main-Adresse zu nehmen (siehe `shadow-sweep.ts`). Das ist **kein „Kollisions“-Fehler**, aber die **App** muss danach die **Main-Adresse** (`MY_ADDRESS`) / Wallet-Import anzeigen — sonst „fehlen“ die Credits in der UI, obwohl sie on-chain auf der Main-Adresse liegen.

**Empfehlung:** Credits **auf die Adresse minten, die der Nutzer langfristig nutzt** (z. B. Main nach Sweep), oder nur **Claim-Token** ausgeben und Mint erst nach Einlösen mit Adresse (späterer Flow).

---

## „Gutschein-Marketing“: Direkt-Minting vom Server (Admin)

**Idee:** Statt Shop-Webhook triggert ein **Admin** die Auszahlung: IOTA-Adresse eingeben → **Credits schenken** → Server führt `mint_messenger_credits_batch` aus und zahlt **Gas mit dem Boss-Wallet**.

**Ist-Zustand im Repo:**

- Die **technische Basis** existiert bereits: **`mintMessengerCreditsBatchForRecipients`** in `chain-access.ts`, aufgerufen u. a. aus **`POST /api/provision-device`** mit `mintMessengerCredits: true` (Bundle-Erstellung, Boss-Passwort).
- Ein **separates Mini-„Admin-Panel“** nur für „Adresse + Betrag“ ist **nicht** als eigene Route ausgelagert — das wäre ein kleines nächstes Feature (geschützter Endpunkt + UI), falls gewünscht.

**Verbesserung der Marketing-Formulierung (präzise):**

- Es ist **nicht „magisch“ ohne Kosten**: Es kostet **Gas in MIST** (und ggf. Betrieb) — nur oft **weniger sichtbar** als ein Shop.
- **Sicherheit:** Nur **vertrauenswürdige Admins** dürfen minten; Route **nicht öffentlich**; Boss-Secrets nie im Client.
- **Doppelboden:** Dieselbe **Credits-Logik** wie im Shop-Mint — konsistente Parameter (`initialBalance`, `maxBalance`, …).

---

## Wo weiterlesen

- Shop-API: **`docs/API-SHOP-SPEC.md`**
- Stripe lokal testen: **`docs/STRIPE-TEST-SETUP.md`**
- Voucher/Claim: **`docs/API-VOUCHER-CLAIM-SPEC.md`**
