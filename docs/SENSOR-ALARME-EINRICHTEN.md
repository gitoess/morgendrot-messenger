# Morgendrot – Sensor-Alarme einrichten

Rauch, Wasser, Einbruch, Temperatur – Sensoren sollen dir Bescheid sagen, wenn etwas passiert. Du entscheidest: Soll jeder Sensor nur dir heimlich melden (verschlüsselt)? Oder sollen alle in der Gruppe den Alarm sehen (Pinnwand)? Oder beides?

**7 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Modell wählen (1 von 7)

**Wie sollen die Sensoren melden?**

**Privat (verschlüsselt):** Jeder Sensor hat seinen eigenen geheimen Kanal zu dir – nur du verstehst die Alarme.  
→ Beispiel: Rauchmelder in der Küche sendet nur dir „Rauch!“ – niemand anderes sieht es.  
→ Du machst mit jedem Sensor einmal **/connect** (Handshake).

**An alle (Pinnwand):** Alle Sensoren schreiben an eine gemeinsame Adresse – alle in der Gruppe sehen den Alarm (Klartext).  
→ Beispiel: Rauchmelder schreibt „Rauch in Küche!“ → alle Familienmitglieder sehen es sofort.  
→ **ENABLE_BROADCAST_PINNWAND** = `true`

**Beides:** Privat für geheime Alarme (z. B. Einbruch), Pinnwand für Status wie „alles ok“.

**Setzen?** Ja – fang mit Privat an (sicherer). Pinnwand nur, wenn alle alles sehen sollen.

---

## Chat mit Sensoren einrichten (2 von 7)

**Damit Sensoren dir verschlüsselt melden können.**

- **/connect** `0xSensorAdresse`  
→ Das ist wie „Hallo sagen“: Du und der Sensor tauschen einen geheimen Schlüssel aus.

**Vorher:** Der Sensor kann dir melden, aber niemand versteht es – oder es ist Klartext (unsicher).

**Nachher:** Der Sensor schickt „Rauch!“ verschlüsselt → nur du kannst es lesen.

**Beispiel:** Du tippst /connect 0xRauchmelderAdresse → der Sensor (oder du am PC) bestätigt → ab jetzt sind geheime Alarme möglich.

**Dafür brauchst du:** MY_ADDRESS, PACKAGE_ID, die Adresse des Sensors

**Setzen?** Ja – mach das mit jedem Sensor einmalig.

---

## Erlaubte Sender festlegen (3 von 7)

**Nur diese Sensoren dürfen Alarm auslösen.**

- **AUTHORIZED_SENDERS** = `0x…,0x…` (mit Komma getrennt)  
→ Das ist wie eine Gästeliste: „Nur diese Sensoren dürfen Alarm schlagen.“

**Vorher:** Jeder könnte dir falsche Alarme schicken (z. B. ein Nachbar hackt).

**Nachher:** Nur deine eigenen Sensoren dürfen melden – alles andere wird ignoriert.

**Beispiel:** Du hast 5 Rauchmelder → AUTHORIZED_SENDERS=0xRauch1,0xRauch2,0xRauch3,0xRauch4,0xRauch5

**Setzen?** Ja – sonst könnte dich jeder alarmieren (Spam oder Fake-Alarm).

---

## Heartbeat einschalten (4 von 7)

**Sensor sagt regelmäßig „Ich lebe noch“.**
- **ENABLE_HEARTBEAT** = `true`  
→ Der Sensor schickt alle X Minuten „Hallo, ich bin wach!“

**Vorher:** Du weißt nicht, ob der Sensor kaputt oder aus ist.

**Nachher:** Der Sensor schickt alle X Minuten „Ich bin da“ → wenn lange nichts kommt → die App sagt „Sensor offline!“.

**Beispiel:** Rauchmelder sendet alle 10 Minuten Heartbeat → App merkt: „Alles ok“. Wenn 30 Minuten nichts kommt → Alarm.

**Setzen?** Ja – mach das immer an, sonst merkst du Ausfälle nicht.

---

## Alarm-Webhook einrichten (5 von 7)

**Was passiert bei Alarm oder wenn ein Sensor offline geht?**

- **MONITOR_ALARM_WEBHOOK_URL** = `https://…`  
→ Das ist wie ein Notfall-Telefon: „Wenn Alarm oder Gerät offline ist, ruf diese Adresse an.“

**Vorher:** Alarm passiert → du merkst es erst, wenn du reinschaust.

**Nachher:** Die App ruft sofort eine Webseite an → z. B. Telegram schickt dir eine Push-Nachricht: „Rauch in Küche!“ oder „Sensor 3 offline“.

**Möglichkeiten:** Webhook zu Telegram-Bot, E-Mail-Service, Sirene usw.  
Beispiel: https://maker.ifttt.com/trigger/alarm/with/key/dein-key → schickt dir eine Push-Nachricht.

**Telegram (Morgendrot):** Lokales Relay `npm run telegram-webhook`, `MONITOR_ALARM_WEBHOOK_URL=http://127.0.0.1:8787/morgendrot-telegram` — Nachricht z. B. „Morgendrot Alarm L1“ mit Gerät, Zeit, Meldung. **Zielbild ohne `.env` für Bot-Token:** Einstellungen → Integrationen in der App — siehe **`docs/TELEGRAM-INTEGRATION-ZIELBILD.md`** (**§ H.26**).

**Setzen?** Sehr empfohlen – mach das an, wenn du wichtige Alarme willst.

---

## Purge nach Entwarnung (6 von 7)

**Alarm-Nachricht nach „Entwarnung“ löschen.**

- **/purge-msg** `Nonce`  
→ Nach „Entwarnung“ (z. B. Rauch weg) die alte Alarm-Nachricht löschen.

**Vorher:** Die Alarm-Nachricht bleibt ewig auf der Kette (nur unlesbar).

**Nachher:** Nachricht ist weg → Speicher gespart + Datenschutz (keine alten Alarme mehr sichtbar).

**Beispiel:** Rauchmelder meldet „Rauch!“ → du löschst mit /purge-msg 123456789 → Nachricht weg.

**Dafür brauchst du:** MAILBOX_ID, ENABLE_PURGE=true, die Nonce aus dem Event

**Setzen?** Ja – mach das nach Entwarnung.

---

## Monitor (optional) – nur überwachen, nichts ausführen (7 von 7)

**Reine Überwachungs-Station.**

- **ROLE** = `monitor`  
→ Das ist wie ein reiner Wachmann: „Ich schaue nur zu, ich mache nichts.“

**Vorher:** Die App könnte Befehle senden oder ausführen.

**Nachher:** Die App hört nur zu, prüft Heartbeat und Alarm – schickt keine Befehle.

**Beispiel:** Du stellst einen zweiten Rechner auf → ROLE=monitor → er überwacht alle Sensoren und schickt dir Alarme (z. B. per Webhook).

**Setzen?** Nein – nur wenn du eine reine Überwachungs-Station willst (ohne Schloss oder Befehle).

---

## Minimal-Beispiel (.env)

```env
MY_ADDRESS=0x…
PARTNER_ADDRESSES=0xRauch1,0xRauch2
AUTHORIZED_SENDERS=0xRauch1,0xRauch2
ENABLE_HEARTBEAT=true
MONITOR_ALARM_WEBHOOK_URL=https://…
```

Mit jedem Sensor einmal /connect, dann läuft der Alarm-Kanal verschlüsselt. Bei Alarm oder Offline ruft die App deinen Webhook auf.
