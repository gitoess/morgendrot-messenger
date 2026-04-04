# Zwei-Instanzen-Test (z. B. morgendrot + morgendrot-kopie)

So testest du den **kompletten Ticket- und AccessKey-Flow mit zwei echten Wallets** – ohne MY_ADDRESS-Konflikt.

---

## 1. Warum zwei Ordner?

- **Ein Ordner** = eine Morgendrot-Instanz = eine **MY_ADDRESS** (ein Wallet).
- Zwei Instanzen brauchen **zwei verschiedene Adressen** (Verkäufer A, Käufer B).
- Mit **zwei Ordnern** (Original + Kopie) hast du zwei getrennte `.env` → zwei MY_ADDRESS → zwei APIs auf verschiedenen Ports → echtes 2-Wallet-Szenario.

---

## 2. Ordner vorbereiten

| Was | Ordner A (Original, z. B. `morgendrot`) | Ordner B (Kopie, z. B. `morgendrot-kopie`) |
|-----|----------------------------------------|--------------------------------------------|
| **Rolle im Test** | Wallet A (Verkäufer / Lock: Tickets & Keys ausstellen) | Wallet B (Käufer: Tickets nutzen, Keys weitergeben) |
| **MY_ADDRESS** | `0x…` **Adresse A** (dein erstes Wallet) | `0x…` **Adresse B** (zweites Wallet, z. B. neue Adresse mit `/api/generate-address` aus A) |
| **API_PORT** | `3342` (Standard) | `3345` |
| **UI_PORT** | `3341` (Standard) | `3344` (oder anderer freier Port) |
| **PACKAGE_ID** | **Gleich in beiden** (eine Chain, ein deploytes Package) | Gleich wie A |
| **RPC_URL** | Gleich (z. B. Testnet) | Gleich wie A |
| **VAULT_FILE / .env** | Getrennt pro Ordner (z. B. je eigenes Passwort/Vault) | Getrennt |

In **morgendrot-kopie** in der `.env` mindestens setzen:

```env
MY_ADDRESS=0x...   # andere Adresse als im Original!
API_PORT=3345
UI_PORT=3344
# PACKAGE_ID und RPC_URL wie im Original
```

---

## 3. Beide Server starten

1. **Terminal 1 – Instanz A (Original):**
   ```bash
   cd morgendrot
   npm run dev
   ```
   → API: http://127.0.0.1:3342

2. **Terminal 2 – Instanz B (Kopie):**
   ```bash
   cd morgendrot-kopie
   npm run dev
   ```
   → API: http://127.0.0.1:3345

3. **Wallet in beiden entsperren** (Passwort eingeben), damit Commands wie `/create-ticket` und `/create-key` signieren können.

---

## 4. Ticket- & AccessKey-Test ausführen

Aus **einem** der beiden Ordner (oder einem dritten Terminal im Projektordner):

```bash
cd morgendrot
npm run test:tickets-keys
```

Das Skript nutzt per Default:
- **API A** = http://127.0.0.1:3342 (Instanz A = Original)
- **API B** = http://127.0.0.1:3345 (Instanz B = Kopie)

Falls du andere Ports nutzt:

```powershell
$env:API_BASE_A="http://127.0.0.1:3342"; $env:API_BASE_B="http://127.0.0.1:3345"; npm run test:tickets-keys
```

**Voraussetzung:** In **mindestens einer** Instanz (idealerweise A) ist eine **gültige PACKAGE_ID** (0x + 64 Hex) gesetzt. Sonst bricht das Skript mit Hinweis ab. PACKAGE_ID bekommst du z. B. durch einmaliges **Deploy:** `POST http://127.0.0.1:3342/api/deploy-package` (Body `{}`) – dann setzt der Server die neue ID automatisch.

---

## 5. Was der Test durchspielt

- **Ticket:** A erstellt Ticket für B → B listet Tickets → hasValidTicket(B) → B nutzt Ticket (Einlass) → B listet (used) → A erstellt 2. Ticket für B → B transferiert an A (Weiterverkauf) → A emergency-purge-ticket + purge-ticket (Stornierung).
- **AccessKey:** A erstellt Key für B → B listet Keys → B transfer-key an A → A purge-key; zusätzlich A erstellt Key 2 für B → B emergency-purge-key + purge-key (Rebate).

Damit sind u. a. getestet: create-ticket, list-tickets, hasValidTicket, use-ticket, transfer-ticket, emergency-purge-ticket, purge-ticket, create-key, list-keys, transfer-key, emergency-purge-key, purge-key.

---

## 6. Ein-Wallet-Modus (nur eine Instanz oder A=B)

Wenn **nur** z. B. Port 3342 erreichbar ist, nutzt das Skript automatisch **Ein-Wallet-Modus**: A und B = dieselbe Adresse, alle Schritte laufen über die eine API.

**Erzwingen:** `FORCE_SINGLE_WALLET=1 npm run test:tickets-keys` – dann wird immer A=B verwendet (Ticket/Key für sich selbst; sinnvoll, um create/list/use/transfer/purge mit einer Instanz durchzuspielen).

**Hinweis:** `list-tickets` / `list-keys` können auf dem Testnet mit Verzögerung antworten (Indizierung). Die Befehle **create-ticket** und **create-key** sind erfolgreich, sobald die API „OK“ meldet – die NFTs liegen dann on-chain.

**Kompletter Real-World-Ablauf (alles durchspielen):** `npm run test:realworld`  
Erstellen (normal + personalisiert z. B. „Nicole“), Auflisten, Prüfen, Mutieren (Einlass), Verkaufen/Tauschen, Entwerten. Optional `FORCE_SINGLE_WALLET=1`.

## 7. Nächste Schritte (weiter testen)

- **Alle API-Endpoints + alle Reiter:**  
  `powershell -ExecutionPolicy Bypass -File scripts/test-all-api.ps1`  
  (ein Server reicht, z. B. nur Instanz A auf 3342.)

- **Übersicht, welche Funktion zu welchem Reiter gehört:**  
  `scripts/TEST-PLAN-REITER.md`

- **Modultests (ohne Server):**  
  `npm test`
