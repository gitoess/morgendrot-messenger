# Move-Publish-Ritual — M2c Team-Broadcast

**Stand:** 2026-06-02  
**Anlass:** Neues Move-Entry `store_team_plaintext_broadcast` + `TeamPlainBroadcastKey` (Gruppenchat 1× Fee).  
**Basis-Checkliste:** **`docs/DEPLOY-CHECKLIST.md`** (gilt unverändert — dieses Dokument ergänzt Schritt 6).

---

## Was sich on-chain ändert

| Neu in `messaging.move` | Zweck |
|-------------------------|--------|
| `TeamPlainBroadcastKey { sender, nonce }` | DF-Key **ohne** `recipient` |
| `store_team_plaintext_broadcast` | 1× Klartext pro Gruppennachricht in Team-Mailbox |
| `purge_team_plaintext_broadcast` | Rebate pro Team-Broadcast (Sender jederzeit; nach TTL jeder) |
| `TeamPlainBroadcastStored` (Event) | Explorer / spätere Indexer |

**Unverändert:** Shared `MAILBOX_ID` (Einsatz-Postfach), `create_team_mailbox`, pairwise `PlainMsgKey`, private Mailbox, Rebate.

**Wichtig:** Team-Broadcast läuft auf der **Team-Mailbox-Object-ID** (pro Gruppe), **nicht** auf der Shared `MAILBOX_ID` aus `create_globals`.

---

## Voraussetzungen

| Check | Befehl / Ort |
|-------|----------------|
| IOTA-CLI | `iota --version` |
| Gas auf CLI-Wallet | Explorer / `iota client gas` |
| `.env` mit `RPC_URL` | z. B. Testnet |
| Move baut | `iota move build --path move-test` |
| Code-Stand | `store_team_plaintext_broadcast` in `move-test/sources/messaging.move` |

---

## Ritual (Reihenfolge — PowerShell)

Befehle **einzeln** ausführen (kein `&&`).

### 0. Vorher notieren (Pflege-Tabelle)

Alte Zeile aus `.env` / `docs/DEPLOY-MOVE-M4d.md` kopieren — **alte Mailbox-Inhalte** hängen an der alten `MAILBOX_ID`.

### 1. Publish

```powershell
cd c:\Users\damast\Desktop\morgendrot
npm run deploy:move-package
```

→ Neue **`PACKAGE_ID`** in `.env` + `.morgendrot-package-id`.

### 2. `create_globals` (einmal pro Package)

```powershell
iota client call --package <PACKAGE_ID> --module messaging --function create_globals --gas-budget 50000000 --json
```

Event **`GlobalsCreated`** → `.env`:

```env
MAILBOX_ID=0x…
VAULT_REGISTRY_ID=0x…
COMMAND_REGISTRY_ID=0x…
USE_MAILBOX=true
MAILBOX_STORE_PLAINTEXT=true
```

(`MAILBOX_STORE_PLAINTEXT` muss für Team-Broadcast + Klartext-Mailbox gesetzt sein — siehe `.env.example`.)

### 3. Backend neu starten

```powershell
npm run dev
```

Prüfen: `GET http://127.0.0.1:3342/api/status` → `packageId`, `mailboxId`, Flags für Klartext-Mailbox.

### 4. Manifest sync

```powershell
npm run sync:package-profiles
```

`frontend/public/templates/package-profiles.manifest.json`: `REPLACE_*` → neue IDs.

### 5. Team-Mailbox anlegen (on-chain Object)

Tresor entsperrt, dann **eine** der Optionen:

**UI:** Telefonbuch → **Team-Mailbox erstellen**  
**CLI:**

```powershell
$env:UNLOCK_PASSWORD="…"
npx tsx scripts/test-create-team-mailbox-command.ts
```

Object-ID notieren → an alle Gruppenmitglieder teilen (Handoff / QR / Export-Assistent).

### 6. Gruppe verknüpfen (pro Gerät)

1. Kanal **Gruppe** → Gruppen-Panel  
2. **Team-Mailbox** wählen oder ID eintragen  
3. Haken **Team-Broadcast (1× TX)**  
4. **Gruppe speichern**  
5. Sendepfad **online**, Persistenz **Mailbox**, **Klartext**, **Mailbox an alle Mitglieder**

### 7. Smoke Team-Broadcast

```powershell
$env:UNLOCK_PASSWORD="…"
$env:TEAM_MAILBOX_ID="0x…"
npx tsx scripts/test-team-broadcast-smoke.ts
```

Erwartung: `ok: true`, `digest` / `txDigest`, danach Posteingang mit Zeile (Absender = `MY_ADDRESS`, recipient = Team-Mailbox-ID).

**Zweites Gerät:** dieselbe `teamMailboxObjectId` in der Gruppe, Hard-Refresh, Posteingang aktualisieren → dieselbe Nachricht sichtbar.

---

## Abhak-Liste M2c

```
[ ] iota move build (move-test) — ohne Fehler
[ ] npm run deploy:move-package → PACKAGE_ID
[ ] create_globals → MAILBOX_ID + Registries
[ ] MAILBOX_STORE_PLAINTEXT=true, Backend neu
[ ] sync:package-profiles
[ ] Team-Mailbox erstellt (Object-ID notiert)
[ ] Gruppe: teamMailboxObjectId + useTeamBroadcast gespeichert
[ ] test-team-broadcast-smoke.ts OK
[ ] Zweites Gerät / zweiter Browser: Inbox sieht Broadcast
[ ] DEPLOY-MOVE-M4d.md § Letzter Deploy + lokale Pflege-Tabelle aktualisiert
[ ] docs/TEST-RUN-LOGBOOK.md Eintrag (optional)
```

---

## Häufige Fehler (M2c)

| Symptom | Ursache | Fix |
|---------|---------|-----|
| `store_team_plaintext_broadcast` nicht gefunden | Altes Package on-chain | Ritual Schritt 1–3 |
| Team-Broadcast sendet pairwise | Keine Team-Mailbox in Gruppe / Broadcast aus | Gruppen-Panel prüfen |
| Send OK, Inbox leer | Falsche Mailbox gefetcht | `alsoMailboxIds` = Team-ID; Hard-Refresh |
| Nur Sender sieht Nachricht | Mitglieder haben andere Team-ID | Object-ID synchronisieren |
| Verschlüsselt → N× Fee | MVP nur Klartext-Broadcast | Klartext wählen oder pairwise akzeptieren |

---

## Verweise

| Thema | Datei |
|-------|--------|
| Allgemeines Deploy | **`docs/DEPLOY-CHECKLIST.md`**, **`docs/DEPLOY-MOVE-M4d.md`** |
| Konzept Team-Broadcast | **`docs/TEAM-MAILBOX-BROADCAST-1TX-KONZEPT.md`** |
| Gruppenchat-Zielbild | **`docs/GRUPPENCHAT-ZIELBILD.md`** |
| Team-Mailbox UI | **`docs/TEAM-MAILBOXES.md`** |
