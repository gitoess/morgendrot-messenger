# Rollen-Profile zum Schreibtisch-Test (Consumer / Arbeiter / Kommandant / Boss)

**Zweck:** Eine Node-Instanz = **eine** Rolle. Für UI-Tests (Team-Mailbox-Gate, Einsatz-Vorlagen, Dashboard-Kacheln) schnell zwischen Profilen wechseln — **ohne** vier komplette `.env`-Kopien mit Secrets.

**Modell:** Siehe **`docs/ROLLEN-MODELL-CONSUMER-EINSATZ.md`**.

---

## Empfohlener Ansatz (Overlay, nicht volle Kopie)

| ❌ Schwach | ✅ Besser |
|-----------|----------|
| Vier vollständige `.env.consumer` … mit duplizierten Secrets | **Eine** `.env` (Wallet, RPC, `PACKAGE_ID`, …) + **Overlays** `.env.role-*.example` |
| `copy .env.boss .env` überschreibt versehentlich Secrets | `npm run env:role:boss` patcht nur `ROLE`, `DEPLOYMENT_PROFILE`, `UI_VARIANT` |

Overlays liegen unter **`env/roles/`** (committbar, **keine** Geheimnisse):

- `env/roles/consumer.env` (auch **`npm run env:role:wanderer`** — gleiches Overlay)
- `env/roles/arbeiter.env`
- `env/roles/kommandant.env`
- `env/roles/boss.env`

---

## Ansteuern

```powershell
# Overlay auf bestehende .env anwenden
npm run env:role:consumer
npm run env:role:wanderer
npm run env:role:arbeiter
npm run env:role:kommandant
npm run env:role:boss

# Danach Backend neu starten (Pflicht für deploymentProfile!)
npm run dev
```

Kombiniert (Overlay + Dev in einem Schritt):

```powershell
npm run dev:role:kommandant
```

**Verifikation:** Browser oder `GET /api/status` — Felder `role`, `deploymentProfile`, `permissions.teamManage`, `permissions.configChange`.

| Profil | Erwartung (Kurz) |
|--------|------------------|
| **consumer** / **wanderer** | `deploymentProfile=consumer`, `SIMPLE_MODE=true`, `TRANSPORT_PROFILE=mesh-first`, kein Team erstellen |
| **arbeiter** | `einsatz`, `UI_VARIANT=messenger`, Simple Mode, kein Team erstellen, **keine** Einsatz-Vorlagen |
| **kommandant** | `einsatz`, Team erstellen, Vorlagen nur lesen |
| **boss** | `einsatz`, Team + Vorlagen speichern |

---

## Feldtest-Protokoll (Schreibtisch 2026-05-21)

| Check | Consumer | Arbeiter | Kommandant |
|-------|----------|----------|------------|
| Team-Mailbox **erstellen** unsichtbar | ✅ | ✅ | ✅ sichtbar |
| Team-Mailbox **erstellen** funktioniert | N/A | N/A | ⚠️ war „Transaktion fehlgeschlagen“ (Fix: Object-ID aus TX-Event) |
| Private Mailbox erstellen + aktiv | ✅ | ✅ | ✅ |
| Private Mailbox **Private #N** Label | ✅ (ab Fix) | ✅ (ab Fix) | ✅ Backfill für alte Einträge |
| Team-Mailbox **beitreten** (ID/QR) | Später | Später | **Beitreten (ID/QR)** in Meine Mailboxen — kein separates Profil-QR |
| Team-Mitglieder per QR/Profil einladen | — | — | ID kopieren / QR nach Beitritt teilen (kein dediziertes „Einladen“-UI) |
| Sendepfad Event vs. Persistent (aktive MB) | Composer: **Speicher auf der Chain** + Badge | gleich | gleich |
| Gruppe: **„Mailbox an alle Mitglieder“** | Checkbox sichtbar | ✅ Checkbox | ✅ Checkbox (Gruppenchat später) |
| Einsatz-Vorlagen Einstellungen | N/A | ✅ **nicht sichtbar** | **Einstellungen** → Lesen (Speichern nur Boss) |
| Handshake empfangen (2. Wallet) | **`docs/CONSUMER-HANDSHAKE-RECEIVE-SMOKE.md`** | — | — |
| Handshake Annehmen/Ablehnen | — | — | ✅ |
| Private + Team aktiv setzen / wechseln | — | — | ✅ Privat; Team nach erfolgreichem Erstellen unter **Team-Mailboxes** |

### Boss — Checkliste (Wo genau?)

**Grundregel:** Boss = alles was Kommandant hat **plus** Schreib-/Verwaltungsrechte (`configChange`, `hierarchyChange`, `keyIssue`, …). Gleiche PWA (`UI_VARIANT=full`), mehr Buttons die speichern/dürfen.

| Was | Kommandant | Boss | Wo in der PWA |
|-----|------------|------|----------------|
| Team-Mailbox erstellen | ✅ | ✅ | Nachrichten → Posteingang → **Meine Mailboxen** → Team-Mailboxes |
| Team-Mailbox beitreten (ID/QR) | ✅ | ✅ | dort: **Beitreten (ID/QR)** |
| Team on-chain löschen / Rebate | ❌ | ❌ | **Nicht implementiert** — Shared-Object bleibt on-chain; nur **Aus Liste** (lokal) |
| Private Mailbox on-chain löschen | ✅ | ✅ | Private Mailboxes → **On-chain löschen** |
| Einsatz-Rollen-Vorlagen lesen | ✅ | ✅ | Dashboard → **Einstellungen** → Karte *Einsatz-Rollen-Vorlagen* |
| Einsatz-Rollen-Vorlagen **speichern** | ❌ | ✅ | dort: Button **Speichern** (JSON → `.morgendrot-einsatz-templates.json`) |
| `.env` / Runtime-Config ändern | ❌ | ✅ | Einstellungen → **.env anpassen** (nur Boss: POST `/api/config`) |
| Hierarchie-Keys (ROLE, BOSS_ADDRESS, …) | ❌ | ✅ | `.env anpassen` (Boss + `hierarchyChange`) |
| **Steuerung / Boss-Modus** | ❌ | ✅ | Dashboard-Kachel **Steuerung** → *Boss-Modus* (Rollen setzen, Befehle, Mesh) |
| **Export-Assistent** (Handoff-ZIP ~3 KB) | ❌ | ✅ | **Einstellungen** oder Steuerung → Boss-Modus → **Export-Assistent** |
| **Handoff importieren** (ZIP) | ✅ | ✅ | **Einstellungen → Handoff importieren** — **`docs/HANDOFF-IMPORT-UX.md`** |
| **Pinnwand-Admin** | ❌ | ✅ | Steuerung → *Admin* |
| Geräte-Radar | ✅ (full) | ✅ | Dashboard unter den Kacheln (Arbeitsbereich **full**) |
| Nachrichtenverlauf / Forensik-Export | ✅ | ✅ | Nachrichten → Posteingang → **Nachrichtenverlauf** (JSON, TXT, verschlüsselt, ZIP-Protokoll) |
| Chain-Verankerung / Tangle-Inventar | ✅ | ✅ | Nachrichtenverlauf-Menü → *Auf Chain verankern*, *Tangle-Inventar* |
| Telefonbuch / Kontakte | ✅ | ✅ | Posteingang → **Telefonbuch** |
| **Einsatz-Profil importieren** (`initialProfile`) | ✅ (Lesen) | ✅ | Dashboard → **Einsatzleitung** (Krone) oder Posteingang → JSON import |
| **Einsatzleitung-Tab** (zentral) | ✅ | ✅ | Dashboard-Kachel **Einsatzleitung** oder Schnellbutton oben |
| Geräte provisionieren (API) | ❌ | ✅ | `POST /api/provision-device` oder Lite-UI `ui/` |
| Volle Dashboard-Kacheln (Schloss, Monitor, …) | ✅ | ✅ | Dashboard „Was möchtest du tun?“ |

**Team-Mailbox Fehler (Boss + Kommandant):** Wenn Explorer **`Function Not Found`** → **`npm run deploy:move-package`**, **`create_globals`**, Backend neu starten. **Ist 2026-05-21:** `PACKAGE_ID` `0xcf409a0387de039a707d1916afeb16f17a22969a0735e8cfeeaaf5b5fa3d811f`.

---

### Kommandant — Hinweise (Meine Mailboxen)

- **Team-Mailbox** erscheint im Abschnitt **Team-Mailboxes** (amber Badge „Team“), oberhalb der privaten Liste — nicht bei Server-Shared (.env).
- **Mitglieder einladen:** Nach Erstellen Object-ID kopieren oder **Beitreten (ID/QR)** auf dem Gerät des Mitglieds; kein separates „Profil einladen“-Button.
- **Einsatz-Vorlagen:** **Einstellungen** (Dashboard-Kachel) → Karte **Einsatz-Rollen-Vorlagen** — Kommandant nur **Lesen** + „Vom Backend laden“.

---

### Gruppenchat: welches Häkchen?

Gemeint ist die Checkbox **„Mailbox an alle Mitglieder“** im Panel **Gruppe** (Chat-Kanal „Gruppe“). Es gibt **kein** separates Label „an alle Mitglieder“. Mit Häkchen: beim Senden N× pairwise Mailbox (online + Persistent) an jedes Gruppenmitglied; ohne Häkchen nur die 0x-Adresse im Composer. Für **Arbeiter/Kommandant/Boss** gleich — **Consumer** ggf. später einschränken (Roadmap § Spätere Tests #6).

---

## Alternative: manuelles Kopieren

Wenn du lieber **komplette** Dateien pflegst (z. B. `.env.boss` mit allem):

```powershell
Copy-Item .env.boss .env -Force
npm run dev
```

**Nachteil:** Vier Dateien mit `MY_ADDRESS`, Vault-Passwort, … — leicht **Drift** und versehentliches Committen (nur `.env` ist in `.gitignore`).

---

## Wichtige Grenzen

1. **Neustart nötig:** `DEPLOYMENT_PROFILE` wird beim Prozessstart gesetzt — nach `env:role:*` immer **`npm run dev`** neu.
2. **Eine Rolle pro Lauf:** Nicht zur Laufzeit im Chat umschaltbar (kein Citizen↔Boss-Dropdown).
3. **Gleiche Wallet, andere Rolle:** Overlays ändern nur die **Geräteklasse** — für realistische Hierarchie optional `BOSS_ADDRESS`, `KOMMANDANT_ADDRESSES`, `WORKER_ADDRESSES` in `.env` setzen.
4. **UI vs. API:** ConfigView (`.env anpassen`) kann `ROLE` schreiben — nur **Boss** + `configChange`; Consumer-`messenger` ohne Override: **403**.
5. **Test-Hack:** `ALLOW_TEST_ROLE_OVERRIDE=true` in `.env` erlaubt Hierarchie-Keys auch ohne Boss (nur Dev).
6. **Parallel:** Vier Rollen **gleichzeitig** = vier Prozesse mit **verschiedenen Ports** und **verschiedenen** `.env`-Verzeichnissen — Overlays reichen für **sequenzielles** Durchklicken.

---

## Simple Mode & UI-Gates (Arbeiter / Wanderer / Consumer)

Nach **`npm run dev:role:arbeiter`** (oder **`dev:role:wanderer`**) + Tresor offen — detailliert auch **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** § 6.

| Check | Arbeiter | Wanderer (consumer) |
|-------|----------|---------------------|
| `GET /api/status` | `simpleMode`, `transportProfile: mesh-first`, `iotaTransportUiEnabled: false` | gleich |
| Dashboard | Kacheln **Nachrichten** + **Tresor** (kein Action Center) | gleich |
| Sendepfad | **funk** + **online**, kein **adhoc** | gleich |
| Posteingang | kein „Nur IOTA“; kein Expert-Menü Verankern/Relay | gleich |
| Offline-Queue | Streifen unter Kopfzeile + Button „Wartende Sendungen (N)“ wenn pending | gleich (Opt-in `morgendrot.offlineMailboxQueue=1`) |
| Einsatzleitung-Tab | ❌ | ❌ |
| Handoff Preset (Boss-Export) | **Arbeiter** / **Helfer** | **Wanderer** (kein Team-Mailbox-Multi) |
| Handoff README: Meshtastic-PSK + optional IOTA-Archiv | Boss-Export-Assistent | — |

**Block 2 (Feldtest, 3–5 Tage):** siehe **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** § Block 2 — Handoff importieren, 2. Wallet, Team beitreten, PWA L1–L5.

**Vitest (Schreibtisch):** `messenger-role-capabilities`, `handoff-export-presets`, `chat-view-offline-queue-strip`, `chat-view-inbox-toolbar` (Simple-Mode-Zweig).

---

## Checkliste pro Profil (Mailbox / Gruppe)

Nach Wechsel + Neustart kurz prüfen:

- [ ] Posteingang → **Meine Mailboxen** → Team **erstellen** ja/nein
- [ ] Einstellungen → **Einsatz-Rollen-Vorlagen** sichtbar / Speichern ja/nein
- [ ] Chat-Kanal **Gruppe** + **Persistent** → „Mailbox an alle Mitglieder“ (Kommandant/Boss/Arbeiter gleich — pairwise)
- [ ] `GET /api/status`: `deploymentProfile`, `permissions.teamManage`

Protokoll: **`docs/TEST-RUN-LOGBOOK.md`**.

---

## Spätere Tests (Backlog)

| Test | Rolle | Status |
|------|-------|--------|
| Einsatzleitung-Tab: Import JSON → Telefonbuch | Boss, Kommandant | offen |
| Einsatzleitung: Handoff-ZIP (Export-Assistent / Schnell-Handoff) | Boss | offen |
| Einsatzleitung: Forensik-Export (JSON/TXT/ZIP) | Boss, Kommandant | offen |
| Posteingang-Shortcut „Einsatzleitung“ → Tab | Boss, Kommandant | offen |

---

*Stand: 2026-05-20 — Simple-Mode-Gates, `env:role:wanderer`, Offline-Queue UI.*
