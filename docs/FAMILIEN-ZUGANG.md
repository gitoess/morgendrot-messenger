# Morgendrot – Familien- / Firmen-Zugang einrichten

Mehrere Leute sollen rein dürfen – Familie, Firma, WG. Du entscheidest: Nur eine feste Liste (Whitelist)? Nur temporäre Schlüssel (Keys)? Oder beides – Stammnutzer immer, Gäste nur mit Key?

**6 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Modell wählen (1 von 6)

**Wer darf wie rein?**

**Nur Whitelist:** Nur bestimmte Adressen dürfen „öffnen“ sagen – einfach und schnell.  
→ **AUTHORIZED_SENDERS** = `0x…,0x…`  
→ Beispiel: Familie hat 4 Adressen → nur diese 4 dürfen die Tür öffnen.

**Nur AccessKey:** Jeder braucht einen Schlüssel (NFT) – keine feste Liste.  
→ **/create-key** `0xSchloss` `0xFamilienmitglied` `30`  
→ Beispiel: Jeder bekommt seinen eigenen Schlüssel für 30 Tage – flexibel für Gäste.

**Whitelist + AccessKey:** Whitelist für Stammnutzer (Familie), Keys für Gäste.  
→ Beispiel: Familie darf immer (Whitelist), Handwerker nur 1 Tag (Key).

**Setzen?** Ja – wähle eine Variante. „Whitelist + Key“ ist am flexibelsten und sichersten.

---

## Schloss einrichten (2 von 6)

**Der App sagen: Ich bin das Schloss!**

- **ROLE** = `lock`  
→ Das ist wie ein Namensschild: „Ich bin jetzt das Schloss.“

- **MY_ADDRESS** = `0x…` (Adresse des Schlosses / der Tür)  
→ Das ist die Adresse, die prüft, wer rein darf.

**Beispiel:** Dein Haus-Schloss hat die Adresse 0x0748… → ROLE=lock + MY_ADDRESS=0x0748… → die App weiß: „Ich steuere diese Tür.“

**Setzen?** Ja – ohne ROLE=lock macht die App keinen Schloss-Modus.

---

## Whitelist – wer darf immer rein? (3 von 6)

**Feste Liste: Nur diese Leute dürfen ohne extra Schlüssel.**

- **AUTHORIZED_SENDERS** = `0x…,0x…` (mit Komma getrennt)  
→ Das ist wie eine Gästeliste: „Nur diese Leute dürfen die Tür öffnen.“

**Vorher:** Jeder mit einem Schlüssel kommt rein – auch Fremde.

**Nachher:** Nur die in der Liste dürfen – extra Sicherheit.

**Beispiel:** Familie hat 4 Adressen → AUTHORIZED_SENDERS=0xPapa,0xMama,0xKind1,0xKind2 → nur sie dürfen ohne Key.

**Setzen?** Nein – nur wenn du feste Nutzer hast. Leer = alle mit gültigem Key dürfen.

---

## Öffnen-Wörter festlegen (4 von 6)

**Welche Nachricht öffnet die Tür?**

- **OPEN_COMMAND_WORDS** = `open,öffnen,aufmachen`  
→ Welche Wörter lösen „öffnen“ aus? (mit Komma getrennt)

**Vorher:** Nur „open“ funktioniert.

**Nachher:** Auch „öffnen“ oder „aufmachen“ öffnet die Tür – praktisch für Familie.

**Beispiel:** Kind schreibt „öffnen bitte“ → Tür geht auf.

**Setzen?** Nein – fang mit den Standard-Wörtern an. Rest ist Extra-Komfort.

---

## Einzelne Keys für Gäste (5 von 6)

**Temporärer Zugang für Handwerker, Gäste usw.**

- **/create-key** `0xSchloss` `0xGast` `7`  
→ Einen Schlüssel für 7 Tage: Schloss-Adresse, Gast-Adresse, 7 Tage.

**Vorher:** Nur feste Nutzer (Whitelist) kommen rein.

**Nachher:** Gäste bekommen temporären Schlüssel → nach 7 Tagen automatisch ungültig.

**Beispiel:** Handwerker kommt → /create-key 0xSchloss 0xHandwerker 1 → er kann 1 Tag rein.

**Setzen?** Nein – nur wenn du Gäste hast. Einfach den Befehl ausführen.

---

## An alle – Status (6 von 6)

**Sollen alle in der Gruppe sehen, wenn die Tür geöffnet wurde?**

- **ENABLE_BROADCAST_PINNWAND** = `true` oder `false`  
→ Wenn true: Status wie „Tür geöffnet“ geht an alle (Pinnwand).

**Vorher:** Status geht nur an Einzelpersonen.

**Nachher:** Alle in der Gruppe sehen „Tür geöffnet“, „Alarm aus“ usw.

**Beispiel:** Tür geht auf → alle Familienmitglieder bekommen Status „Tür offen“.

**Setzen?** Nein – nur wenn du Status für alle brauchst.

---

## Minimal-Beispiel (.env)

**Nur Whitelist:**
```env
ROLE=lock
MY_ADDRESS=0x0748…
AUTHORIZED_SENDERS=0xPapa…,0xMama…,0xKind1…,0xKind2…
OPEN_COMMAND=node relay-on.js
OPEN_COMMAND_WORDS=open,öffnen
```

**Whitelist + Key:** Wie oben, zusätzlich bei Gästen: `/create-key 0x0748… 0xHandwerker… 1` → Gast für 1 Tag.

Damit haben feste Nutzer (Whitelist) immer Zugang – Gäste bekommen temporäre Keys.
