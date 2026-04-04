# Szenarien – einen nach dem anderen

Wir gehen jedes Szenario einzeln durch. Du führst die Schritte aus, ich sage dir, was als Nächstes kommt.

---

## Szenario 1: Tür mit NFT (jemand will mit Key durch die Tür)

**Idee:** Gast (B) hat einen AccessKey von Schloss (A). B sendet "open" → wenn A als Lock läuft, führt A OPEN aus.

### Voraussetzung

- **2 laufende Morgendrot-Instanzen:**
  - **Instanz A** (z. B. Port 3342): MY_ADDRESS = Schloss-Adresse, PACKAGE_ID gesetzt.
  - **Instanz B** (z. B. Port 3345): MY_ADDRESS = Gast-Adresse (andere als A).
- Beide Wallets entsperrt (oder UNLOCK_PASSWORD setzen).

### Schritt 1 (du)

Starte **zwei** Terminals/Fenster:

1. **Terminal A:** Im Projektordner `npm run start` (oder `npm run dev`).  
   → Instanz A läuft als **Messenger** (Standard).  
   (Später können wir A als Lock starten, um OPEN im Log zu sehen.)

2. **Terminal B:** In einem zweiten Projektordner (Kopie oder anderes Verzeichnis) mit anderer `.env` (andere MY_ADDRESS, gleiche PACKAGE_ID, z. B. Port 3345) ebenfalls `npm run start` starten.

Sag Bescheid, wenn beide laufen (oder wenn du nur eine Instanz hast – dann gehen wir mit einer weiter und simulieren B per Skript wo möglich).

### Schritt 2 (Skript / ich)

Sobald A und B laufen, führe aus:

```bash
npm run test:scenarios
```

Das Skript macht für **Szenario 1** (Tür mit NFT):

- A: `/create-key` (Schloss stellt Key für B aus).
- B: `/handshake` an A, `/connect` zu A, `/send "open"`.

Du siehst in der Konsole `[OK]` oder `[FAIL]` pro Schritt.

### Schritt 3 (du – optional, um OPEN wirklich zu sehen)

Wenn du **OPEN im Log** sehen willst:

1. Instanz A stoppen (Ctrl+C).
2. In A’s `.env` setzen: `ROLE=lock`, `LOCK_ID=<MY_ADDRESS von A>` (oder LOCK_ID weglassen, dann wird MY_ADDRESS genutzt).
3. A wieder starten (`npm run start`).  
   → A läuft jetzt als **Lock** (pollt die Chain, führt bei "open" + gültigem Key OPEN aus).
4. **Noch einmal** `npm run test:scenarios` ausführen (oder nur den Teil „Tür mit NFT“ – Key existiert schon, B sendet erneut "open").
5. Im **Log von A (Lock)** nach der Zeile **„OPEN GRANTED“** suchen.

Wenn du bei Schritt 1–2 bleibst (beide nur als Messenger), ist das auch ok – dann haben wir trotzdem Key-Erstellung und "open"-Nachricht durchgespielt; OPEN-Ausführung fehlt dann nur im Log.

---

## Szenario 2: Boss gibt Anweisung an Kommandant

Wird von `npm run test:scenarios` mit A + B automatisch durchgespielt (A sendet Anweisung, B fetcht). ✅ Bereits erledigt.

---

## Szenario 3: Kommandant → Arbeiter (B sendet "open" an Lock C)

**Idee:** Boss (A), Kommandant (B), Arbeiter (C). A stellt Key für B aus (Lock = C). B sendet "open" an C → wenn C als Lock (ROLE=arbeiter) läuft, führt C OPEN aus.

### Voraussetzung

- **3 laufende Morgendrot-Instanzen:**
  - **A** (z. B. Port 3342): MY_ADDRESS = Boss, PACKAGE_ID gesetzt.
  - **B** (z. B. Port 3345): MY_ADDRESS = Kommandant (andere Adresse).
  - **C** (z. B. Port 3346): MY_ADDRESS = Arbeiter (dritte Adresse), **gleiche PACKAGE_ID** wie A/B.

### Schritt 1 (du): Dritte Instanz C starten

1. **Drittes Verzeichnis** (weiterer Klon/Kopie des Projekts) mit eigener `.env`:
   - `MY_ADDRESS=0x…` (dritte Adresse, anders als A und B)
   - `PACKAGE_ID=` (gleich wie A und B)
   - Port für API: z. B. **3347** (UI ggf. 3346). In C’s `.env` z. B. `PORT=3347`.

2. In diesem Ordner starten: `npm run start` (oder `npm run dev`).  
   → Instanz C läuft (zunächst als Messenger mit API).

3. **(Optional, um OPEN im Log zu sehen)** In C’s `.env` setzen:  
   `ROLE=arbeiter`, `BOSS_ADDRESS=<Adresse A>`, `KOMMANDANT_ADDRESSES=<Adresse B>`.  
   Dann C **neu starten** → C läuft als Lock und akzeptiert "open" nur von A oder B.

### Schritt 2: Szenarien mit C ausführen

Mit allen **drei** laufenden Instanzen (A, B, C erreichbar):

```bash
set API_BASE_C=http://127.0.0.1:3347
npm run test:scenarios
```

(Port 3347 = API von C; falls C anders läuft, Port anpassen.)

Das Skript macht für **Szenario 3**:
- A: `/create-key` (Lock = C, Empfänger = B).
- B: `/handshake` an C, `/send-plain "open"` an C.

### Schritt 3 (du): Log C prüfen

Wenn C mit **ROLE=arbeiter** läuft: Im **Log von C** nach **„OPEN GRANTED“** suchen.

---

Damit sind alle durchspielbaren Szenarien (1–3 plus Zahlung, Pinnwand, Ticket/Key) abgedeckt.
