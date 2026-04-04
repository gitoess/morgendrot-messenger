# Kritische Einordnung: 1.123-Aktionen-Lauf (Tiles + Explorer)

**Zweck:** Was stimmt, was ist übertrieben – ehrliche technische Einordnung für Dokumentation/Showcase.

---

## 1. Was der Code wirklich löst (verifiziert im Repo)

### 1.1 Serialisierung pro Gas-Payer (kein „Nonce-Juggling“ im Ethereum-Sinn)

- **Wo:** `src/chain-access.ts`: `withTxSerial(gasPayerKey, fn)` + `txSerialByGasPayer`
- **Was:** Pro Adresse (Gas-Payer) läuft **nur eine TX gleichzeitig**. Die nächste startet erst, wenn die vorherige durch ist (Promise-Kette).
- **Warum:** Verhindert **„object reserved for another transaction“** (Gas-Objekt gesperrt). Kein klassisches Nonce-Queue-Management; die IOTA-Runtime handhabt die finale Reihenfolge.
- **Fazit:** Echte Hürde, echte Lösung – aber treffender: **TX-Serialisierung pro Konto**, nicht „Nonce-Juggling“.

### 1.2 Retry nur bei „object reserved“

- **Wo:** `src/chain-access.ts`: `runWithRetry()` mit `isObjectReservedError(e)` und **seit Verbesserung** `isTransientChainError(e)` (Dependent package not found, -32002, transaction inputs).
- **Was:** Bis zu **3 Versuche**: bei „object reserved“ 2,5 s Pause; bei transienten Chain-Fehlern 4 s Pause.
- **Fazit:** Retry gilt jetzt auch für Sync-Lag / „Dependent package not found“. Nach allen Retries weiterhin Fehler → Tiles-Skript zählt `failed`.

### 1.3 PTBs (Programmable Transaction Blocks) und Batching

- **Wo:** `chain-access.ts` – create_access_key, create_ticket, store_plaintext_message, purge_key/ticket, create_key_and_notify (Key + Nachricht in einer TX).
- **Was:** Eine TX kann mehrere Aktionen bündeln (z. B. create-keys Batch, purge-keys Batch). Spart Gas und Bestätigungen.
- **Fazit:** **Korrekt** – Batching/PTB-Nutzung ist fachlich aufwendig und sinnvoll.

### 1.4 Settlement-Queue (Offline-Bestätigungen)

- **Wo:** `src/settlement-queue.ts` – persistente Queue, Worker schreibt use_ticket-Batches on-chain, **mit** Retry/Backoff bei Fehlern.
- **Fazit:** Echte Queue mit Retry – aber für **Settlement** (use_ticket), nicht für den generischen 1.123-Aktionen-Lauf.

---

## 2. Was übertrieben oder falsch ist

| Aussage | Korrektur |
|--------|-----------|
| „Nonce-Queue: Backend weiß, welche Nummer als Nächstes dran ist“ | Es gibt **keine** explizite Nonce-Queue für Chain-TX. Es gibt **TX-Serialisierung pro Gas-Payer** (withTxSerial), damit sich TX nicht gegenseitig Gas-Objekte wegnehmen. |
| „Gas-Splitting: Code zerlegt Guthaben in viele kleine Objekte“ | **Im Node-Code** gibt es **kein** automatisches Gas-Splitting. Die Doku erwähnt „Wallet gas-split“ – das ist typischerweise **manuell** oder über **CLI** (z. B. `iota move`), nicht durch dieses Backend. **Hilfe:** `getGasCoinCount(client, address)` (chain-access) zeigt die Anzahl Gas-Coins; bei wenigen Coins: mehrere kleine transferCoins an sich selbst oder CLI-Split. |
| „Dependent package: System hat Retry, Chain zeigt am Ende grün“ | **Jetzt ja (verbessert).** signAndExecute nutzt runWithRetry mit **transienten Fehlern** (Dependent package not found, -32002, transaction inputs). Bis zu 3 Versuche mit 4s Pause – danach wird geworfen. Die Tiles-Skripte zählen weiterhin `failed`, wenn nach allen Retries kein Erfolg. |
| „1.123 mathematische Kombinationen (Bitmasken, Rollen, TTLs)“ | Die **1.123 Tiles** sind vor allem: viele send-plain-Texte, fetch(count), create-key/ticket/streams-Varianten. **Bitmasken/Rollen** werden in **run-all-combinations.ts** (>12.000 Tests) geprüft, **nicht** in den 1.123 Tiles. Zwei verschiedene Test-Suiten. |

---

## 3. Die 3 schwierigsten technischen Hürden – präzise formuliert

Für Showcase/Dokumentation ohne Übertreibung:

1. **TX-Serialisierung pro Konto (withTxSerial)**  
   Verhindert, dass mehrere gleichzeitige Transaktionen dasselbe Gas-Objekt beanspruchen („object reserved“). Ohne das bricht bei Last nach wenigen parallelen Aufrufen die Ausführung ab.

2. **Retry bei Object-Reserved**  
   Bei temporärer Sperre des Gas-Objekts: bis zu 3 Versuche mit Backoff. Reduziert Flakiness unter Last; gilt **nicht** für „Dependent package not found“.

3. **PTB-Batching und Delays in den Testskripten**  
   create-keys/create-tickets in einer TX; in den Skripten bewusst **Delays** (z. B. 900–1200 ms nach On-Chain-Befehlen, Pause alle N Aktionen), damit die Chain das Package bestätigen kann. Ohne diese Vorsicht treten „Dependent package not found“ und ähnliche Fehler gehäuft auf.

---

## 4. Kurzfassung

- **Richtig:** Serialisierung pro Gas-Payer, Retry bei object reserved, PTB/Batching, Settlement-Queue mit Retry, bewusste Delays in den Tests. Das reicht, um viele Aktionen stabil durchzuführen – und ist mehr als „einfach 1.000 Mal Hallo rufen“.
- **Falsch/irreführend:** Automatisches Gas-Splitting im Backend, Nonce-Queue im beschriebenen Sinne, Vermischung von Tiles (1.123) mit BIT_MASK/Rollen (run-all-combinations).
- **Verbessert:** Retry bei „Dependent package not found“ (transiente Fehler) mit 4s Delay; getGasCoinCount für Gas-Coins-Check.
- **Ehrlicher Showcase-Satz:** „Über 1.000 On-Chain-Aktionen in einem Lauf dank TX-Serialisierung, Retry bei object reserved und bei transienten Chain-Fehlern (Dependent package), sowie bewusster Delay-Strategie in den Testskripten.“
