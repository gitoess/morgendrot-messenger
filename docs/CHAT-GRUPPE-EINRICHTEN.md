# Morgendrot – Dezentrale Chat-Gruppe einrichten

Familie, WG, Firma, Nachbarn – ihr wollt in einer Gruppe chatten. Du entscheidest: Soll jeder mit jedem verschlüsselt reden (privat)? Oder soll es eine gemeinsame Pinnwand geben, wo alle alles sehen (an alle)? Oder beides?

**6 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Gruppen-Modus wählen (1 von 6)

**Wie soll die Gruppe chatten?**

**Privat (verschlüsselt):** Jeder hat seinen eigenen geheimen Kanal zu jedem anderen – nur du und der andere verstehen die Nachrichten.  
→ Beispiel: Familie – Mama schreibt an Papa → nur Papa sieht es, nicht die Kinder.  
→ **PARTNER_ADDRESSES** = `0x…,0x…` (mit Komma getrennt)  
→ **ENABLE_PAIRWISE_GROUPS** = `true` → jeder mit jedem verschlüsselt

**An alle (Pinnwand):** Alle schreiben an eine einzige Adresse – alle sehen alles (Klartext).  
→ Beispiel: WG – jemand schreibt „Milch leer“ → alle sehen es sofort.  
→ **ENABLE_BROADCAST_PINNWAND** = `true`

**Beides:** Privat für private Chats (z. B. Mama–Papa), Pinnwand für Status (z. B. „Müll rausbringen!“).

**Setzen?** Ja – fang mit Privat an (sicherer). Pinnwand nur, wenn alle alles sehen sollen.

---

## Empfänger – aktiv oder passiv? (2 von 6)

**Haben alle in der Gruppe die App?**

**Aktiv (volles Wallet):** Jeder hat die App → macht /connect → kann senden und empfangen.  
→ Beispiel: Familie – alle haben App → alle können chatten.

**Passiv (nur Adresse):** Einige haben keine App → du kannst ihnen Klartext schicken mit **/send-plain** `0x…` `Text` – kein Handshake nötig.  
→ Beispiel: Nachbarn haben keine App → du schreibst „Wasser abgestellt“ – sie sehen es im Explorer.

**Setzen?** Nein – fang mit aktiven Partnern an. Passiv nur für einfache Bekanntmachungen.

---

## Mailbox – löschbare Nachrichten (3 von 6)

**Sollen alte Nachrichten wirklich gelöscht werden können?**

- **USE_MAILBOX** = `true`  
→ Purgebare Nachrichten nutzen (besser als ewige Events).

- **MAILBOX_ID** = `0x…`  
→ Die Adresse des „Briefkastens“ (aus create_globals kopieren).

**Vorher:** Nachrichten bleiben ewig auf der Kette (nur unlesbar).

**Nachher:** Mit Mailbox kannst du alte Nachrichten wirklich löschen → Speicher sparen + Datenschutz.

**Beispiel:** Nach dem Familien-Urlaub alle alten Chats löschen → /purge-msg &lt;nonce&gt; → weg.

**Setzen?** Ja – empfohlen, wenn du Datenschutz willst.

---

## Handshake & Connect (4 von 6)

**So startet ihr den Chat – „Hallo sagen“.**
- **/connect** `0xPartnerAdresse`  
→ Du und der andere tauschen einen geheimen Schlüssel aus.

**Vorher:** Kein Kontakt – ihr könnt nicht verschlüsselt chatten.

**Nachher:** Nach dem Handshake könnt ihr sicher Nachrichten austauschen.

**Beispiel:** Du tippst /connect 0xPapa → Papa tippt /connect 0xDeineAdresse → Chat läuft.

**Dafür brauchst du:** MY_ADDRESS, PACKAGE_ID, Partner-Adresse

**Setzen?** Ja – mach das mit jedem neuen Gruppenmitglied einmalig.

---

## Nachrichten laden (5 von 6)

**Ältere Nachrichten nachholen.**

- **/fetch** `10`  
→ Die letzten 10 Nachrichten laden.

**Vorher:** Du siehst nur neue Nachrichten nach dem Start.

**Nachher:** Du siehst auch alte – wie „ältere Nachrichten laden“ bei WhatsApp.

**Beispiel:** /fetch 15 → die letzten 15 Nachrichten erscheinen im Log.

**Setzen?** Nein – mach das, wenn du den Verlauf sehen willst.

---

## Streams – schneller Kanal (6 von 6)

**Soll es einen superschnellen Zusatzkanal geben?**

- **STREAMS_BRIDGE_URL** = `…`  
→ Wo der Streams-Dienst läuft (falls du Streams nutzen willst).

**Vorher:** Alles läuft nur über die normale Kette (oft 1–5 Sekunden).

**Nachher:** Nachrichten können auch über Streams geschickt werden → schneller (fast sofort) und fast kostenlos.

**Beispiel:** „Milch leer“ kommt in 0,5 Sekunden an statt 5 Sekunden.

**Setzen?** Nein – nur wenn du Echtzeit brauchst.

---

## Minimal-Beispiel (.env)

```env
MY_ADDRESS=0x…
PARTNER_ADDRESSES=0xPapa,0xMama,0xKind
ENABLE_PAIRWISE_GROUPS=true
MAILBOX_ID=0x…
USE_MAILBOX=true
```

Mit jedem Partner einmal /connect, dann läuft der Gruppen-Chat verschlüsselt. Alte Nachrichten kannst du mit /purge-msg löschen.
