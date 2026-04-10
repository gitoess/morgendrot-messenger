# Frontend: API-Schicht modular (`lib/api/*` + Barrel `api.ts`)

**Zweck:** Den öffentlichen Einstieg **`@/frontend/lib/api`** (bzw. `../lib/api`) beizubehalten, während die Implementierung in **kleine Domänen-Dateien** unter **`frontend/frontend/lib/api/`** zerlegt wird. So bleiben **UI → Hooks → `lib/api`** unverändert; nur die **Dateizuordnung** wird klarer und zyklenfrei erweiterbar.

**Fahrplan-Anker:** `docs/MESSENGER-UI-MODULARITY-STRATEGY.md` (Phase 1, § H.1b in `docs/ROADMAP-FAHRPLAN.md`).

---

## Barrel (`frontend/frontend/lib/api.ts`)

- Re-exportiert **`executeCommand`** und alle Domänen-Module unten — **ohne** eigene Logik (reine Barrel-Datei).
- **`getStatus`** (Kompatibilitäts-Mapping auf `fetchStatus`) liegt in **`get-status-compat.ts`**.

**Regel für neue HTTP-/Command-APIs:** Wenn möglich **neues Modul** unter `lib/api/<thema>.ts` anlegen und in `api.ts` **nur re-exportieren** — nicht wieder alles in `api.ts` wachsen lassen.

---

## Basis ohne Zyklus zu `api.ts`

| Modul | Rolle |
|--------|--------|
| **`api-base.ts`** | `API_BASE` (Next-Rewrite vs. `NEXT_PUBLIC_API_BASE`). |
| **`execute-command.ts`** | `executeCommand` → POST `/api/command`. Wird von allen Modulen genutzt, die **keinen** Import von `api.ts` brauchen. |

---

## Module (`frontend/frontend/lib/api/`)

| Datei | Exporte (Auszug) |
|--------|-------------------|
| **`status.ts`** | `ApiStatus`, `HierarchyPermissions`, `VaultStatus`, `fetchStatus`, `unlockBackend` |
| **`get-status-compat.ts`** | `getStatus` (Legacy-Mapping auf `fetchStatus`) |
| **`contacts.ts`** | `ContactMeshEntryClient`, Kontakt-Labels, Mesh-Import/Export |
| **`media.ts`** | `compactImageEncode`, `loraProgressiveEncode`, `loraProgressiveFuse`, `messengerAudioToOpus` |
| **`clear-local-history.ts`** | `clearLocalHistory` |
| **`shadow-sweep.ts`** | `ShadowSweepApiResult`, `postShadowSweep` |
| **`help.ts`** | `fetchHelp` |
| **`backend-restart.ts`** | `restartBackend` |
| **`package-id-history.ts`** | `fetchPackageIdHistory` |
| **`monitor-audit.ts`** | `fetchMonitorStatus`, `fetchAuditEvents`, `AuditEvent` |
| **`vault-personal-secrets.ts`** | `PersonalSecretEntry`, `fetchVaultPersonalSecrets`, `saveVaultPersonalSecrets` |
| **`vault-commands.ts`** | `vaultSave`, `vaultLoad`, `vaultListLocalFiles`, `vaultLoadFromChain`, `vaultOnchain`, `emergencyPurge`, `vaultLockCommand` |
| **`mesh-morg-pkg.ts`** | `MeshV2Wire`, `meshBuildV2Wires`, `meshDecryptV2Wire`, `morgPkgExport`, `morgPkgImport` |
| **`inbox.ts`** | `fetchInbox`, `fetchAllInboxMessagesForExport` |
| **`chat-commands.ts`** | `sendMessage`, `sendEncryptedMessageWithTimeout`, `purgeMailboxMessage` |
| **`package-connect.ts`** | `setPackageIdCommand`, `startHandshake`, `connect` |
| **`keys.ts`** | `createKey`, `createKeys`, `transferKey`, `purgeKey`, `listKeys` |
| **`tickets.ts`** | `createTicket`, `createTickets`, `useTicket`, `transferTicket`, `purgeTicket`, `listTickets` |
| **`device-heartbeat.ts`** | `getDeviceStatus`, `sendHeartbeat`, `setHeartbeatInterval`, `setHeartbeatEnabled` |
| **`boss-transfer.ts`** | `setBossRole`, `sendBossCommand`, `transferCoins` |
| **`vault-signer-import.ts`** | `revealVaultSignerImport` |

Weitere Helfer bleiben bewusst unter **`lib/`** (z. B. `api-fetch-text.ts`, `api-simple-ok-envelope.ts`).

---

## Feature-Slice (`features/`)

- **`frontend/frontend/features/README.md`** — Konvention.
- **`features/attachments/chat-view-attachment-ingest.ts`** — Anhang-Ingest; **`lib/chat-view-attachment-ingest.ts`** ist dünner Re-Export für alte Pfade.
- **`features/send/`** — Mesh-Burst, Delayed-Upload-Marker, Send-Validierung, Outgoing-Wire, `.txt`-Split; dünne Re-Exports unter **`lib/chat-view-*.ts`** und **`lib/mesh-delayed-upload.ts`** für alte Importe.
- **`features/inbox/`** — u. a. **`inbox-map-messages.ts`** (von **`lib/api/inbox.ts`** importiert), Partner-Filter, Slides, Zeilenliste, Fehlertexte; **`lib/inbox-*.ts`** / **`lib/chat-view-inbox-rows.ts`** re-exportieren.
- **`features/voice/`** — **`messenger-voice-record.ts`**; **`lib/messenger-voice-record.ts`** re-exportiert.

---

## Qualitätssicherung

Nach Änderungen an der API-Schicht im Ordner **`frontend/`**:

```bash
npx tsc --noEmit
npx vitest run
```

---

## Git / GitHub

- Sinnvolle **Commit-Granularität:** eine Scheibe pro Commit (z. B. „api: extract inbox“), damit `git bisect` hilft.
- Regelmäßig **`git push`** zum Tracking-Remote (z. B. `origin`), wenn die Arbeitsphase abgeschlossen oder ein Meilenstein erreicht ist.

---

*Stand der Modulliste: 2026-03-28 — bei neuen Dateien unter `lib/api/` diese Tabelle ergänzen.*
