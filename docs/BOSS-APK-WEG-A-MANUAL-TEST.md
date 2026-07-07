# Boss-APK — Weg A manueller Test + Greenfield-Backlog

**Zweck:** Eine **durchführbare Testrunde** für Handoff/Provision **ohne Boss-PC** (Scheiben 1–4) plus **Skizze** für Greenfield Move-Deploy nur vom Handy.

**Voraussetzung-Checkliste (Kurz):** [`BOSS-APK-HANDOFF-EXPORT-CHECKLIST.md`](BOSS-APK-HANDOFF-EXPORT-CHECKLIST.md)

**Helfer danach:** [`STANDALONE-SMOKE-CHECKLIST.md`](STANDALONE-SMOKE-CHECKLIST.md) (Import Handoff-ZIP auf zweitem Gerät)

---

## Teil I — Manueller Testplan (Weg A, Ist-Stand)

### Bewertung: Sinnvolle Reihenfolge

| Phase | Was | Geräte | Dauer (Richtwert) |
|-------|-----|--------|-------------------|
| **0** | Schreibtisch + APK | PC | 15–30 min |
| **1** | IDs einmal seeden (mit PC) | Boss-Handy + PC | 10–20 min |
| **2** | Offline-Export (Kern) | Boss-Handy allein | 15 min |
| **3** | Schnell-Provision | Boss-Handy allein | 10 min |
| **4** | Helfer-Ende-zu-Ende | 2. Handy | 20–40 min |
| **5** | Negativ + Regression | Boss-Handy | 10 min |

**Wichtig:** Phase **1** ist bewusst **einmal mit PC** — Greenfield nur vom Handy ist **noch nicht** implementiert (Teil II). Ohne Phase 1 fehlen oft CmdReg/VaultReg in localStorage.

---

### Phase 0 — Schreibtisch

- [ ] Commit/Tag notieren: `________________`
- [ ] `cd frontend` → `npm run test:unit -- frontend/lib/handoff-export-defaults.test.ts frontend/lib/handoff-build-parts-locally.test.ts frontend/lib/generate-mnemonic-local.test.ts` grün
- [ ] APK bauen: `npm run apk:debug:build` → `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
- [ ] APK auf **Boss-Testgerät** installieren (gleicher Build für Helfer in Phase 4)

**Gate:** Unit grün + APK installiert → Phase 1.

---

### Phase 1 — IDs seeden (einmalig, Boss-PC an)

Ziel: localStorage füllen, damit Phase 2–3 offline funktionieren.

| # | Schritt | Erwartung |
|---|---------|-----------|
| 1.1 | Boss-APK: Onboarding **Boss**, Wallet/Mnemonic, Testnet-Faucet wenn nötig | Signer aktiv |
| 1.2 | **Basis-URL** auf LAN-PC setzen (z. B. `http://192.168.x.x:3342`) — PC: `npm run dm` Boss-Rolle | Status erreichbar |
| 1.3 | Wizard/Deploy: Move-Package + **`create_globals`** (Testnet) | Package, Mailbox, CmdReg, VaultReg in UI/Status |
| 1.4 | Optional: Einstellungen → Direct-RPC = Testnet-Fullnode | `morgendrot.directIotaRpcUrl` gesetzt |
| 1.5 | DevTools/Chrome Remote Debugging: LS prüfen (siehe unten) | pkg, mb, sender, rpc, cmd, vault **nicht leer** |
| 1.6 | **Basis-URL leeren**, PC-API stoppen | App bleibt nutzbar (Direct-RPC + LS) |

**LS-Snapshot (Chrome → Gerät → inspect → Console):**

```javascript
const k = (x) => localStorage.getItem(x)
;({
  apiBase: k('morgendrot.apiBaseOverride'),
  pkg: k('morgendrot.directChain.packageId')?.slice(0,14)+'…',
  mb: k('morgendrot.directChain.mailboxId')?.slice(0,14)+'…',
  sender: k('morgendrot.directChain.senderAddress')?.slice(0,14)+'…',
  cmd: k('morgendrot.directChain.commandRegistryId')?.slice(0,14)+'…',
  vault: k('morgendrot.directChain.vaultRegistryId')?.slice(0,14)+'…',
  rpc: k('morgendrot.directIotaRpcUrl'),
})
```

**Gate Phase 1:** `pkg`, `mb`, `sender`, `rpc` gesetzt; nach Deploy ideal auch `cmd` + `vault`.

---

### Phase 2 — Handoff-Export offline (Scheibe 1 + 4)

Voraussetzung: Basis-URL **leer**, PC **aus**, WLAN am Handy **an** (nur IOTA-RPC, kein Morgendrot-Server).

| # | Schritt | Erwartung | ✓ |
|---|---------|-----------|---|
| 2.1 | Dashboard → **Helfer einrichten** / Handoff-Export öffnen | Felder Boss, Mailbox, RPC, ggf. CmdReg/VaultReg **vorausgefüllt** (aus LS) | |
| 2.2 | Preset „Helfer“, Bezeichnung setzen → **Nur ZIP** (ohne Passwort) | Download startet, **kein** Network-Fehler | |
| 2.3 | ZIP entpacken (PC oder Dateimanager) | `morgendrot-standalone-handoff.env`, `README-HANDOFF.txt`, ggf. `.morgendrot-runtime-config.json` | |
| 2.4 | `.env` prüfen | `PACKAGE_ID`, `BOSS_ADDRESS`, `MAILBOX_ID`, `RPC_URL`, `NEXT_PUBLIC_DIRECT_IOTA_RPC_URL` = 0x+64 / gültige URL | |
| 2.5 | Wenn Phase 1.3 ok | `COMMAND_REGISTRY_ID`, `VAULT_REGISTRY_ID` in `.env` | |
| 2.6 | Optional: Passwort-ZIP | Entschlüsselung + gleicher Inhalt | |

**Negativ 2.N1:** In DevTools `morgendrot.directChain.mailboxId` löschen → Export erneut → Meldung mit „Mailbox-ID fehlt …“ (kein stilles Hängen).

---

### Phase 3 — Schnell-Provision offline (Scheibe 2)

| # | Schritt | Erwartung | ✓ |
|---|---------|-----------|---|
| 3.1 | **Helfer einrichten** → neues Gerät / Schnell-Assistent | Neues Mnemonic **ohne** Server-Fehler | |
| 3.2 | ZIP + Seed-QR erscheinen | QR ~60 s, Registry-Eintrag lokal | |
| 3.3 | Boss-Registry: Eintrag sichtbar, Seed nur mit Master-PW | wie bisher mit Server | |

**Hinweis:** `syncHandoffSuggestionToServer` schlägt offline fehl — **ok**, Roster-Pending bleibt lokal.

---

### Phase 4 — Helfer (Ende-zu-Ende, optional aber empfohlen)

Zweites Gerät (oder zweites Profil): Handoff-ZIP aus Phase 2/3 importieren → siehe **STANDALONE-SMOKE** § Vorbereitung + Schritte A–C.

| # | Minimal-Erwartung | ✓ |
|---|-------------------|---|
| 4.1 | Handoff importiert, Mnemonic auf Helfer | |
| 4.2 | Direct-RPC Inbox/Chat ohne Boss-PC | |
| 4.3 | Boss ↔ Helfer Nachricht (Direct-IOTA) | |

---

### Phase 5 — Regression

| # | Schritt | Erwartung | ✓ |
|---|---------|-----------|---|
| 5.1 | Basis-URL wieder auf LAN-PC setzen | Export nutzt **Server-Pfad** (weiterhin ok) | |
| 5.2 | Basis wieder leeren | Wieder **Client-Pfad** | |

---

### Logbuch (eine Zeile pro Runde)

Eintrag in [`TEST-RUN-LOGBOOK.md`](TEST-RUN-LOGBOOK.md):

```text
YYYY-MM-DD | Boss-APK Weg A | Commit ______ | Phase 0–5: 2.x/3.x grün/rot | Geräte: Boss ______ Helfer ______ | Notiz: ______
```

---

## Teil II — Greenfield Move-Deploy nur vom Handy (Backlog-Skizze)

**Problem heute:** Erstes Package + `create_globals` laufen über **`POST /api/deploy-package`** / **`POST /api/create-globals`** (Node + IOTA-CLI auf Boss-PC). Weg A deckt **Handoff ab bestehendem Setup** ab — nicht **komplett neuer Einsatz ohne PC**.

### Zielbild

Boss-Handy (Basis leer, Wallet mit Gas):

1. Move-Bytecode **bereits im Repo/APK** (embedded oder CDN-Hash) — kein `npm run` auf dem Telefon.
2. **Direct-IOTA Submit** aus dem Browser: `publish` / `create_globals` / `create_team_mailbox` mit Session-Signer (bestehende H.15-Pipeline erweitern).
3. Ergebnis-IDs → dieselben LS-Keys wie heute (`directChain.*`, Registry-Store, Netzwerk-Profil).
4. Anschließend sofort Weg-A-Export (Scheiben 1–4) **ohne** jemals einen Server gestartet zu haben.

### Grobe Scheiben (Vorschlag)

| Scheibe | Inhalt | Abhängigkeit |
|---------|--------|--------------|
| **G1** | Publish Move-Package clientseitig (Testnet) | `@morgendrot/core` TX-Builder, Gas/Faucet-UI |
| **G2** | `create_globals` + Events parsen → LS persist | G1 |
| **G3** | Wizard „Neuer Einsatz“ ohne Basis-URL durchgängig | G1–G2 + Weg A |
| **G4** | Mainnet + Manifest-Anker (optional) | G1–G3, Gas-Hürde |

### Bewusst **nicht** Weg B

Eingebetteter Node (`npm start` in APK) — hoher Wartungsaufwand, Android-Limits; nur erwägen wenn G1–G2 an Move/SDK scheitern.

### Abnahme Greenfield (später)

| Check | Erwartung |
|-------|-----------|
| Fabrikneues Boss-Handy, nie PC verbunden | Wizard → Deploy Testnet → Export ZIP → Helfer importiert |
| Kein `morgendrot.apiBaseOverride` jemals gesetzt | — |

### Code-Anknüpfung (Ist)

| Bereich | Heute | Greenfield |
|---------|-------|------------|
| Deploy | `onboarding-boss-bootstrap.ts` → `/api/deploy-package` | Client-TX + Event-Extract |
| Globals | `boss-registry-bootstrap.ts` → `/api/create-globals` | Client-TX |
| IDs persist | `persistDirectChainFieldIds`, `persistBossChainRegistryIds` | **Reuse** |
| Handoff | Weg A Scheiben 1–4 | unverändert nach G2 |

---

*Pflege: Nach APK-Build-Änderungen Phase 0 aktualisieren; nach Greenfield-Implementierung Teil II in Roadmap § H.7 verlinken.*
