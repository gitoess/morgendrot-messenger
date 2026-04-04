# Demo-Vorführung: 4 Punkte nacheinander

*„Brücke zwischen Code und Realität“ – was wir jedem zeigen können, ohne das gesamte Geschäftsgeheimnis preiszugeben.*

Wir machen **eines nach dem anderen**.

---

## 1. Der „echte“ digitale Schlüssel (Ownership)

- **Zeigen:** Im Explorer, wie ein AccessKey-Objekt von der Boss-Adresse zu einer Gast-Adresse wandert.
- **Effekt:** Der Gast öffnet seine Wallet und sieht dort den physisch existierenden Schlüssel.
- **Aussage:** „Das ist kein Datenbank-Eintrag, das ist ein digitales Gut, das dem Gast gehört.“
- **Status:** ✅ Implementiert (create_access_key, transfer, /create-key, /transfer-key).
- **Ablauf:** [DEMO-1-OWNERSHIP-Ablauf.md](DEMO-1-OWNERSHIP-Ablauf.md) (Schritte, Checkliste, Befehle).

---

## 2. Die PTB-Effizienz (Key + Nachricht in einer TX)

- **Zeigen:** Eine Transaktion, die gleichzeitig bezahlt, einen Key erstellt und eine Nachricht sendet (bzw. Key + Nachricht).
- **Effekt:** Im Explorer die Transaktions-Zusammenfassung mit mehreren Commands.
- **Aussage:** „Ich erledige drei komplexe Geschäftsprozesse in einer halben Sekunde zum Preis von einer einzigen winzigen Gebühr.“
- **Status:** ✅ Implementiert (/create-key-and-notify, createAccessKeyAndSendPlain).
- **Ablauf:** [DEMO-2-PTB-Ablauf.md](DEMO-2-PTB-Ablauf.md) · **Automatisch:** `npm run demo:2`

---

## 3. Das Dynamic-Field-Upgrade (Ticket live erweitern)

- **Zeigen:** Ein bestehendes Ticket-Objekt und ihm live ein Feld (z. B. VIP: true) hinzufügen.
- **Effekt:** Im Explorer sieht man, wie sich das Objekt „verwandelt“, ohne neues NFT.
- **Aussage:** „Meine Hardware-Schlüssel können lernen und sich verändern, während sie beim Kunden sind.“
- **Status:** ❌ Noch nicht implementiert (Vision in VISION-ZUKUNFT.md; Move-Vertrags-Erweiterung).

---

## 4. Der Boss-Signer (Infrastruktur-Sicherheit)

- **Zeigen:** Eine Maschine ohne eigenes Guthaben löst eine Aktion aus, die vom Boss autorisiert wird.
- **Effekt:** Maschine sendet Befehl → im Log des Bosses: „Signieranfrage für Arbeiter-01 genehmigt“.
- **Aussage:** „Ich schütze die Fabrikhalle, indem die wertvollen Keys sicher im Tresor des Bosses bleiben.“
- **Status:** ✅ Implementiert (boss-signer, REMOTE_SIGNER_URL, ROLE=arbeiter/kommandant).
- **Ablauf:** [DEMO-4-BOSS-SIGNER-Ablauf.md](DEMO-4-BOSS-SIGNER-Ablauf.md)

---

## Reihenfolge

1. **Punkt 1** (Ownership) → dann  
2. **Punkt 2** (PTB) → dann  
3. **Punkt 3** (Dynamic Fields, sobald umgesetzt) → dann  
4. **Punkt 4** (Boss-Signer).

Wenn du sagst „wir machen Punkt 1“ (oder 2, 3, 4), arbeiten wir genau diesen einen Punkt aus (Vorbereitung, Schritte, ggf. Skript/Checkliste).

---

## Roadmap (Überblick)

| Priorität | Inhalt | Referenz |
|-----------|--------|----------|
| **Sinnvoll jetzt** | Drei lauffähige Demos (Ownership, PTB, Boss-Signer) klar vorbereiten: kurze Schritte, feste Testadressen/Events. | [DEMO-VORBEREITUNG.md](DEMO-VORBEREITUNG.md) |
| **Als Nächstes** | Ticket-metadata-Schema dokumentieren (JSON: Sitzplatz, Name, VIP, Rabatt); in UI/CLI einheitliches Encoding nutzen. Optional: image_url/IPFS als Konvention in metadata. | [TICKET-METADATA-SCHEMA.md](TICKET-METADATA-SCHEMA.md), [NFT-PARAMETERS.md](NFT-PARAMETERS.md) |
| **Größerer Schritt (Vision)** | Dynamic Fields im Move für Tickets; dann ggf. IOTA-Display + Template/QR für „Ticket als Bild“. Bewusst nicht umgesetzt. | [VISION-ZUKUNFT.md](VISION-ZUKUNFT.md) |
