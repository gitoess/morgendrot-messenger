# Morgendrot – Projekt-Ist-Zustand (Kontext für KI/Entwicklung)

**Stand:** Kurzfassung des gesamten Projekts, damit eine KI oder ein neuer Entwickler den kompletten Ist-Zustand versteht.

---

## 1. Was ist Morgendrot?

- **Kurz:** Sicherer Messenger und M2M-Lock auf **IOTA Rebased** (Move): ECDH P-256, AES-GCM, Vault (lokal/on-chain), purgebare Nachrichten/Handshakes, **AccessKey-NFTs** (Zutritt Tür/Spind), **Ticket-NFTs** (Event-Einlass), Rebate bei Purge.
- **SPOF:** Seed (ohne Seed keine Signatur); Wallet-Passwort für Vault/CLI.
- **Stack:** Move-Package unter `move-test/`, Node/TS unter `src/` (wallet-bridge, chain-access, m2m-lock, monitoring, streams-adapter, config, vault-local, …), Lite-UI in `ui/` (Alpine + Tailwind), optional Next-Frontend unter `frontend/`.

---

## 2. Was kann es? (Kernfunktionen)

| Bereich | Fähigkeiten |
|--------|--------------|
| **Messenger** | Handshake, Connect, Send (verschlüsselt), Send-plain (Klartext on-chain), Fetch, Purge Handshake/Nachricht, Vault-save/Vault-onchain. |
| **Lock (M2M)** | AccessKey prüfen (on-chain + Offline-Cache), OPEN ausführen (OPEN_COMMAND/OPEN_URL), Klartext/Broadcast-Pinnwand, Replay-Schutz, Zahlungs-Trigger, Streams-Listener. |
| **Keys & Tickets** | Create-key / create-keys (AccessKey-NFT), create-ticket / create-tickets, list-keys / list-tickets, purge-key / purge-ticket (Rebate), transfer-key / transfer-ticket, use-ticket, emergency-purge. |
| **Rollen** | Boss, Kommandant, Arbeiter, Lock, Monitor, Wärter, User (64 Profile über BIT_MASK: D, LW, BW, L, S, P). ROLE_ID 0..63; Rechte z. B. S-Bit für Senden/Heartbeat, D-Bit für set-role. |
| **Streams** | streams-create, streams-subscribe, streams-publish, streams-fetch (L0.5-Bridge). |
| **Monitoring** | Heartbeat, device-status, boss-command (an Worker-Adressen), Gas Station (Boss füllt Worker nach). |
| **Provisioning** | 64 Profil-Templates (id-00 … id-63), Wizard (8×8-Grid), Export config.json/.env/ZIP, Vault für Provisioning, Kommandant-Export. |
| **Asset-Twin / Inventar** | create-asset (PhysicalAsset: name, metadata on-chain), purge-asset (Rebate), list-assets. Lite-UI-Kachel mit QR-Label (objectId + Explorer-Link). Move: `create_physical_asset`, `purge_physical_asset`. |

- **Strategie:** Kachel **„Asset-Twin / Inventar“** umgesetzt (PhysicalAsset im Move, QR-Label, Rebate). ObjectID als Upgrade-Pfad. Siehe `docs/ASSET-TWIN-OBJECTID-STRATEGY.md`.

---

## 3. Architektur (kurz)

- **Backend:** `src/start-with-secrets.ts` → API (api-server.ts) + Wallet-Bridge (Messenger oder Lock). Befehle über `/api/command` (cmd + args).
- **Chain:** `chain-access.ts` spricht mit IOTA Rebased (Move: messaging, create_access_key, create_ticket, store_plaintext_message, purge_key, …). Explorer-Links über EXPLORER_BASE_URL + objectId.
- **Konfiguration:** `.env` / CFG in config.ts; blocklist (OPEN_COMMAND, WALLET_PASSWORD, …), Hierarchy-Keys (ROLE, BOSS_ADDRESS, …).

---

## 4. Tests (aktuell)

- **Unit:** `npm run test` (run-tests.ts) – Modultests.
- **Kombinationen:** `npm run test:combinations` (run-all-combinations.ts) – **>12.000** Tests: 64 Profile, BIT_MASK Roundtrip, Template-Keys, buildDeviceEnv/Json, Befehle, Profil×Aktion, Config.
- **Real-World Chain:** `npm run test:firma-realworld` (run-firma-realworld-explorer.ts) – echte TX (Keys, Tickets, send-plain, Vault, Streams, Heartbeat), Explorer-Links in Datei. Delays: create-key 1200 ms, create-ticket 1200 ms, send-plain 1000 ms (Nonce/Gas).
- **1000 Explorer/Chain-Tests:** `npm run test:explorer-chain-1000` (run-explorer-chain-1000.ts) – 1000 verschiedene Chain-Tests: **Parallelität** (10 Nachrichten gleichzeitig), **Sequenz** (Key → Ticket → Purge Key/Rebate), **Rollen-Wechsel** (set-role → Aktion), **Multi-Backend** (Boss→B, B→Boss). Env: EXPLORER_N_PARALLEL, EXPLORER_N_SEQUENCE, EXPLORER_N_ROLE, EXPLORER_N_MULTI (je default 250).
- **Echte TX einmal durch:** `npm run test:echte-tx` (run-realworld-echte-tx.ts) – Keys, Tickets, Transfer, Handshake, Connect, Send-plain, Send (verschlüsselt), Heartbeat, Streams, Rebate; Beweis-JSON.
- **Szenarien / Nachrichten:** test:scenarios, test:messages, test:arbeiter-kommandant-boss, test:64-profiles-stress.

---

## 5. Bekannte Fehlerquellen & Lösungen

| Problem | Ursache | Lösung |
|--------|---------|--------|
| Nur jedes 4. send-plain ok | Nonce/Queue: Backend feuert schneller als Chain Nonce hochzählt | FIRMA_SEND_PLAIN_DELAY_MS=1000 (oder höher) im Testskript. |
| Nur ~3 create-key/create-ticket ok | Wenige Gas-Objekte im Wallet; TX blockieren sich | Mehr Gas-Coins: z. B. per IOTA-CLI/Wallet mehrfach kleine Beträge an eigene Adresse senden (split); oder FIRMA_CREATE_KEY_DELAY_MS / FIRMA_CREATE_TICKET_DELAY_MS (z. B. 1200 ms). `getGasCoinCount(client, address)` (chain-access) prüft Anzahl. |
| vault-save 0/n | VAULT_FILE im Backend nicht gesetzt | In Backend-.env VAULT_FILE=./test-vault.json (o. ä.) setzen. |
| create-ticket „recipient 0x+64“ | Ungültige Adresse (z. B. von generate-mnemonic) | Nur Adressen mit Regex /^0x[a-fA-F0-9]{64}$/ verwenden (im Skript gefiltert). |
| create-key „LOCK_ID in .env“ | Backend erwartet LOCK_ID oder gültige Lock-Adresse | LOCK_ID in Backend-.env setzen oder MY_ADDRESS (Boss) als Lock übergeben. |

---

## 6. Mathematische/Konsistenz-Sicherheit

- **BIT_MASK:** Für alle ID 0..63 gilt decode(bitMask(ID)) === ID (Roundtrip); ROLE_BITS in config.ts und Test identisch (D:32, LW:16, BW:8, L:4, S:2, P:1). Verhindert Rollen-Verwechslung (z. B. ID 14 ≠ 46).
- **Adressen:** Überall wo 0x+64 Hex verlangt wird: strikte Regex-Prüfung; im Firma-Skript nur solche Adressen für Keys/Tickets.
- **Template:** 64 Profile × 18 Keys typgeprüft (heartbeatIntervalMs, roleId, BIT_MASK, …).

---

## 7. Wichtige Pfade

- `src/wallet-bridge.ts` – Befehlslogik, create-key/create-ticket/send-plain/purge-key, Rollen-Checks.
- `src/chain-access.ts` – Move-Calls, signAndExecute, createAccessKey, chainCreateTicket, storePlaintextMessage, purgeKey.
- `src/config.ts` – CFG, ROLE_BITS, hasRoleBit, buildDeviceEnv, buildDeviceJson.
- `src/api-server.ts` – HTTP-API, /api/command, /api/status, /api/profiles, Explorer-Links anhängen.
- `profiles/id-00` … `profiles/id-63` – template.json pro Profil.
- `scripts/run-firma-realworld-explorer.ts` – Firma Real-World (echte TX, Explorer).
- `scripts/run-all-combinations.ts` – >12.000 Kombinationstests.

---

## 8. Env (Auswahl)

- RPC_URL, PACKAGE_ID, MAILBOX_ID, MY_ADDRESS, ROLE, ROLE_ID, LOCK_ID, VAULT_FILE, STREAMS_BRIDGE_URL, EXPLORER_BASE_URL, ENABLE_PURGE, OPEN_COMMAND, WORKER_ADDRESSES, KOMMANDANT_ADDRESSES, AUTHORIZED_SENDERS. Siehe `.env.example`, `docs/ENV-ERKLAERUNG.md`, `docs/CONFIG-REFERENCE.md`.

Diese Zusammenfassung kann von einer KI genutzt werden, um auf dem kompletten Ist-Zustand des Projekts zu arbeiten.
