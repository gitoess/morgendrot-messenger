# Morgendrot Verkaufs-Messenger (Kunden-Bundle)

Dieser Ordner ist **dieselbe Software** wie `Morgendrot-Messenger-standalone`, aber mit **`MESSENGER_EDITION=sales`** (fest in `npm start`). Die Lite-UI zeigt den Titel **Verkaufs-Messenger** und **zusätzliche Hinweise** zur Kette Schatten-Seed → Sweep → Main-Entsperren → Tresor → Chat.

## Boss / Hersteller – vor Übergabe an den Kunden

1. **Move-Paket:** Deploy, **`PACKAGE_ID`** notieren – muss für **alle** Chat-Teilnehmer **identisch** sein.
2. **Gas:** Die Wallet-Adresse des Kunden (Schatten oder bereits Main nach eurem internen Sweep) braucht **IOTA** für Transaktionen (Handshake, Nachrichten).
3. **Schatten → Main (optional, aber typisch für Verkauf):** Entweder **intern** (Boss kennt Schatten-Seed kurz, führt Sweep aus, dokumentiert **Main-Mnemonic** sicher **offline**) **oder** der Kunde führt den Sweep **selbst** in **Setup → Schatten-Seed / Main-Sweep** aus. Der Sweep bündelt Coins und Nicht-Coin-Objekte in **einer** Transaktion; das **neue Main-Secret** erscheint **nur einmal** – sofort sichern, **nicht** per Messenger verschicken.
4. **`.env` für den Kunden:** `PACKAGE_ID`, `MY_ADDRESS` (Adresse, mit der der Kunde nach eurem Ablauf signiert), **dieselbe `RPC_URL`** wie bei euch. **`SIGNER=sdk`** ist für Laien oft am einfachsten (Mnemonic beim ersten Entsperren in der UI). `SIGNER=cli` / `remote` wie im normalen Boss-Export möglich.
5. **Kein Lizenz-NFT für Pairing:** Verbindung läuft über **Handshake / Connect** wie im klassischen Messenger – **kein** on-chain NFT-Gate beim Koppeln.
6. **HD-Kontaktadressen** (`ENABLE_HD_CONTACT_ADDRESSES`): aktuell **Stub** ohne produktive HD-Ableitung – nicht als fertiges Feature verkaufen.

Voucher, „Delete-on-Delivery“ oder NFT-Zusatzprozesse **außerhalb** dieses Repos: nur dokumentieren, wenn ihr sie selbst betreibt.

---

## Kunde – Schritt für Schritt

1. **Node.js** (LTS) installieren.
2. Ordner entpacken, im Terminal **in diesem Ordner**: `npm install`
3. Die vom Boss gelieferte Datei als **`.env`** hier ablegen (oder `.env.example` kopieren und Werte eintragen). **`MESSENGER_EDITION`** muss nicht manuell gesetzt werden – `npm start` setzt **sales**.
4. `npm start` → Browser: **http://127.0.0.1:3342/** (oder Port aus `API_PORT`). Optional: `npm run desktop`.
5. **Entsperren (Startseite):**
   - **`SIGNER=sdk`:** Mnemonic des **Main-Wallets** (nach Sweep) einfügen, wie in der `.env`/Anleitung vom Boss.
   - **`SIGNER=cli`:** Passwort des **IOTA-CLI-Keystores** zu `MY_ADDRESS` – **kein** Ersatz für Tresor-`/vault-load`.
   - Wenn der **Sweep bei dir als Kunde noch aussteht**: zuerst **Setup** öffnen, **Schatten-Seed → Main-Sweep** ausführen, **neues Mnemonic notieren**, dann mit **Main-Secret** erneut entsperren.
6. **Setup (`#setup`):** Netzwerk / `RPC_URL`, `PACKAGE_ID` mit dem Boss abgleichen; bei Bedarf RPC-Rotation (`RPC_URLS`).
7. **Tresor (`#vault`):** Empfohlen: nach erfolgreichem Chat-Setup **lokal sichern** (`.morgendrot-vault` + Passwort) – optional Mnemonic im Backup, wenn ihr die Checkbox dafür nutzt.
8. **Nachrichten (`#chat`):** Partner-Adresse des anderen Messengers; **eine Seite Handshake**, **andere Seite Connect** (wie im Standalone-README).
9. Erst wenn die UI **verbunden** zeigt: **verschlüsselt** schreiben. **Mnemonics niemals in den Chat.**

---

## Kein `npm run create-vault`

Wie im Standalone-Bundle: Es gibt **kein** `npm run create-vault`. Vault/Tresor über UI **lokal sichern** / **von Chain laden** oder Befehle `/vault-save`, `/vault-load` – siehe Standalone-`README.md` im Schwesterordner oder Abschnitt im Haupt-Repo.

---

## Zwei Messenger / zwei Geräte

Gleiche `PACKAGE_ID` und `RPC_URL`, **unterschiedliche** `MY_ADDRESS`. Zwei Instanzen auf **einem** PC: zweiten Ordner kopieren, in der zweiten `.env` z. B. `API_PORT=3345` und andere `MY_ADDRESS` setzen.

---

## Tests (nach `npm install` in diesem Ordner)

| Befehl | Bedeutung |
|--------|-----------|
| `npm run typecheck` | TypeScript |
| `npm test` | Modultests |
| `npm run validate:ui` | UI-Struktur |
| `npm run test:lite-ui-api` | API-Tests (Backend muss laufen) |
| `npm run test:messenger` | Zwei APIs, Real-World Chat (siehe Haupt-Repo) |

---

## Standalone-Schwesterordner

Der Ordner **`exports/Morgendrot-Messenger-standalone/`** (gleicher Build-Befehl im Repo) nutzt **`MESSENGER_EDITION=standalone`** und die UI-Bezeichnung **Messenger** ohne Verkaufs-Banner.
