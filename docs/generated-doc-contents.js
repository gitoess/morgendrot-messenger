/**
 * Eingebettete Anleitungen – keine Server-Anfrage nötig.
 * Generiert von: npx tsx scripts/build-doc-contents.ts
 */
(function(global) {
  const docs = {
    'CHAT-GRUPPE-EINRICHTEN.md': `# Morgendrot – Dezentrale Chat-Gruppe einrichten

Familie, WG, Firma, Nachbarn – ihr wollt in einer Gruppe chatten. Du entscheidest: Soll jeder mit jedem verschlüsselt reden (privat)? Oder soll es eine gemeinsame Pinnwand geben, wo alle alles sehen (an alle)? Oder beides?

**6 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Gruppen-Modus wählen (1 von 6)

**Wie soll die Gruppe chatten?**

**Privat (verschlüsselt):** Jeder hat seinen eigenen geheimen Kanal zu jedem anderen – nur du und der andere verstehen die Nachrichten.  
→ Beispiel: Familie – Mama schreibt an Papa → nur Papa sieht es, nicht die Kinder.  
→ **PARTNER_ADDRESSES** = \`0x…,0x…\` (mit Komma getrennt)  
→ **ENABLE_PAIRWISE_GROUPS** = \`true\` → jeder mit jedem verschlüsselt

**An alle (Pinnwand):** Alle schreiben an eine einzige Adresse – alle sehen alles (Klartext).  
→ Beispiel: WG – jemand schreibt „Milch leer“ → alle sehen es sofort.  
→ **ENABLE_BROADCAST_PINNWAND** = \`true\`

**Beides:** Privat für private Chats (z. B. Mama–Papa), Pinnwand für Status (z. B. „Müll rausbringen!“).

**Setzen?** Ja – fang mit Privat an (sicherer). Pinnwand nur, wenn alle alles sehen sollen.

---

## Empfänger – aktiv oder passiv? (2 von 6)

**Haben alle in der Gruppe die App?**

**Aktiv (volles Wallet):** Jeder hat die App → macht /connect → kann senden und empfangen.  
→ Beispiel: Familie – alle haben App → alle können chatten.

**Passiv (nur Adresse):** Einige haben keine App → du kannst ihnen Klartext schicken mit **/send-plain** \`0x…\` \`Text\` – kein Handshake nötig.  
→ Beispiel: Nachbarn haben keine App → du schreibst „Wasser abgestellt“ – sie sehen es im Explorer.

**Setzen?** Nein – fang mit aktiven Partnern an. Passiv nur für einfache Bekanntmachungen.

---

## Mailbox – löschbare Nachrichten (3 von 6)

**Sollen alte Nachrichten wirklich gelöscht werden können?**

- **USE_MAILBOX** = \`true\`  
→ Purgebare Nachrichten nutzen (besser als ewige Events).

- **MAILBOX_ID** = \`0x…\`  
→ Die Adresse des „Briefkastens“ (aus create_globals kopieren).

**Vorher:** Nachrichten bleiben ewig auf der Kette (nur unlesbar).

**Nachher:** Mit Mailbox kannst du alte Nachrichten wirklich löschen → Speicher sparen + Datenschutz.

**Beispiel:** Nach dem Familien-Urlaub alle alten Chats löschen → /purge-msg &lt;nonce&gt; → weg.

**Setzen?** Ja – empfohlen, wenn du Datenschutz willst.

---

## Handshake & Connect (4 von 6)

**So startet ihr den Chat – „Hallo sagen“.**
- **/connect** \`0xPartnerAdresse\`  
→ Du und der andere tauschen einen geheimen Schlüssel aus.

**Vorher:** Kein Kontakt – ihr könnt nicht verschlüsselt chatten.

**Nachher:** Nach dem Handshake könnt ihr sicher Nachrichten austauschen.

**Beispiel:** Du tippst /connect 0xPapa → Papa tippt /connect 0xDeineAdresse → Chat läuft.

**Dafür brauchst du:** MY_ADDRESS, PACKAGE_ID, Partner-Adresse

**Setzen?** Ja – mach das mit jedem neuen Gruppenmitglied einmalig.

---

## Nachrichten laden (5 von 6)

**Ältere Nachrichten nachholen.**

- **/fetch** \`10\`  
→ Die letzten 10 Nachrichten laden.

**Vorher:** Du siehst nur neue Nachrichten nach dem Start.

**Nachher:** Du siehst auch alte – wie „ältere Nachrichten laden“ bei WhatsApp.

**Beispiel:** /fetch 15 → die letzten 15 Nachrichten erscheinen im Log.

**Setzen?** Nein – mach das, wenn du den Verlauf sehen willst.

---

## Streams – schneller Kanal (6 von 6)

**Soll es einen superschnellen Zusatzkanal geben?**

- **STREAMS_BRIDGE_URL** = \`…\`  
→ Wo der Streams-Dienst läuft (falls du Streams nutzen willst).

**Vorher:** Alles läuft nur über die normale Kette (oft 1–5 Sekunden).

**Nachher:** Nachrichten können auch über Streams geschickt werden → schneller (fast sofort) und fast kostenlos.

**Beispiel:** „Milch leer“ kommt in 0,5 Sekunden an statt 5 Sekunden.

**Setzen?** Nein – nur wenn du Echtzeit brauchst.

---

## Minimal-Beispiel (.env)

\`\`\`env
MY_ADDRESS=0x…
PARTNER_ADDRESSES=0xPapa,0xMama,0xKind
ENABLE_PAIRWISE_GROUPS=true
MAILBOX_ID=0x…
USE_MAILBOX=true
\`\`\`

Mit jedem Partner einmal /connect, dann läuft der Gruppen-Chat verschlüsselt. Alte Nachrichten kannst du mit /purge-msg löschen.
`,
    'M2M-KOORDINATION-EINRICHTEN.md': `# Morgendrot – M2M-Koordination einrichten

Fabrik-Roboter, Drohnen, Spielzeug-Autos – mehrere Geräte sollen zusammenarbeiten. Du richtest eine „Ameisen-Hierarchie“ ein: Boss → Kommandant → Arbeiter. Der Boss gibt Befehle, Kommandanten leiten weiter, Arbeiter führen aus (z. B. Tür öffnen). Optional: Maschinen ohne eigenes Wallet (Boss unterschreibt für alle).

**6 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Rolle wählen (1 von 6)

**Sag der App: Wer bist du in der Hierarchie?**

- **ROLE** = \`boss\` / \`kommandant\` / \`arbeiter\`  
→ Das ist wie ein Kostüm: Jeder bekommt seine Aufgabe.

**Boss:** ROLE=boss + KOMMANDANT_ADDRESSES  
→ Der große Chef. Er sendet Befehle an alle Kommandanten (z. B. „alle Roboter in Pause“).  
→ Beispiel: Dein großer Computer ist der Boss → er sagt den Kommandanten, was sie tun sollen.

**Kommandant:** ROLE=kommandant + BOSS_ADDRESS + WORKER_ADDRESSES  
→ Der Vorarbeiter. Er hört auf den Boss und leitet Befehle an die Arbeiter weiter.  
→ Beispiel: Ein Raspberry Pi pro Stockwerk ist Kommandant → er hört auf den Boss und sagt den Robotern „stopp“.

**Arbeiter (Lock):** ROLE=arbeiter + BOSS_ADDRESS + KOMMANDANT_ADDRESSES  
→ Die kleinen Ameisen. Sie hören nur auf Boss oder Kommandanten und machen die Arbeit (z. B. Tür öffnen).  
→ Beispiel: Ein kleiner Roboter-Arm ist Arbeiter → er hört auf den Kommandanten und macht, was er sagt.

**Setzen?** Ja – jedes Gerät braucht seine Rolle. Ohne ROLE weiß die App nicht, was sie tun soll.

**Wer darf was? (Ameisen-Rechte, alle optional)**

| Recht | Boss | Kommandant | Arbeiter | Flag (in .env) |
|-------|------|------------|----------|----------------|
| Befehl senden (Handshake, Send) | Ja | Ja | Nein | ENABLE_COMMAND_DOWN |
| Schlüssel ausstellen | Ja | Nein | Nein | ENABLE_KEY_ISSUE |
| Widerruf / Sperren (Purge) | Ja | Ja | Nein | ENABLE_REVOKE_DOWN |
| Status von unten lesen | Ja | Ja | Nein | ENABLE_STATUS_READ_DOWN |
| Status von oben lesen | – | Ja (Boss) | Ja (Boss + Kommandant) | ENABLE_STATUS_READ_UP |
| Konfig ändern | Ja | Nein | Nein | ENABLE_CONFIG_CHANGE |
| Hierarchie ändern (ROLE, Adressen) | Ja | Nein | Nein | ENABLE_HIERARCHY_CHANGE |

In der UI und API siehst du nur die Optionen, die deine Rolle darf. Arbeiter sieht z. B. kaum etwas – nur Lesen von Status oben. Alle Flags default: true (Boss hat alles, Kommandant/Arbeiter nach Tabelle).

---

## Maschinen ohne Wallet? (2 von 6)

**Kleine Geräte brauchen kein eigenes Sparschwein – der Boss unterschreibt.**

- **SIGNER** = \`remote\`  
→ Die kleinen Ameisen haben kein eigenes Wallet – der Boss unterschreibt für sie.

- **REMOTE_SIGNER_URL** = \`https://mein-boss-computer:3340/sign\`  
→ Wo der Boss-Signer läuft (seine Adresse im Netzwerk).

**Mit eigenem Wallet:** SIGNER=cli oder sdk → jede Maschine hat eigenes Passwort (komplizierter).

**Ohne Wallet (Boss signiert):** SIGNER=remote + REMOTE_SIGNER_URL  
→ Beispiel: Die kleinen Roboter schicken dem Boss „bitte unterschreib für mich“ → der Boss macht es.

**Setzen?** Ja – mach SIGNER=remote für kleine Geräte, dann brauchst du keine Passwörter überall.

---

## Streams – schneller Kanal (3 von 6)

**Soll es einen superschnellen „Tunnel“ für Befehle geben?**

- **OPEN_STREAMS_ENABLED** = \`true\` oder \`false\`  
→ Bei „open“ oder anderen Befehlen auch über Streams schicken? (schneller und fast kostenlos.)

- **STREAMS_BRIDGE_URL** = \`…\`  
→ Wo der Streams-Dienst läuft.

**Beispiel:** Boss sagt „alle Roboter stopp!“ → über Streams in 0,5 Sekunden bei allen an – viel schneller als normale Kette.

**Setzen?** Nein – nur wenn du superschnell sein willst (z. B. Roboter müssen sofort stoppen).

---

## Connect – Hallo sagen (4 von 6)

**Damit die Geräte sich „kennen“ und verschlüsselt reden können.**

- **/connect** \`0xAdresse\`  
→ Das ist wie „Hallo, ich bin da!“ – Boss oder Kommandant und Arbeiter tauschen einen geheimen Schlüssel aus.

**Vorher:** Die kleinen Roboter verstehen die Befehle nicht (oder nur unverschlüsselt).

**Nachher:** Nach /connect können sie geheime Befehle empfangen (z. B. „stopp!“).

**Beispiel:** Boss tippt /connect 0xRoboter1 → Roboter1 und Boss vertrauen sich → ab jetzt läuft die Koordination.

**Dafür brauchst du:** MY_ADDRESS, PACKAGE_ID, Adresse vom anderen

**Setzen?** Ja – mach das einmalig mit jedem neuen Roboter oder Kommandanten.

---

## Befehle senden (5 von 6)

**Der Boss oder Kommandant sagt, was alle tun sollen.**

Nachrichten gehen an alle verbundenen Partner. Du tippst z. B. „alle stopp!“ → alle Roboter hören es und stoppen.

**Beispiel:** Boss schreibt „alle Roboter in Pause“ → Kommandanten leiten weiter → Arbeiter machen Pause.

**Setzen?** Nein – das passiert automatisch, wenn die Rollen und Adressen richtig gesetzt sind.

---

## Zusätzliche Optionen (6 von 6)

**Extras – nimm nur, was du brauchst:**

- **Zahlungs-Trigger:** Arbeiter als Lock → bei Zahlung öffnen (z. B. Roboter arbeitet nur nach Bezahlung).  
  → PAYMENT_TRIGGER_ENABLED = true

- **AccessKey für Maschinen:** Boss stellt Keys für Arbeiter aus (z. B. Roboter 1 darf 7 Tage durchs Gate).  
  → /create-key

- **Ticket-NFT (hasValidTicket):** Ein Gate prüft, ob jemand ein gültiges Ticket hat – statt oder zusätzlich zu AccessKey.

**Setzen?** Nein – nur wenn du solche Extras willst.

---

## Minimal-Beispiel

**Boss (.env):** ROLE=boss, KOMMANDANT_ADDRESSES=0x…,0x…  
**Kommandant (.env):** ROLE=kommandant, BOSS_ADDRESS=0x…, WORKER_ADDRESSES=0x…  
**Arbeiter (.env):** ROLE=arbeiter, BOSS_ADDRESS=0x…, KOMMANDANT_ADDRESSES=0x…, ggf. SIGNER=remote + REMOTE_SIGNER_URL

Mit jedem Gerät einmal /connect, dann gehen Befehle von Boss → Kommandant → Arbeiter.
`,
    'SENSOR-ALARME-EINRICHTEN.md': `# Morgendrot – Sensor-Alarme einrichten

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
→ **ENABLE_BROADCAST_PINNWAND** = \`true\`

**Beides:** Privat für geheime Alarme (z. B. Einbruch), Pinnwand für Status wie „alles ok“.

**Setzen?** Ja – fang mit Privat an (sicherer). Pinnwand nur, wenn alle alles sehen sollen.

---

## Chat mit Sensoren einrichten (2 von 7)

**Damit Sensoren dir verschlüsselt melden können.**

- **/connect** \`0xSensorAdresse\`  
→ Das ist wie „Hallo sagen“: Du und der Sensor tauschen einen geheimen Schlüssel aus.

**Vorher:** Der Sensor kann dir melden, aber niemand versteht es – oder es ist Klartext (unsicher).

**Nachher:** Der Sensor schickt „Rauch!“ verschlüsselt → nur du kannst es lesen.

**Beispiel:** Du tippst /connect 0xRauchmelderAdresse → der Sensor (oder du am PC) bestätigt → ab jetzt sind geheime Alarme möglich.

**Dafür brauchst du:** MY_ADDRESS, PACKAGE_ID, die Adresse des Sensors

**Setzen?** Ja – mach das mit jedem Sensor einmalig.

---

## Erlaubte Sender festlegen (3 von 7)

**Nur diese Sensoren dürfen Alarm auslösen.**

- **AUTHORIZED_SENDERS** = \`0x…,0x…\` (mit Komma getrennt)  
→ Das ist wie eine Gästeliste: „Nur diese Sensoren dürfen Alarm schlagen.“

**Vorher:** Jeder könnte dir falsche Alarme schicken (z. B. ein Nachbar hackt).

**Nachher:** Nur deine eigenen Sensoren dürfen melden – alles andere wird ignoriert.

**Beispiel:** Du hast 5 Rauchmelder → AUTHORIZED_SENDERS=0xRauch1,0xRauch2,0xRauch3,0xRauch4,0xRauch5

**Setzen?** Ja – sonst könnte dich jeder alarmieren (Spam oder Fake-Alarm).

---

## Heartbeat einschalten (4 von 7)

**Sensor sagt regelmäßig „Ich lebe noch“.**
- **ENABLE_HEARTBEAT** = \`true\`  
→ Der Sensor schickt alle X Minuten „Hallo, ich bin wach!“

**Vorher:** Du weißt nicht, ob der Sensor kaputt oder aus ist.

**Nachher:** Der Sensor schickt alle X Minuten „Ich bin da“ → wenn lange nichts kommt → die App sagt „Sensor offline!“.

**Beispiel:** Rauchmelder sendet alle 10 Minuten Heartbeat → App merkt: „Alles ok“. Wenn 30 Minuten nichts kommt → Alarm.

**Setzen?** Ja – mach das immer an, sonst merkst du Ausfälle nicht.

---

## Alarm-Webhook einrichten (5 von 7)

**Was passiert bei Alarm oder wenn ein Sensor offline geht?**

- **MONITOR_ALARM_WEBHOOK_URL** = \`https://…\`  
→ Das ist wie ein Notfall-Telefon: „Wenn Alarm oder Gerät offline ist, ruf diese Adresse an.“

**Vorher:** Alarm passiert → du merkst es erst, wenn du reinschaust.

**Nachher:** Die App ruft sofort eine Webseite an → z. B. Telegram schickt dir eine Push-Nachricht: „Rauch in Küche!“ oder „Sensor 3 offline“.

**Möglichkeiten:** Webhook zu Telegram-Bot, E-Mail-Service, Sirene usw.  
Beispiel: https://maker.ifttt.com/trigger/alarm/with/key/dein-key → schickt dir eine Push-Nachricht.

**Setzen?** Sehr empfohlen – mach das an, wenn du wichtige Alarme willst.

---

## Purge nach Entwarnung (6 von 7)

**Alarm-Nachricht nach „Entwarnung“ löschen.**

- **/purge-msg** \`Nonce\`  
→ Nach „Entwarnung“ (z. B. Rauch weg) die alte Alarm-Nachricht löschen.

**Vorher:** Die Alarm-Nachricht bleibt ewig auf der Kette (nur unlesbar).

**Nachher:** Nachricht ist weg → Speicher gespart + Datenschutz (keine alten Alarme mehr sichtbar).

**Beispiel:** Rauchmelder meldet „Rauch!“ → du löschst mit /purge-msg 123456789 → Nachricht weg.

**Dafür brauchst du:** MAILBOX_ID, ENABLE_PURGE=true, die Nonce aus dem Event

**Setzen?** Ja – mach das nach Entwarnung.

---

## Monitor (optional) – nur überwachen, nichts ausführen (7 von 7)

**Reine Überwachungs-Station.**

- **ROLE** = \`monitor\`  
→ Das ist wie ein reiner Wachmann: „Ich schaue nur zu, ich mache nichts.“

**Vorher:** Die App könnte Befehle senden oder ausführen.

**Nachher:** Die App hört nur zu, prüft Heartbeat und Alarm – schickt keine Befehle.

**Beispiel:** Du stellst einen zweiten Rechner auf → ROLE=monitor → er überwacht alle Sensoren und schickt dir Alarme (z. B. per Webhook).

**Setzen?** Nein – nur wenn du eine reine Überwachungs-Station willst (ohne Schloss oder Befehle).

---

## Minimal-Beispiel (.env)

\`\`\`env
MY_ADDRESS=0x…
PARTNER_ADDRESSES=0xRauch1,0xRauch2
AUTHORIZED_SENDERS=0xRauch1,0xRauch2
ENABLE_HEARTBEAT=true
MONITOR_ALARM_WEBHOOK_URL=https://…
\`\`\`

Mit jedem Sensor einmal /connect, dann läuft der Alarm-Kanal verschlüsselt. Bei Alarm oder Offline ruft die App deinen Webhook auf.
`,
    'SCHLOSS-EINRICHTEN.md': `# Morgendrot – Smart-Lock / Schloss einrichten

So richtest du ein digitales Schloss ein: Du sagst der App „Ich bin das Schloss“, gibst an, was bei „öffnen“ passieren soll, und wer einen Schlüssel (Ticket) haben darf.

**8 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst. Fang mit Schritt 1 an. Wenn du etwas nicht willst, überspring es.

---

## Rolle & Adresse setzen (1 von 8)

**Der App sagen: Ich bin das Schloss.**

- **ROLE** = \`lock\`  
→ Das ist wie ein Namensschild: „Ich bin jetzt das Schloss.“

- **MY_ADDRESS** = \`0x…\` (deine Schloss-Adresse)  
→ Das ist die Adresse, die alle kennen – wie deine Handynummer für das Schloss.

**Vorher:** Die App weiß nicht, ob sie Chat, Überwachung oder Schloss sein soll.

**Nachher:** Die App sagt: „Ich bin das Schloss mit der Adresse 0x0748…“

**Beispiel:** Du startest die App → sie weiß sofort: „Ich bin das Schloss und heiße 0x0748…“

**Setzen?** Ja – ohne ROLE=lock macht die App keinen Schloss-Modus!

---

## Öffnen-Aktion festlegen (2 von 8)

**Was soll passieren, wenn jemand „öffnen“ sagt?**

- **OPEN_COMMAND** = \`node relay-on.js\`  
→ Ein Programm auf deinem Rechner starten (z. B. Relais ein- oder ausschalten).

**Beispiel:** Du hast ein Relais an Pin 5 → das Skript relay-on.js schaltet es ein → die Tür geht auf.

- **OPEN_URL** = \`http://192.168.1.123/open\`  
→ Einen Link im Internet aufrufen (z. B. dein Smart-Lock oder eine Ladesäule).

**Beispiel:** Dein Smart-Lock hat eine Webseite → bei „open“ wird die Seite aufgerufen → das Schloss öffnet sich.

**Vorher:** Jemand sagt „öffnen“ – aber nichts passiert, weil die App nicht weiß, was sie tun soll.

**Nachher:** Jemand sagt „öffnen“ → Relais klickt oder Webseite wird aufgerufen → Tür geht auf.

**Setzen?** Ja – ohne das tut sich nichts Physisches! Nimm entweder OPEN_COMMAND oder OPEN_URL (oder beides).

---

## Öffnen-Wörter festlegen (3 von 8)

**Welche Nachricht soll die Tür öffnen?**

- **OPEN_COMMAND_WORDS** = \`open,öffnen,aufmachen\`  
→ Welche Wörter lösen „öffnen“ aus? (mit Komma getrennt)

**Beispiel:** Jemand schreibt „öffnen bitte“ → die App erkennt „öffnen“ → Tür geht auf.

**Wenn du es extra geheim willst:**

- **OPEN_COMMAND_LIST_FILE** = \`open-words.aes\`  
→ Geheime Wortliste in einer verschlüsselten Datei (nur wer den Schlüssel hat, kann die Wörter ändern).

- **COMMAND_REGISTRY_ID** = \`0x…\`  
→ Die Liste der Wörter liegt auf der Kette (Blockchain) – sehr sicher, aber etwas aufwendiger.

**Setzen?** Nein – fang mit OPEN_COMMAND_WORDS an. Der Rest ist Extra-Sicherheit, wenn du sie brauchst.

---

## Zusätzliche Trigger – auch bei Zahlung öffnen? (4 von 8)

**Soll sich die Tür auch öffnen, wenn jemand zahlt?** (z. B. Ladesäule, Parkplatz)

- **PAYMENT_TRIGGER_ENABLED** = \`false\` oder \`true\`  
→ Wenn true: Jemand zahlt z. B. 0,001 IOTA an deine Schloss-Adresse + gibt einen Code ein → Tür öffnet sich.

**Beispiel:** Ladesäule: Du zahlst 2 € → Code erscheint → du tippst ihn ein → Ladesäule gibt Strom frei.

**Setzen?** Nein – nur wenn du „Zahlung als Schlüssel“ willst (z. B. für Ladesäule oder Parkplatz).

---

## Offline-Modus – ohne Internet öffnen? (5 von 8)

**Soll das Schloss auch ohne Internet funktionieren?**

- **OFFLINE_OPEN_ENABLED** = \`false\` oder \`true\`  
→ Wenn true: Die App merkt sich Schlüssel eine Weile lokal. Wenn das Internet ausfällt, funktioniert „öffnen“ trotzdem (z. B. 24 Stunden).

**Beispiel:** Internet ist weg → App hat den Schlüssel noch im Cache → Tür geht trotzdem auf.

- **OFFLINE_CACHE_TTL_MS** = \`86400000\` (24 Stunden in Millisekunden)  
→ Wie lange der Cache gültig ist.

**Setzen?** Nein – nur wenn du an einem Ort bist, wo das Internet oft ausfällt (z. B. abgelegenes Haus).

---

## Streams bei OPEN – schneller Zusatzweg (6 von 8)

**Soll bei „öffnen“ zusätzlich ein schneller Kanal genutzt werden?**

- **OPEN_STREAMS_ENABLED** = \`false\` oder \`true\`  
→ Wenn true: Zusätzlich zur normalen Kette wird eine schnelle Nachricht geschickt – Tür reagiert oft in unter einer Sekunde.

**Beispiel:** Normale Kette braucht 5 Sekunden → mit Streams geht „Tür auf“ in 0,5 Sekunden.

**Setzen?** Nein – nur wenn du Echtzeit brauchst (z. B. Schranke an der Einfahrt).

---

## Ticket für Gäste ausstellen (7 von 8)

**Du willst jemandem einen zeitlich begrenzten Schlüssel geben.**

- **/create-key** \`0xSchloss 0xGast 7\`  
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

\`\`\`env
ROLE=lock
MY_ADDRESS=0x0748…
OPEN_COMMAND=node relay-on.js
OPEN_COMMAND_WORDS=open,öffnen
\`\`\`

Damit startest du die App – sie ist das Schloss, reagiert auf „open“ oder „öffnen“ und führt dein Relais-Skript aus.
`,
    'BROADCAST-PINNWAND.md': `# Morgendrot – An alle (Pinnwand) einrichten

Eine Pinnwand ist wie eine Anschlagtafel: Eine Adresse, an die alle schreiben können – und alle in der Gruppe lesen es. Perfekt für Status-Meldungen wie „Wasser abgestellt von 14–16 Uhr“ oder „Alarm: Rauch in Küche“. Die Nachrichten sind Klartext (nicht verschlüsselt), also nur für Dinge, die nicht geheim sein müssen.

**5 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Pinnwand aktivieren (1 von 5)

**Der App sagen: Ja, ich will eine Pinnwand!**

- **ENABLE_BROADCAST_PINNWAND** = \`true\`  
→ Das ist wie ein Schalter: „Mach die Pinnwand an!“

**Vorher:** Keine Pinnwand – alles bleibt normaler 1:1-Chat.

**Nachher:** Es gibt eine Adresse, an die alle schreiben können (wenn du sie erlaubst).

**Beispiel:** Du willst allen Nachbarn sagen „Wasser abgestellt von 14–16 Uhr“ → dann mach true.

**Setzen?** Ja – ohne true passiert nichts.

---

## Pinnwand-Adresse setzen (2 von 5)

**Welche Adresse ist die Pinnwand?**

- **BROADCAST_PINNWAND_ADDRESS** = \`0x…\`  
→ Das ist die „öffentliche Anschlagtafel“ – alle schauen auf diese eine Adresse.

**Vorher:** Keine Adresse → die App weiß nicht, wohin die Nachrichten gehen.

**Nachher:** Alle Nachrichten an diese Adresse sind für alle sichtbar (Klartext).

**Beispiel:** Du nimmst deine eigene Adresse (MY_ADDRESS) oder eine extra Adresse – alle Gruppenmitglieder stellen ihre App auf diese Adresse.

**Setzen?** Ja – ohne Adresse funktioniert die Pinnwand nicht.

---

## Erlaubte Sender festlegen (3 von 5)

**Wer darf auf die Pinnwand schreiben?**

- **BROADCAST_AUTHORIZED_SENDERS** = \`0x…,0x…\` (mit Komma getrennt)  
→ Das ist wie eine Gästeliste: „Nur diese Leute dürfen was an die Pinnwand schreiben.“

**Vorher:** Jeder mit einer Adresse könnte schreiben → Spam möglich.

**Nachher:** Nur die erlaubten Adressen können posten – alle anderen werden ignoriert.

**Beispiel:** Du willst nur die Hausverwaltung schreiben lassen → nur deren Adresse eintragen.

**Setzen?** Ja – sonst könnte jeder spammen. Leer lassen = alle dürfen (nicht empfohlen).

---

## Klartext senden – wie poste ich was? (4 von 5)

**So schickst du eine Nachricht an die Pinnwand.**

- **/send-plain** \`0xPinnwandAdresse\` \`Dein Text\`  
→ Schick eine normale, offene Nachricht an die Pinnwand-Adresse.

**Vorher:** Alles verschlüsselt – im Explorer siehst du nur unverständliche Zeichen.

**Nachher:** Dein Text ist direkt lesbar – alle sehen ihn sofort.

**Beispiel:** \`/send-plain 0xPinnwandAdresse Achtung: Wasser abgestellt von 14–16 Uhr!\`

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

\`\`\`env
ENABLE_BROADCAST_PINNWAND=true
BROADCAST_PINNWAND_ADDRESS=0x0748…
BROADCAST_AUTHORIZED_SENDERS=0x1234…,0x5678…
\`\`\`

Damit hast du eine Pinnwand – nur die genannten Adressen können posten, alle können lesen (Klartext).
`,
    'VAULT-EINRICHTEN.md': `# Morgendrot – Vault (Tresor) einrichten

Der Vault ist dein digitaler Tresor: Hier werden die geheimen Schlüssel gespeichert, mit denen Nachrichten verschlüsselt werden. Ohne Tresor verlierst du bei jedem Neustart die Verbindung zu deinen Partnern.

**4 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst. Fang mit Schritt 1 an.

---

## Adresse & Paket setzen (1 von 4)

**Ohne Adresse weiß die App nicht, wer du bist.**

- **MY_ADDRESS** = \`0x…\` (deine Adresse aus der Wallet)  
→ Das ist wie deine Handynummer auf der Blockchain – ohne sie kann das Programm nichts für dich tun.

**Vorher:** Die App kann nichts machen – sie findet dich nicht.

**Nachher:** Du kannst den Tresor nutzen, Nachrichten schicken, Schlüssel ausstellen.

**Beispiel:** Du öffnest deine Wallet-App → kopierst deine Adresse → hier einfügen.

**Setzen?** Ja – das ist der allererste Schritt. Ohne Adresse kommst du nicht weiter!

---

## Speicherort wählen – wo sollen die Schlüssel liegen? (2 von 4)

**Lokal auf dem Gerät oder in der Cloud (auf der Kette)?**

- **VAULT_FILE** = \`.morgendrot-vault\`  
→ Eine Datei auf deiner Festplatte – wie ein Safe in deinem Zimmer. Nur du (mit Passwort) kommst ran.

**Lokal (am einfachsten):**  
VAULT_FILE setzen → dann \`/vault-save\` tippen → Passwort eingeben → Schlüssel werden verschlüsselt in der Datei gespeichert.

**Beispiel:** Du tippst \`/vault-save\` → „Passwort?“ → „geheim123“ → „OK, Schlüssel sind jetzt sicher in der Datei!“

**On-Chain (falls dein Gerät kaputtgeht):**  
VAULT_REGISTRY_ID setzen → \`/vault-onchain\` tippen → Passwort eingeben → Schlüssel gehen verschlüsselt auf die Kette.

**Beispiel:** \`/vault-onchain\` → „Passwort?“ → „geheim123“ → „Tresor ist jetzt auf der Kette gespeichert!“

**Vorher:** Ohne Speicherort verlierst du bei jedem Neustart die Schlüssel → du musst mit jedem Partner neu verbinden.

**Nachher:** Beim nächsten Start gibst du nur das Passwort ein → alles ist sofort wieder da.

**Setzen?** Ja – mach das möglichst früh. Lokal ist für den Anfang super, On-Chain für langfristige Sicherheit.

---

## Keys speichern – mach das nach dem ersten Chat! (3 von 4)

**Die Schlüssel in den Tresor legen.**

- **/vault-save** → Schlüssel lokal speichern (Passwort eingeben)  
→ Die App nimmt deine geheimen Schlüssel und verschlüsselt sie mit deinem Passwort in der Datei.

**Vorher:** Bei Neustart sind die Schlüssel weg → neuer Handshake nötig → Chat mit Partnern geht kaputt.

**Nachher:** Beim nächsten Start fragst du nur noch nach dem Passwort → die App holt die Schlüssel aus der Datei → alles läuft weiter.

**Beispiel:** Du chattest mit jemandem → tippst \`/vault-save\` → „Passwort?“ → „meinpasswort“ → „Schlüssel gespeichert!“

- **/vault-onchain** → Schlüssel auf der Kette speichern (VAULT_REGISTRY_ID nötig)  
→ Schlüssel gehen verschlüsselt auf die Kette – sicherer, falls die Festplatte kaputtgeht.

**Beispiel:** \`/vault-onchain\` → „Passwort?“ → „meinpasswort“ → „Tresor ist jetzt auf der Kette!“

**Setzen?** Ja – mach das nach jedem neuen Chat oder Key-Wechsel. Ohne das musst du bei jedem Neustart neu verbinden.

---

## Folgeoptionen – Notfall (4 von 4)

**Wenn etwas Schlimmes passiert: Tresor sofort löschen.**

- **/emergency-purge** → Vault Notfall-Löschung (sofort alles weg)  
→ Wenn dein Gerät gestohlen wird oder jemand dein Passwort geknackt hat → du sagst der App: „Mach den Tresor sofort kaputt!“

**Vorher:** Die Schlüssel sind noch da → jemand könnte sie missbrauchen.

**Nachher:** Der Tresor ist weg – niemand kommt mehr rein.

**Beispiel:** Du merkst, dein Laptop wurde geklaut → tippst \`/emergency-purge\` → alles ungültig.

**Dafür brauchst du:** VAULT_REGISTRY_ID + ENABLE_PURGE = true

**Ausführen?** Ja – das ist dein Notfall-Knopf. Nutz ihn nur, wenn wirklich etwas passiert ist!

---

## Minimal-Beispiel (.env)

\`\`\`env
MY_ADDRESS=0x671bf669…
VAULT_FILE=.morgendrot-vault
\`\`\`

Nach dem ersten \`/connect\` oder Handshake: \`/vault-save\` tippen → Passwort eingeben → Schlüssel sind sicher.
`,
    'CAR-SHARING-EINRICHTEN.md': `# Morgendrot – Car-Sharing / E-Scooter-Zugang einrichten

Zahlung oder Schlüssel → Freischaltung. Du richtest ein „Schloss“ ein (Roller, Auto, Ladesäule), und entscheidest: Öffnet sich nur bei Zahlung? Nur mit Schlüssel? Oder beides?

**6 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Modell wählen (1 von 6)

**Wie soll sich das Fahrzeug / die Ladesäule freischalten?**

**Drei Möglichkeiten:**

**Nur Zahlung:** Jemand zahlt → Tür oder Roller geht automatisch auf.  
→ **PAYMENT_TRIGGER_ENABLED** = \`true\`  
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

- **ROLE** = \`lock\`  
→ Das ist wie ein Namensschild: „Ich bin jetzt das Schloss.“

- **MY_ADDRESS** = \`0x…\` (Adresse des Fahrzeugs oder der Ladesäule)  
→ Das ist die Adresse, an die Zahlungen gehen und die Schlüssel prüft.

**Beispiel:** Dein E-Scooter hat die Adresse 0x0748… → ROLE=lock + MY_ADDRESS=0x0748… → die App weiß: „Ich steuere diesen Roller.“

**Setzen?** Ja – ohne ROLE=lock macht die App keinen Lock-Modus.

---

## Öffnen-Aktion festlegen (3 von 6)

**Was soll passieren, wenn jemand zahlt oder den Schlüssel nutzt?**

- **OPEN_COMMAND** = \`node relay-on.js\`  
→ Ein Programm starten (z. B. Relais am Schloss).

**Beispiel:** Du hast ein Relais am Roller-Schloss → das Skript schaltet es ein → Schloss öffnet sich.

- **OPEN_URL** = \`http://192.168.1.123/open\`  
→ Einen Link im Internet aufrufen (z. B. API des Rollers).

**Beispiel:** Der Roller hat eine Webseite → bei „open“ wird die Seite aufgerufen → er entriegelt sich.

**Setzen?** Ja – ohne das tut sich nichts. Nimm OPEN_COMMAND oder OPEN_URL (oder beides).

---

## Zahlungs-Trigger (4 von 6)

**Soll sich bei Zahlung automatisch etwas öffnen?**

- **PAYMENT_TRIGGER_ENABLED** = \`true\` oder \`false\`  
→ Wenn true: Jemand zahlt z. B. 0,001 IOTA an deine Adresse (+ evtl. Code) → Tür/Roller geht auf.

- **PAYMENT_TRIGGER_MIN_IOTA** = \`0.001\`  
→ Ab welchem Betrag wird geöffnet?

- **PAYMENT_TRIGGER_REQUIRE_MEMO** = \`LADE4711\`  
→ Das Memo (Nachricht zur Zahlung) muss diesen Code enthalten – z. B. Buchungsnummer.

**Beispiel:** Jemand zahlt 0,001 IOTA mit Memo „LADE4711“ → Ladesäule gibt Strom frei.

**Setzen?** Nein – nur wenn du „Zahlung als Schlüssel“ willst.

---

## Temporärer Key (5 von 6)

**Schlüssel für begrenzte Zeit ausstellen.**

- **/create-key** \`0xRoller 0xMieter 1\`  
→ Einen Schlüssel für 1 Tag: Roller-Adresse, Mieter-Adresse, 1 Tag.

**Beispiel:** Du stellst für einen Mieter einen Schlüssel aus → er kann 1 Tag fahren.

**Setzen?** Nein – nur wenn du zusätzlich Schlüssel nutzen willst (z. B. für Abo-Mieter).

---

## Streams – schneller Zusatzweg (6 von 6)

**Soll bei „öffnen“ zusätzlich ein schneller Kanal genutzt werden?**

- **OPEN_STREAMS_ENABLED** = \`true\` oder \`false\`  
→ Wenn true: Zusätzlich zur normalen Kette wird eine schnelle Nachricht geschickt – oft unter einer Sekunde.

**Beispiel:** Normale Kette braucht 5 Sekunden → mit Streams geht „Entriegeln“ in 0,5 Sekunden.

**Setzen?** Nein – nur wenn du Echtzeit brauchst.

---

## Minimal-Beispiel

**Nur Zahlung (.env):**
\`\`\`env
ROLE=lock
MY_ADDRESS=0x0748…
OPEN_URL=http://192.168.1.123/open
PAYMENT_TRIGGER_ENABLED=true
PAYMENT_TRIGGER_MIN_IOTA=0.001
\`\`\`

**Nur Key (.env):**
\`\`\`env
ROLE=lock
MY_ADDRESS=0x0748…
OPEN_COMMAND=node relay-on.js
OPEN_COMMAND_WORDS=open,öffnen
\`\`\`

Danach: \`/create-key 0x0748… 0xMieter… 1\` → Schlüssel für 1 Tag.

Damit hast du entweder Zahlung → Freischaltung oder Key → Freischaltung (oder beides).
`,
    'BOSS-MODUS.md': `# Morgendrot – Boss-Modus: Maschinen ohne Wallet einrichten

Maschinen (Schlösser, Roboter, Sensoren) brauchen normalerweise ein eigenes Wallet und Passwort. Im Boss-Modus hast nur du (der Boss) ein Wallet – die Maschinen haben nur eine Adresse und sagen: „Der Boss unterschreibt für mich.“ So musst du keine Passwörter auf jeder Maschine verwalten.

**5 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Boss: Adressen erstellen (1 von 5)

**Du erzeugst für jede Maschine eine eigene Adresse – wie Handynummern für deine Geräte.**

Mit dem IOTA-CLI (oder ähnlich) legst du Adressen an, z. B. \`iota client new-address\`. Jede Maschine bekommt eine Adresse, aber kein eigenes Wallet und kein Passwort – du verwaltest alles.

**Vorher:** Keine Adressen → Maschinen können nichts empfangen oder senden.

**Nachher:** Du hast z. B. 5 Adressen für 5 Schlösser → du gibst sie den Maschinen und behältst die Kontrolle.

**Beispiel:** Du tippst im Terminal den Befehl für eine neue Adresse → sie wird angezeigt → notier sie dir für die Maschine.

**Setzen?** Ja – mach das als Erstes. Jede Maschine braucht ihre eigene Adresse.

---

## Boss: Signer-Service starten (2 von 5)

**Du wirst der „Unterschreiber“ für alle Maschinen.**

- **npm run boss-signer**  
→ Ein Programm läuft auf deinem Rechner. Die Maschinen schicken dir fertige Befehle (z. B. „Tür öffnen“), du prüfst und unterschreibst – oder sagst Nein.

**Vorher:** Jede Maschine müsste selbst unterschreiben (braucht Seed/Passwort).

**Nachher:** Maschinen schicken dir die Transaktion → du entscheidest → unterschreibst (oder nicht).

**Beispiel:** Du startest den Service → eine Maschine schickt „open die Tür“ → du siehst „Unterschreiben? (y/n)“ → y → Befehl geht durch.

**Setzen?** Ja – starte den Service auf deinem PC oder Pi – er läuft dann im Hintergrund (z. B. Port 3340).

---

## Maschine: Nur Adresse + .env (3 von 5)

**Auf der Maschine: Kein Wallet, kein Passwort – nur drei Dinge in der .env.**

- **SIGNER** = \`remote\`  
→ „Ich lass den Boss unterschreiben.“

- **REMOTE_SIGNER_URL** = \`https://boss.example:3340/sign\`  
→ Wo dein Boss-Signer läuft (die Adresse im Netzwerk).

- **MY_ADDRESS** = \`0x…\` (die Adresse, die du der Maschine gegeben hast)  
→ Das ist die „Handynummer“ dieser Maschine.

**Vorher:** Jede Maschine bräuchte eigenes Wallet → kompliziert und unsicher.

**Nachher:** Maschine schickt Befehle an den Boss-Signer → der Boss entscheidet.

**Beispiel:** Maschine startet → schickt an Boss „open“ → Boss prüft und unterschreibt → Tür geht auf.

**Setzen?** Ja – jede Maschine braucht SIGNER=remote + REMOTE_SIGNER_URL + ihre MY_ADDRESS.

---

## Handshake beim Provisioning (4 von 5)

**Damit die Maschine verschlüsselt reden kann – optional.**

Du (Boss) schickst im Namen der Maschine einen Handshake an einen Partner. Die Maschine muss dann nur noch /connect machen (oder du machst es einmal für sie).

- **boss-provision-handshake:**  
  \`npx tsx scripts/boss-provision-handshake.ts --address 0x…Maschine --partner 0x…Partner --pubkey <base64>\`  
→ Du schickst „Hallo“ von der Maschine an den Partner.

- **Maschine macht /connect:**  
→ Handshake vom Partner abholen.

**Vorher:** Maschine müsste selbst Handshake machen (braucht App oder Terminal).

**Nachher:** Boss macht Handshake → Maschine kann später verschlüsselt antworten.

**Setzen?** Nein – nur wenn die Maschine verschlüsselt reden soll. Für reine Status-Meldungen reicht oft Klartext.

---

## Folgeoptionen (5 von 5)

**Lock ohne Signer:** ROLE=lock – das Schloss hört nur zu, braucht keine eigene Signatur.  
→ Beispiel: Schloss liest nur die Kette → kein eigenes Wallet nötig.

**Ameisen-Maschinen:** ROLE=arbeiter, BOSS_ADDRESS, KOMMANDANT_ADDRESSES  
→ Maschine hört auf Boss oder Kommandanten – Hierarchie wie in einem Ameisenhaufen.

**Setzen?** Nein – das ist für spezielle Fälle (z. B. viele einfache Geräte mit einem Boss).

---

## Minimal-Beispiel

**Boss:** Keystore mit Adressen für Maschinen anlegen, dann \`npm run boss-signer\` starten.

**Maschine (.env):**
\`\`\`env
SIGNER=remote
REMOTE_SIGNER_URL=https://boss.example:3340/sign
MY_ADDRESS=0x…   # vom Boss vergeben
ROLE=lock
\`\`\`

Damit hat die Maschine keine eigene Wallet – der Boss unterschreibt alles.
`,
    'LEIHGERAETE-EINRICHTEN.md': `# Morgendrot – Temporäre Leihgeräte einrichten

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
→ **PAYMENT_TRIGGER_ENABLED** = \`true\`

**Zahlung + Key:** Schlüssel wird erst nach Zahlung ausgestellt (am sichersten und fairsten).  
→ Beispiel: Jemand zahlt → dein Backend prüft die Zahlung → stellt Schlüssel aus → Gerät geht auf.

**Setzen?** Ja – wähle eine Variante. „Zahlung + Key“ ist am sichersten.

---

## Geräte-Lock einrichten (2 von 6)

**Der App sagen: Ich bin das Leihgerät!**

- **ROLE** = \`lock\`  
→ Das ist wie ein Namensschild: „Ich bin jetzt die Powerbank-Station / der Werkzeug-Schrank.“

- **MY_ADDRESS** = \`0x…\` (Adresse des Leihgeräts)  
→ Das ist die Adresse, die Zahlungen oder Schlüssel prüft.

- **LOCK_ID** = \`0x…\` (meist = MY_ADDRESS)  
→ Die „ID“ des Geräts, die in den Schlüsseln steht.

**Beispiel:** Deine Powerbank-Station hat die Adresse 0x0748… → ROLE=lock + MY_ADDRESS=0x0748… + LOCK_ID=0x0748… → die App weiß: „Ich steuere diese Station.“

**Setzen?** Ja – ohne ROLE=lock macht die App keinen Lock-Modus.

---

## Key ausstellen (3 von 6)

**Einen temporären Schlüssel für den Mieter ausstellen.**

- **/create-key** \`0xGerät 0xMieter 1\`  
→ Ein Schlüssel für 1 Tag: Geräte-Adresse, Mieter-Adresse, 1 Tag.

**Vorher:** Niemand kann das Gerät nutzen.

**Nachher:** Mieter bekommt Schlüssel → kann das Gerät für 1 Tag nutzen.

**Möglichkeiten:**  
- **Ein Key:** \`/create-key 0xPowerbank 0xMieter 1\` → Schlüssel für 1 Tag.  
- **Mehrere Keys:** \`/create-keys 0xPowerbank 0xMieter 1 5\` → 5 Schlüssel für 1 Tag (z. B. für 5 Mieter).

**Setzen?** Nein – nur wenn du gerade verleihst. Einfach den Befehl ausführen.

---

## Nach Rückgabe: Key löschen (4 von 6)

**Gerät wieder frei machen – Schlüssel ungültig.**

- **/purge-key** \`keyId\`  
→ Schlüssel löschen. Die keyId findest du im Event oder im Explorer (Objekt-ID des Keys).

**Vorher:** Schlüssel bleibt gültig → Mieter könnte später nochmal nutzen.

**Nachher:** Schlüssel ist weg → Gerät ist wieder frei + du bekommst Speicher-Gebühr zurück (Rebate).

**Beispiel:** Mieter bringt Powerbank zurück → du tippst /purge-key 0xKeyId → Schlüssel ungültig.

**Dafür brauchst du:** PACKAGE_ID, keyId, ENABLE_PURGE=true

**Setzen?** Ja – mach das immer nach Rückgabe.

---

## Bei Verlust: Notfall-Purge (5 von 6)

**Schlüssel sofort ungültig machen.**

- **/emergency-purge-key** \`keyId\`  
→ Schlüssel sofort widerrufen (Notfall-Flag setzen).

**Vorher:** Schlüssel ist noch gültig → bei Verlust könnte jemand das Gerät nutzen.

**Nachher:** Schlüssel ist sofort ungültig → niemand kann mehr rein.

**Beispiel:** Powerbank verloren → /emergency-purge-key 0xKeyId → sofort gesperrt.

**Danach:** /purge-key \`keyId\` → Schlüssel komplett von der Kette löschen.

**Setzen?** Ja – das ist dein Notfall-Knopf.

---

## Zahlungs-Trigger (6 von 6)

**Soll sich das Gerät auch bei Zahlung öffnen?**

- **PAYMENT_TRIGGER_ENABLED** = \`true\` oder \`false\`  
→ Wenn true: Jemand zahlt z. B. 0,001 IOTA an die Geräte-Adresse → Gerät öffnet sich (z. B. Powerbank-Station).

**Beispiel:** Jemand zahlt an der Station → Powerbank entriegelt sich.

**Setzen?** Nein – nur wenn du „Zahlung als Schlüssel“ willst.

---

## Minimal-Beispiel

**Ein Key:** \`/create-key 0xGerät 0xMieter 1\`  
**Mehrere Keys:** \`/create-keys 0xGerät 0xMieter 1 5\` (5 Stück, 1 Tag)

Nach Rückgabe: \`/purge-key keyId\`. Bei Verlust: \`/emergency-purge-key keyId\`, danach \`/purge-key keyId\`.
`,
    'FAMILIEN-ZUGANG.md': `# Morgendrot – Familien- / Firmen-Zugang einrichten

Mehrere Leute sollen rein dürfen – Familie, Firma, WG. Du entscheidest: Nur eine feste Liste (Whitelist)? Nur temporäre Schlüssel (Keys)? Oder beides – Stammnutzer immer, Gäste nur mit Key?

**6 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Modell wählen (1 von 6)

**Wer darf wie rein?**

**Nur Whitelist:** Nur bestimmte Adressen dürfen „öffnen“ sagen – einfach und schnell.  
→ **AUTHORIZED_SENDERS** = \`0x…,0x…\`  
→ Beispiel: Familie hat 4 Adressen → nur diese 4 dürfen die Tür öffnen.

**Nur AccessKey:** Jeder braucht einen Schlüssel (NFT) – keine feste Liste.  
→ **/create-key** \`0xSchloss\` \`0xFamilienmitglied\` \`30\`  
→ Beispiel: Jeder bekommt seinen eigenen Schlüssel für 30 Tage – flexibel für Gäste.

**Whitelist + AccessKey:** Whitelist für Stammnutzer (Familie), Keys für Gäste.  
→ Beispiel: Familie darf immer (Whitelist), Handwerker nur 1 Tag (Key).

**Setzen?** Ja – wähle eine Variante. „Whitelist + Key“ ist am flexibelsten und sichersten.

---

## Schloss einrichten (2 von 6)

**Der App sagen: Ich bin das Schloss!**

- **ROLE** = \`lock\`  
→ Das ist wie ein Namensschild: „Ich bin jetzt das Schloss.“

- **MY_ADDRESS** = \`0x…\` (Adresse des Schlosses / der Tür)  
→ Das ist die Adresse, die prüft, wer rein darf.

**Beispiel:** Dein Haus-Schloss hat die Adresse 0x0748… → ROLE=lock + MY_ADDRESS=0x0748… → die App weiß: „Ich steuere diese Tür.“

**Setzen?** Ja – ohne ROLE=lock macht die App keinen Schloss-Modus.

---

## Whitelist – wer darf immer rein? (3 von 6)

**Feste Liste: Nur diese Leute dürfen ohne extra Schlüssel.**

- **AUTHORIZED_SENDERS** = \`0x…,0x…\` (mit Komma getrennt)  
→ Das ist wie eine Gästeliste: „Nur diese Leute dürfen die Tür öffnen.“

**Vorher:** Jeder mit einem Schlüssel kommt rein – auch Fremde.

**Nachher:** Nur die in der Liste dürfen – extra Sicherheit.

**Beispiel:** Familie hat 4 Adressen → AUTHORIZED_SENDERS=0xPapa,0xMama,0xKind1,0xKind2 → nur sie dürfen ohne Key.

**Setzen?** Nein – nur wenn du feste Nutzer hast. Leer = alle mit gültigem Key dürfen.

---

## Öffnen-Wörter festlegen (4 von 6)

**Welche Nachricht öffnet die Tür?**

- **OPEN_COMMAND_WORDS** = \`open,öffnen,aufmachen\`  
→ Welche Wörter lösen „öffnen“ aus? (mit Komma getrennt)

**Vorher:** Nur „open“ funktioniert.

**Nachher:** Auch „öffnen“ oder „aufmachen“ öffnet die Tür – praktisch für Familie.

**Beispiel:** Kind schreibt „öffnen bitte“ → Tür geht auf.

**Setzen?** Nein – fang mit den Standard-Wörtern an. Rest ist Extra-Komfort.

---

## Einzelne Keys für Gäste (5 von 6)

**Temporärer Zugang für Handwerker, Gäste usw.**

- **/create-key** \`0xSchloss\` \`0xGast\` \`7\`  
→ Einen Schlüssel für 7 Tage: Schloss-Adresse, Gast-Adresse, 7 Tage.

**Vorher:** Nur feste Nutzer (Whitelist) kommen rein.

**Nachher:** Gäste bekommen temporären Schlüssel → nach 7 Tagen automatisch ungültig.

**Beispiel:** Handwerker kommt → /create-key 0xSchloss 0xHandwerker 1 → er kann 1 Tag rein.

**Setzen?** Nein – nur wenn du Gäste hast. Einfach den Befehl ausführen.

---

## An alle – Status (6 von 6)

**Sollen alle in der Gruppe sehen, wenn die Tür geöffnet wurde?**

- **ENABLE_BROADCAST_PINNWAND** = \`true\` oder \`false\`  
→ Wenn true: Status wie „Tür geöffnet“ geht an alle (Pinnwand).

**Vorher:** Status geht nur an Einzelpersonen.

**Nachher:** Alle in der Gruppe sehen „Tür geöffnet“, „Alarm aus“ usw.

**Beispiel:** Tür geht auf → alle Familienmitglieder bekommen Status „Tür offen“.

**Setzen?** Nein – nur wenn du Status für alle brauchst.

---

## Minimal-Beispiel (.env)

**Nur Whitelist:**
\`\`\`env
ROLE=lock
MY_ADDRESS=0x0748…
AUTHORIZED_SENDERS=0xPapa…,0xMama…,0xKind1…,0xKind2…
OPEN_COMMAND=node relay-on.js
OPEN_COMMAND_WORDS=open,öffnen
\`\`\`

**Whitelist + Key:** Wie oben, zusätzlich bei Gästen: \`/create-key 0x0748… 0xHandwerker… 1\` → Gast für 1 Tag.

Damit haben feste Nutzer (Whitelist) immer Zugang – Gäste bekommen temporäre Keys.
`,
    'NOTFALL-DATENSPEICHER.md': `# Morgendrot – Notfall-Datenspeicher einrichten

Verschlüsselte Daten auf der Blockchain – sicher, aber nach einer bestimmten Zeit löschbar. Perfekt für Testament, Patientenverfügung, PINs oder Notfall-Kontakte: Nur du kommst mit Passwort ran, und nach z. B. 365 Tagen kannst du alles löschen (Datenschutz).

**4 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Vault on-chain vorbereiten (1 von 4)

**Der „sichere Tresor“ auf der Blockchain.**

- **VAULT_REGISTRY_ID** = \`0x…\` (Adresse des Tresoren-Registers)  
→ Das ist wie die Adresse eines Bankschließfachs auf der Blockchain. Dort liegen später deine verschlüsselten Daten.

**Vorher:** Ohne diese ID kannst du keine Daten on-chain speichern.

**Nachher:** Du hast einen Platz, wo deine Daten liegen – verschlüsselt, und nur du kommst mit Passwort ran.

**Woher bekommst du die ID?**  
Einmalig \`create_globals\` ausführen (oder schon gemacht) → im Terminal oder Explorer steht VAULT_REGISTRY_ID → hier eintragen.

**Beispiel:** Du tippst den Befehl für create_globals → das Event „GlobalsCreated“ zeigt die ID → kopieren und hier einfügen.

**Setzen?** Ja – das ist der allererste Schritt. Ohne diese ID geht nichts On-Chain.

---

## Daten speichern (2 von 4)

**So legst du etwas Wichtiges in den Tresor.**

- **/vault-onchain**  
→ Du gibst dein Passwort ein → die App verschlüsselt deine Daten (z. B. Gesundheitsdokumente, Testament-Text, PINs) → schickt sie in den Tresor auf der Kette.

**Vorher:** Daten liegen nur lokal auf deinem Gerät → wenn die Festplatte kaputtgeht oder das Gerät verloren geht → alles weg.

**Nachher:** Daten sind auf der Blockchain – sicher verschlüsselt. Nur du mit Passwort kannst sie wieder holen.

**Dafür brauchst du:** VAULT_REGISTRY_ID muss gesetzt sein + Wallet muss Gas haben.

**Beispiel:** Du tippst \`/vault-onchain\` → „Passwort?“ → „geheim123“ → „Daten sind jetzt sicher auf der Kette!“

**Setzen?** Ja – mach das, wenn du etwas wirklich Wichtiges sichern willst (z. B. Testament, Notfall-Kontaktdaten).

---

## TTL setzen – nach wie vielen Tagen löschbar? (3 von 4)

**Wie ein Verfallsdatum für deine Daten.**

- **DEFAULT_TTL_DAYS** = \`30\` oder \`365\`  
→ Nach X Tagen können die Daten gelöscht werden (von dir oder automatisch).

**Vorher:** Daten bleiben ewig auf der Kette (nur verschlüsselt).

**Nachher:** Nach 30 oder 365 Tagen kannst du sie löschen → Datenschutz (DSGVO) + Speicher sparen.

**Beispiel:** Du speicherst ein Testament → setzt 365 Tage → nach einem Jahr kannst du es löschen (oder es wird automatisch ungültig).

**Setzen?** Ja – 30 Tage ist gut für normale Daten, 365 für wichtige Dokumente wie Testament.

---

## Notfall-Purge – sofort alles löschen (4 von 4)

**Wenn etwas Schlimmes passiert: Tresor sofort kaputt machen.**

- **/emergency-purge**  
→ Du sagst der App: „Mach den Tresor sofort kaputt – Notfall!“

**Vorher:** Daten sind noch da → bei Diebstahl oder Passwort-Leck könnte jemand sie missbrauchen.

**Nachher:** Tresor ist weg – niemand kommt mehr ran.

**Beispiel:** Du merkst, dein Gerät wurde geklaut → tippst \`/emergency-purge\` → alles ungültig.

**Dafür brauchst du:** VAULT_REGISTRY_ID + ENABLE_PURGE = true

**Setzen?** Ja – das ist dein Notfall-Knopf. Nutz ihn nur, wenn wirklich etwas passiert ist!

---

## Minimal-Beispiel (.env)

\`\`\`env
MY_ADDRESS=0x…
VAULT_REGISTRY_ID=0x…
DEFAULT_TTL_DAYS=365
ENABLE_PURGE=true
\`\`\`

Nach dem ersten Handshake: \`/vault-onchain\` → Passwort eingeben → Daten sind verschlüsselt on-chain. Bei Notfall: \`/emergency-purge\`.
`,
    'ENV-ERKLAERUNG.md': `# Morgendrot – .env – alles ganz einfach erklärt

Die Datei **.env** ist wie die „Einstellungszentrale“ von Morgendrot: Hier trägst du ein, wer du bist, wo die Blockchain wohnt, ob du Schloss oder Chat bist, und vieles mehr. Alles in einfachen Worten – wie für einen Freund.

**Wichtig: Nach jeder Änderung in der .env die Änderung speichern und das Programm neu starten!**

**Du musst nicht alles setzen – nimm nur, was du für dein Projekt brauchst.** Fang mit „Wer bin ich?“ (MY_ADDRESS, ROLE) und „Internet & Kette“ (RPC_URL, PACKAGE_ID) an.

---

## 🌐 1. Internet & Kette (★ das Erste, was du eintragen musst!)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **RPC_URL** | \`https://api.testnet.iota.cafe\` | Wo die Blockchain wohnt. **testnet** = Spielwiese (kein echtes Geld). **mainnet** = echtes IOTA. Ohne Angabe: Testnet-Default. |

---

## 🔑 2. Programm & Schubladen (★ einmalig nach dem ersten Start setzen)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **PACKAGE_ID** | \`0x7137af6c…\` | Die „Hausnummer“ deines Programms auf der Kette. Nach \`create_globals\` deploy bekommst du sie. Leer → wird aus \`.morgendrot-package-id\` geladen (z.B. nach \`/set-package-id\`). |
| **VAULT_REGISTRY_ID** | \`0xc4ac51a8…\` | Adresse des Tresoren-Schranks (aus \`create_globals\`-Event). Nötig für On-Chain-Vault (\`/vault-onchain\`). |
| **MAILBOX_ID** | \`0xadd744a5…\` | Adresse des Briefkastens (aus \`create_globals\`). Ermöglicht purgbare Nachrichten und Handshakes. Ohne: nur Events (nicht purgbar). |
| **COMMAND_REGISTRY_ID** | \`0xa66e55a8…\` | Liste für geheime Öffnen-Wörter (aus \`create_globals\` oder \`create_command_registry\`). Lock liest von hier, welche Wörter „öffnen“ auslösen. |

---

## 👤 3. Wer bin ich? (★ immer zuerst setzen!)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **MY_ADDRESS** | \`0x671bf669…\` | Meine Adresse (wie meine Handynummer). Ohne sie funktioniert fast nichts. Bei ROLE=lock = Schloss-Adresse. Bei SIGNER=sdk kann leer sein (wird aus Mnemonic abgeleitet). |
| **ROLE** | \`messenger\` | Was bin ich gerade? **messenger** = Chat-Mensch, Key-Verwaltung. **lock** = das Schloss selbst (hört auf „open“). **monitor** = nur Zuschauer (Offline-Alarm). **boss** / **kommandant** / **arbeiter** = Hierarchie-Modus (Ameisen). |

---

## 🤝 4. Mit wem rede ich? (Partner & Gruppen)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **PARTNER_ADDRESS** | \`0x0748329e…\` | Mein Haupt-Gesprächspartner (z.B. das Schloss). Wird automatisch in \`.morgendrot-partner\` gespeichert bei \`/connect\` oder Handshake. |
| **PARTNER_ADDRESSES** | \`0xabc…,0xdef…\` | Mehrere Partner (kommagetrennt). Bei ENABLE_PAIRWISE_GROUPS: jeder mit eigenem Handshake. Teurer, sicherer. |
| **AUTHORIZED_SENDERS** | \`0x671b…,0x0748…\` | Wer darf mir Befehle geben? (kommagetrennt). Leer = keine Zusatz-Whitelist. Lock prüft zusätzlich AccessKey. |
| **BOSS_ADDRESS** | \`0x…\` | Boss-Adresse (nur bei Ameisen-Modus). |
| **KOMMANDANT_ADDRESSES** | \`0x…,0x…\` | Kommandant-Adressen (Ameisen). |
| **WORKER_ADDRESSES** | \`0x…,0x…\` | Arbeiter-Adressen (Ameisen). |
| **BROADCAST_PINNWAND_ADDRESS** | \`0x…\` | Adresse der Pinnwand (alle hören hier). Nur bei ENABLE_BROADCAST_PINNWAND. |
| **BROADCAST_AUTHORIZED_SENDERS** | \`0x…,0x…\` | Nur diese dürfen an die Pinnwand senden. **Pflicht** bei Broadcast. |

**Ameisen-Hierarchie (boss/kommandant/arbeiter):** Wer darf was, steuerst du mit diesen Flags (alle default true). Siehe Tabelle in **M2M-KOORDINATION-EINRICHTEN.md** (Wer darf was?).

| Variable | Default | Bedeutung |
|----------|---------|-----------|
| **ENABLE_COMMAND_DOWN** | \`true\` | Befehl senden (Boss/Kommandant). |
| **ENABLE_KEY_ISSUE** | \`true\` | Schlüssel ausstellen (nur Boss). |
| **ENABLE_REVOKE_DOWN** | \`true\` | Widerruf/Sperren (Boss, Kommandant). |
| **ENABLE_STATUS_READ_DOWN** | \`true\` | Status von unten lesen. |
| **ENABLE_STATUS_READ_UP** | \`true\` | Status von oben lesen (Arbeiter/Kommandant). |
| **ENABLE_CONFIG_CHANGE** | \`true\` | Konfig ändern (nur Boss). |
| **ENABLE_HIERARCHY_CHANGE** | \`true\` | Hierarchie ändern (nur Boss). |

---

## 🛡️ 5. Wie sicher soll es sein?

| Variable | Default | Was bedeutet das? |
|----------|---------|-------------------|
| **ENABLE_PLAINTEXT_CHANNEL** | \`false\` | Darf ich auch Klartext senden? **true** = im Explorer sichtbar. Nur für Tests! |
| **ENABLE_PURGE** | \`true\` | Darf ich alte Daten löschen? **false** = alle Purge-Befehle werden abgelehnt. |
| **ENABLE_REPLAY_PROTECTION** | \`true\`* | Alte Befehle blockieren? (Nonce pro Sender). *Wenn REPLAY_STATE_FILE gesetzt. |
| **REPLAY_STATE_FILE** | (leer) | Datei für letzte Nonce pro Sender. Leer = nur in-memory (kein Schutz nach Neustart). |
| **USE_ENCRYPTED_DISCOVERY** | \`false\` | Discovery über verschlüsselte Kanäle (z.B. Streams). Geplant. |

---

## ⚡ 6. Was soll automatisch laufen? (Schalter für Bequemlichkeit)

| Variable | Default | Was bedeutet das? |
|----------|---------|-------------------|
| **ENABLE_LISTENER** | \`true\` | Auf Nachrichten warten und reagieren? **false** = keine eingehenden Nachrichten, Lock reagiert nicht. **→ Ausschalten für maximale Sicherheit!** |
| **ENABLE_AUTO_EXECUTE** | \`true\` | Befehle automatisch ausführen? **false** = nur anzeigen, nicht ausführen (Kill-Switch). Lock: „open“ wird nicht ausgeführt. **→ Ausschalten für maximale Sicherheit!** |
| **ENABLE_HARDWARE_OPEN** | \`true\`* | Relais / Web-Link bei „open“ aufrufen? **false** = nur Log, keine Aktion. *Wenn OPEN_COMMAND oder OPEN_URL gesetzt. **→ Ausschalten wenn nur Chat/Status!** |
| **ENABLE_FILE_LOGGING** | \`true\` | Alles in eine Log-Datei schreiben? **false** = nur Konsole. |
| **ENABLE_FETCH_COMMAND** | \`true\` | Befehl „hole letzten N“ / \`/fetch N“ erlauben. |
| **FETCH_LAST_ON_START** | \`0\` | Beim Start (nach /connect) die letzten N Nachrichten holen. 0 = aus. Für Maschinen z.B. 20. |
| **USE_MAILBOX** | \`true\`* | Purgebare Nachrichten (Mailbox statt nur Events). *Wenn MAILBOX_ID gesetzt. |
| **MAX_SEND_AMOUNT_IOTA** | (leer) | Max. IOTA pro Sendung (zukünftig). Leer = kein Limit. |

---

## ⏱️ 7. Wie schnell & wie lange? (Zeit-Einstellungen)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **DEFAULT_TTL_DAYS** | \`30\` | Nachrichten / Vault leben X Tage (danach purgebar). |
| **DEFAULT_KEY_TTL_DAYS** | \`30\` | Standard-Gültigkeit für AccessKey-NFTs (Tage). \`/create-key\` nutzt dies, wenn kein ttl angegeben. |
| **LISTENER_POLL_MS** | \`5000\` | Alle X Millisekunden die Kette anschauen (5000 = 5 Sekunden). Min. 1000. |
| **HANDSHAKE_REFRESH_MS** | \`5000\` | Handshake-Update-Intervall (ms). |
| **LOCK_COMMAND_POLL_MS** | \`3000\` | Lock: Abstand für Befehls-Poll (ms). |
| **LOCK_PEER_REFRESH_MS** | \`15000\` | Lock: Abstand für Peer-Update (ms). |
| **HEARTBEAT_INTERVAL_MS** | \`600000\` | Alle X ms „Ich bin noch da“ melden (600000 = 10 Min). |
| **PAYMENT_TRIGGER_POLL_MS** | \`15000\` | Abstand Zahlungs-Prüfungen (ms). |
| **MONITOR_OFFLINE_TIMEOUT_MS** | \`1800000\` | Timeout bis Offline-Alarm (30 Min). |
| **MONITOR_CHECK_INTERVAL_MS** | \`300000\` | Abstand Offline-Prüfungen (5 Min). |
| **ANCHOR_INTERVAL_MS** | \`86400000\` | Abstand zwischen Chain-Anchors (24h). |

---

## 🔧 8. Tür & Hardware (physische Aktionen)

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **LOCK_ID** | \`0x…\` | Adresse meines Schlosses (meist = MY_ADDRESS bei ROLE=lock). |
| **OPEN_COMMAND** | \`node relay-on.js\` | Was soll passieren bei „open“? (z.B. Relais-Skript). Wird per spawn ohne Shell ausgeführt. **Nur in .env setzen, nicht per UI!** |
| **OPEN_URL** | \`http://192.168.1.123/open\` | Web-Link, der bei „open“ aufgerufen wird (z.B. Smart-Lock). **Nur in .env setzen!** |
| **OPEN_COMMAND_WORDS** | \`open,öffnen\` | Wörter die „öffnen“ auslösen (kommagetrennt, Kleinbuchstaben). Default: open,öffnen. |
| **OPEN_COMMAND_LIST_FILE** | (leer) | AES-Datei mit Öffnen-Wörtern (Priorität vor .env). |
| **OPEN_COMMAND_LIST_KEY** | (64 Hex) | 32-Byte-Key für AES-Datei. |
| **OFFLINE_OPEN_ENABLED** | \`false\` | OPEN mit gecachtem AccessKey erlauben (ohne Internet). |
| **OFFLINE_CACHE_TTL_MS** | \`86400000\` | Gültigkeit AccessKey-Cache (24h). |
| **OFFLINE_QUEUE_FILE** | (leer) | Datei für Offline-Befehls-Queue. |

**Mehr dazu:** Was „offline“ bedeutet und welche Möglichkeiten es gibt (Cache, Queue, Streams, LoRa), steht in **OFFLINE-FAEHIGKEIT.md**.

---

## 🌐 9. Streams (schneller, geheimer Zusatzkanal – optional)

| Variable | Default | Was bedeutet das? |
|----------|---------|-------------------|
| **OPEN_STREAMS_ENABLED** | \`false\` | Bei „open“ auch Streams nutzen? (schneller & günstiger). Sendet Status nach OPEN GRANTED. |
| **STREAMS_LISTEN_ENABLED** | \`false\` | Lock empfängt „open“ auch von Streams (zusätzlich zu Rebased). Bei Ausfall: Fallback auf Rebased. |
| **STREAMS_ANCHOR_ID** | (leer) | ID des Streams-Kanals (wenn aktiviert). |
| **STREAMS_BRIDGE_URL** | (leer) | HTTP-Bridge (z.B. LoRa-Bridge: \`http://localhost:9342\`). Leer = Stub. |
| **STREAMS_TOPIC** | (leer) | Streams-Topic (optional). |

**Was passiert bei true vs. false (Streams)?**

| Flag | Was passiert bei „open“-Befehl? | Streams wird gesendet? | Rebased wird genutzt? | Fallback bei Streams-Ausfall? |
|------|--------------------------------|------------------------|------------------------|-------------------------------|
| **false** (Default) | Nur Rebased + Hardware (Relais/URL) | Nein | Ja (Hauptweg) | – |
| **true** | Rebased + Hardware + zusätzlich Streams | Ja (zusätzlich) | Ja (Hauptweg) | Ja – fällt automatisch auf Rebased zurück |

---

## 💳 10. Zahlung & Trigger (z.B. Ladesäule)

| Variable | Default | Was bedeutet das? |
|----------|---------|-------------------|
| **PAYMENT_TRIGGER_ENABLED** | \`false\` | Bei Zahlung an Lock-Adresse OPEN auslösen? |
| **PAYMENT_TRIGGER_MIN_IOTA** | (leer) | Mindestbetrag (IOTA, z.B. \`0.001\`). Leer = jede Zahlung. |
| **PAYMENT_TRIGGER_REQUIRE_MEMO** | (leer) | Memo muss Code enthalten (Substring). Leer = keine Prüfung. |
| **PAYMENT_TRIGGER_STATE_FILE** | (leer) | Datei für verarbeitete TX (Replay-Schutz). |

---

## 📂 11. Dateien, Signer & UI

| Variable | Beispiel | Was bedeutet das? |
|----------|----------|-------------------|
| **VAULT_FILE** | \`.morgendrot-vault\` | Mein verschlüsselter Tresor (lokal). Leer = aus. |
| **REPLAY_STATE_FILE** | \`.morgendrot-replay-state\` | Alte Nummern speichern (gegen Wiederholung). |
| **GAS_BUDGET** | \`10000000\` | Wie viel Gas pro Befehl (meist ok so lassen). |
| **SIGNER** | \`cli\` | **cli** = IOTA-CLI (lokal). **remote** = Boss-Service signiert. **sdk** = Mnemonic im Prozess (keine CLI nötig). |
| **REMOTE_SIGNER_URL** | \`https://boss.example:3340/sign\` | URL des Boss-Signer-Services. Nur bei SIGNER=remote. |
| **REMOTE_SIGNER_TOKEN** | (leer) | Bearer-Token für REMOTE_SIGNER_URL. **Nur in .env setzen!** |
| **WALLET_DERIVATION_PATH** | (leer) | Ableitungspfad (nur bei SIGNER=sdk). Leer = Default. |
| **ENABLE_UI** | \`false\` | Web-Oberfläche im Browser starten? |
| **UI_PORT** | \`3341\` | Auf welchem Port die Web-Seite läuft (localhost:3341). |
| **API_PORT** | \`3342\` | Port der API (Befehle, Status). |

---

## 📊 12. Monitoring & Wartung

| Variable | Default | Was bedeutet das? |
|----------|---------|-------------------|
| **ENABLE_HEARTBEAT** | \`false\` | Lock sendet Heartbeat via Streams („ich bin online“). |
| **ENABLE_MONITOR** | \`false\` | Bei ROLE=messenger zusätzlich Offline-Monitor (Heartbeat + Webhook) im Hintergrund. So kannst du Messenger und Monitor in einer Instanz nutzen. |
| **MONITOR_DEVICES** | (leer) | Geräte-Adressen für Offline-Monitor (kommagetrennt). Für ROLE=monitor oder ENABLE_MONITOR=true. |
| **MONITOR_STATE_FILE** | (leer) | Datei für letzten Heartbeat pro Gerät. |
| **MONITOR_ALARM_WEBHOOK_URL** | (leer) | Webhook bei Offline-Alarm. **Nur in .env setzen!** |
| **ENABLE_CHAIN_ANCHOR** | \`false\` | Zustands-Hash on-chain anker. |
| **ENABLE_FILE_LOGGING** | \`true\` | Logs in Dateien schreiben. |
| **LOG_VERBOSE** | \`false\` | Ausführliche Logs. |
| **LOG_MAX_FILES** | \`7\` | Max. Log-Dateien (Rotation). |
| **LOG_MAX_SIZE** | \`20m\` | Max. Größe pro Log-Datei. |

---

## 🛑 Was genau passiert bei true vs. false? (Sicherheits-Schalter)

| Flag | Was passiert bei „open“-Befehl? | Risiko | Wann empfohlen? |
|------|--------------------------------|--------|-----------------|
| **ENABLE_AUTO_EXECUTE=false** | Listener zeigt Nachrichten nur noch an – führt aber nichts aus | **0** | Immer, wenn maximale Sicherheit (Produktion, echtes Schloss) |
| **ENABLE_LISTENER=false** | Kein Empfang mehr – Instanz hört gar nichts | **0** | Wenn nur zum Senden genutzt (z.B. nur als „Schlüssel“ ohne Rückkanal) |
| **ENABLE_HARDWARE_OPEN=false** | OPEN_COMMAND/OPEN_URL wird nicht ausgeführt | **Sehr niedrig** | Wenn nur Chat/Status, keine physischen Aktionen |

**Um die Gefahr auf null zu bringen, reicht es, eine dieser drei Dinge zu deaktivieren.**

---

## 📖 Weitere Infos

- **docs/CONFIG-REFERENCE.md** – technische Referenz
- **docs/STREAMS-INTEGRATION.md** – Streams letzte Meile, Ablauf, Fallback
- **.env.example** – alle Variablen mit Defaults
`,
    'STREAMS-INTEGRATION.md': `# IOTA Streams – Integration in Morgendrot

**In einfachen Worten:** Streams ist wie ein **schneller, günstiger Zusatzkanal**. Die normale Kette (Rebased) bleibt für alles Wichtige zuständig: Wer darf was, Schlüssel, Löschen, Zahlung. Streams übernimmt nur den **schnellen Transport** zum Gerät – z. B. „Tür auf“ in unter einer Sekunde, fast ohne Kosten. Du ersetzt also nichts, du ergänzt: Berechtigung und Kontrolle auf der Kette, Übertragung zum Gerät schnell und günstig.

**Wann lohnt sich Streams?** Wenn du Echtzeit brauchst (z. B. Schranke, Roboter-Stopp) oder viele Nachrichten (z. B. Sensordaten) und die normale Kette dafür zu langsam oder zu teuer wäre.

---

Konkret und realistisch: Wie ein **Streams-ähnlicher Kanal** (feeless, niedrige Latenz, metadatenarm) dein bestehendes System **ergänzt**, ohne es zu ersetzen. Wo es eingreift, was weiterhin Rebased macht, und wie du es minimal einbaust.

---

## 1. Dein System heute (Kurz)

| Komponente | Rolle |
|------------|--------|
| **Rebased + Move** | Vault, Mailbox, AccessKey, Tickets, Purge – Berechtigung und Speicher on-chain. |
| **ECDH + AES-GCM** | Handshake, Shared Secret, verschlüsselte Nachrichten. |
| **Listener** | Pollt Events (EncryptedMessage, PlaintextMessage), recipient = Lock/Messenger. |
| **M2M Lock** | Open-Words, Replay, AUTHORIZED_SENDERS, hasValidAccessKey → bei Erfolg **executeOpenAction(sender)**. |
| **executeOpenAction** | \`OPEN_COMMAND\` (spawn) und/oder \`OPEN_URL\` (GET) – die „letzte Meile“ zum Gerät. |

Stärken: Berechtigung (AccessKey, Whitelist), Purge, Replay-Schutz, eine klare Stelle für die letzte Meile (\`OPEN_COMMAND\` / \`OPEN_URL\`).

---

## 2. Schwächen, die Streams abfedern kann

| Schwäche | Streams-Nutzen |
|----------|----------------|
| **Metadaten-Leak** | Sender/Empfänger on-chain sichtbar; bei vielen Polls/Events mehr Tracking. Streams: Kanal-ID statt Adressen, weniger direktes Adress-Tracking. |
| **Latenz** | Rebased: TX + Block/Event-Poll (typ. 1–5 s). Streams: oft < 1 s, gut für „open“ und Heartbeats. |
| **Kosten bei hoher Frequenz** | Viele Nachrichten = viele TXs/Gas. Streams: feeless bzw. nur Anchor-TX alle paar Minuten, skaliert für viele Nachrichten. |

Streams **ersetzt** bei uns weder Handshake, noch AccessKey, noch Purge – es übernimmt dort, wo **Transport** billig und schnell sein soll.

---

## 3. Warum Streams ergänzt (nicht ersetzt)

- **Rebased bleibt** für: Handshake, Shared Secret, Vault, AccessKey-Prüfung, Purge, Zahlungs-Trigger, Berechtigungslogik.
- **Streams (oder Streams-ähnlich)** für: schneller, feeless, metadatenarmer **Transport** für Befehle/Status (z. B. „OPEN“, Heartbeats, Sensor-Streaming).

Kombination = Berechtigung und Kontrolle on-chain, Übertragung zum Gerät günstig und schnell.

---

## 3a. Warum „letzte Meile“ mit Streams?

**Rebased bleibt** für alles Kritische & Sichtbare: Handshake, AccessKey-NFT, Berechtigungs-Prüfung, Zahlung, Purge.

**Streams übernimmt** die schnelle, feeless, private Kommunikation danach: „open“, „status“, „heartbeat“, „bin da“, „lade mit 22 kW“ usw.

| Vorteil | Erklärung |
|---------|-----------|
| **Latenz** | Von 1–10 s (Rebased TX + Poll) auf < 1 s |
| **Kosten** | Fast 0 – nur Anchor-TX einmalig, danach feeless |
| **Metadaten-Schutz** | Kanal-ID statt Sender/Empfänger on-chain; weniger Tracking |
| **Offline-Puffer** | Bridge (z. B. LoRa) kann puffern; Gerät holt nach |

---

## 3b. Konkreter Ablauf (wie es in der Praxis läuft)

### Einmaliger Setup (pro Schloss / Gruppe)

1. **Wallet 1 (Schloss/Gate)** und **Wallet 2 (Nutzer/Auto)** machen normalen ECDH-Handshake auf Rebased.
2. Danach erstellt **Wallet 1** (oder ein Kommandant) einen Streams-Kanal.
3. **Seed für den Kanal:** z. B. aus Handshake abgeleitet oder zufällig.
4. **Anchor-TX auf Rebased** (kleine TX, einmalig).
5. **Nutzer (Wallet 2)** abonniert den Kanal (kennt nur Channel-Address).

### Normalbetrieb

1. **Nutzer sendet „open“ per Streams** (feeless, < 1 s).
2. **Schloss-Listener** empfängt Streams-Nachricht → prüft on-chain (Rebased): AccessKey gültig? Nonce ok?
3. Wenn ja → **OPEN_COMMAND** / **OPEN_URL** ausführen.
4. **Schloss sendet per Streams zurück:** „OPEN GRANTED“, „Tür offen seit 5 s“.
5. **Nutzer sieht Status sofort** (OLED, App, Auto-Display).

### Fallback bei Streams-Ausfall

Wenn Streams nicht geht → **Fallback auf normale Rebased-Nachricht** (verschlüsselt).

| Flag | Bedeutung |
|------|-----------|
| **STREAMS_LISTEN_ENABLED=true** | Lock empfängt „open“ auch von Streams (zusätzlich zu Rebased). |
| **STREAMS_LISTEN_ENABLED=false** | Lock hört nur auf Rebased (EncryptedMessage/PlaintextMessage). |
| **OPEN_STREAMS_ENABLED=true** | Lock sendet nach OPEN GRANTED zusätzlich Status auf Streams-Kanal. |

Rebased und Streams laufen **parallel** – bei Streams-Ausfall nutzt der Nutzer weiterhin verschlüsselte Rebased-Nachricht; Lock prüft weiterhin AccessKey on-chain.

---

## 4. Fünf Varianten – Bewertung für dein Setup

### Variante 1: Streams als „letzte Meile“ (empfohlen)

| Aspekt | Inhalt |
|--------|--------|
| **Wo eingebaut** | Statt oder **zusätzlich** zu \`OPEN_COMMAND\` / \`OPEN_URL\`: bei **OPEN GRANTED** eine Nachricht auf einen Streams-Kanal schreiben; Gerät (z. B. Heltec/ESP32) liest den Kanal und schaltet Relais/OLED. |
| **Was Streams übernimmt** | Transport von „OPEN“ (und ggf. kurzen Status) zum Gerät: feeless, < 1 s. |
| **Was Rebased weiter macht** | Handshake, Shared Secret, AccessKey-Prüfung, Replay, Purge, Vault – unverändert in \`m2m-lock.ts\` (Listener + Validierung). |
| **Vorteile** | Geringe Latenz und Kosten an der letzten Meile; Gerät braucht nur Streams-Client (kein RPC); Metadaten-Schutz am Kanal. |
| **Aufwand** | Mittel: neues Modul „Streams-Client“ (oder Skript), Config (z. B. Kanal/Anchor), Aufruf aus **executeOpenAction** (oder direkt danach). |

**Konkreter Einbau (Code) – umgesetzt:**

- **Config** (\`config.ts\`): \`OPEN_STREAMS_ENABLED\` (boolean), \`STREAMS_ANCHOR_ID\`, \`STREAMS_TOPIC\`. In der Konfigurationsanzeige und in \`.env.example\` eingetragen.
- **Stub** (\`m2m-lock.ts\`): \`publishOpenViaStreams(sender)\` – wird aus \`executeOpenAction(sender)\` aufgerufen, sobald \`OPEN_STREAMS_ENABLED\` und \`STREAMS_ANCHOR_ID\` gesetzt sind. Aktuell nur Log-Ausgabe; hier die echte Streams-Publish-Logik (z. B. mit @iota/streams oder API-spezifisch) einbauen. Payload z. B. \`OPEN\` oder \`{ command: 'OPEN', sender: '…', ts }\`.
- **Stelle:** Nach AccessKey- und Replay-OK ruft der Lock weiterhin \`executeOpenAction(sender)\` auf; darin laufen nacheinander OPEN_COMMAND, OPEN_URL und \`publishOpenViaStreams(sender)\`.
- **Abhängigkeit:** IOTA Streams-Repo ist archiviert (Apr 2024); v2.0 war nicht Stardust-kompatibel. Für eine lauffähige Implementierung: Streams auf IOTA-1.x oder ein Rebased-taugliches Streaming-Angebot nutzen; der Stub bleibt die Einbaustelle.

---

### Variante 2: Streams für Sensor-Streaming

| Aspekt | Inhalt |
|--------|--------|
| **Eingbau** | Gerät (Sensor) schreibt Messwerte in einen Streams-Kanal; Pi/PC liest den Kanal. |
| **Streams** | Hohe Frequenz (z. B. Temp, GPS), feeless. |
| **Rebased** | Bei Schwellwert/Alarm eine **einzige** Rebased-TX (z. B. Alarm-Event, Purge, Zugangs-Revoke). |
| **Vorteil** | Skalierung für viele Messwerte; Rebased nur für kritische Aktionen. |
| **Aufwand** | Niedrig–Mittel; eher neues Geräte-Skript + ggf. kleines Aggregator-Skript; Morgendrot-Code kaum geändert (nur wenn du „bei Schwellwert → Rebased-TX“ in der App abbilden willst). |

---

### Variante 3: Streams als Backup-Kanal

| Aspekt | Inhalt |
|--------|--------|
| **Eingbau** | Wenn Rebased-TX oder RPC fehlschlägt (Congestion, Ausfall): Fallback „OPEN“ (oder Status) per Streams senden. |
| **Streams** | Backup-Transport. |
| **Rebased** | Primärkanal; Logik (AccessKey, Replay) unverändert – nur der **Versand** weicht bei Fehler auf Streams aus. |
| **Vorteil** | Höhere Resilienz. |
| **Aufwand** | Niedrig: Fehlerbehandlung im Sender (Messenger/Key-Halter), optional zweiter Pfad „bei Fehler → Streams senden“. Lock-Seite kann unverändert bleiben, wenn das Gerät sowohl Rebased-Events (über Pi) als auch Streams-Kanal lesen kann. |

---

### Variante 4: Streams für anonyme Heartbeats

| Aspekt | Inhalt |
|--------|--------|
| **Eingbau** | Gerät sendet periodisch „online“ in einen Streams-Kanal (ohne Adresse/Identität im Kanal). |
| **Streams** | Nur Heartbeats; wenig Metadaten. |
| **Rebased** | Echte Befehle, Berechtigung, Purge. |
| **Vorteil** | Offline-Alarm (Timeout → Purge/Warnung) ohne Metadaten-Leak bei Heartbeats. |
| **Aufwand** | Niedrig; eigenes kleines Modul/Skript; Lock/Messenger nur um „Timeout + Reaktion“ erweiterbar. |

---

### Variante 5: Hybrid (Streams Chat/Status + Rebased Berechtigung)

| Aspekt | Inhalt |
|--------|--------|
| **Eingbau** | Echtzeit-Chat/Status über Streams; Berechtigung und Zahlung on-chain (Rebased). |
| **Vorteil** | Maximale Flexibilität. |
| **Aufwand** | Hoch (5–10 h); stärkere Architektur-Entscheidungen (wer ist Author/Subscriber, wie wird Berechtigung mit Kanal verknüpft). Für dein jetziges System weniger prioritär als Variante 1. |

---

## 5. Empfehlung: Variante 1 umsetzbar machen

- **Architektur:** Unverändert. Rebased + Listener + AccessKey + Replay bleiben die **einzige** Quelle der Wahrheit für „OPEN erlaubt“. Streams ist nur ein **weiterer Ausgabekanal** an der letzten Meile.
- **Konfiguration (optional, vorbereitet):** Z. B. in \`config.ts\`:
  - \`OPEN_STREAMS_ENABLED\` (boolean)
  - \`STREAMS_ANCHOR_ID\` / \`STREAMS_TOPIC\` (oder API-spezifisch)
  - Weitere Streams-Parameter nur bei Bedarf.
- **Code-Stelle:** \`m2m-lock.ts\` → \`executeOpenAction(sender)\`. Dort:
  - wie heute: \`OPEN_COMMAND\` (spawn), \`OPEN_URL\` (fetch);
  - **wenn** \`OPEN_STREAMS_ENABLED\`: zusätzlich Aufruf eines kleinen Moduls/Skripts, das eine Nachricht (z. B. „OPEN“ oder ein kurzer Token) in den konfigurierten Streams-Kanal schreibt. Kein Umbau der bestehenden Logik.
- **Gerät (Heltec/ESP32):** Nur Streams-Client (WASM/Rust), abonnier den Kanal; bei Nachricht → Relais + OLED. Kein Rebased-RPC nötig.

So bleibt dein Code der Kern; Streams ist reiner Transport für die letzte Meile. Sobald ein Rebased-kompatibler oder IOTA-1.x-Streams-Client für Node verfügbar ist, kann die konkrete Implementierung (Publish-Funktion) in dieses Gerüst eingehängt werden.

**LoRa-Bridge (eigenes Projekt):** Unter \`lora-bridge/\` liegt eine HTTP-Bridge, die Morgendrot mit LoRa-Mesh (Heltec/Meshtastic) verbindet. \`STREAMS_BRIDGE_URL=http://localhost:9342\` zeigt auf die Bridge. Simulation ohne Hardware möglich. Siehe \`lora-bridge/README.md\`.

---

## 6. Kurz: Was du behältst vs. was Streams übernimmt

| Behalten (Rebased + dein Code) | Streams (oder Streams-ähnlich) |
|-------------------------------|----------------------------------|
| Handshake, ECDH, Shared Secret | – |
| Vault, Purge, AccessKey, Tickets | – |
| Listener, Replay, AUTHORIZED_SENDERS | – |
| Entscheidung „OPEN GRANTED“ | – |
| **OPEN_COMMAND / OPEN_URL** (weiter nutzbar) | **Transport „OPEN“ zum Gerät** (feeless, schnell) |
| – | Optional: Sensor-Streaming, Heartbeats, Backup-Kanal |

Damit bleiben Stärken (Berechtigung, Purge, Kontrolle) erhalten; Latenz, Kosten und Metadaten an der letzten Meile können mit Streams verbessert werden, sobald der passende Transport-Stack gewählt ist.

---

## 7. Szenario-Check: „Smart-Garage mit Auto-Zugang“ (Hybrid)

Prüfung: Ist das beschriebene Szenario (Auto mit gültigem Key, Status über Streams, kritischer Befehl „open“ nur über Rebased) mit dem aktuellen Code abbildbar?

### Was das Szenario verlangt

| Anforderung | Im Code? | Wo / Hinweis |
|-------------|----------|--------------|
| ECDH-Handshake on-chain, Shared Secret | Ja | Handshake (Mailbox/Events), \`deriveSharedSecret\` in crypto-layer; wallet-bridge + m2m-lock. |
| AccessKey-NFT (purgebar, TTL) | Ja | Move: AccessKey, create_key, purge_key, enable_emergency_purge_key; TS: hasValidAccessKey. |
| Purge & Notfall-Kill-Switch für Schlüssel | Ja | Move + /emergency-purge-key, /purge-key. |
| Replay-Schutz & AUTHORIZED_SENDERS | Ja | replay-state.ts, acceptAndUpdate; config AUTHORIZED_SENDERS; Lock prüft vor OPEN. |
| Kritischer Befehl „open“ nur über Rebased | Ja | Lock führt OPEN nur aus, wenn Nachricht von Rebased (EncryptedMessage/PlaintextMessage) kommt und AccessKey + Replay + ggf. Whitelist OK sind. Kein „open“ aus Streams. |
| Nach OPEN GRANTED etwas an Gerät/Auto senden (Status) | Teilweise | \`publishOpenViaStreams(sender)\` wird genau nach OPEN GRANTED aufgerufen; aktuell Stub. Nutzung: hier **Status** (z. B. \`OPEN GRANTED\`, \`Tür offen\`) auf Streams-Kanal senden – dann empfängt Auto/Heltec feeless und schnell. Befehl „open“ bleibt Rebased; Streams nur Status. |
| Schloss erstellt einmalig Streams-Kanal | Nein | Nicht im Code. Kanal-Erstellung (Anchor o. ä.) müsste einmalig außerhalb oder in einem Setup-Skript passieren; STREAMS_ANCHOR_ID kommt dann in .env. |
| Auto abonniert Kanal, sendet Status („bin da, Batterie 20 %“) | Nein | Lock liest nur Rebased-Events. Empfang von Streams-Nachrichten (vom Auto) wäre neuer Listener/Poll auf Streams-Kanal; optional ergänzbar. |
| Zahlungs-Trigger (z. B. 0.001 IOTA → Ladevorgang) | Vorbereitet | Config: MAX_SEND_AMOUNT_IOTA; keine Logik „bei eingehender Zahlung → Aktion auslösen“ im Code. Könnte in Listener oder eigenem Modul ergänzt werden. |

### Fazit Szenario

- **Rebased-Teil (alles Kritische):** Vollständig im Code – Handshake, AccessKey, Purge, Replay, Whitelist, „open“ nur nach Rebased-Validierung, OPEN_COMMAND/OPEN_URL.
- **Streams für Status („OPEN GRANTED“, „Tür offen“, „80 %“):** Einbaustelle ist da (\`publishOpenViaStreams\` nach OPEN GRANTED). Payload sollte **Status** sein (z. B. \`OPEN GRANTED\` oder JSON), nicht der Befehl „open“. Stub-Kommentar im Code erlaubt beides (Token/Status); für Smart-Garage: hier nur Status senden.
- **Nicht im Code (optional ergänzbar):** (1) Einmalige Kanal-Erstellung (Script oder extern), (2) Lock empfängt Streams („bin da, Batterie 20 %“) und reagiert z. B. mit AccessKey-Prüfung + Antwort auf Streams, (3) Zahlungs-Trigger-Logik.

Damit ist das Szenario **mit dem aktuellen Stand möglich**, sobald (a) Streams-Client für Publish (Status) eingebunden ist und (b) STREAMS_ANCHOR_ID (und ggf. Kanal-Erstellung) gesetzt sind. Der kritische Pfad (open nur über Rebased, Berechtigung on-chain) ist abgedeckt; Streams bleibt optional für Status und letzte Meile.

---

## 8. Die drei offenen Punkte: Sinn, Machbarkeit, Implementierung

### 8.1 Schloss erstellt einmalig Streams-Kanal

| Frage | Antwort |
|-------|--------|
| **Macht es Sinn?** | Ja. Ein Kanal pro Schloss (oder pro Schlüsselpaar) ist üblich; einmalig anlegen, dann STREAMS_ANCHOR_ID in .env. |
| **Geht es?** | Nur mit einem lauffähigen Streams-Stack. Das IOTA-Streams-Repo ist archiviert (Apr 2024), v2.0 war nicht Stardust-kompatibel. Auf IOTA 1.x oder einem kompatiblen Layer geht Kanal-Erstellung mit der Streams-Bibliothek. Auf Rebased gibt es derzeit keine eingebaute „Streams“-Schicht – also entweder 1.x nutzen oder auf ein künftiges Rebased-Streaming-Angebot warten. |
| **Implementieren?** | Im Projekt: **Doku + optionales Script**. Ein Skript (z. B. \`scripts/create-streams-channel.ts\`) kann (a) Anleitung/Platzhalter sein („mit Streams 1.x: … aufrufen, STREAMS_ANCHOR_ID in .env eintragen“) oder (b) falls du eine konkrete Streams-API nutzt, den Aufruf dazu enthalten. Echten Streams-Client ins Kern-Projekt zu ziehen ist wegen Archivierung/Abhängigkeit nur sinnvoll, wenn du einen festen, wartbaren Client nutzt. |

---

### 8.2 Auto sendet Status per Streams; Lock empfängt Streams

| Frage | Antwort |
|-------|--------|
| **Macht es Sinn?** | Ja. Status („bin da“, „Batterie 20 %“, „OPEN GRANTED“) feeless und schnell über Streams entlastet Rebased und verbessert Metadaten-Schutz. |
| **Geht es?** | Ja, sobald ein Streams-Client (Publisher + Subscriber) verfügbar ist. Lock würde einen zweiten „Listener“ haben (Streams-Kanal abonnieren); bei Nachricht optional Sender prüfen (z. B. AccessKey) und antworten (z. B. über \`publishOpenViaStreams\`). |
| **Implementieren?** | **Config + Stub.** Optionen wie \`STREAMS_LISTEN_ENABLED\`, weiterhin \`STREAMS_ANCHOR_ID\` (als Subscriber). Eine Stub-Funktion (z. B. \`listenStreamsStatus(callback)\`) wird optional im Lock aufgerufen; im Stub: „Bei echter Streams-Nachricht → callback(Payload); Implementierung mit Streams-Client ergänzen.“ So ist die Einbaustelle da, die konkrete Implementierung hängt am gewählten Streams-Client. |

---

### 8.3 Zahlungs-Trigger (z. B. 0.001 IOTA → Ladevorgang starten)

| Frage | Antwort |
|-------|--------|
| **Macht es Sinn?** | Ja. Typisches Muster für Ladesäule/Garage: Zahlung an Adresse → Aktion (Ladevorgang, Schranke). |
| **Geht es?** | Ja, mit Rebased. Die SDK-Methoden \`getBalance\`, \`getCoins\`, \`queryTransactionBlocks\` erlauben, Kontostand oder Transaktionen zu prüfen. Entweder: Balance-Poll (Vorher/Nachher) oder Abfrage von Transaktionen, die die Lock-Adresse betreffen – sobald ein ausreichender Betrag eingegangen ist, Trigger auslösen. |
| **Implementieren?** | **Ja – im Projekt umgesetzt.** Config: \`PAYMENT_TRIGGER_ENABLED\`, \`PAYMENT_TRIGGER_MIN_IOTA\` (z. B. \`0.001\`), \`PAYMENT_TRIGGER_POLL_MS\`, \`PAYMENT_TRIGGER_STATE_FILE\`. Chain-Layer: \`queryIncomingPayments(client, address)\` nutzt \`queryTransactionBlocks\` mit Filter \`ToAddress\` und \`showBalanceChanges\`; Rückgabe \`{ digest, amountMist }\`. Lock: optionaler Polling-Loop; bei Betrag ≥ Mindestbetrag wird dieselbe Aktion wie bei OPEN ausgeführt (\`OPEN_COMMAND\`/\`OPEN_URL\`), Sender-Kontext \`payment:<digest>\`. Replay-Schutz: bereits verarbeitete TX-Digests werden in \`PAYMENT_TRIGGER_STATE_FILE\` persistiert. **Hinweis:** Die State-Datei wächst mit jeder verarbeiteten Zahlung (eine Zeile pro Digest); bei sehr langer Laufzeit ggf. rotieren/leeren (dann würden alte Digests beim Neustart nicht als „bereits verarbeitet“ gelten – nur relevant, wenn dieselbe TX aus Sicht des Nodes erneut erscheinen könnte). |
`,
    'FESTIVAL-TICKETS-EINRICHTEN.md': `# Morgendrot – Festival-Tickets einrichten

Tickets, die automatisch ablaufen oder der Veranstalter zurückrufen kann. Zwei Wege: AccessKey (einfach per Kommando) oder Ticket-NFT (mächtiger).

**15 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst. Fang mit Schritt 1 an, dann 2, dann 3 usw. Wenn du etwas nicht willst, überspring es.

---

## Ticket-Typ wählen (1 von 15)

**Welche Art Ticket willst du?**

Es gibt zwei Möglichkeiten – du entscheidest:

**AccessKey (einfach & schnell – per Kommandozeile)**  
→ Das ist wie ein „digitaler Eintrittsschlüssel“ für dein Festival-Tor. Du gibst nur Tor-Adresse, Käufer-Adresse und wie viele Tage er gilt.

- Befehl: \`/create-key\`
- Beispiel: \`/create-key 0xTor 0xBesucher 1\`  
→ Besucher bekommt Schlüssel für 1 Tag. Danach ist der Schlüssel automatisch weg.

Vorteil: Superschnell einzurichten, perfekt für einfache Eintritte.

**Ticket-NFT (mächtiger – mit Sitzplatz, Getränke-Gutschrift, VIP-Status)**  
→ Das ist wie ein echtes Festival-Ticket mit allem drauf (Name, Sitzplatz, Rabatt). Du gibst Event-Adresse, Start- und Endzeit, Extra-Infos und Käufer.

- Befehl: create_ticket (CLI geplant: \`/create-ticket\`)
- Beispiel: \`/create-ticket 0xFestival 1712000000000 1714608000000 „Sitz A12“ 0xKaeufer\`  
→ Ticket für Festival mit Sitz A12.

Vorteil: Viel mehr Infos möglich (z. B. „VIP + 5 € Getränke“).

**Setzen?** Ja – fang mit AccessKey an (einfacher). Ticket-NFT später, wenn du mehr willst.

---

## Tickets erstellen / ausstellen (2 von 15)

Jetzt machst du das Ticket und gibst es dem Käufer. Ticket landet automatisch im Wallet des Käufers (wie ein digitales Ticket).

**Möglichkeiten:**

- **/create-ticket (Ticket-NFT):** event_id valid_from_ms valid_until_ms metadata recipient  
→ Ticket mit Zeitfenster und Extra-Infos (geplant).  
Beispiel: \`/create-ticket 0xFestival 1712000000000 1714608000000 „Sitz A12“ 0xKaeufer\`  
→ Ticket gültig vom 1. April bis 5. April mit Sitz A12.

- **/create-key (AccessKey):** lock recipient [ttl]  
→ Einzelnes Ticket: Tor-Adresse, Käufer-Adresse, Tage  
Beispiel: \`/create-key 0xTor 0xKaeufer 30\` → Schlüssel für 30 Tage.

- **/create-keys (AccessKey):** lock recipient [ttl] [anzahl]  
→ Mehrere Tickets auf einmal: z. B. 50 Stück für 1 Tag  
Beispiel: \`/create-keys 0xTor 0xVerlosung 1 50\` → 50 Tickets für 1 Tag.

**Setzen?** Nein – nur wenn du gerade Tickets verkaufst oder ausstellst. Fang mit einem einzelnen Key an.

---

## Kern-Parameter (Ticket & AccessKey) (3 von 15)

**Welche Infos brauchst du beim Ticket?** Hier die wichtigsten – denk an ein echtes Ticket:

- **event_id / lock_id:** Welches Festival oder Tor? (Muss-Feld) – Beispiel: 0xFestival oder 0xTor
- **owner / recipient:** Wer bekommt das Ticket? (wird automatisch beim Ausstellen gesetzt) – Beispiel: 0xKaeuferAdresse
- **valid_from_ms / valid_until_ms:** Ab wann bis wann gültig? (Ticket braucht beides, AccessKey nur Ablauf) – Beispiel: Ab heute bis Sonntagabend
- **used (Ticket):** Schon benutzt? – Sollte immer false sein – Beispiel: false (noch nicht eingelassen)
- **tier (Ticket):** Welche Kategorie? – 0=Early Bird, 1=Normal, 2=VIP, 3=Backstage, 4=Crew – Beispiel: 2 = VIP (besserer Platz)
- **issuer:** Wer hat das Ticket ausgestellt? – Für Rückruf – Beispiel: 0xVeranstalter
- **Promo & Gutschein:** promo_code, discount_percent oder Guthaben (in metadata) – Beispiel: {"promo":"SUMMER25","Rabatt":25} oder {"Getränke":5000}
- **Weitere Infos (optional):** max_uses, zone_list, seat, holder_name, qr_data, revoked, price_paid_iota

**Setzen?** Nein – nur die Muss-Felder (event_id, recipient, Zeit). Rest ist Extra.

---

## metadata (Ticket): tier, seat, promo_code (4 von 15)

metadata_hex kann Extra-Infos speichern: Kategorie, Sitzplatz, Rabatt usw.

- **Einfach:** tier=2 (VIP) → metadata_hex = 02 (nur 1 Byte)
- **Mehr Infos:** {"tier":2,"seat":"A-12-5"} → Text in Hex umwandeln
- **Promo:** {"promo":"FRIEND25","Rabatt":25}

Beispiel: Du machst Ticket für VIP → metadata sagt „VIP + Sitz A12 + 25% Rabatt“.

**Setzen?** Nein – nur wenn du Extra-Infos willst (z. B. Sitzplatz oder Rabatt).

---

## Tickets nutzen / einlösen (5 von 15)

Ticket als benutzt markieren (Einlass). Einmalnutzung.

- **/use-ticket:** ticket_id event_id – Besitzer ruft auf → used=true  
→ Beispiel: Einlass-Scanner tippt \`/use-ticket 0xTicketId 0xFestival\` → Ticket ist jetzt benutzt.

**Setzen?** Nein – das macht der Einlass-Scanner oder der Besitzer selbst.

---

## Tickets prüfen / validieren (6 von 15)

On-Chain-Prüfung: Hat Adresse gültiges Ticket? (Zeitfenster, used=false)

- **hasValidTicket** – Tor/Einlass prüft automatisch bei Einlass  
→ Beispiel: Scanner schaut: „Hat der Besucher ein gültiges Ticket?“ → Ja/Nein
- **hasValidAccessKey** – Für AccessKey-Pfad: Tor prüft automatisch

**Setzen?** Nein – das passiert automatisch, wenn das Tor eingerichtet ist.

---

## Tickets ändern / mutieren (7 von 15)

Status ändern (used, tier, valid_until)

- **/upgrade-ticket:** Ticket von Normal zu VIP upgraden  
→ Beispiel: Käufer zahlt extra → Ticket wird VIP.
- **/mark-used:** Ticket manuell als benutzt markieren  
→ Beispiel: Einlass sagt „benutzt“ → Ticket ist weg.

**Setzen?** Nein – nur wenn du Upgrades oder manuelles Markieren willst.

---

## Tickets löschen / ungültig machen (8 von 15)

Ticket von Kette entfernen

- **purge_ticket** – Ticket komplett löschen (nach Nutzung oder Ablauf)  
→ Beispiel: Festival vorbei → alle Tickets löschen.
- **enable_emergency_purge_ticket** – Notfall-Flag setzen → sofort purgebar  
→ Beispiel: Event abgesagt → Veranstalter macht alle Tickets ungültig.
- **/purge-ticket** – Ticket löschen (CLI)
- **/emergency-purge-ticket** – Notfall-Löschung aktivieren (CLI)
- **/purge-key / /emergency-purge-key** – Für AccessKey-Pfad

**Setzen?** Nein – nur wenn du aufräumen oder Notfall hast.

---

## Tickets weitergeben / transferieren (9 von 15)

Ticket an neue Adresse übertragen

- **/transfer-ticket** – Ticket an neuen Empfänger weitergeben (wie normales NFT)  
→ Beispiel: Käufer verkauft Ticket an Freund → \`/transfer-ticket 0xTicketId 0xFreund\`

**Setzen?** Nein – nur wenn Weiterverkauf erlaubt sein soll.

---

## Tickets zurückgeben / Refund (10 von 15)

Ticket löschen + Geld zurück

- **/refund-ticket** – Ticket zurückgeben + Zahlungs-Trigger rückwärts  
→ Beispiel: Käufer gibt Ticket zurück → Geld kommt zurück + Ticket weg.

**Setzen?** Nein – nur wenn du Rückgabe erlaubst.

---

## Tickets anzeigen / Übersicht (11 von 15)

Liste aller eigenen Tickets

- **/list-tickets** – Meine Tickets auflisten (gültig, abgelaufen, benutzt)  
→ Beispiel: \`/list-tickets\` → „Du hast 3 Tickets: 1 gültig, 2 abgelaufen“

**Setzen?** Nein – nur wenn du eine Übersicht willst.

---

## Eintritts-Gate einrichten (12 von 15)

ROLE=lock, LOCK_ID = Gate-Adresse. Prüft hasValidTicket oder hasValidAccessKey

LOCK_ID = 0x… → Das ist die Adresse deines Tores/Einlasses.

Beispiel: Dein Festival-Tor hat Adresse 0xTor… → LOCK_ID=0xTor… → Tor prüft bei jedem: „Hat der ein gültiges Ticket?“

**Setzen?** Ja – wenn du ein echtes Gate hast.

---

## Teilen (QR/Email) (13 von 15)

KeyId oder Ticket-Objekt-ID aus TX-Event kopieren, als QR oder Link an Käufer

→ Beispiel: Du erstellst Ticket → ID ist 0xTicket123… → mach QR-Code → schick per WhatsApp oder E-Mail.

**Setzen?** Nein – mach das nach dem Ausstellen.

---

## Rückruf bei Event-Absage (14 von 15)

Alle Keys/Tickets widerrufen: /emergency-purge-key pro KeyId, danach /purge-key

→ Beispiel: Event abgesagt → Veranstalter macht alle Tickets ungültig.

**Setzen?** Nein – nur im Notfall.

---

## Automatischer Ablauf (15 von 15)

Nach DEFAULT_TTL_DAYS automatisch purgebar

→ Beispiel: Ticket für 3 Tage → nach 3 Tagen kannst du es löschen oder es wird automatisch ungültig.

**Setzen?** Ja – DEFAULT_TTL_DAYS = 3 für ein Wochenend-Festival.
`,
    'OFFLINE-FAEHIGKEIT.md': `# Wie geht das Ding ohne Internet?

## 1. Was bedeutet „offline“?

**„Offline“ heißt:**

- Kein WLAN
- Kein Mobilfunk
- Kein Zugang zur IOTA-Kette (RPC_URL nicht erreichbar)

**Trotzdem soll das System weiterarbeiten, z. B.:**

- Tür öffnen
- Alarm melden
- Status speichern
- Später synchronisieren, wenn Netz wieder da ist

---

## 2. Was Rebased / IOTA nicht offline kann

Rebased (wie jede echte Blockchain) braucht eine Verbindung zur Kette, um:

- Transaktionen zu senden (open, purge, create_key, Zahlung)
- Objekte zu prüfen (hasValidAccessKey, hasValidTicket)
- Events zu lesen (Nachrichten, Heartbeat)

**Ohne Verbindung zur Kette geht nichts On-Chain** – keine neue Nachricht, kein neuer Schlüssel, keine Live-Prüfung. Rebased alleine ist also nicht offline-fähig; es ist ein online-zentriertes System.

---

## 3. Wie Morgendrot trotzdem offline-fähig wird

Es gibt mehrere Bausteine – von „schon umgesetzt“ bis „möglich, aber mit Aufwand“.

---

### Möglichkeit A – Offline-Cache für AccessKeys (bereits umgesetzt)

**So funktioniert es im Code:**

- Wenn ein Sender **online** einen gültigen AccessKey hat → die App speichert ihn **im Speicher** (RAM) mit Ablaufzeit: \`jetzt + OFFLINE_CACHE_TTL_MS\`.
- **OFFLINE_OPEN_ENABLED** = true
- **OFFLINE_CACHE_TTL_MS** = z. B. 86400000 (24 Stunden)
- Bei „open“ prüft die App zuerst: Ist die Kette erreichbar?
  - **Ja** → Prüfung on-chain; bei gültigem Key wird wieder gecacht.
  - **Nein** (offline) → Prüfung nur im Cache: „Ist dieser Sender mit Ablaufzeit in der Zukunft eingetragen?“  
  - Ja → Relais/URL sofort ausführen (keine Kette nötig).  
  - Nein → „Kein gültiger Schlüssel im Cache – verweigert.“

**Beispiel:** Du hast einen Schlüssel für 30 Tage. Sobald du einmal online „open“ gemacht hast (oder der Lock deinen Key online geprüft hat), steht deine Adresse 24 Stunden im Cache. Strom/Netz weg → Tür geht trotzdem auf, solange die App läuft und die 24 h nicht um sind.

**Einschränkungen (was „fehlt“ oder anders ist):**

- **Cache nur im RAM:** Nach **Neustart** der App ist der Cache leer. Offline-OPEN funktioniert also nur, wenn die App durchläuft. Nach Neustart ohne Internet: erst wieder online gehen, dann funktioniert der Cache wieder.
- **Optional möglich:** Cache in eine Datei schreiben und beim Start laden (Persistenz) → Offline-OPEN auch nach Neustart, wenn vorher mal online war. (Aktuell nicht implementiert.)
- **used-Flag:** Wenn AccessKeys on-chain als „benutzt“ markiert werden, weiß der Lock offline davon nichts; er verlässt sich auf die Zeit (validUntil). Für reine TTL-Keys ohne „used“ ist das unkritisch.

**Aufwand für Persistenz:** ca. 1–2 Stunden (Cache in Datei schreiben/laden, TTL weiter prüfen).

---

### Möglichkeit B – Streams als Offline-Puffer (mittelschwer, sehr mächtig)

**Idee:**

- Streams-Kanäle sind append-only und können lokal gepuffert werden.
- Gerät (z. B. Heltec) ohne Netz → puffert Befehle lokal.
- Netz wieder da → gepufferte Befehle werden gesendet.
- Schloss empfängt Befehle per Streams (oder über Bridge).

**Beispiel:** Roboter sendet „open“ → kein Netz → puffert lokal → Netz wieder da → Schloss bekommt Befehl → öffnet.

**Was dafür fehlt / nötig ist:**

- Echter Streams-Client auf Gerät (Heltec/ESP32) oder HTTP-Fallback zur Bridge.
- Lokaler Puffer (Queue auf dem Gerät).
- Synchronisation nach Offline-Zeit.

**Aufwand:** ca. 5–15 Stunden (Streams + Puffer).

---

### Möglichkeit C – Meshtastic / LoRa als Offline-Brücke (sehr mächtig, Hardware nötig)

**Idee:**

- Geräte (Schloss, Sensor, Handy) haben LoRa-Modul (Heltec, LilyGo, RAK).
- Mesh-Netz: Nachricht springt von Gerät zu Gerät (1–10 km, durch Wände).
- Kein Internet nötig – nur Funk.
- Morgendrot auf Pi/PC hört per MQTT oder Serial auf Meshtastic.

**Beispiel:** Internet weg → Sensor meldet „Einbruch!“ per Funk → Heltec im Wohnzimmer → Pi → Sirene + Telegram-Alarm.

**Was fehlt / nötig ist:**

- Meshtastic-Integration (MQTT-Listener).
- Parser für Befehle („open“, „alarm“).
- Optional: Status-OLED auf Heltec.

**Aufwand:** ca. 6–12 Stunden + 20–40 € pro Heltec.

**Hinweis:** Unter \`lora-bridge/\` gibt es bereits eine HTTP-Bridge (Morgendrot ↔ LoRa/Meshtastic). Siehe \`lora-bridge/README.md\`.

---

### Möglichkeit D – Offline-Queue (lokale Datei als Befehlseingang) – bereits umgesetzt

**So funktioniert es:**

- **OFFLINE_QUEUE_FILE** = Pfad zu einer Datei (z. B. \`.morgendrot-offline-queue\`).
- Ein **anderes Programm oder Gerät** (z. B. Skript, Heltec über Serial, LoRa-Bridge) schreibt Zeilen in diese Datei.
- Format pro Zeile: \`{"sender":"0x…","cmd":"open","nonce":123}\`.
- Der Lock liest die Datei in einer Schleife (alle paar Sekunden), prüft pro Zeile:
  - Replay-Schutz (nonce),
  - AUTHORIZED_SENDERS (falls gesetzt),
  - **hasValidAccessKeyOrCached** (also on-chain oder aus dem Offline-Cache).
- Bei gültigem Befehl → OPEN ausführen.

**Das ist kein „Puffer für ausgehende Befehle“**, sondern ein **lokaler Eingang**: Befehle kommen von außen in die Datei (z. B. von einem Gerät ohne direkten Chain-Zugang). Der Lock kann dabei offline sein – er nutzt dann nur den Cache (Möglichkeit A) für die AccessKey-Prüfung.

**Beispiel:** Heltec empfängt per LoRa „open“ von einem Key-Holder → schreibt eine Zeile in die Offline-Queue-Datei auf dem Pi → Lock liest die Datei, prüft Sender im Cache → Tür auf.

---

### Möglichkeit E – Reine lokale Regeln (keine Kette, kein Streams)

**Idee:**

- Alle Keys und Regeln nur lokal (z. B. Vault / eigene Datei).
- „open“ kommt per Bluetooth oder WiFi-Direct → App prüft lokal (Key gültig? Zeit ok?) → Relais schaltet.
- Keine Chain-Prüfung → 100 % offline.

**Beispiel:** Handy ohne Netz → Bluetooth zum Schloss → Schloss prüft lokal gecachten Key → Tür auf.

**Was fehlt:**

- Bluetooth- oder WiFi-Direct-Integration in Morgendrot.
- Explizite „rein lokale“ Prüf-Logik (hasValidAccessKey nur aus lokaler Liste/Datei, ohne Kette).

**Aufwand:** abhängig von gewählter Technik.

---

## 4. Kurzüberblick

| Möglichkeit | Status | Beschreibung |
|-------------|--------|--------------|
| **A – Offline-Cache** | ✅ umgesetzt | Gültiger Key wird im RAM gecacht; bei Offline nur Cache-Prüfung. Kein Persistenz nach Neustart. |
| **D – Offline-Queue** | ✅ umgesetzt | Lokale Datei als Befehlseingang; Lock prüft mit hasValidAccessKeyOrCached (on-chain oder Cache). |
| **B – Streams-Puffer** | ⚠️ möglich | Puffer auf dem Gerät + Streams; Aufwand 5–15 h. |
| **C – Meshtastic/LoRa** | ⚠️ möglich | LoRa-Bridge vorhanden; Meshtastic-Integration + Parser nötig. |
| **E – Nur lokal** | ❌ nicht umgesetzt | Bluetooth/WiFi-Direct + rein lokale Key-Prüfung fehlen. |

**Sinn der Aussagen:** Die Einordnung „Rebased braucht immer Kette“ und „Offline heißt: kein Zugang zur Kette“ ist korrekt. Möglichkeit A ist bereits implementiert (Cache im RAM, kein „muss noch geschrieben werden“). Die Offline-Queue (D) ist ein lokaler Befehlseingang, der zusammen mit dem Offline-Cache sinnvoll „ohne Internet“ genutzt werden kann.
`,
    'PACKAGE-ID-NEU-DEPLOYEN.md': `# Ablauf: Package-ID ist noch nicht bekannt (neu deployen)

Wenn du **noch keine** Package-ID hast (z. B. frisches Projekt oder neue Kette), musst du das Move-Package einmal bauen, auf die Kette publizieren und danach die **globale Konfiguration** (Vault, Mailbox, …) anlegen. Danach hast du die Package-ID und trägst sie in der App ein.

**Voraussetzung:** IOTA-CLI installiert (\`iota\` im Terminal verfügbar), Wallet/Keystore mit Adresse, RPC_URL in .env (z. B. Testnet).

---

## Schritt 1: Move-Package bauen

Im Projektordner die beiden Befehle **nacheinander** ausführen (in PowerShell/CMD kein \`&&\` – jeweils einzeln ausführen):

\`\`\`bash
cd move-test
iota move build
\`\`\`

Ohne Fehler → Build war erfolgreich.

---

## Schritt 2: Package auf die Kette publizieren

Im Ordner **move-test** (von Schritt 1) mit dem IOTA-CLI das Package **publizieren**. Die genaue Syntax hängt von deiner CLI-Version ab, z. B.:

\`\`\`bash
iota client publish --gas-budget 100000000
\`\`\`

(Falls du den Ordner gewechselt hast: zuerst \`cd move-test\`, dann den Befehl oben.)

oder (je nach Dokumentation):

\`\`\`bash
iota move publish
\`\`\`

**Wichtig:** In der Ausgabe oder im Explorer erscheint die **neue Package-ID** (0x…). Diese ID notieren – das ist deine **PACKAGE_ID**.

- Oft steht sie in der TX-Ausgabe als \`package_id\` oder in einem Event.
- Im Explorer: Transaktion öffnen → „Created“-Objekte / Events → Package-Objekt mit Adresse 0x….

---

## Schritt 3: create_globals ausführen (einmalig)

Mit der **gerade erhaltenen** Package-ID legst du die gemeinsamen Objekte an (Vault-Registry, Mailbox, Command-Registry):

\`\`\`bash
iota client call --package <PACKAGE_ID> --module messaging --function create_globals --gas-budget 10000000 --json
\`\`\`

**&lt;PACKAGE_ID&gt;** durch deine 0x… aus Schritt 2 ersetzen.

Aus dem Event **GlobalsCreated** (in der Ausgabe oder im Explorer) die IDs entnehmen:

- **vault_registry_id** → in .env als \`VAULT_REGISTRY_ID=0x…\`
- **mailbox_id** → in .env als \`MAILBOX_ID=0x…\`
- **command_registry_id** → in .env als \`COMMAND_REGISTRY_ID=0x…\`

(Wenn du nur Chat/Keys brauchst, reichen PACKAGE_ID und ggf. MAILBOX_ID; VAULT_REGISTRY_ID für On-Chain-Vault, COMMAND_REGISTRY_ID für On-Chain-Öffnen-Wörter.)

---

## Schritt 4: Package-ID in Morgendrot eintragen

Jetzt ist die Package-ID **bekannt**. Du kannst sie so eintragen:

- **In der App (empfohlen):** Projekt „Nachrichten + Chat“ (oder „1. Anfang & Verbindung“) → Schritt „Package-ID verbinden“ → **(a) Package-ID bekannt** → bei **/set-package-id** auf **Ausführen** klicken → die 0x… aus Schritt 2 eingeben → wird gespeichert und unter „Aktuell“ angezeigt.
- **Oder in der .env:** \`PACKAGE_ID=0x…\` (die gleiche 0x… aus Schritt 2).
- **Oder in der Datei:** In \`.morgendrot-package-id\` die Zeile \`0x…\` speichern (macht die App automatisch bei **/set-package-id**).

Die anderen IDs (VAULT_REGISTRY_ID, MAILBOX_ID, COMMAND_REGISTRY_ID) trägst du bei Bedarf in der .env ein (in der App unter den jeweiligen Einträgen oder direkt in der .env).

---

## Kurzüberblick

| Schritt | Was du machst | Ergebnis |
|--------|----------------|----------|
| 1 | \`cd move-test\` und \`iota move build\` | Move-Package gebaut |
| 2 | Package publizieren (\`iota client publish\` o. ä.) | **Package-ID (0x…)** aus Ausgabe/Explorer notieren |
| 3 | \`create_globals\` mit dieser Package-ID aufrufen | VAULT_REGISTRY_ID, MAILBOX_ID, COMMAND_REGISTRY_ID aus Event |
| 4 | In Morgendrot: **/set-package-id** mit der 0x… aus Schritt 2 (oder .env) | Package-ID ist gesetzt und überall nutzbar |

**Danach:** Package-ID ist bekannt und eingetragen – du arbeitest wie unter „(a) Package-ID bekannt“ weiter (Handshake, Connect, Nachrichten, etc.).
`,
    'CHAT-DURCHTESTEN.md': `# Nachrichten + Chat: Schritt für Schritt mit 2 UIs und 2 Wallets

Diese Anleitung führt dich durch den kompletten Ablauf **„Nachrichten + Chat“** mit **zwei getrennten Instanzen** (2 UIs, 2 Wallets). Du brauchst zwei Terminals/Fenster und zwei Browser-Tabs (oder zwei Geräte).

---

## Voraussetzungen

- **2× Morgendrot** laufen (z. B. \`npm run dev\` in zwei verschiedenen Projektordnern **oder** zwei Rechner).
- **Gleiche RPC_URL** (z. B. Testnet) und **gleiche Package-ID** auf beiden Seiten.
- **2 Wallets** mit je einer Adresse (0x…). Du kannst auf Instanz 1 eine Adresse erzeugen („Neue Adresse erzeugen“) und auf Instanz 2 eine andere – oder zwei bestehende Wallets nutzen.

Kurz: **Instanz A** = UI 1 + Wallet 1 (Adresse **Alice**). **Instanz B** = UI 2 + Wallet 2 (Adresse **Bob**).

---

## Phase 1: Beide Instanzen einrichten

### Auf **beiden** UIs (A und B):

| Schritt | Was du machst | Wo in der UI |
|--------|----------------|---------------|
| 1 | **Eigene Adresse setzen** | Projekt „Nachrichten + Chat“ → Schritt 1 „Eigene Adresse setzen“. MY_ADDRESS = deine 0x… (aus Wallet oder „Neue Adresse erzeugen“). |
| 2 | **Package-ID setzen** | Schritt 2 → (a) Package-ID bekannt → bei \`/set-package-id\` die **gleiche** 0x… auf **beiden** eintragen und „Ausführen“ klicken. |
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

\`\`\`bash
npm run test:messages
\`\`\`

Optional: \`UNLOCK_PASSWORD=deinpass API_BASE_A=http://127.0.0.1:3342 API_BASE_B=http://127.0.0.1:3345 npm run test:messages\`

Das Skript führt aus: Handshake (A→B), Connect (B), verschlüsseltes Senden A→B und B→A, /fetch auf beiden Seiten, optional /send-plain.
`
  };
  global.DOC_CONTENTS = docs;
})(typeof window !== 'undefined' ? window : this);
