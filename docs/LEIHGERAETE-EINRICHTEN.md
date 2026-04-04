# Morgendrot – Temporäre Leihgeräte einrichten

Powerbank, Werkzeugkasten, E-Scooter – jemand bekommt einen zeitlich begrenzten „Schlüssel“ (NFT), kann das Gerät nutzen, und nach Ablauf oder Rückgabe wird der Schlüssel ungültig. Optional: Nur nach Zahlung einen Schlüssel ausstellen.

**6 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Modell wählen (1 von 6)

**Wie soll das Leihgerät funktionieren?**

**Nur Key:** Jemand bekommt einen temporären Schlüssel – das Gerät prüft, ob er gültig ist.  
→ Beispiel: Du leihst eine Powerbank für 24 Stunden → Schlüssel ist 24 Stunden gültig → danach automatisch ungültig.  
→ **/create-key** → Schlüssel ausstellen

**Nur Zahlung:** Bei Zahlung geht das Gerät automatisch auf (z. B. Powerbank-Station, Parkplatz).  
→ Beispiel: Jemand zahlt 0,001 IOTA → Powerbank entriegelt sich.  
→ **PAYMENT_TRIGGER_ENABLED** = `true`

**Zahlung + Key:** Schlüssel wird erst nach Zahlung ausgestellt (am sichersten und fairsten).  
→ Beispiel: Jemand zahlt → dein Backend prüft die Zahlung → stellt Schlüssel aus → Gerät geht auf.

**Setzen?** Ja – wähle eine Variante. „Zahlung + Key“ ist am sichersten.

---

## Geräte-Lock einrichten (2 von 6)

**Der App sagen: Ich bin das Leihgerät!**

- **ROLE** = `lock`  
→ Das ist wie ein Namensschild: „Ich bin jetzt die Powerbank-Station / der Werkzeug-Schrank.“

- **MY_ADDRESS** = `0x…` (Adresse des Leihgeräts)  
→ Das ist die Adresse, die Zahlungen oder Schlüssel prüft.

- **LOCK_ID** = `0x…` (meist = MY_ADDRESS)  
→ Die „ID“ des Geräts, die in den Schlüsseln steht.

**Beispiel:** Deine Powerbank-Station hat die Adresse 0x0748… → ROLE=lock + MY_ADDRESS=0x0748… + LOCK_ID=0x0748… → die App weiß: „Ich steuere diese Station.“

**Setzen?** Ja – ohne ROLE=lock macht die App keinen Lock-Modus.

---

## Key ausstellen (3 von 6)

**Einen temporären Schlüssel für den Mieter ausstellen.**

- **/create-key** `0xGerät 0xMieter 1`  
→ Ein Schlüssel für 1 Tag: Geräte-Adresse, Mieter-Adresse, 1 Tag.

**Vorher:** Niemand kann das Gerät nutzen.

**Nachher:** Mieter bekommt Schlüssel → kann das Gerät für 1 Tag nutzen.

**Möglichkeiten:**  
- **Ein Key:** `/create-key 0xPowerbank 0xMieter 1` → Schlüssel für 1 Tag.  
- **Mehrere Keys:** `/create-keys 0xPowerbank 0xMieter 1 5` → 5 Schlüssel für 1 Tag (z. B. für 5 Mieter).

**Setzen?** Nein – nur wenn du gerade verleihst. Einfach den Befehl ausführen.

---

## Nach Rückgabe: Key löschen (4 von 6)

**Gerät wieder frei machen – Schlüssel ungültig.**

- **/purge-key** `keyId`  
→ Schlüssel löschen. Die keyId findest du im Event oder im Explorer (Objekt-ID des Keys).

**Vorher:** Schlüssel bleibt gültig → Mieter könnte später nochmal nutzen.

**Nachher:** Schlüssel ist weg → Gerät ist wieder frei + du bekommst Speicher-Gebühr zurück (Rebate).

**Beispiel:** Mieter bringt Powerbank zurück → du tippst /purge-key 0xKeyId → Schlüssel ungültig.

**Dafür brauchst du:** PACKAGE_ID, keyId, ENABLE_PURGE=true

**Setzen?** Ja – mach das immer nach Rückgabe.

---

## Bei Verlust: Notfall-Purge (5 von 6)

**Schlüssel sofort ungültig machen.**

- **/emergency-purge-key** `keyId`  
→ Schlüssel sofort widerrufen (Notfall-Flag setzen).

**Vorher:** Schlüssel ist noch gültig → bei Verlust könnte jemand das Gerät nutzen.

**Nachher:** Schlüssel ist sofort ungültig → niemand kann mehr rein.

**Beispiel:** Powerbank verloren → /emergency-purge-key 0xKeyId → sofort gesperrt.

**Danach:** /purge-key `keyId` → Schlüssel komplett von der Kette löschen.

**Setzen?** Ja – das ist dein Notfall-Knopf.

---

## Zahlungs-Trigger (6 von 6)

**Soll sich das Gerät auch bei Zahlung öffnen?**

- **PAYMENT_TRIGGER_ENABLED** = `true` oder `false`  
→ Wenn true: Jemand zahlt z. B. 0,001 IOTA an die Geräte-Adresse → Gerät öffnet sich (z. B. Powerbank-Station).

**Beispiel:** Jemand zahlt an der Station → Powerbank entriegelt sich.

**Setzen?** Nein – nur wenn du „Zahlung als Schlüssel“ willst.

---

## Minimal-Beispiel

**Ein Key:** `/create-key 0xGerät 0xMieter 1`  
**Mehrere Keys:** `/create-keys 0xGerät 0xMieter 1 5` (5 Stück, 1 Tag)

Nach Rückgabe: `/purge-key keyId`. Bei Verlust: `/emergency-purge-key keyId`, danach `/purge-key keyId`.
