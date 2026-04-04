# Morgendrot – An alle (Pinnwand) einrichten

Eine Pinnwand ist wie eine Anschlagtafel: Eine Adresse, an die alle schreiben können – und alle in der Gruppe lesen es. Perfekt für Status-Meldungen wie „Wasser abgestellt von 14–16 Uhr“ oder „Alarm: Rauch in Küche“. Die Nachrichten sind Klartext (nicht verschlüsselt), also nur für Dinge, die nicht geheim sein müssen.

**5 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Pinnwand aktivieren (1 von 5)

**Der App sagen: Ja, ich will eine Pinnwand!**

- **ENABLE_BROADCAST_PINNWAND** = `true`  
→ Das ist wie ein Schalter: „Mach die Pinnwand an!“

**Vorher:** Keine Pinnwand – alles bleibt normaler 1:1-Chat.

**Nachher:** Es gibt eine Adresse, an die alle schreiben können (wenn du sie erlaubst).

**Beispiel:** Du willst allen Nachbarn sagen „Wasser abgestellt von 14–16 Uhr“ → dann mach true.

**Setzen?** Ja – ohne true passiert nichts.

---

## Pinnwand-Adresse setzen (2 von 5)

**Welche Adresse ist die Pinnwand?**

- **BROADCAST_PINNWAND_ADDRESS** = `0x…`  
→ Das ist die „öffentliche Anschlagtafel“ – alle schauen auf diese eine Adresse.

**Vorher:** Keine Adresse → die App weiß nicht, wohin die Nachrichten gehen.

**Nachher:** Alle Nachrichten an diese Adresse sind für alle sichtbar (Klartext).

**Beispiel:** Du nimmst deine eigene Adresse (MY_ADDRESS) oder eine extra Adresse – alle Gruppenmitglieder stellen ihre App auf diese Adresse.

**Setzen?** Ja – ohne Adresse funktioniert die Pinnwand nicht.

---

## Erlaubte Sender festlegen (3 von 5)

**Wer darf auf die Pinnwand schreiben?**

- **BROADCAST_AUTHORIZED_SENDERS** = `0x…,0x…` (mit Komma getrennt)  
→ Das ist wie eine Gästeliste: „Nur diese Leute dürfen was an die Pinnwand schreiben.“

**Vorher:** Jeder mit einer Adresse könnte schreiben → Spam möglich.

**Nachher:** Nur die erlaubten Adressen können posten – alle anderen werden ignoriert.

**Beispiel:** Du willst nur die Hausverwaltung schreiben lassen → nur deren Adresse eintragen.

**Setzen?** Ja – sonst könnte jeder spammen. Leer lassen = alle dürfen (nicht empfohlen).

---

## Klartext senden – wie poste ich was? (4 von 5)

**So schickst du eine Nachricht an die Pinnwand.**

- **/send-plain** `0xPinnwandAdresse` `Dein Text`  
→ Schick eine normale, offene Nachricht an die Pinnwand-Adresse.

**Vorher:** Alles verschlüsselt – im Explorer siehst du nur unverständliche Zeichen.

**Nachher:** Dein Text ist direkt lesbar – alle sehen ihn sofort.

**Beispiel:** `/send-plain 0xPinnwandAdresse Achtung: Wasser abgestellt von 14–16 Uhr!`

**Dafür brauchst du:** MY_ADDRESS, PACKAGE_ID, die Pinnwand-Adresse

**Setzen?** Nein – das ist der Befehl zum Posten. Einfach ausführen, wenn du was sagen willst.

---

## Was du noch ergänzen kannst (5 von 5)

**Alles optional – nur wenn du es brauchst:**

- Automatische Benachrichtigung bei neuer Pinnwand-Nachricht (z. B. Telegram)
- Bestimmte Adressen dürfen nur lesen, nicht schreiben
- Alte Nachrichten automatisch löschen (Purge)

**Setzen?** Nein – nur wenn du solche Extras willst.

---

## Minimal-Beispiel (.env)

```env
ENABLE_BROADCAST_PINNWAND=true
BROADCAST_PINNWAND_ADDRESS=0x0748…
BROADCAST_AUTHORIZED_SENDERS=0x1234…,0x5678…
```

Damit hast du eine Pinnwand – nur die genannten Adressen können posten, alle können lesen (Klartext).
