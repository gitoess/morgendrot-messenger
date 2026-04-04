# Szenarien-Playbook: Was kann man effektiv mit den Funktionen machen?

Alle durchspielbaren Abläufe pro Kachel und alle sinnvollen Kombinationen. **Du** startest die Instanzen und prüfst Logs; **das Skript** führt aus, was per API geht.

---

## Übersicht: 9 Kacheln → Szenarien

| Kachel | Szenario | Was wird durchgespielt | Testbar per Skript? |
|--------|----------|------------------------|---------------------|
| 1 Chat | Zwei Freunde chatten | Handshake, Connect, Send, Fetch, Send-Plain, Fetch mit Sender | ✅ voll |
| 2 Ticket & Schlüssel | Festival: NFT an Gast → Einlass → Storno | Create-Ticket, List, hasValidTicket, Use-Ticket, Transfer, Purge | ✅ voll (wenn list indiziert) |
| 2 Ticket & Schlüssel | Schloss: Key an Gast → Tür öffnen | Create-Key, Key-Holder sendet "open" | ✅ bis "open" senden; OPEN-Ausführung nur wenn Lock-Prozess läuft |
| 3 Schloss & Tür | **Jemand will durch Tür mit NFT** | Lock stellt Key aus → Gast sendet "open" → (Lock führt OPEN aus) | ✅ Key ausstellen + "open" senden; OPEN in Lock-Log prüfen |
| 4 Sensor-Alarm | Sensor schlägt Alarm | Verschlüsselte Nachricht = Alarm; Monitor-Status | ✅ Send/Fetch + monitor-status |
| 5 Überwachung | Geräte auf Offline prüfen | Monitor-Status, Geräte-Liste | ✅ GET monitor-status |
| 6 Zahlung | Zahle → Ladesäule auf | B zahlt an A → (Lock A löst OPEN aus) | ✅ transfer-coins; OPEN nur wenn Lock mit PAYMENT_TRIGGER läuft |
| 7 Pinnwand | An alle melden | Send-Plain an gemeinsame Adresse | ✅ send-plain |
| 8 Tresor & Notfall | Keys/Daten sicher speichern | Vault-Save, Vault-Onchain, Emergency-Purge | ✅ (optional/skip ohne Konfig) |
| 9 Boss-Modus | Maschinen ohne Wallet | Generate-Address, Deploy, Boss-Provision-Handshake | ✅ (teilw. skip) |
| M2M | **Boss gibt Anweisung an Kommandant, Arbeiter** | Boss→Kommandant Chat; Kommandant→Arbeiter "open" (Arbeiter = Lock) | ✅ Boss→K; K→A "open" senden; OPEN auf Arbeiter-Log prüfen |

---

## Szenario 1: Tür mit NFT (Schloss & Tür)

**Idee:** Gast hat AccessKey-NFT; will Tür öffnen.

**Ablauf:**

1. **Schloss (A)** stellt Key aus: `/create-key <LOCK_ID> <Adresse_B> 7`
2. **Gast (B)** sendet Handshake an Schloss (A): `/handshake <addrA>`
3. **Gast (B)** verbindet sich: `/connect <addrA>`
4. **Gast (B)** sendet Öffnen-Wort: `/send open` (oder `/send-plain <addrA> open` wenn Klartext)
5. **Schloss** prüft on-chain: Hat B gültigen AccessKey? Wenn ja → OPEN (OPEN_COMMAND/OPEN_URL).

**Kombinationen:**

- Nur Key (wie oben).
- Key + AUTHORIZED_SENDERS: Nur bestimmte Adressen dürfen "open" senden (zusätzlich zum Key).
- Key + Zahlung: Lock mit PAYMENT_TRIGGER; B kann auch per Zahlung auslösen (separates Szenario).

**Was das Skript macht:** Schritte 1–4 (create-key, handshake, connect, send "open").  
**Was du prüfst:** Wenn **A als Lock** läuft (ROLE=lock, eigener Prozess): Im Log von A muss „OPEN GRANTED“ erscheinen.

---

## Szenario 2: Boss → Kommandant → Arbeiter (alle Kombinationen)

**Idee:** Boss (A) gibt Anweisung an Kommandant (B); Kommandant (B) gibt Anweisung/Befehl an Arbeiter (C). Arbeiter = Lock (Tür/Maschine).

**Rollen:**

- **Boss (A):** ROLE=boss, KOMMANDANT_ADDRESSES=addrB. Verbindet sich nur mit Kommandanten.
- **Kommandant (B):** ROLE=kommandant, BOSS_ADDRESS=addrA, WORKER_ADDRESSES=addrC. Verbindet sich mit Boss und Arbeitern.
- **Arbeiter (C):** ROLE=arbeiter, BOSS_ADDRESS=addrA, KOMMANDANT_ADDRESSES=addrB. Läuft als **Lock** (runLockMode); akzeptiert "open" nur von A oder B.

**Ablauf:**

1. Boss (A) erstellt Key für Kommandant (B) für Lock (C): `/create-key <addrC> <addrB> 7` (von A aus, gleiche PACKAGE_ID).
2. Boss (A) Handshake an B, dann Connect zu B.
3. Boss (A) sendet: `/send "Anweisung an Kommandant"` → B empfängt (z. B. per `/fetch`).
4. Kommandant (B) Handshake an C (damit C B’s Nachrichten entschlüsseln kann).
5. Kommandant (B) sendet an C: `/send open` (oder Klartext "open" an addrC).
6. Arbeiter (C), der als Lock läuft, pollt die Chain, sieht Nachricht von B, prüft AUTHORIZED_SENDERS (B ist drin) und AccessKey (B hat Key für C) → **OPEN GRANTED**.

**Kombinationen:**

- Nur Boss → Kommandant (Chat): A handshake B, connect B, send; B fetch. ✅ Skript.
- Kommandant → Arbeiter (OPEN): B handshake C, B send "open" an C. ✅ Skript; OPEN nur sichtbar im Log von C.
- Boss + Kommandant + Arbeiter (voll): wie oben, alle drei Schritte. ✅ Skript; C muss als Lock laufen.

**Was das Skript macht:** A create-key (für B, Lock C), A handshake/connect/send zu B; B handshake C, B send "open" an C.  
**Was du prüfst:** Auf **C (Arbeiter-Lock)** im Log: „OPEN GRANTED“.

---

## Szenario 3: Zahlung → Freischaltung (Ladesäule)

**Idee:** B zahlt an Lock (A) → Lock löst OPEN aus (PAYMENT_TRIGGER).

**Ablauf:**

1. Lock (A) hat ROLE=lock, PAYMENT_TRIGGER_ENABLED=true, OPEN_URL oder OPEN_COMMAND.
2. B sendet Coins an A: `/transfer-coins <addrA> 0.001`
3. Lock (A) pollt eingehende Zahlungen; bei Betrag ≥ MIN → OPEN ausführen.

**Was das Skript macht:** B führt `/transfer-coins` an A aus.  
**Was du prüfst:** Wenn A als Lock mit PAYMENT_TRIGGER läuft: im Log „Zahlungs-Trigger … OPEN ausführen“.

---

## Szenario 4: Pinnwand – An alle

**Idee:** Eine Adresse (z. B. BROADCAST_PINNWAND_ADDRESS); alle senden Klartext dorthin, alle können lesen.

**Ablauf:** A (oder B) sendet: `/send-plain <Pinnwand-Adresse> "Meldung für alle"`.  
**Was das Skript macht:** send-plain an Pinnwand-Adresse (oder an B als Ersatz). ✅

---

## Szenario 5: Sensor-Alarm / Überwachung

- **Sensor:** Sendet verschlüsselte Nachricht (= Alarm); gleicher Ablauf wie Chat (handshake, connect, send). ✅  
- **Monitor:** ROLE=monitor, MONITOR_DEVICES=…; GET /api/monitor-status. ✅  

---

## Was ist alles testbar? (Checkliste für dich)

### Per Skript (run-scenarios-realworld.ts) voll abgedeckt

- [x] Chat: Handshake, Connect, Send, Fetch, Fetch mit Sender, Send-Plain
- [x] Ticket: Create, List, hasValidTicket, Use, Transfer, Emergency-Purge, Purge
- [x] AccessKey: Create, Create-Keys, List, Transfer, Purge, Emergency-Purge
- [x] **Tür mit NFT:** Create-Key (A→B), B handshake/connect/send "open" an A
- [x] **Boss→Kommandant:** A handshake/connect/send an B; B fetch
- [x] **Kommandant→Arbeiter:** A create-key (Lock C, für B); B handshake C, B send "open" an C
- [x] Zahlung: B transfer-coins an A
- [x] Pinnwand: send-plain
- [x] Vault: config, vault-save, vault-onchain, emergency-purge (optional/skip)
- [x] Boss-Modus: generate-address, deploy-package, boss-provision-handshake (optional)
- [x] Monitor: GET monitor-status (A, B, ggf. C)

### Nur mit laufendem Prozess / Log prüfen

- [ ] **OPEN tatsächlich ausgeführt:** Lock (A oder C) muss als eigener Prozess mit ROLE=lock bzw. ROLE=arbeiter laufen; du prüfst im Log „OPEN GRANTED“.
- [ ] **Zahlungs-Trigger OPEN:** A muss als Lock mit PAYMENT_TRIGGER laufen; du prüfst Log nach transfer-coins.

### Optional / manuell

- [ ] Restart, Exit, Start-Boss-Signer (manuell oder separat getestet)
- [ ] Purge-Msg (braucht MAILBOX)
- [ ] Offline-OPEN, Streams, COMMAND_REGISTRY (spezielle Konfiguration)

---

## Wie wir zusammen testen

1. **Du** startest 2 oder 3 Morgendrot-Instanzen (verschiedene Ports, verschiedene MY_ADDRESS; für Boss/K/A je ROLE in .env).
2. **Skript** läuft: `npm run test:scenarios` (oder `npx tsx scripts/run-scenarios-realworld.ts`).
3. Das Skript macht alle API-Schritte (create-key, handshake, connect, send "open", transfer-coins, …).
4. **Du** prüfst dort, wo ein Lock läuft: Im Log der Lock-Instanz „OPEN GRANTED“ (und ggf. Zahlungs-Trigger).
5. Wenn etwas fehlschlägt: Skript gibt [OK]/[FAIL] pro Schritt aus; du kannst Logs der Instanzen dazu nehmen und wir passen Szenarien oder Konfig an.

So siehst du genau, was man effektiv mit den Funktionen machen kann und was in welcher Kombination durchgespielt wird.
