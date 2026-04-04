# Objekte auf deiner Adresse (0x671bf6…) – Prüfung & Batch-Purge

Kurzfassung: Was die vielen Sui/Move-Objekte sind, ob und warum man sie löschen kann, und wie man sie effizient per Batch purged.

---

## 1. Was sind die Assets? (Verifiziert im Code)

| Objekttyp | Definition / Verwendung | Code-Referenz |
|-----------|--------------------------|----------------|
| **AccessKey** | NFT-ähnlich: `roleId`, BIT_MASK, TTL (Gültigkeit). Zutritt Tür/Spind/Airbnb. | `chain-access.ts`: `ACCESS_KEY_STRUCT_TYPE`, `createAccessKey`, `getOwnedAccessKeys`; Move: `messaging::AccessKey`. |
| **Ticket** | Einmal-Gutschein / Zugangsberechtigung, an `eventId` gekoppelt. | `chain-access.ts`: `TICKET_STRUCT_TYPE`, `createTicket`, `getOwnedTickets`; Move: `messaging::Ticket`. |
| **Gas-Coins (IOTA)** | Kleine Coin-Objekte durch Transaktionen (Splits) entstanden; werden für Gas genutzt. | `chain-access.ts`: `getGasCoinCount`, Coin-Filter in `getOwnedObjects`; Typ `::coin::Coin` / `0x2::coin`. |

Zusätzlich können an deiner Adresse hängen: **Mailbox-Objekte** (Handshakes, Nachrichten), **Vault-Einträge** (wenn on-chain), **andere Move-Objekte** aus dem gleichen Package.

---

## 2. Kann man sie löschen? (Ja – Move „burn“)

- **Purge = Objekt auf der Chain zerstören („burned“).**
- Backend/Contract stellt bereit:
  - **Keys:** `/purge-key <keyId>`, `/purge-keys <id1> <id2> …` (Batch in einer TX)
  - **Tickets:** `/purge-ticket <ticketId>`, `/purge-tickets <id1> <id2> …` (Batch in einer TX)
  - **Mailbox:** `/purge-handshake`, `/purge-msg` (wenn MAILBOX_ID + ENABLE_PURGE)
- Voraussetzung: **ENABLE_PURGE=true** (Default in `config.ts`). Keys: nach Ablauf oder nach `emergency-purge-key`. Tickets: ungenutzt oder `emergency-purge-ticket` bzw. abgelaufen.

Code: `src/chain-access.ts` – `purgeKey`, `purgeMultipleKeys`, `purgeTicket`, `purgeMultipleTickets`; `src/wallet-bridge.ts` – Befehle `/purge-key`, `/purge-keys`, `/purge-ticket`, `/purge-tickets`.

---

## 3. Warum löschen? (Storage Rebate)

- Beim Anlegen eines Objekts wird ein **Storage Deposit (Pfand)** in IOTA reserviert.
- Beim **Purge** wird dieses Pfand abzüglich einer kleinen Gebühr an deine Adresse zurückgezahlt (**Storage Rebate**).
- Vorteile: **Guthaben zurück**, weniger Objekt-Chaos, Explorer-Profil wieder übersichtlich.

Rebate wird im Code ausgewiesen: `chain-access.ts` – `showStorageRebate: true` bei `getOwnedAccessKeys`/`getOwnedTickets`; Typen `OwnedAccessKey.storageRebate`, `OwnedTicket.storageRebate`; `gasSummary` bei `signAndExecute` (inkl. Rebate-Infos).

---

## 4. Wie am besten löschen? (Batch statt manuell)

- **Manuell im Explorer:** für hunderte Objekte unpraktisch.
- **Batch über Backend-API:**
  1. **Kandidaten holen:** `GET /api/rebate-candidates?owner=0x…` (optional `&packageId=0x…`) → liefert `keys` und `tickets` (mit `objectId`), die du purgen kannst.
  2. **Keys/Tickets in Batches purgen:**  
     - Einzeln: `POST /api/command` mit `{ "cmd": "/purge-key", "args": ["<keyId>"] }` bzw. `/purge-ticket` + `<ticketId>`.  
     - **Batch (empfohlen):** `/purge-keys` mit mehreren IDs: `{ "cmd": "/purge-keys", "args": ["0x…", "0x…", …] }`, analog `/purge-tickets`. Pro Aufruf viele Objekte in **einer** TX (PTB) → eine Computation Fee, volle Storage Rebates.

**Bereits im Projekt:**

- **run-firma-realworld-explorer.ts:**  
  - Holt Rebate-Kandidaten über wiederholte `GET /api/rebate-candidates`.  
  - Purged Keys/Tickets in einer Schleife per `/purge-key` bzw. `/purge-ticket` (einzeln).  
  - Steuerung über Env: **FIRMA_PURGE_KEYS**, **FIRMA_PURGE_TICKETS** (Anzahl; Default 0).  
  - Aufruf z. B.:  
    `FIRMA_PURGE_KEYS=50 FIRMA_PURGE_TICKETS=50 npx tsx scripts/run-firma-realworld-explorer.ts`  
  - Hinweis: Das Skript erstellt zuerst viele Keys/Tickets/Nachrichten; wenn du **nur** purgen willst, eignet sich das dedizierte Skript unten besser.

- **Dediziertes Batch-Purge-Skript:**  
  `scripts/purge-rebate-batch.ts` – ruft nur `/api/rebate-candidates` auf und purged alle gelieferten Keys/Tickets in Batches per `/purge-keys` und `/purge-tickets` (kein Erzeugen neuer Objekte).

**Wichtig:** Nur Objekte purgen, die du nicht mehr brauchst. Nach dem Purge sind Key/Ticket und Zugriff unwiderruflich weg.

---

## 5. Warum sehe ich Purge „nicht im Explorer“?

- **Nach einem Purge existiert das Objekt nicht mehr.** Purge = Löschen („burn“) auf der Chain.  
  → Ein Link wie `https://explorer.iota.org/object/0x…?network=testnet` zeigt für dieses Objekt dann **nicht mehr** den Key/Ticket (Objekt gelöscht). Das ist **erwartetes Verhalten**.
- **Wo siehst du den Purge?**  
  Die **Transaktion**, die den Purge ausgeführt hat, hat einen **Digest**. Diesen Digest liefert die API bei erfolgreichem Purge (z. B. `digest` in der Antwort von `/purge-key` oder `/purge-keys`).  
  → Im Explorer die **Transaktion** ansehen: z. B. `https://explorer.iota.org/txblock/<digest>` (ggf. `?network=testnet` anhängen, je nach Netz). Dort siehst du die Purge-TX (Sender, Gas, Effects, „deleted“-Objekte).
- **Zusammenhang mit „Dependent package not found“:**  
  Der Fehler bezieht sich auf die **Package-ID** (dein Move-Contract, z. B. `0x671bf669…`), **nicht** auf die gepurgen Keys/Tickets. Purge löscht nur **Objekte** (AccessKeys, Tickets), **nie** das Package selbst. Dass das Package „not found“ ist, liegt also an Deployment/RPC/Netzwerk (z. B. Package nicht auf dieser Chain deployt oder anderes Netz), **nicht** am Purge.

---

## 6. Gas-Coins nicht „löschen“, aber aufräumen

- **Gas-Coins** (IOTA-Coins) werden nicht „gepurged“, sondern für Gas verbraucht oder können (je nach Wallet/CLI) zusammengeführt werden.
- Wenn zu viele kleine Coins Probleme machen: Wallet/CLI-Funktionen nutzen (Merge/Split). Anzahl prüfen: `getGasCoinCount(client, address)` in `chain-access.ts` (siehe auch `docs/PROJEKT-IST-ZUSTAND.md`).

---

## 7. Kurz-Checkliste

| Frage | Antwort |
|-------|--------|
| Was liegt auf 0x671bf6…? | AccessKeys, Tickets, Gas-Coins (IOTA), ggf. Mailbox/Vault-Objekte. |
| Löschbar? | Ja – Keys/Tickets (und Mailbox) per Purge-Befehle. |
| Warum löschen? | Storage Rebate (IOTA zurück), Übersicht. |
| Wie batch-weise? | `GET /api/rebate-candidates` → `POST /api/command` mit `/purge-keys` und `/purge-tickets` (IDs in Batches), oder `run-firma-realworld-explorer.ts` mit FIRMA_PURGE_* oder `purge-rebate-batch.ts`. |
