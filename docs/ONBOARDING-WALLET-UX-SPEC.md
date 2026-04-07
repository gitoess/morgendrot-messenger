# Onboarding, Wallet, Session — Ist-Zustand, Lücken, Ziel-Spezifikation

**Zweck:** Eine **kritische** Einordnung, was Morgendrot **heute** kann, was **fehlt**, und ein **Zielbild** für Endnutzer-Onboarding — ohne bestehende Architektur (IOTA-Rebased, Backend-Session, Vault) zu verleugnen.

**Verwandte Doku:** `docs/DEV-START.md` (Start/Ports), `docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md` (Credits vs. MIST), `docs/API-SHOP-SPEC.md` / `docs/STRIPE-TEST-SETUP.md` (Shop + optional Chain-Mint), `src/wallet-bridge.ts` (Ablauf), `src/api-server.ts` (`GET /api/status`, `POST /api/unlock`).

---

## 1. Begriffe (kurz)

| Begriff | Bedeutung in diesem Projekt |
|--------|------------------------------|
| **Backend-Session / „entsperrt“** | Laufender Prozess hat `WALLET_PASSWORD` gesetzt und kann signieren / Befehle ausführen. Ohne das: viele Pfade gesperrt. |
| **„locked“ in der UI** | `GET /api/status` → `locked: true`, solange intern noch ein **Passwort-Resolver** wartet (`setPasswordResolver` in `api-server.ts`) — typisch bis erstes erfolgreiches `POST /api/unlock` **oder** `WALLET_PASSWORD` in `.env` beim Start. |
| **Vault-Datei** (`.morgendrot-vault`) | Verschlüsselter Blob: Messaging-Keys, Notizen, optional `iotaSdkSignerImport`, ggf. „Mein Safe“. Passwort = Nutzer wählt es; **nicht** automatisch dasselbe wie CLI-Keystore (bei `SIGNER=cli`). |
| **Credits (Messenger)** | Move-Objekt / Tarif-Kontingent — **kein** Ersatz für eine **IOTA-Adresse**. Siehe Gas-/Credits-Doku. |
| **„Kein Wallet“** (Nutzer-Sprache) | Muss im Produkt in **„kein eigenes Gas (MIST)“** vs. **„noch keine Adresse / kein Signer“** zerlegt werden — technisch immer eine **Identität auf der Chain** nötig für den vollen Messenger-Pfad. |

---

## 2. Ist-Zustand (verifiziert im Code)

### 2.1 Startreihenfolge (`wallet-bridge.ts`)

- Mit **`ENABLE_UI=true`:** API startet **zuerst**, dann blockiert die Logik bis Passwort da ist — **entweder** `WALLET_PASSWORD` aus der Umgebung **oder** Promise-Auflösung durch **`POST /api/unlock`** (Browser).
- **`SIGNER=sdk`:** Ohne UI wird Mnemonic/Bech32 per Terminal abgefragt; mit UI **nicht** stdin (Event-Loop).
- Existiert eine **Vault-Datei** und Entschlüsselung schlägt fehl → neuer Resolver für erneutes `/api/unlock` (`awaitWalletPasswordAfterVaultFailureUi`).
- **`SIGNER=cli`:** Separates Verhältnis zum **IOTA-CLI-Keystore** — der Entsperr-Dialog fragt **kein** Mnemonic ab; Nutzerhilfe in Lite-UI beschreibt das explizit.

### 2.2 UI: „Wallet entsperren“ (`frontend/.../dashboard.tsx`)

- Dialog bei `locked`: **Passwort** + bei `signer === 'sdk'` optional **Mnemonic/Bech32**, falls nicht im Vault.
- **`POST /api/unlock`:** Entschlüsselt lokalen oder on-chain Vault (wenn konfiguriert), wendet SDK-Import an, löst internen Passwort-Resolver auf.

### 2.3 Explizit **nicht** vorhanden (Next-Messenger)

- **Kein** geführter **Erststart-Assistent** (kein Wizard: „Seed erzeugen → sichern → fertig“) — Hinweis bereits in `chat-view-chat-header.tsx`.
- **Kein** getrennter **„Account erstellen“**-Flow wie bei Web2 (E-Mail/Passwort als alleinige Identität).
- **Keine** integrierte **„nur Credits kaufen ohne jemals eine Adresse anzugeben“**-Story: Shop kann **`recipientIotaAddress`** (0x+64) für Mint erfassen (`handle-shop-api.ts`, `/shop`); ohne gültige Empfängeradresse kein Chain-Mint (`shop-fulfillment.ts`).

### 2.4 Bereits vorhandene Brücken

- **`WALLET_PASSWORD`** in `.env`: Umgeht den UI-Dialog — für **Dev/CI**, nicht als Endnutzer-Standard.
- **Shop + `ENABLE_SHOP_CHAIN_MINT`:** Fiat → optional **Credits-Mint** auf **vorgegebene** IOTA-Adresse (Boss zahlt Gas) — siehe `STRIPE-TEST-SETUP.md`.
- **Lite-UI (`ui/index.html`):** Ausführlicher **Ablauf-Hinweis** (Wallet entsperren → optional Connect → Tresor lokal sichern) — besser dokumentiert als die Next-Startseite allein.

---

## 3. Kritische Lücken („was wir nicht haben“) — **Backlog mit Status**

Die gleichen Punkte als **nachverfolgbare** Liste; Umsetzung priorisiert **Roadmap § H.0** (Produkt/UX), insbesondere **H.0 #4** (Unlock- & Secret-UX).

| ID | Lücke | Risiko / Nutzerfrustration | Status |
|----|--------|----------------------------|--------|
| L1 | **Keine narrative Einheit** zwischen Next-Dashboard, Unlock-Dialog, Tresor und Shop | Session-Passwort vs. Vault vs. Keystore vs. Credits verwechselt | **Teilweise:** Unlock-Dialog **signer-abhängig** (`dashboard.tsx`); Chat-Banner präzisiert; diese Doku + **`docs/DEV-START.md`** |
| L2 | **Erstnutzer ohne vorkonfigurierte `.env`** | Kein geführter Pfad zu **MY_ADDRESS**, **PACKAGE_ID**, erstem **Handshake** | **Backlog:** optional geführte „Erste Schritte“-Seite oder Boss-Export-Assistent (**Roadmap H.7**); bis dahin Lite-UI-Hinweis (`ui/index.html`) + **`docs/VAULT-EINRICHTEN.md`** / **`docs/DEV-START.md`** |
| L3 | **„Credits statt IOTA“** ohne Klartext | Credits ≠ native MIST; Marketing irreführend | **Teilweise:** **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`**, Shop-Tooltip (`/shop`), **`TESTING.md`** Smoke |
| L4 | **Wiederkehrende Nutzer** („neues Gerät“) | Kein UX für „Vault auf neuem Rechner“ vs. Erststart | **Backlog:** kurze Kopfzeile in Einstellungen/Tresor (Schritte: Vault-Datei / Chain laden); technisch unverändert |
| L5 | **SIGNER=sdk vs. cli** im Dialog | Falsche Erwartung (Mnemonic vs. nur Keystore) | **Erledigt (Copy):** bedingter Hilfetext im Unlock-Dialog je **`GET /api/status` → `signer`** |
| L6 | **`WALLET_PASSWORD` in `.env`** | Klartext auf Platte | **Doku:** Dev/CI-Hilfe; Betrieb: **`docs/SECRETS-OPTIONS.md`**, **`docs/ROADMAP-FAHRPLAN.md` § H.3c** |

---

## 4. Ziel-Spezifikation (Skizze, nicht Implementierungsauftrag)

Ziel ist **kein** neues Login-System, sondern **klare Phasen** und **UI-Texte**, die zum bestehenden Modell passen.

### Phase A — **Deployment-Identität** (vor oder ohne App-Öffnung)

- **A1:** Adresse und Package/Mailbox stammen aus **Konfiguration** (Boss-Bundle, `.env`, Export) **oder** aus **/generate-address** / CLI — **nicht** aus einem noch zu bauenden reinen „Registrieren“-Formular ohne Chain-Kontext.
- **A2:** Optional: **Ein** Einstiegspunkt in der App: „Status prüfen“ (`/api/status`) mit **maskierter** Adresse + Link zur Doku „Erste Schritte“.

### Phase B — **Session-Entsperren** (jedes Backend-Start / nach `/vault-lock`)

- **B1:** Ein Dialog: **Passwort** (Vault/Session).
- **B2:** Nur wenn `SIGNER=sdk` **und** kein gespeicherter SDK-Import im Vault: **zweites Feld** Mnemonic/Bech32.
- **B3:** Nur wenn `SIGNER=cli`: Kurztext: „Passwort = IOTA-Keystore zu MY_ADDRESS“ — **kein** Mnemonic-Feld.
- **B4:** Erfolg: `locked: false`, Nutzer kann Chat/Tresor nutzen.

### Phase C — **Persistenz** (optional, empfohlen)

- **C1:** Tresor **lokal sichern** (`/vault-save`) — verschlüsselt inkl. optional SDK-Import.
- **C2:** Optional **on-chain** (`/vault-onchain`), wenn Registry konfiguriert.

### Phase D — **Gas / Messaging-Kontingent**

- **D1:** Anzeige: **Credits-Stand** (wenn Objekt-ID konfiguriert und lesbar) **und** Hinweis auf **MIST** nur wenn relevant (`MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`).
- **D2:** **Credits kaufen:** Shop mit **optional** `recipientIotaAddress` — für Mint muss Nutzer **eine** gültige Adresse kennen (eigene Wallet-Adresse).

### Phase E — **„Kein eigenes IOTA für Gas“**

- **E1:** Produkt sagt: **Organisation/Boss** sponsert über **Credits** oder Infrastruktur — **nicht** „ohne Blockchain“.
- **E2:** Self-Pay nur, wenn explizit aktiviert und Nutzer informiert (Policy-Doku).

---

## 5. Konkrete Verbesserungen (umsetzbar, klein)

- **Copy:** Unlock-Dialog und Chat-Banner: **gleiche Begriffe** — **erledigt** (Startseite, kein Schloss-Kachel-Irrtum); **signer-spezifisch** — **erledigt** (`dashboard.tsx`).
- **Verlinkung:** README-Einstiegsliste + **`docs/DEV-START.md`** + **`docs/ROADMAP-FAHRPLAN.md` § H.0** verweisen auf diese Datei — **erledigt**.
- **Shop:** Tooltip auf dem Adressfeld (`/shop`) — **erledigt** (Mint vs. Claim-Token).

**Noch offen (nächste sinnvolle Iterationen, klein):** Einstellungen: ein Absatz „Wallet & Session“ mit Link-Sammlung (ohne Pflicht); optional **`fetchHelp()`**-Eintrag im Backend-Hilfetext — Backlog **H.0**.

---

## 6. Verifikations-Checkliste (Regression)

- [ ] Backend startet mit `ENABLE_UI=true` → `locked: true` bis Unlock oder `WALLET_PASSWORD`.
- [ ] `POST /api/unlock` mit falschem Vault-Passwort → Fehler, erneuter Versuch möglich.
- [ ] `SIGNER=sdk` ohne Vault-Import → Fehlermeldung verlangt Feld oder Vault-Speicherung (siehe API-Fehlertexte).
- [ ] Shop-Checkout mit/ohne `recipientIotaAddress` entspricht `shop-fulfillment.ts` / `ENABLE_SHOP_CHAIN_MINT`.
- [ ] `npm run test:smoke` (laut `TESTING.md`).

---

## 7. Nicht-Ziele (bewusst)

- Vollständige **Self-Custody-Wallet-App** (Seed-Show, 24-Wort-Animation) im Repo — nur wenn später als eigenes Epic definiert.
- **Anonymes** Messaging **ohne** Adresse auf der Rebased-Chain im aktuellen Messenger-Kern.

---

## 8. Roadmap-Verknüpfung (Fahrplan)

| Ort | Inhalt |
|-----|--------|
| **`docs/ROADMAP-FAHRPLAN.md` § H.0** | Produkt/UX zuerst; **#4 Unlock- & Secret-UX** deckt diese Spezifikation ab. |
| **`docs/ROADMAP-FAHRPLAN.md` § H.3c** | Shop, Credits-Mint, `WALLET_PASSWORD` / Secret-Manager — Betrieb, nicht Endnutzer-„ohne Wallet“. |
| **`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`** | Vor Commit: keine Secrets; State-Dateien ignorieren. |

**Nächster logischer Schritt** nach dieser Doku (wenn **H.0** weitergezogen wird): L2/L4 — **kompakte** „Erste Schritte“ in **Settings** oder **SetupOverlay** (nur Text + Links, kein neuer Chain-Code), oder Boss-**Export-Assistent** (**H.7**) — vor **Mesh-Phase B** nicht zwingend.

---

*Stand: Abgleich mit `wallet-bridge.ts`, `api-server.ts` (`/api/unlock`), `dashboard.tsx`, `chat-view-chat-header.tsx`, `frontend/app/shop/page.tsx`. Bei Code-Änderungen diese Skizze aktualisieren.*
