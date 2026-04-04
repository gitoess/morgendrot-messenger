# Demo-Vorbereitung: Drei lauffähige Demos

Kurze Schritte und feste Testadressen/Events, damit du **ohne Geschäftsgeheimnis** stabil zeigst: Ownership/Key, PTB, Boss-Signer.

---

## Testumgebung (einmalig)

- **RPC:** Testnet (z. B. `RPC_URL=https://api.testnet.iota.cafe`).
- **Wallet 1 („Boss/Veranstalter“):** MY_ADDRESS = deine Hauptadresse, PACKAGE_ID gesetzt.
- **Wallet 2 („Gast/Maschine“):** Zweite Adresse (zweite Instanz oder zweites Gerät).
- **Lock/Event-ID:** Eine feste 0x64-Hex-Adresse als Platzhalter (z. B. eine Tür oder ein Event-Gate). Du kannst eine beliebige gültige Adresse nutzen oder eine „Dummy“-Lock-ID aus dem Projekt.

**Platzhalter (ersetze bei Bedarf):**

| Rolle        | Variable / Verwendung | Beispiel (nur Platzhalter) |
|-------------|------------------------|----------------------------|
| Boss-Adresse | MY_ADDRESS (Instanz 1) | `0x…` (deine Wallet) |
| Gast-Adresse | Partner / zweite Instanz | `0x…` (zweite Wallet) |
| Lock-ID     | LOCK_ID / event_id     | `0xdd…64 Hex` (eine feste ID pro Demo-Schloss/Event) |

---

## Demo 1: Ownership (digitaler Schlüssel)

**Botschaft:** „Der Schlüssel ist ein Objekt, das dem Gast gehört – kein Datenbank-Eintrag.“

1. **Vorbereitung:** Zwei Wallets (Boss, Gast). PACKAGE_ID in Instanz 1 gesetzt. Explorer (Testnet) im Browser offen.
2. **Schritt 1:** Boss: `/create-key <LOCK_ID> <GAST_ADRESSE> 7` (7 Tage TTL). TX im Explorer zeigen (create_access_key + transfer).
3. **Schritt 2:** Gast: Wallet/App öffnen → Objekt „AccessKey“ erscheint (Owner = Gast-Adresse). Optional: `/list-keys` auf Gast-Seite.
4. **Schritt 3:** Optional: Boss zeigt im Explorer die gleiche Object-ID → Owner = Gast. „Das digitale Gut gehört jetzt dem Gast.“

**Checkliste:** [ ] LOCK_ID festgelegt  [ ] Beide Adressen einsatzbereit  [ ] Explorer-Tab bereit  

→ **Konkreter Ablauf (Kopie/Befehl):** [DEMO-1-OWNERSHIP-Ablauf.md](DEMO-1-OWNERSHIP-Ablauf.md)

---

## Demo 2: PTB (Key + Nachricht in einer TX)

**Botschaft:** „Eine Transaktion: Key ausstellen und Benachrichtigung – eine Gebühr, eine Bestätigung.“

1. **Vorbereitung:** Wie Demo 1. Eine feste LOCK_ID und Gast-Adresse.
2. **Schritt 1:** Boss: `/create-key-and-notify <LOCK_ID> <GAST_ADRESSE> 30 Dein Key ist aktiv.` (30 Tage TTL, Nachricht beliebig.)
3. **Schritt 2:** Im Explorer: eine Transaktion mit mehreren Commands (create_access_key + store_plaintext_message bzw. Mailbox/Send).
4. **Schritt 3:** Kurz erklären: „Key + Nachricht in einem Block – weniger Gas, schneller.“

**Checkliste:** [ ] LOCK_ID + Gast-Adresse  [ ] Nachrichtentext festgelegt (neutral/demo)  

→ **Ablauf:** [DEMO-2-PTB-Ablauf.md](DEMO-2-PTB-Ablauf.md) · **Automatisch:** `npm run demo:2`

---

## Demo 3: Boss-Signer (Maschine ohne Wallet)

**Botschaft:** „Die Maschine hat nur eine Adresse; der Boss unterschreibt. Keys bleiben beim Boss.“

1. **Vorbereitung:** Drei Rollen: Boss (PC mit Wallet), Kommandant (optional), Arbeiter/Maschine (Lock ohne Wallet).
2. **Boss:** Adresse für „Arbeiter“ anlegen (z. B. `iota client new-address`), REMOTE_SIGNER_URL auf Boss-Rechner zeigen. `npm run boss-signer` starten (Port 3340).
3. **Arbeiter:** .env: SIGNER=remote, REMOTE_SIGNER_URL=http://<Boss-IP>:3340, MY_ADDRESS=<Arbeiter-Adresse>, BOSS_ADDRESS=<Boss-Adresse>, PACKAGE_ID, AUTHORIZED_SENDERS oder ROLE=arbeiter.
4. **Demo:** Arbeiter sendet „open“ (oder Handshake/Befehl) → Boss erhält Signieranfrage → genehmigt → TX wird ausgeführt. Im Log: „Signieranfrage … genehmigt“.

**Checkliste:** [ ] Boss-Signer läuft  [ ] Arbeiter .env mit REMOTE_SIGNER_URL  [ ] Boss-Adresse und Arbeiter-Adresse klar getrennt  

→ **Ablauf:** [DEMO-4-BOSS-SIGNER-Ablauf.md](DEMO-4-BOSS-SIGNER-Ablauf.md)

---

## Übersicht

| Demo   | Dauer (ca.) | Abhängigkeiten        |
|--------|-------------|------------------------|
| 1 Ownership | 3–5 Min | 2 Wallets, PACKAGE_ID, Lock-ID |
| 2 PTB       | 2–4 Min | Wie 1, ein Befehl |
| 3 Boss-Signer | 5–10 Min | Boss-Rechner + Arbeiter-Instanz, boss-signer |

Nach jeder Demo: Explorer-Link zur TX bzw. zum Objekt bereithalten (zum Zeigen ohne Geschäftsgeheimnis).

Siehe auch: **DEMO-VORFUEHRUNG.md** (die 4 Punkte inkl. Dynamic Fields als Vision).
