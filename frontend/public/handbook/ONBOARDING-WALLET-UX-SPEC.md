# Onboarding, Wallet, Session — Ist-Zustand, Lücken, Ziel-Spezifikation

**Zweck:** Eine **kritische** Einordnung, was Morgendrot **heute** kann, was **fehlt**, und ein **Zielbild** für Endnutzer-Onboarding — ohne bestehende Architektur (IOTA-Rebased, Backend-Session, Vault) zu verleugnen.

**Verwandte Doku:** `docs/DEV-START.md` (Start/Ports), **`docs/RECOVERY-PHRASE-BACKUP.md`** (Recovery/Sicher anzeigen, Szenario Geräteverlust), `docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md` (Credits vs. MIST), `docs/API-SHOP-SPEC.md` / `docs/STRIPE-TEST-SETUP.md` (Shop + optional Chain-Mint), `src/wallet-bridge.ts` (Ablauf), `src/api-server.ts` (`GET /api/status`, `POST /api/unlock`). **Gebündeltes Härtungs-Arbeitspaket (PWA-Speicher, Lite-UI L2, Wipe, Idempotenz, PTB):** **`docs/MORGENDROT-HARDENING-V3-PRECISION.md`** (**Fahrplan § H.14**).

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

### 2.2 UI: „Wallet entsperren“ (**Next** `frontend/frontend/components/dashboard.tsx` · **Lite** `ui/index.html`)

- Dialog bei `locked`: drei gleichwertige Einstiege — **Tresor öffnen** (Passwort; Mnemonic bei `SIGNER=sdk` optional per Schaltfläche), **Seed importieren** (nur `SIGNER=sdk`: Passwort + Mnemonic/Bech32 sofort sichtbar), **Neu anlegen** (neues Profil: Passwort und Seed je zweimal bei `sdk`). Beim ersten Sperren ohne lokale Vault und mit `SIGNER=sdk`: Voreinstellung **Neu anlegen** (Wanderer-Erststart). **`POST /api/unlock`** mit **`code: SIGNER_IMPORT_REQUIRED`** schaltet auf **Seed importieren** um.
- **`SIGNER=sdk`:** Unter **Tresor öffnen** bleibt der Mnemonic-Bereich weiterhin **optional** (progressiv), sofern nicht **Seed importieren** gewählt ist.
- **`SIGNER=cli`:** nur Passwort (Keystore); die Radio-Option **Seed importieren** entfällt.
- **`POST /api/unlock`:** Entschlüsselt lokalen oder on-chain Vault (wenn konfiguriert), wendet SDK-Import an, löst internen Passwort-Resolver auf.

### 2.2.1 Installierte PWA (**standalone**): Sperre im Hintergrund & Ansicht

- Wenn die Messenger-PWA **vom Startbildschirm** (nicht nur Browser-Tab) läuft und die App in den **Hintergrund** geht, wird **`POST /vault-lock`** ausgeführt — der Server bleibt nicht „dauerhaft entsperrt“, bis du die App wieder öffnest. Beim erneuten Öffnen gilt wieder **Tresor öffnen** wie nach **§ 2.2**.
- Die **zuletzt gewählte Kachel** (z. B. Chat, Einstellungen) wird in **`sessionStorage`** gehalten und nach erfolgreichem Unlock wiederhergestellt, sobald die Basis erreichbar ist (**`dashboard.tsx`** / **`chat-view-main-content.tsx`**).

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
| L2 | **Erstnutzer ohne vorkonfigurierte `.env`** | Kein geführter Pfad zu **MY_ADDRESS**, **PACKAGE_ID**, erstem **Handshake** | **Teilweise (2026-03-28):** Next-Dashboard **„Erste Schritte“** + **`GET /api/help`** (`HELP_UI_INTRO`). **Unlock:** Tresor öffnen / **Seed importieren** / **Neu anlegen** (Next + Lite, `SIGNER=sdk`). **Boss:** Handoff-ZIP für Standalone-Smartphone-Bundle (**`POST /api/standalone-smartphone-handoff-zip`**, § H.7). Vollständiger geführter Wizard weiter Backlog; **`docs/VAULT-EINRICHTEN.md`** / **`docs/DEV-START.md`** |
| L3 | **„Credits statt IOTA“** ohne Klartext | Credits ≠ native MIST; Marketing irreführend | **Teilweise:** **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`**, Shop-Tooltip (`/shop`), **`TESTING.md`** Smoke |
| L4 | **Wiederkehrende Nutzer** („neues Gerät“) | Kein UX für „Vault auf neuem Rechner“ vs. Erststart | **Teilweise:** Einstellungen **Wallet & Backup** + **`docs/RECOVERY-PHRASE-BACKUP.md`**; vollständiger Gerätewechsel-Flow weiter Backlog |
| L5 | **SIGNER=sdk vs. cli** im Dialog | Falsche Erwartung (Mnemonic vs. nur Keystore) | **Erledigt (Copy):** bedingter Hilfetext im Unlock-Dialog je **`GET /api/status` → `signer`** |
| L6 | **`WALLET_PASSWORD` in `.env`** | Klartext auf Platte | **Doku:** Dev/CI-Hilfe; Betrieb: **`docs/SECRETS-OPTIONS.md`**, **`docs/ROADMAP-FAHRPLAN.md` § H.3c** |

---

## 4. Ziel-Spezifikation (Skizze, nicht Implementierungsauftrag)

Ziel ist **kein** neues Login-System, sondern **klare Phasen** und **UI-Texte**, die zum bestehenden Modell passen.

### Phase A — **Deployment-Identität** (vor oder ohne App-Öffnung)

- **A1:** Adresse und Package/Mailbox stammen aus **Konfiguration** (Boss-Bundle, `.env`, Export) **oder** aus **/generate-address** / CLI — **nicht** aus einem noch zu bauenden reinen „Registrieren“-Formular ohne Chain-Kontext.
- **A2:** Optional: **Ein** Einstiegspunkt in der App: „Status prüfen“ (`/api/status`) mit **maskierter** Adresse + Link zur Doku „Erste Schritte“.

### Phase B — **Session-Entsperren** (jedes Backend-Start / nach `/vault-lock`)

- **B1:** Ein Dialog: Modus **öffnen** (bestehend) vs. **neu anlegen** (erstes Setup); **Passwort**; bei Neu anlegen **Passwort-Wiederholung**.
- **B2:** Nur wenn `SIGNER=sdk`: bei **Neu anlegen** Mnemonic/Bech32 **mit Wiederholung**; bei **Öffnen** Mnemonic **nur bei Bedarf** (UI-Schaltfläche oder Server **`SIGNER_IMPORT_REQUIRED`**) — nicht dauernd dieselbe Maske wie ohne Vault.
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

**Noch offen (nächste sinnvolle Iterationen, klein):** weitere Kurztexte / Wizard-Teile (Backlog **H.0**). **Einstellungen → „Wallet & Session“** mit Link-Sammlung (Handbuch: Onboarding, Recovery, Boss-Orientierung, PWA § 5) — **erledigt (2026-04-28)** (`frontend/frontend/components/views/settings-view.tsx`). **`GET /api/help`:** Kurzabsatz **`HELP_UI_INTRO`** — **erledigt** (`src/messenger-nest/messenger-help.ts`).

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
| **`docs/ROADMAP-FAHRPLAN.md` § H.14** | **Hardening V3:** PWA-Verschlüsselungsschicht, Lite-UI-Wizard L2, Client-Wipe, Idempotenz-Review, PTB-Audit — **`docs/MORGENDROT-HARDENING-V3-PRECISION.md`**. |
| **`docs/ROADMAP-FAHRPLAN.md` § H.3c** | Shop, Credits-Mint, `WALLET_PASSWORD` / Secret-Manager — Betrieb, nicht Endnutzer-„ohne Wallet“. |
| **`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`** | Vor Commit: keine Secrets; State-Dateien ignorieren. |

**Nächster logischer Schritt** nach dieser Doku (wenn **H.0** weitergezogen wird): L2/L4 — **kompakte** „Erste Schritte“ in **Settings** oder **SetupOverlay** (nur Text + Links, kein neuer Chain-Code); optional **Seed im UI per Knopf zufällig erzeugen** (heute: extern erzeugen oder manuell eintragen) — vor **Mesh-Phase B** nicht zwingend.

---

*Stand: Abgleich mit `wallet-bridge.ts`, `api-server.ts` (`/api/unlock`), `dashboard.tsx`, `chat-view-chat-header.tsx`, `frontend/app/shop/page.tsx`. Bei Code-Änderungen diese Skizze aktualisieren.*
