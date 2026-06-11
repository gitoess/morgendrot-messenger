# Move deployen — Upgrade vs. Neu-Publish

**Stand:** 2026-06-02  
**Zweck:** Wann **`npm run upgrade:move-package`** (gleiche IDs) vs. **`npm run deploy:move-package`** (neue `PACKAGE_ID`).  
**Verwandt:** `docs/DEPLOY-CHECKLIST.md`, `docs/MOVE-MESSENGER-KONFIGURATION.md` §17, `docs/ID-UEBERSICHT-WANN-WELCHE-ID.md`.

---

## Kurzentscheidung

| Situation | Befehl | `PACKAGE_ID` | Team-Mailbox `0x…` | Handoff an Helfer |
|-----------|--------|--------------|---------------------|-------------------|
| Erst-Deploy / neuer Einsatz | `deploy:move-package` | **Neu** | Neu (`create_globals` / `create_team_mailbox`) | **Ja** |
| Bugfix, neue Move-Funktion (z. B. Team-Purge) | **`upgrade:move-package`** | **Gleich** | **Gleich** | **Nein** |
| Secure Edition / Breaking Change | `deploy:move-package` | **Neu** | Neu empfohlen | **Ja** |
| UpgradeCap verloren | Nur Neu-Publish | Neu | Migrieren / Archiv | Ja |

---

## Was ist was?

### Dynamic Fields + `store_*`

Speichern **Nachrichten** in der Mailbox (`MsgKey`, `TeamPlainBroadcastKey`, …).  
**Kein** Contract-Update. Object-ID der Mailbox bleibt; Inhalt kommt und geht.

### Package-Upgrade (`UpgradeCap`)

Ersetzt den **Move-Bytecode** unter **derselben** `PACKAGE_ID`.  
Bestehende Mailbox-Objects (`0x…::messaging::Mailbox`) bleiben gültig — App ruft weiter dieselbe Package-ID auf, nur mit neueren Funktionen.

### Neu-Publish (`iota client publish`)

Erzeugt **neues** Package → **neue** `PACKAGE_ID`.  
Alte Mailbox-Objects haben Typ-Prefix der **alten** ID → `validateMessagingMailboxObjectForPackage` schlägt fehl → neues Team-Postfach + neues Handoff.

---

## Ablauf: Erst-Publish (einmal pro Einsatz)

```powershell
cd c:\Users\damast\Desktop\morgendrot
npm run deploy:move-package
```

**Ergebnis in `.env`:**

- `PACKAGE_ID=0x…` (neu)
- `UPGRADE_CAP_ID=0x…` (wenn CLI `--json` liefert — sonst Explorer / Wallet)

**Danach (nur bei Neu-Publish):**

1. `create_globals` → `MAILBOX_ID`, `VAULT_REGISTRY_ID`, `COMMAND_REGISTRY_ID`
2. Team-Mailboxen (`create_team_mailbox`) wie gewohnt
3. Backend neu starten
4. Handoff-ZIP an Helfer

**UpgradeCap sichern:** Tresor / offline notieren — ohne Cap kein In-Place-Upgrade.

---

## Ablauf: Upgrade (Code-Fix, gleiche IDs)

Voraussetzungen:

- `PACKAGE_ID` in `.env` (bestehender Einsatz)
- `UPGRADE_CAP_ID` in `.env` **oder** Cap in der CLI-Wallet zum Package
- IOTA-CLI-Wallet = Besitzer der UpgradeCap

```powershell
npm run upgrade:move-package
```

Optional:

```powershell
npm run upgrade:move-package -- move-test
UPGRADE_CAP_ID=0x… npm run upgrade:move-package
```

**Ergebnis:**

- **Gleiche** `PACKAGE_ID`
- **Gleiche** `MAILBOX_ID` / Team-Mailbox-IDs
- **Kein** neues Handoff nötig
- Backend neu starten; Einsatzleitung → **Einsatz-Konfiguration** → Move-Funktionen prüfen (z. B. Team-Purge ✓)

CLI-Equivalent:

```powershell
cd move-test
iota client upgrade --upgrade-capability <UPGRADE_CAP_ID> --json
```

---

## UI: Einsatz-Konfiguration (Boss)

**Einsatzleitung → Einsatz-Konfiguration** zeigt:

| Feld | Bedeutung |
|------|-----------|
| **UpgradeCap** | Konfiguriert → „upgrade-fähig“ |
| **deployModeHint** | `upgrade-fähig` vs. `nur Neu-Publish` |
| **Move-Deploy** | RPC-Probe: `store_team_plaintext_broadcast`, `purge_team_plaintext_broadcast`, … |

---

## Wann **nicht** upgraden?

- **Kompatibilitätsbruch** in Move (Struct-Felder, entfernte Entry-Funktionen) → oft scheitert `--verify-compatibility`; dann bewusst Neu-Publish + Migration.
- **Zweite Produkt-Edition** (z. B. No-Purge) → eigenes Package, eigene `PACKAGE_ID`.
- **UpgradeCap auf anderem Wallet** als CLI → Cap transferieren oder richtige Wallet in CLI aktivieren.

---

## `.env`-Keys

| Key | Publish | Upgrade |
|-----|---------|---------|
| `PACKAGE_ID` | Wird **neu** gesetzt | **Unverändert** |
| `UPGRADE_CAP_ID` | Wird gesetzt (Erst-Publish) | Wird **benutzt**, nicht geändert |
| `MAILBOX_ID` / Team-IDs | Bei Neu-Publish neu setzen | **Unverändert** |

---

## Fehlerbilder

| Symptom | Ursache | Fix |
|---------|---------|-----|
| „Postfach gehört zu Package X, eingestellt Y“ | Neu-Publish, alte Mailbox | Upgrade statt Publish **oder** neue Mailbox |
| Team-Purge „Unbekannter Befehl“ | Altes Package on-chain | `upgrade:move-package` + Backend-Neustart |
| UpgradeCap fehlt in UI | Nie gespeichert / falsche Wallet | Explorer; `UPGRADE_CAP_ID` manuell; ggf. nur Neu-Publish |
| Upgrade CLI-Fehler compatibility | Breaking Move-Änderung | Neu-Publish planen |

---

## Referenz im Repo

| Artefakt | Pfad |
|----------|------|
| Publish-Skript | `scripts/deploy-move-package.ts` |
| Upgrade-Skript | `scripts/upgrade-move-package.ts` |
| CLI-Wrapper | `src/move-package-deploy.ts` |
| npm | `deploy:move-package`, `upgrade:move-package` |
