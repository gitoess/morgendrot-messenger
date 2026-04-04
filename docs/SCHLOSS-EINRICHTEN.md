# Morgendrot – Smart-Lock / Schloss einrichten

So richtest du ein digitales Schloss ein: Du sagst der App „Ich bin das Schloss“, gibst an, was bei „öffnen“ passieren soll, und wer einen Schlüssel (Ticket) haben darf.

**8 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst. Fang mit Schritt 1 an. Wenn du etwas nicht willst, überspring es.

---

## Rolle & Adresse setzen (1 von 8)

**Der App sagen: Ich bin das Schloss.**

- **ROLE** = `lock`  
→ Das ist wie ein Namensschild: „Ich bin jetzt das Schloss.“

- **MY_ADDRESS** = `0x…` (deine Schloss-Adresse)  
→ Das ist die Adresse, die alle kennen – wie deine Handynummer für das Schloss.

**Vorher:** Die App weiß nicht, ob sie Chat, Überwachung oder Schloss sein soll.

**Nachher:** Die App sagt: „Ich bin das Schloss mit der Adresse 0x0748…“

**Beispiel:** Du startest die App → sie weiß sofort: „Ich bin das Schloss und heiße 0x0748…“

**Setzen?** Ja – ohne ROLE=lock macht die App keinen Schloss-Modus!

---

## Öffnen-Aktion festlegen (2 von 8)

**Was soll passieren, wenn jemand „öffnen“ sagt?**

- **OPEN_COMMAND** = `node relay-on.js`  
→ Ein Programm auf deinem Rechner starten (z. B. Relais ein- oder ausschalten).

**Beispiel:** Du hast ein Relais an Pin 5 → das Skript relay-on.js schaltet es ein → die Tür geht auf.

- **OPEN_URL** = `http://192.168.1.123/open`  
→ Einen Link im Internet aufrufen (z. B. dein Smart-Lock oder eine Ladesäule).

**Beispiel:** Dein Smart-Lock hat eine Webseite → bei „open“ wird die Seite aufgerufen → das Schloss öffnet sich.

**Vorher:** Jemand sagt „öffnen“ – aber nichts passiert, weil die App nicht weiß, was sie tun soll.

**Nachher:** Jemand sagt „öffnen“ → Relais klickt oder Webseite wird aufgerufen → Tür geht auf.

**Setzen?** Ja – ohne das tut sich nichts Physisches! Nimm entweder OPEN_COMMAND oder OPEN_URL (oder beides).

---

## Öffnen-Wörter festlegen (3 von 8)

**Welche Nachricht soll die Tür öffnen?**

- **OPEN_COMMAND_WORDS** = `open,öffnen,aufmachen`  
→ Welche Wörter lösen „öffnen“ aus? (mit Komma getrennt)

**Beispiel:** Jemand schreibt „öffnen bitte“ → die App erkennt „öffnen“ → Tür geht auf.

**Wenn du es extra geheim willst:**

- **OPEN_COMMAND_LIST_FILE** = `open-words.aes`  
→ Geheime Wortliste in einer verschlüsselten Datei (nur wer den Schlüssel hat, kann die Wörter ändern).

- **COMMAND_REGISTRY_ID** = `0x…`  
→ Die Liste der Wörter liegt auf der Kette (Blockchain) – sehr sicher, aber etwas aufwendiger.

**Setzen?** Nein – fang mit OPEN_COMMAND_WORDS an. Der Rest ist Extra-Sicherheit, wenn du sie brauchst.

---

## Zusätzliche Trigger – auch bei Zahlung öffnen? (4 von 8)

**Soll sich die Tür auch öffnen, wenn jemand zahlt?** (z. B. Ladesäule, Parkplatz)

- **PAYMENT_TRIGGER_ENABLED** = `false` oder `true`  
→ Wenn true: Jemand zahlt z. B. 0,001 IOTA an deine Schloss-Adresse + gibt einen Code ein → Tür öffnet sich.

**Beispiel:** Ladesäule: Du zahlst 2 € → Code erscheint → du tippst ihn ein → Ladesäule gibt Strom frei.

**Setzen?** Nein – nur wenn du „Zahlung als Schlüssel“ willst (z. B. für Ladesäule oder Parkplatz).

---

## Offline-Modus – ohne Internet öffnen? (5 von 8)

**Soll das Schloss auch ohne Internet funktionieren?**

- **OFFLINE_OPEN_ENABLED** = `false` oder `true`  
→ Wenn true: Die App merkt sich Schlüssel eine Weile lokal. Wenn das Internet ausfällt, funktioniert „öffnen“ trotzdem (z. B. 24 Stunden).

**Beispiel:** Internet ist weg → App hat den Schlüssel noch im Cache → Tür geht trotzdem auf.

- **OFFLINE_CACHE_TTL_MS** = `86400000` (24 Stunden in Millisekunden)  
→ Wie lange der Cache gültig ist.

**Setzen?** Nein – nur wenn du an einem Ort bist, wo das Internet oft ausfällt (z. B. abgelegenes Haus).

---

## Streams bei OPEN – schneller Zusatzweg (6 von 8)

**Soll bei „öffnen“ zusätzlich ein schneller Kanal genutzt werden?**

- **OPEN_STREAMS_ENABLED** = `false` oder `true`  
→ Wenn true: Zusätzlich zur normalen Kette wird eine schnelle Nachricht geschickt – Tür reagiert oft in unter einer Sekunde.

**Beispiel:** Normale Kette braucht 5 Sekunden → mit Streams geht „Tür auf“ in 0,5 Sekunden.

**Setzen?** Nein – nur wenn du Echtzeit brauchst (z. B. Schranke an der Einfahrt).

---

## Ticket für Gäste ausstellen (7 von 8)

**Du willst jemandem einen zeitlich begrenzten Schlüssel geben.**

- **/create-key** `0xSchloss 0xGast 7`  
→ Einen Schlüssel für 7 Tage ausstellen. Schloss-Adresse, Gast-Adresse, Anzahl Tage.

**Beispiel:** Handwerker soll eine Woche Zugang haben → du stellst einen Key für 7 Tage aus → nach 7 Tagen funktioniert er nicht mehr.

**Setzen?** Nein – nur wenn du Gäste oder Mieter hast, die zeitweise rein dürfen.

---

## Folgeoptionen – Erweiterungen (8 von 8)

**Alles, was du noch dazuschalten kannst:**

- **An alle (Pinnwand)** – Status an alle senden (z. B. „Tür wurde geöffnet“).
- **AUTHORIZED_SENDERS** – Nur bestimmte Adressen dürfen „öffnen“ sagen (Whitelist).
- **Zahlungs-Trigger** – Bei Zahlung öffnen (siehe Schritt 4).
- **Offline + Streams** – Offline-Cache und schneller Kanal zusammen.

**Setzen?** Nein – nur das, was du wirklich brauchst.

---

## Minimal-Beispiel (.env)

```env
ROLE=lock
MY_ADDRESS=0x0748…
OPEN_COMMAND=node relay-on.js
OPEN_COMMAND_WORDS=open,öffnen
```

Damit startest du die App – sie ist das Schloss, reagiert auf „open“ oder „öffnen“ und führt dein Relais-Skript aus.
