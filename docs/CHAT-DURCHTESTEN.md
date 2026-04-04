# Nachrichten + Chat: Schritt für Schritt mit 2 UIs und 2 Wallets

Diese Anleitung führt dich durch den kompletten Ablauf **„Nachrichten + Chat“** mit **zwei getrennten Instanzen** (2 UIs, 2 Wallets). Du brauchst zwei Terminals/Fenster und zwei Browser-Tabs (oder zwei Geräte).

---

## Voraussetzungen

- **2× Morgendrot** laufen (z. B. `npm run dev` in zwei verschiedenen Projektordnern **oder** zwei Rechner).
- **Gleiche RPC_URL** (z. B. Testnet) und **gleiche Package-ID** auf beiden Seiten.
- **2 Wallets** mit je einer Adresse (0x…). Du kannst auf Instanz 1 eine Adresse erzeugen („Neue Adresse erzeugen“) und auf Instanz 2 eine andere – oder zwei bestehende Wallets nutzen.

Kurz: **Instanz A** = UI 1 + Wallet 1 (Adresse **Alice**). **Instanz B** = UI 2 + Wallet 2 (Adresse **Bob**).

---

## Phase 1: Beide Instanzen einrichten

### Auf **beiden** UIs (A und B):

| Schritt | Was du machst | Wo in der UI |
|--------|----------------|---------------|
| 1 | **Eigene Adresse setzen** | Projekt „Nachrichten + Chat“ → Schritt 1 „Eigene Adresse setzen“. MY_ADDRESS = deine 0x… (aus Wallet oder „Neue Adresse erzeugen“). |
| 2 | **Package-ID setzen** | Schritt 2 → (a) Package-ID bekannt → bei `/set-package-id` die **gleiche** 0x… auf **beiden** eintragen und „Ausführen“ klicken. |
| 3 | **Kette prüfen** | Schritt 3 „Kette prüfen“ → „?“ oder Ausführen. Sollte „Chain erreichbar“ zeigen. |
| 4 | **Wallet entsperren** | Oben: Passwort eingeben → „Entsperren“. Einmal pro Session. |

Ergebnis: Beide UIs zeigen in der Leiste **Adresse: 0x…** und **Package: 0x…** (jeweils die eigene Adresse und die gemeinsame Package-ID).

---

## Phase 2: Handshake – wer schickt zuerst?

Eine Seite sendet den Handshake, die andere wartet und verbindet sich danach.

### Option A: **Instanz A (Alice) sendet zuerst**

| Schritt | Wer | Aktion |
|--------|-----|--------|
| 1 | **A** | Projekt „Nachrichten + Chat“ → Schritt 10 „Handshake & Connect“ → **/handshake** → „Ausführen“ → **Bob-Adresse (0x…)** eingeben. |
| 2 | **B** | Schritt 10 → **/connect** → „Ausführen“ → optional Bob-Adresse leer lassen (oder eingeben). Warten, bis „Verbunden“ erscheint. |

### Option B: **Instanz B (Bob) sendet zuerst**

| Schritt | Wer | Aktion |
|--------|-----|--------|
| 1 | **B** | /handshake → Partner-Adresse = **Alice (0x…)**. |
| 2 | **A** | /connect → warten bis „Verbunden“. |

Nach dem Handshake + Connect steht oben bei beiden **„Verbunden“** (grüner Badge).

---

## Phase 3: Nachrichten senden und holen

### Nachricht senden (verschlüsselt)

- **Wer verbunden ist**, kann im **Terminal** eine Nachricht eingeben (einfach Text tippen + Enter) → wird verschlüsselt an den Partner gesendet.
- In der **UI** gibt es keinen klassischen Chat-Eingabefeld; verschlüsseltes Senden geht über das Terminal oder über Befehle. Du kannst **/fetch** nutzen, um die letzten Nachrichten in der UI anzuzeigen.

### Klartext (zum Testen)

- Wenn **ENABLE_PLAINTEXT_CHANNEL=true**: Projekt → **/send-plain** → Ausführen → **Partner-Adresse** und **Text** eingeben. Die Nachricht erscheint on-chain (im Explorer sichtbar).

### Nachrichten in der UI anzeigen

- Auf **beider** Seite: Schritt 11 **„Nachrichten holen“** → bei **/fetch** „Ausführen“ klicken → Anzahl (z. B. **10**) eingeben oder Enter. Es öffnet sich das **Modal „Nachrichten (/fetch)“** mit den letzten Nachrichten (Absender + Text).

---

## Phase 4: Checkliste zum Abhaken

Du kannst diese Liste beim Testen abhaken:

**Phase 1 – Einrichtung (beide Instanzen)**  
- [ ] Instanz A: MY_ADDRESS gesetzt (Leiste zeigt Adresse)  
- [ ] Instanz B: MY_ADDRESS gesetzt  
- [ ] Beide: gleiche PACKAGE_ID (Leiste zeigt Package)  
- [ ] Beide: Kette erreichbar (Schritt 3)  
- [ ] Beide: Wallet entsperrt (kein Passwort-Popup mehr)

**Phase 2 – Verbindung**  
- [ ] Eine Seite: /handshake mit Partner-Adresse ausgeführt  
- [ ] Andere Seite: /connect ausgeführt  
- [ ] Beide: Status „Verbunden“ (grüner Badge)

**Phase 3 – Nachrichten**  
- [ ] Eine Nachricht gesendet (Terminal oder /send-plain)  
- [ ] Auf der anderen Seite: /fetch ausgeführt → Modal zeigt die Nachricht  
- [ ] Optional: Antwort senden und auf der ersten Seite /fetch → Antwort sichtbar

---

## Häufige Probleme

| Problem | Mögliche Lösung |
|--------|------------------|
| „MY_ADDRESS fehlt“ / „PACKAGE_ID fehlt“ | Phase 1 nochmal durchgehen; Leiste prüfen. |
| „Kein Handshake gefunden“ bei /connect | Partner muss zuerst /handshake mit **deiner** Adresse ausführen. |
| /fetch zeigt „invalid param“ oder Fehler | MY_ADDRESS und PACKAGE_ID prüfen (0x + 64 Hex); Wallet entsperrt? |
| Nachrichten erscheinen nicht | Beide auf gleicher RPC_URL und Package-ID; nach Senden kurz warten, dann /fetch. |
| Zwei UIs, aber nur eine Instanz | Zwei getrennte Morgendrot-Starts (z. B. zwei Ordner/Kopien mit je eigener .env und Wallet). |

---

## Kurz: Reihenfolge für 2 UIs + 2 Wallets

1. **Beide:** MY_ADDRESS setzen, **gleiche** Package-ID setzen, Kette prüfen, Wallet entsperren.  
2. **Eine Seite:** /handshake mit der **Partner-Adresse**.  
3. **Andere Seite:** /connect.  
4. **Nachrichten:** Senden (Terminal oder /send-plain), auf der anderen Seite **/fetch** → Modal mit Nachrichten.

Wenn du willst, können wir als Nächstes einen bestimmten Schritt (z. B. nur Handshake oder nur /fetch) genauer durchgehen oder Fehlermeldungen klären.

---

## Automatischer Test (2 Instanzen)

Mit zwei laufenden Morgendrot-Instanzen (z. B. A auf 3342, B auf 3345) kannst du alle Nachrichten- und Chat-Szenarien automatisch durchspielen:

```bash
npm run test:messages
```

Optional: `UNLOCK_PASSWORD=deinpass API_BASE_A=http://127.0.0.1:3342 API_BASE_B=http://127.0.0.1:3345 npm run test:messages`

Das Skript führt aus: Handshake (A→B), Connect (B), verschlüsseltes Senden A→B und B→A, /fetch auf beiden Seiten, optional /send-plain.
