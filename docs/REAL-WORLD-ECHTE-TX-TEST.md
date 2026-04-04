# Real-World-Test: Echte TX auf IOTA, Streams, Nachrichten, Arbeiter/Kommandant

**Ziel:** Alle Funktionen mit **echten** Transaktionen auf der IOTA-Chain (Testnet/Mainnet), echten IOTA Streams, verschlüsselten und unverschlüsselten Nachrichten, NFTs/Keys, Tickets, Heartbeats – inkl. **Explorer-Links** und klarer Trennung **Arbeiter (mit Seed)** vs **Kommandant (ohne Seed)**.

---

## 1. Voraussetzungen

- **RPC:** Echte Chain – Testnet (`RPC_URL=https://fullnode.testnet.iota.cafe:443`) oder Mainnet. In `.env` gesetzt.
- **Wallet:** Eine Boss-Instanz mit entsperrtem Wallet (MY_ADDRESS, PACKAGE_ID, MAILBOX_ID gesetzt).
- **Rolle Boss:** Entweder in `.env`: `ROLE=boss` und `ROLE_ID=14` (dann Backend neu starten). Oder einmalig `ALLOW_TEST_ROLE_OVERRIDE=true` in `.env` eintragen, Backend neu starten – dann setzt das Testskript ROLE und ROLE_ID per API und schreibt sie in `.env` (danach bleibt Boss auch nach Seiten-Reload).
- **Streams:** Für Heartbeat/Streams-Tests: `STREAMS_BRIDGE_URL` (echte Bridge, z. B. öffentlicher L0.5-Service oder eigene Bridge).
- **Explorer:** Object-Links nutzen `EXPLORER_BASE_URL` (Default: `https://explorer.iota.org/object`). Testnet: `?network=testnet` wird automatisch angehängt, wenn RPC testnet enthält. Optional in `.env`: `EXPLORER_BASE_URL=https://explorer.iota.org/object`.

---

## 2. Echte TX auf IOTA

Alle Befehle, die On-Chain schreiben, erzeugen echte Transaktionen:

| Aktion | Befehl / API | Was auf der Chain passiert | Explorer-Link |
|--------|----------------|----------------------------|----------------|
| AccessKey erstellen (Zutritt Gast, Tür/Spind/Airbnb) | `/create-key` | AccessKey-NFT an Empfänger (Gast) | Response: `objectId` / `explorerLinks` (siehe `docs/BEGRIFFE-MOVE-REBASED.md`) |
| Ticket erstellen | `/create-ticket` | Ticket-Objekt für Event | wie oben |
| Key/Ticket purgen | `/purge-key`, `/purge-ticket` | Objekt wird zerstört, Rebate | Digest/TX sichtbar |
| Transfer | `/transfer-coins` | IOTA-Coins an Adresse | Über Adresse/Block im Explorer |
| Handshake | `/handshake` | EcdhInit in Mailbox | Objekt in Mailbox |
| Nachricht (Klartext) | `/send-plain` | PlaintextMessage on-chain | Objekt-ID in Response nutzbar |
| Nachricht (verschlüsselt) | `/send` nach `/connect` | EncryptedMessage on-chain | wie oben |

**Explorer-URL (Testnet):**  
`https://explorer.iota.org/object/<OBJECT_ID>?network=testnet`

Die API antwortet bei `create-key` / `create-ticket` etc. mit `explorerLink` (ein Objekt) bzw. `explorerLinks` (Array), sofern `EXPLORER_BASE_URL` und ggf. Testnet erkannt werden.

---

## 3. Echte IOTA Streams

- **Kanal erstellen:** `/streams-create` → echte Bridge erstellt Kanal, zurück kommt `anchorId` und optional `streamsChannelUrl` (Bridge-URL mit `?anchor=<ANCHOR_ID>`).
- **Abonnieren:** `/streams-subscribe <anchorId>` (oder STREAMS_ANCHOR_ID setzen).
- **Publish:** `/streams-publish "Payload"` → echte Nachricht im Kanal (mit Wallet-Passwort: verschlüsselt).
- **Fetch:** `/streams-fetch` → liest echte Nachrichten vom Kanal.

**Streams-„Explorer“ / Nachweis:**  
Die Anchor-ID ist die Referenz auf den Kanal. Direkter Objekt-Explorer-Link ist für L0.5-Streams je nach Bridge unterschiedlich; die API liefert `anchorId` und `streamsChannelUrl` (Link zur Bridge mit diesem Kanal).

---

## 4. Echte Nachrichten: verschlüsselt vs. unverschlüsselt

- **Unverschlüsselt (Klartext):**  
  `/send-plain <Empfänger 0x…> <Text>`  
  → On-Chain als PlaintextMessage, im Explorer sichtbar (Inhalt lesbar).

- **Verschlüsselt:**  
  `/handshake <Partner>` → `/connect <Partner>` → `/send <Text>`  
  → On-Chain als EncryptedMessage, nur mit gemeinsamem Secret entschlüsselbar.

Beide sind **echte** Chain-Objekte (Mailbox/Nachrichten-Objekt).

---

## 5. Arbeiter „mit Seed“ vs. Kommandant „ohne Seed“

- **Arbeiter mit Seed:**  
  Eigenes Keypair (eigener Seed/Mnemonic). Boss ruft z. B. `/api/generate-mnemonic` auf, speichert Adresse + Secret, und trägt die **Adresse** als WORKER_ADDRESSES ein. Das **Gerät/der Arbeiter** läuft später mit diesem Seed (eigene Instanz oder physisches Gerät). Echte Keys/Tickets/Heartbeats laufen über diese Adresse.

- **Kommandant ohne Seed (nur Adresse):**  
  Boss trägt eine Adresse als KOMMANDANT_ADDRESSES ein. Der Kommandant **kann** dieselbe Boss-Wallet sein (eine Instanz, zwei Rollen) oder eine **fremde** Adresse, an die nur Befehle/Keys gesendet werden – **ohne** dass Morgendrot dort einen Seed anlegt. „Ohne Seed“ = wir speichern nur die Adresse, keine Mnemonic; die andere Seite nutzt ggf. eigenes Wallet/Seed woanders.

**Praktisch für den Test:**

- **Ein PC, ein Wallet:** Boss = du, „Arbeiter“ = eine per generate-mnemonic erzeugte Adresse (ohne zweite laufende Instanz). Keys/Tickets gehen an diese Adresse; Explorer zeigt die Objekte.
- **Zwei PCs / zwei Instanzen:** Instanz A = Boss, Instanz B = Arbeiter (mit eigenem Seed von generate-mnemonic). Dann echte Zwei-Wallet-Nachrichten, Handshake, Connect, Send.

---

## 6. Ablauf „alle erdenklichen“ echten Tests (ein PC)

1. Backend starten, Wallet entsperren.
2. `ROLE=boss` setzen.
3. **Worker-Adresse (mit Seed):** `/api/generate-mnemonic` → Adresse + Secret (für spätere zweite Instanz oder Gerät); Adresse in WORKER_ADDRESSES eintragen.
4. **Key erstellen** an Worker-Adresse → Response prüfen: `explorerLink` / `explorerLinks` ausgeben, im Explorer öffnen.
5. **Ticket erstellen** an dieselbe Adresse → wieder Explorer-Link prüfen.
6. **Transfer** (Minimalbetrag) an eigene oder Worker-Adresse.
7. **Handshake** mit Worker-Adresse, **Connect**, **send-plain** (unverschlüsselt), **send** (verschlüsselt).
8. **Heartbeat** (wenn STREAMS_ANCHOR_ID + STREAMS_BRIDGE_URL + S-Bit): `/heartbeat`.
9. **Streams:** `/streams-create` → `anchorId` und `streamsChannelUrl` notieren/linken; `/streams-publish`, `/streams-fetch`.
10. **Rebate:** `/api/rebate-candidates` → echte Objekte; optional einen Key/Ticket purgen und im Explorer prüfen.

Skript dafür: **`npm run test:echte-tx`** (siehe `scripts/run-realworld-echte-tx.ts`). Es verwendet die echte MY_ADDRESS, optional eine generierte Worker-Adresse, und gibt zu jeder erzeugten TX/Objekt die Explorer-Links bzw. Streams-Anchor-URL aus.

**Beweis-Resultat:** Am Ende gibt das Skript ein vollständiges **BEWEIS / RESULTAT** aus (Konsole + JSON-Datei):
- **Adressen:** MY_ADDRESS (Boss), WORKER_ADDRESS, PACKAGE_ID
- **Worker SecretKey (Seed-Beweis):** Das von `/api/generate-mnemonic` erzeugte Secret – sicher aufbewahren, nicht teilen
- **Erstellte Keys/Tickets:** jede Object-ID + zugehörige Explorer-Links
- **Transfer:** digest/Status
- **Nachrichten:** handshake, connect, sendPlain, sendEncrypted (Erfolg)
- **Heartbeat, Streams:** anchorId, streamsChannelUrl, publish/fetch
- **Rebate:** Anzahl Keys/Tickets + alle Object-IDs

Die JSON-Datei wird unter `RESULT_FILE` (Default: `realworld-echte-tx-result.json`) gespeichert und ist in `.gitignore` eingetragen (enthält den Worker-Secret).

---

## 7. Explorer & Umgebung

- **Testnet:**  
  `EXPLORER_BASE_URL=https://explorer.iota.org/object` (Default), RPC enthält `testnet` → Links erhalten `?network=testnet`.
- **Mainnet:**  
  RPC ohne testnet → keine `network`-Query; gleiche Basis-URL (oder eigene Explorer-URL setzen).

Damit sind **echte TX**, **echte Streams**, **echte Nachrichten (verschlüsselt + unverschlüsselt)**, **NFT/Keys**, **Tickets**, **Heartbeats** und die Unterscheidung **Arbeiter (mit Seed)** / **Kommandant (ohne Seed)** abgedeckt und mit Explorer- bzw. Streams-Links nachvollziehbar.
