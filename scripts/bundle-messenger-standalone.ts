/**
 * Erzeugt Messenger-Bundles unter exports/:
 * - Morgendrot-Messenger-standalone (MESSENGER_EDITION=standalone)
 * - Morgendrot-Messenger-verkauf (MESSENGER_EDITION=sales, Kunden-Fokus)
 *
 * Optional: `tsx scripts/bundle-messenger-standalone.ts --standalone-only` | `--sales-only`
 * Auf dem Zielrechner: npm install, .env aus Boss-Export oder .env.example, npm start bzw. npm run desktop.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

type MessengerEdition = 'standalone' | 'sales';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

const BUNDLE_EDITIONS: MessengerEdition[] = (() => {
    const a = process.argv.slice(2);
    if (a.includes('--sales-only')) return ['sales'];
    if (a.includes('--standalone-only')) return ['standalone'];
    return ['standalone', 'sales'];
})();

function bundleOut(edition: MessengerEdition): string {
    return path.join(
        REPO,
        'exports',
        edition === 'sales' ? 'Morgendrot-Messenger-verkauf' : 'Morgendrot-Messenger-standalone'
    );
}

function rmrf(p: string) {
    if (!fs.existsSync(p)) return;
    try {
        fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (e) {
        console.warn(
            'Warnung: Altes Bundle nicht löschbar (Explorer/Antivirus offen?). Ordner manuell schließen und erneut bundle:messenger ausführen.',
            e
        );
        throw e;
    }
}

function copyDir(from: string, to: string) {
    if (!fs.existsSync(from)) throw new Error('Fehlt: ' + from);
    fs.cpSync(from, to, { recursive: true });
}

function readmeSales(): string {
    return `# Morgendrot Verkaufs-Messenger (Kunden-Bundle)

Dieser Ordner ist **dieselbe Software** wie \`Morgendrot-Messenger-standalone\`, aber mit **\`MESSENGER_EDITION=sales\`** (fest in \`npm start\`). Die Lite-UI zeigt den Titel **Verkaufs-Messenger** und **zusätzliche Hinweise** zur Kette Schatten-Seed → Sweep → Main-Entsperren → Tresor → Chat.

## Boss / Hersteller – vor Übergabe an den Kunden

1. **Move-Paket:** Deploy, **\`PACKAGE_ID\`** notieren – muss für **alle** Chat-Teilnehmer **identisch** sein.
2. **Gas:** Die Wallet-Adresse des Kunden (Schatten oder bereits Main nach eurem internen Sweep) braucht **IOTA** für Transaktionen (Handshake, Nachrichten).
3. **Schatten → Main (optional, aber typisch für Verkauf):** Entweder **intern** (Boss kennt Schatten-Seed kurz, führt Sweep aus, dokumentiert **Main-Mnemonic** sicher **offline**) **oder** der Kunde führt den Sweep **selbst** in **Setup → Schatten-Seed / Main-Sweep** aus. Der Sweep bündelt Coins und Nicht-Coin-Objekte in **einer** Transaktion; das **neue Main-Secret** erscheint **nur einmal** – sofort sichern, **nicht** per Messenger verschicken.
4. **\`.env\` für den Kunden:** \`PACKAGE_ID\`, \`MY_ADDRESS\` (Adresse, mit der der Kunde nach eurem Ablauf signiert), **dieselbe \`RPC_URL\`** wie bei euch. **\`SIGNER=sdk\`** ist für Laien oft am einfachsten (Mnemonic beim ersten Entsperren in der UI). \`SIGNER=cli\` / \`remote\` wie im normalen Boss-Export möglich.
5. **Kein Lizenz-NFT für Pairing:** Verbindung läuft über **Handshake / Connect** wie im klassischen Messenger – **kein** on-chain NFT-Gate beim Koppeln.
6. **HD-Kontaktadressen** (\`ENABLE_HD_CONTACT_ADDRESSES\`): aktuell **Stub** ohne produktive HD-Ableitung – nicht als fertiges Feature verkaufen.

Voucher, „Delete-on-Delivery“ oder NFT-Zusatzprozesse **außerhalb** dieses Repos: nur dokumentieren, wenn ihr sie selbst betreibt.

---

## Kunde – Schritt für Schritt

1. **Node.js** (LTS) installieren.
2. Ordner entpacken, im Terminal **in diesem Ordner**: \`npm install\`
3. Die vom Boss gelieferte Datei als **\`.env\`** hier ablegen (oder \`.env.example\` kopieren und Werte eintragen). **\`MESSENGER_EDITION\`** muss nicht manuell gesetzt werden – \`npm start\` setzt **sales**.
4. \`npm start\` → Browser: **http://127.0.0.1:3342/** (oder Port aus \`API_PORT\`). Optional: \`npm run desktop\`.
5. **Entsperren (Startseite):**
   - **\`SIGNER=sdk\`:** Mnemonic des **Main-Wallets** (nach Sweep) einfügen, wie in der \`.env\`/Anleitung vom Boss.
   - **\`SIGNER=cli\`:** Passwort des **IOTA-CLI-Keystores** zu \`MY_ADDRESS\` – **kein** Ersatz für Tresor-\`/vault-load\`.
   - Wenn der **Sweep bei dir als Kunde noch aussteht**: zuerst **Setup** öffnen, **Schatten-Seed → Main-Sweep** ausführen, **neues Mnemonic notieren**, dann mit **Main-Secret** erneut entsperren.
6. **Setup (\`#setup\`):** Netzwerk / \`RPC_URL\`, \`PACKAGE_ID\` mit dem Boss abgleichen; bei Bedarf RPC-Rotation (\`RPC_URLS\`).
7. **Tresor (\`#vault\`):** Empfohlen: nach erfolgreichem Chat-Setup **lokal sichern** (\`.morgendrot-vault\` + Passwort) – optional Mnemonic im Backup, wenn ihr die Checkbox dafür nutzt.
8. **Nachrichten (\`#chat\`):** Partner-Adresse des anderen Messengers; **eine Seite Handshake**, **andere Seite Connect** (wie im Standalone-README).
9. Erst wenn die UI **verbunden** zeigt: **verschlüsselt** schreiben. **Mnemonics niemals in den Chat.**

---

## Kein \`npm run create-vault\`

Wie im Standalone-Bundle: Es gibt **kein** \`npm run create-vault\`. Vault/Tresor über UI **lokal sichern** / **von Chain laden** oder Befehle \`/vault-save\`, \`/vault-load\` – siehe Standalone-\`README.md\` im Schwesterordner oder Abschnitt im Haupt-Repo.

---

## Zwei Messenger / zwei Geräte

Gleiche \`PACKAGE_ID\` und \`RPC_URL\`, **unterschiedliche** \`MY_ADDRESS\`. Zwei Instanzen auf **einem** PC: zweiten Ordner kopieren, in der zweiten \`.env\` z. B. \`API_PORT=3345\` und andere \`MY_ADDRESS\` setzen.

---

## Tests (nach \`npm install\` in diesem Ordner)

| Befehl | Bedeutung |
|--------|-----------|
| \`npm run typecheck\` | TypeScript |
| \`npm test\` | Modultests |
| \`npm run validate:ui\` | UI-Struktur |
| \`npm run test:lite-ui-api\` | API-Tests (Backend muss laufen) |
| \`npm run test:messenger\` | Zwei APIs, Real-World Chat (siehe Haupt-Repo) |

---

## Standalone-Schwesterordner

Der Ordner **\`exports/Morgendrot-Messenger-standalone/\`** (gleicher Build-Befehl im Repo) nutzt **\`MESSENGER_EDITION=standalone\`** und die UI-Bezeichnung **Messenger** ohne Verkaufs-Banner.
`;
}

async function buildBundle(edition: MessengerEdition) {
    const OUT = bundleOut(edition);
    console.log('Bundle [' + edition + '] →', OUT);
    rmrf(OUT);
    fs.mkdirSync(OUT, { recursive: true });

    copyDir(path.join(REPO, 'src'), path.join(OUT, 'src'));
    copyDir(path.join(REPO, 'ui'), path.join(OUT, 'ui'));
    copyDir(path.join(REPO, 'move-test'), path.join(OUT, 'move-test'));

    fs.copyFileSync(path.join(REPO, 'tsconfig.json'), path.join(OUT, 'tsconfig.json'));

    const scriptsDir = path.join(OUT, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    const copyScript = (name: string) => {
        const from = path.join(REPO, 'scripts', name);
        if (!fs.existsSync(from)) throw new Error('Bundle: fehlt scripts/' + name);
        fs.copyFileSync(from, path.join(scriptsDir, name));
    };
    for (const f of [
        'run-tests.ts',
        'run-messages-chat-realworld.ts',
        'run-pairing-realworld.ts',
        'run-lite-ui-realworld-tests.ts',
        'validate-ui-data.js',
        'streams-bridge-mock.ts',
    ]) {
        copyScript(f);
    }

    const cross = (env: string) =>
        'cross-env ' + env + ' tsx src/start-with-secrets.ts';
    const startEnv =
        edition === 'sales'
            ? 'UI_VARIANT=messenger MESSENGER_EDITION=sales'
            : 'UI_VARIANT=messenger MESSENGER_EDITION=standalone';
    const streamsEnv =
        edition === 'sales'
            ? 'UI_VARIANT=messenger MESSENGER_EDITION=sales'
            : 'UI_VARIANT=messenger MESSENGER_EDITION=standalone';

    const pkgPath = path.join(REPO, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
    pkg.name = edition === 'sales' ? 'morgendrot-messenger-verkauf' : 'morgendrot-messenger-standalone';
    pkg.private = true;
    pkg.description =
        edition === 'sales'
            ? 'Morgendrot Verkaufs-Messenger (sales): Schatten/Sweep-Fokus. npm install; Boss-.env; npm start.'
            : 'Kopierbarer Morgendrot-Messenger standalone (Boss-Export). npm install; .env; npm start oder npm run desktop.';
    /** Nur Skripte, deren Dateien im Bundle liegen (keine toten npm run …). */
    pkg.scripts = {
        start: cross(startEnv),
        'start:secrets': 'tsx src/start-with-secrets.ts',
        'start:with-streams':
            'cross-env ' +
            streamsEnv +
            ' concurrently --names "app,streams" -c "cyan,magenta" "npm run start:secrets" "npm run streams-mock:persist"',
        'streams-mock': 'tsx scripts/streams-bridge-mock.ts',
        'streams-mock:persist': 'cross-env STREAMS_MOCK_PERSIST=1 tsx scripts/streams-bridge-mock.ts',
        desktop: 'electron main.cjs',
        'validate:ui': 'node scripts/validate-ui-data.js',
        typecheck: 'tsc --noEmit',
        test: 'tsx scripts/run-tests.ts',
        'test:messenger': 'tsx scripts/run-messages-chat-realworld.ts',
        'test:messages': 'tsx scripts/run-messages-chat-realworld.ts',
        'test:pairing': 'tsx scripts/run-pairing-realworld.ts',
        'test:lite-ui-api': 'tsx scripts/run-lite-ui-realworld-tests.ts',
        'build:lite-ui': 'npx @tailwindcss/cli -i ui/input.css -o ui/styles.css --minify',
    };
    const devDeps = { ...((pkg.devDependencies as Record<string, string>) || {}) };
    devDeps.electron = devDeps.electron || '^33.4.0';
    pkg.devDependencies = devDeps;
    fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    const mainSrc = path.join(REPO, 'morgendrot-messenger-desktop', 'main.cjs');
    fs.copyFileSync(mainSrc, path.join(OUT, 'main.cjs'));

    const envHead =
        edition === 'sales'
            ? [
                  '# =============================================================================',
                  '# Morgendrot Verkaufs-Messenger – .env (vom Boss)',
                  '# =============================================================================',
                  '#',
                  '# MESSENGER_EDITION=sales ist bereits im npm start gesetzt – hier nur ergänzen,',
                  '# wenn ihr bewusst überschreiben wollt (normalerweise weglassen).',
                  '#',
                  '# >>> Es gibt HIER kein npm-Script "npm run create-vault" oder',
              ]
            : [
                  '# =============================================================================',
                  '# Morgendrot Messenger – .env (Plug & Play)',
                  '# =============================================================================',
                  '#',
                  '# >>> STANDALONE: Es gibt HIER kein npm-Script "npm run create-vault" oder',
              ];

    const envExample = [
        ...envHead,
        '#     "create-vault -- --import". Das ist Absicht – Vault siehe README.md',
        '#     Abschnitt „Kein npm run create-vault“ und Option 3 unten.',
        '#',
        '# =============================================================================',
        '# Es liegt keine fertige .env im Bundle (Sicherheit).',
        '#',
        '# ── Weg A (am einfachsten): Boss „Export Messenger“ ────────────────────────',
        '#    Die exportierte .env unverändert hier als Datei „.env“ ablegen. Fertig.',
        '#',
        '# ── Weg B: Diese Vorlage ───────────────────────────────────────────────────',
        '#    1) copy .env.example .env  (Windows)  /  cp .env.example .env',
        '#    2) Nur noch eintragen:',
        '#       • PACKAGE_ID  (bei allen Chat-Partnern gleich – vom Admin/Deploy)',
        '#       • MY_ADDRESS  (deine 0x…64 Wallet-Adresse, pro Gerät anders)',
        '#       • Wallet-Secrets – eine der Optionen unten (1–3)',
        '#',
        '# Option 1 – Wie Boss-Export meist liefert:',
        '#   SIGNER=cli (IOTA-CLI-Wallet, passend zu MY_ADDRESS) oder SIGNER=remote + REMOTE_SIGNER_URL.',
        '#   WALLET_MNEMONIC in .env ist oft nur Dokumentation – wird aktuell nicht automatisch eingelesen.',
        '#   Ohne CLI: SIGNER=sdk → Mnemonic beim Start interaktiv (Text aus Boss-Export einfügen).',
        '#',
        '# Option 2 – Verschlüsselte Secrets-Datei (Klartext-.env schlank halten):',
        '#   a) secrets.txt z. B.: WALLET_PASSWORD=…, REMOTE_SIGNER_TOKEN=…',
        '#   (Mnemonic: nicht automatisch aus Env – Vault .morgendrot-vault oder SIGNER=sdk + Prompt.)',
        '#   b) Im Projektordner:  npx tsx scripts/encrypt-env.ts secrets.txt .env.secrets.enc',
        '#      (Passwort für die .enc-Datei wählen – das ist NICHT dasselbe wie das Wallet-Passwort,',
        '#       es sei denn ihr setzt es absichtlich gleich.)',
        '#   c) secrets.txt löschen. In .env unten setzen: ENCRYPTED_ENV_FILE=.env.secrets.enc',
        '#   Start erfolgt mit npm start (lädt über start-with-secrets → fragt nach Passwort der .enc)',
        '#',
        '# Option 3 – Lokaler Tresor (.morgendrot-vault) – KEIN npm create-vault:',
        '#   1) Datei .morgendrot-vault in DIESEN Ordner legen (neben package.json).',
        '#   2) .env: PACKAGE_ID, MY_ADDRESS, RPC_URL setzen (optional VAULT_FILE=…).',
        '#   3) npm start → Browser → Passwort eingeben (Vault-Entschlüsselung).',
        '#   Oder nach Unlock: /vault-load <passwort> [pfad-zur-datei]',
        '#   Oder UI: Tresor „lokal sichern“ / von Chain laden – siehe README.md',
        '#   Abschnitt „Kein npm run create-vault“.',
        '#',
        '# Vollständige Variablenliste: Haupt-Repo .env.example + docs/CONFIG-REFERENCE.md',
        '# =============================================================================',
        '',
        'ENABLE_UI=true',
        'UI_VARIANT=messenger',
        edition === 'sales' ? 'MESSENGER_EDITION=sales' : 'MESSENGER_EDITION=standalone',
        'ROLE=messenger',
        'ROLE_ID=14',
        'API_PORT=3342',
        'SIGNER=cli',
        '# Vor Start auf gleichem Port: alte API per /restart beenden. Bei ZWEITER Instanz neben Haupt-Morgendrot:',
        '#   API_PORT=3343',
        '#   API_KILL_PREVIOUS_INSTANCE=false',
        'API_KILL_PREVIOUS_INSTANCE=true',
        '# RPC_URL exakt wie beim Chat-Partner / Boss (sonst Peering & Events inkonsistent). Bevorzugt:',
        'RPC_URL=https://api.testnet.iota.cafe',
        '# Optional: mehrere öffentliche Nodes (Komma) – Rotation in Setup-UI oder POST /api/rpc-rotate',
        '# RPC_URLS=',
        '# HTTP(S)-Proxy für RPC (z. B. Privoxy vor Tor). Siehe Haupt-Repo .env.example',
        '# RPC_HTTP_PROXY=',
        '# 1–3: Vertrauens-Hinweis (UI); kein technischer Zwang',
        'NETWORK_TRUST_TIER=1',
        '# Phase-2-Stub HD-Kontaktadressen (noch ohne Ableitung)',
        '# ENABLE_HD_CONTACT_ADDRESSES=false',
        'PACKAGE_ID=',
        'MY_ADDRESS=',
        '# ENCRYPTED_ENV_FILE=.env.secrets.enc',
        '# WALLET_MNEMONIC=  # optional Referenz; Laufzeit: siehe Option 1 (cli / remote / sdk)',
        '# PARTNER_ADDRESS=  # optional; oft nach Handshake/Connect',
        '# MAILBOX_ID=  # optional; nach create_globals / Deploy, falls genutzt',
        '# KOMMANDANT_ADDRESSES / BOSS: nur vollständige Adressen (0x + 64 Hex).',
        '# Streams (optional): STREAMS_ANCHOR_ID 0x+64Hex; STREAMS_BRIDGE_URL = IP des Bridge-Rechners wenn nicht localhost.',
        '# ENABLE_HEARTBEAT=true nur mit gültiger STREAMS_ANCHOR_ID + erreichbarer Bridge.',
        '',
    ].join('\n');
    fs.writeFileSync(path.join(OUT, '.env.example'), envExample, 'utf8');

    const readme =
        edition === 'sales'
            ? readmeSales()
            : `# Morgendrot Messenger (eigenständiger Ordner, **standalone**)

Dieser Ordner enthält **denselben Code** wie das Hauptprojekt (Messenger-Lite-UI). **Edition:** \`MESSENGER_EDITION=standalone\` (in \`npm start\` gesetzt). Für **Kunden mit Schatten-Seed-/Sweep-Fokus** baut das Repo zusätzlich **\`exports/Morgendrot-Messenger-verkauf/\`** (\`npm run bundle:messenger\` erzeugt **beide** Ordner).

Du kannst diesen Ordner **als Ganzes** kopieren (USB, Zip, Git).

## Kein \`npm run create-vault\` in diesem Bundle

**Das gibt es hier nicht:** In diesem **Messenger-Standalone-Ordner** existiert **kein** npm-Script wie \`npm run create-vault\`, \`npm run create-vault -- --import\` oder ähnlich. \`package.json\` listet solche Scripts nicht – andere Tutorials oder Tools können sich auf ein anderes Projekt beziehen.

| Nicht suchen | Stattdessen |
|--------------|-------------|
| CLI „Vault anlegen/importieren“ per npm | **Lite-UI** (Tresor): lokal sichern / von Chain laden, oder Befehle **\`/vault-save\`**, **\`/vault-load\`**, **\`/vault-onchain\`** (nach Unlock) |
| Einmalig Secrets verschlüsseln | **\`npx tsx scripts/encrypt-env.ts <datei.txt> [.enc]\`** → in \`.env\` **\`ENCRYPTED_ENV_FILE=…\`** setzen; Start mit **\`npm start\`** (nutzt \`start-with-secrets\`) |

### Tresor (\`.morgendrot-vault\`) – Schrittfolge

1. **Backup auf diesen PC kopieren:** Datei **\`.morgendrot-vault\`** in **diesen Ordner** legen (neben \`package.json\`). In **\`.env\`**: \`PACKAGE_ID\`, \`MY_ADDRESS\`, \`RPC_URL\` passend setzen; optional \`VAULT_FILE=.morgendrot-vault\` (häufig Standard).
2. **Start:** \`npm start\` → Browser öffnen → **Wallet-/Vault-Passwort** eingeben (wie beim Erzeugen des Vaults). Ohne passende Datei oder falsches Passwort schlägt die Entschlüsselung fehl.
3. **Neu nach Chat-Setup:** Nach Handshake/Connect in der UI **„lokal sichern“** nutzen oder **\`/vault-save\`** mit Passwort – erzeugt/aktualisiert die lokale Vault-Datei.
4. **Nur Konsole (Backend schon entsperrt):** **\`/vault-load <passwort>\`** – optional zweites Argument: Pfad zur Datei, wenn nicht \`.morgendrot-vault\` im Arbeitsverzeichnis.

Details zu allen Variablen: im **Haupt-Repo** die Datei \`.env.example\` und \`docs/CONFIG-REFERENCE.md\` (im Standalone nicht immer mitgeliefert – ggf. aus dem Repo öffnen).

---

## Wichtig: Was \`npm run bundle:messenger\` **nicht** liefert

- Es gibt **keine fertige \`.env\`** mit deinen Geheimnissen (Absicht: nichts Leakbares im Bundle).
- Es gibt nur **\`.env.example\`** als Vorlage. Du musst mindestens eintragen bzw. aus dem **Boss „Export Messenger“** übernehmen:
  - **\`PACKAGE_ID\`** (Move-Paket auf der Chain – **bei allen Chat-Partnern gleich**),
  - **\`MY_ADDRESS\`** (deine Wallet-Adresse, **pro Gerät unterschiedlich**),
  - **Wallet-Zugang** (z. B. \`WALLET_MNEMONIC\` / verschlüsselte Env – wie im Export),
  - **\`RPC_URL\`** (Testnet/Mainnet wie beim Boss).

Nur die eigene Adresse reicht **nicht**: Ohne \`PACKAGE_ID\` und Wallet-Secrets startet der Messenger nicht sinnvoll.

---

## Schritt-für-Schritt: Ein Messenger (ein PC, ein Wallet)

1. **Node.js** (LTS) installieren.
2. In **diesem** Ordner im Terminal: \`npm install\`
3. \`.env\` anlegen:
   - **Empfohlen:** die vom Boss erzeugte **Messenger-\`.env\`** hierher als \`.env\` legen (Plug & Play).
   - **Alternativ:** \`copy .env.example .env\` / \`cp .env.example .env\` – Kurzweg in \`.env.example\`: \`PACKAGE_ID\`, \`MY_ADDRESS\`, Signer (\`cli\` / \`remote\` / \`sdk\` wie Boss-Export), optional \`encrypt-env\` + \`ENCRYPTED_ENV_FILE\`, oder \`.morgendrot-vault\` + Passwort in der UI. **Nicht** nach \`npm run create-vault\` suchen – siehe **oben** [Kein create-vault](#kein-npm-run-create-vault-in-diesem-bundle) und \`.env.example\`.
4. \`npm start\` → Browser: **http://127.0.0.1:3342/** (Port = \`API_PORT\` in \`.env\`, Standard 3342).  
   Alternativ: \`npm run desktop\` (Electron).
5. **Wallet entsperren** (Startseite): Passwort = **IOTA-CLI-Keystore** (bei \`SIGNER=cli\`) – **kein** Mnemonic-Feld und **kein** Ersatz für \`/vault-load\`.
6. **Tresor:** Minibar oder Kachel **„Tresor“** (\`#vault\`). **„Lokal laden“** / \`/vault-load\` nur mit **bestehender** \`.morgendrot-vault\` und **Vault-Passwort**. Ohne Datei: zuerst **Nachrichten** → Handshake/Connect, dann **Tresor** → **„Lokal sichern“**.
7. **Navigation (Messenger-Modus):** Nur \`#chat\`, \`#vault\`, \`#setup\`, \`#config\` – andere Hashes springen zu Nachrichten (Absicht).
8. **Setup (optional):** Unter **\`#setup\`** – Netzwerk-Stufen-Anzeige, **RPC-Rotation** (wenn \`RPC_URLS\` mehrere URLs hat), **Schatten-Seed → Main-Sweep** (einmaliger Transfer auf neu erzeugtes Main-Wallet; Secret-Key nur in der Antwort – sofort sichern).

**Mnemonics niemals in Chats posten.**

---

## Zweites Wallet / zweiter Messenger – so verbindet ihr euch

Der Messenger „verbindet sich“ **nicht automatisch** mit einem zweiten Wallet. Ablauf (klassisch):

1. **Beide** Messenger müssen dieselbe **\`PACKAGE_ID\`** und dieselbe **\`RPC_URL\`** (Testnet) nutzen.
2. **Unterschiedliche** **\`MY_ADDRESS\`** – jeder nutzt sein eigenes Wallet.
3. **Zwei Instanzen**:
   - **Zwei PCs:** je einen entpackten Messenger-Ordner, je \`npm install\`, je eigene \`.env\`.
   - **Ein PC, zwei Messenger:** Ordner **duplizieren** (z. B. \`Messenger-A\` und \`Messenger-B\`). In **B** z. B. \`API_PORT=3345\` setzen, damit nicht beide Port 3342 belegen. Je eigene \`.env\` mit je eigener \`MY_ADDRESS\`.
4. Beide starten (\`npm start\`). A öffnet http://127.0.0.1:3342/, B z. B. http://127.0.0.1:3345/.
5. **Handshake / Connect** (in der UI unter Nachrichten oder per Befehl):
   - **Alice** trägt Bobs **Partner-Adresse** ein und startet **Handshake** (oder nutzt QR/JSON „Kontakt teilen“, falls vorhanden).
   - **Bob** startet **Connect** (wartet auf Alices Handshake) bzw. die Reihenfolge wie in eurer UI: typisch **eine Seite Handshake**, **andere Seite Connect** mit der jeweiligen Gegenadresse.
6. Wenn die Statusanzeige **verbunden** ist: **verschlüsselt senden** (\`/send\`). **Klartext** nur wenn \`ENABLE_PLAINTEXT_CHANNEL\` in der Env erlaubt ist (\`/send-plain\`).

Optional: Kontakt per **QR/JSON** (Phase 1) in der Chat-Kachel – setzt \`PARTNER_ADDRESS\` und ggf. Netzwerk nach Bestätigung.

---

## Automatisierter Real-World-Test (zwei APIs)

Im **Haupt-Repo** (nicht zwingend im Standalone-Ordner): zwei Messenger laufen, dann:

\`\`\`bash
set API_BASE_A=http://127.0.0.1:3342
set API_BASE_B=http://127.0.0.1:3345
set UNLOCK_PASSWORD=dein-wallet-passwort
npm run test:messages
\`\`\`

(Unix: \`export API_BASE_A=...\`). Wallets in beiden UIs vorher entsperren, falls \`UNLOCK_PASSWORD\` nicht gesetzt ist.

---

## Tests im Standalone-Ordner

Nach \`npm install\` (im Ordner \`Morgendrot-Messenger-standalone\`):

| Befehl | Bedeutung |
|--------|-----------|
| \`npm run typecheck\` | TypeScript-Prüfung (\`tsc --noEmit\`) |
| \`npm test\` | Modultests ohne echte Chain (Crypto, Vault, Config, …) |
| \`npm run validate:ui\` | Prüft \`ui/index.html\`-Struktur |
| \`npm run test:lite-ui-api\` | Viele GET/POST gegen die API – **Backend muss laufen** (\`npm start\`, Port \`API_PORT\` oder 3342). Setze optional \`API_URL=http://127.0.0.1:PORT\`. |
| \`npm run test:messenger\` | Zwei APIs (3342 + 3343), beide Wallets entsperrt; siehe Abschnitt „Automatisierter Real-World-Test“. Env: \`UNLOCK_PASSWORD\`, \`API_BASE_A\`/\`B\`, optional \`SKIP_PEERING=1\`. |
| \`npm run test:pairing\` | Nur Geheimnis-Peering (Move mit \`emit_pairing_offer\` nötig). |

Hinweis: Im Bundle sind absichtlich **nicht** alle Skripte des Haupt-Repos enthalten – nur was für Messenger + Tests nötig ist.

---

## Streams (optional)

\`npm run start:with-streams\` – wie im Hauptprojekt (App + Streams-Mock).

## Raspi / andere Exporte

Ordner \`exports/Morgendrot-Raspi-*\` enthalten oft nur \`.env\` / \`config.json\`; der **Code** ist dieser Messenger-Ordner oder das volle Repo.
`;
    fs.writeFileSync(path.join(OUT, 'README.md'), readme, 'utf8');

    console.log('Fertig [' + edition + '] →', OUT);
    console.log('Hinweis: .env.example = Vorlage, keine fertige .env. Anleitung: README.md im Bundle.');
}

async function main() {
    for (const edition of BUNDLE_EDITIONS) {
        await buildBundle(edition);
    }
    console.log('Alle Bundles: ' + BUNDLE_EDITIONS.join(', '));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
