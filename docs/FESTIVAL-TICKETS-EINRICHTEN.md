# Morgendrot – Festival-Tickets einrichten

Tickets, die automatisch ablaufen oder der Veranstalter zurückrufen kann. Zwei Wege: AccessKey (einfach per Kommando) oder Ticket-NFT (mächtiger).

**15 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst. Fang mit Schritt 1 an, dann 2, dann 3 usw. Wenn du etwas nicht willst, überspring es.

---

## Ticket-Typ wählen (1 von 15)

**Welche Art Ticket willst du?**

Es gibt zwei Möglichkeiten – du entscheidest:

**AccessKey (einfach & schnell – per Kommandozeile)**  
→ Das ist wie ein „digitaler Eintrittsschlüssel“ für dein Festival-Tor. Du gibst nur Tor-Adresse, Käufer-Adresse und wie viele Tage er gilt.

- Befehl: `/create-key`
- Beispiel: `/create-key 0xTor 0xBesucher 1`  
→ Besucher bekommt Schlüssel für 1 Tag. Danach ist der Schlüssel automatisch weg.

Vorteil: Superschnell einzurichten, perfekt für einfache Eintritte.

**Ticket-NFT (mächtiger – mit Sitzplatz, Getränke-Gutschrift, VIP-Status)**  
→ Das ist wie ein echtes Festival-Ticket mit allem drauf (Name, Sitzplatz, Rabatt). Du gibst Event-Adresse, Start- und Endzeit, Extra-Infos und Käufer.

- Befehl: create_ticket (CLI geplant: `/create-ticket`)
- Beispiel: `/create-ticket 0xFestival 1712000000000 1714608000000 „Sitz A12“ 0xKaeufer`  
→ Ticket für Festival mit Sitz A12.

Vorteil: Viel mehr Infos möglich (z. B. „VIP + 5 € Getränke“).

**Setzen?** Ja – fang mit AccessKey an (einfacher). Ticket-NFT später, wenn du mehr willst.

---

## Tickets erstellen / ausstellen (2 von 15)

Jetzt machst du das Ticket und gibst es dem Käufer. Ticket landet automatisch im Wallet des Käufers (wie ein digitales Ticket).

**Möglichkeiten:**

- **/create-ticket (Ticket-NFT):** event_id valid_from_ms valid_until_ms metadata recipient  
→ Ticket mit Zeitfenster und Extra-Infos (geplant).  
Beispiel: `/create-ticket 0xFestival 1712000000000 1714608000000 „Sitz A12“ 0xKaeufer`  
→ Ticket gültig vom 1. April bis 5. April mit Sitz A12.

- **/create-key (AccessKey):** lock recipient [ttl]  
→ Einzelnes Ticket: Tor-Adresse, Käufer-Adresse, Tage  
Beispiel: `/create-key 0xTor 0xKaeufer 30` → Schlüssel für 30 Tage.

- **/create-keys (AccessKey):** lock recipient [ttl] [anzahl]  
→ Mehrere Tickets auf einmal: z. B. 50 Stück für 1 Tag  
Beispiel: `/create-keys 0xTor 0xVerlosung 1 50` → 50 Tickets für 1 Tag.

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
→ Beispiel: Einlass-Scanner tippt `/use-ticket 0xTicketId 0xFestival` → Ticket ist jetzt benutzt.

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
→ Beispiel: Käufer verkauft Ticket an Freund → `/transfer-ticket 0xTicketId 0xFreund`

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
→ Beispiel: `/list-tickets` → „Du hast 3 Tickets: 1 gültig, 2 abgelaufen“

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
