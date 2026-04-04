# Morgendrot – Car-Sharing / E-Scooter-Zugang einrichten

Zahlung oder Schlüssel → Freischaltung. Du richtest ein „Schloss“ ein (Roller, Auto, Ladesäule), und entscheidest: Öffnet sich nur bei Zahlung? Nur mit Schlüssel? Oder beides?

**6 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Modell wählen (1 von 6)

**Wie soll sich das Fahrzeug / die Ladesäule freischalten?**

**Drei Möglichkeiten:**

**Nur Zahlung:** Jemand zahlt → Tür oder Roller geht automatisch auf.  
→ **PAYMENT_TRIGGER_ENABLED** = `true`  
→ Beispiel: Roller kostet 0,001 IOTA pro Minute → Zahlung kommt an → Roller entriegelt sich.

**Nur AccessKey:** Jemand bekommt einen zeitlichen Schlüssel – kein Geld nötig.  
→ **/create-key** → Schlüssel für X Tage ausstellen  
→ Beispiel: Mieter bekommt Schlüssel für 1 Tag → Roller geht auf, ohne dass Geld fließt.

**Zahlung + Key:** Schlüssel wird nur ausgestellt, wenn vorher gezahlt wurde (am sichersten).  
→ Dein Backend prüft die Zahlung → ruft dann /create-key auf.  
→ Beispiel: Jemand zahlt 2 € → bekommt Schlüssel für 1 Stunde → Roller geht auf.

**Setzen?** Ja – wähle eine der drei Varianten. „Zahlung + Key“ ist am sichersten.

---

## Lock einrichten (2 von 6)

**Der App sagen: Ich bin der Roller / das Auto / die Ladesäule.**

- **ROLE** = `lock`  
→ Das ist wie ein Namensschild: „Ich bin jetzt das Schloss.“

- **MY_ADDRESS** = `0x…` (Adresse des Fahrzeugs oder der Ladesäule)  
→ Das ist die Adresse, an die Zahlungen gehen und die Schlüssel prüft.

**Beispiel:** Dein E-Scooter hat die Adresse 0x0748… → ROLE=lock + MY_ADDRESS=0x0748… → die App weiß: „Ich steuere diesen Roller.“

**Setzen?** Ja – ohne ROLE=lock macht die App keinen Lock-Modus.

---

## Öffnen-Aktion festlegen (3 von 6)

**Was soll passieren, wenn jemand zahlt oder den Schlüssel nutzt?**

- **OPEN_COMMAND** = `node relay-on.js`  
→ Ein Programm starten (z. B. Relais am Schloss).

**Beispiel:** Du hast ein Relais am Roller-Schloss → das Skript schaltet es ein → Schloss öffnet sich.

- **OPEN_URL** = `http://192.168.1.123/open`  
→ Einen Link im Internet aufrufen (z. B. API des Rollers).

**Beispiel:** Der Roller hat eine Webseite → bei „open“ wird die Seite aufgerufen → er entriegelt sich.

**Setzen?** Ja – ohne das tut sich nichts. Nimm OPEN_COMMAND oder OPEN_URL (oder beides).

---

## Zahlungs-Trigger (4 von 6)

**Soll sich bei Zahlung automatisch etwas öffnen?**

- **PAYMENT_TRIGGER_ENABLED** = `true` oder `false`  
→ Wenn true: Jemand zahlt z. B. 0,001 IOTA an deine Adresse (+ evtl. Code) → Tür/Roller geht auf.

- **PAYMENT_TRIGGER_MIN_IOTA** = `0.001`  
→ Ab welchem Betrag wird geöffnet?

- **PAYMENT_TRIGGER_REQUIRE_MEMO** = `LADE4711`  
→ Das Memo (Nachricht zur Zahlung) muss diesen Code enthalten – z. B. Buchungsnummer.

**Beispiel:** Jemand zahlt 0,001 IOTA mit Memo „LADE4711“ → Ladesäule gibt Strom frei.

**Setzen?** Nein – nur wenn du „Zahlung als Schlüssel“ willst.

---

## Temporärer Key (5 von 6)

**Schlüssel für begrenzte Zeit ausstellen.**

- **/create-key** `0xRoller 0xMieter 1`  
→ Einen Schlüssel für 1 Tag: Roller-Adresse, Mieter-Adresse, 1 Tag.

**Beispiel:** Du stellst für einen Mieter einen Schlüssel aus → er kann 1 Tag fahren.

**Setzen?** Nein – nur wenn du zusätzlich Schlüssel nutzen willst (z. B. für Abo-Mieter).

---

## Streams – schneller Zusatzweg (6 von 6)

**Soll bei „öffnen“ zusätzlich ein schneller Kanal genutzt werden?**

- **OPEN_STREAMS_ENABLED** = `true` oder `false`  
→ Wenn true: Zusätzlich zur normalen Kette wird eine schnelle Nachricht geschickt – oft unter einer Sekunde.

**Beispiel:** Normale Kette braucht 5 Sekunden → mit Streams geht „Entriegeln“ in 0,5 Sekunden.

**Setzen?** Nein – nur wenn du Echtzeit brauchst.

---

## Minimal-Beispiel

**Nur Zahlung (.env):**
```env
ROLE=lock
MY_ADDRESS=0x0748…
OPEN_URL=http://192.168.1.123/open
PAYMENT_TRIGGER_ENABLED=true
PAYMENT_TRIGGER_MIN_IOTA=0.001
```

**Nur Key (.env):**
```env
ROLE=lock
MY_ADDRESS=0x0748…
OPEN_COMMAND=node relay-on.js
OPEN_COMMAND_WORDS=open,öffnen
```

Danach: `/create-key 0x0748… 0xMieter… 1` → Schlüssel für 1 Tag.

Damit hast du entweder Zahlung → Freischaltung oder Key → Freischaltung (oder beides).
