# Demo 2: PTB – Ablauf Schritt für Schritt

**Ziel:** Eine Transaktion, die gleichzeitig einen AccessKey erstellt und eine Nachricht sendet. Im Explorer: eine TX mit mehreren Commands (Key + Nachricht) – eine Gebühr, eine Bestätigung.

---

## Vor dem Start (einmalig)

- Wie **Demo 1**: Wallet 1 (Boss) und Wallet 2 (Gast) laufen, PACKAGE_ID auf Boss gesetzt.
- Optional: MAILBOX_ID auf Boss (dann wird `store_plaintext_message` genutzt); sonst `send_plaintext_message`.
- Explorer (Testnet) offen.

---

## Ablauf

### Schritt 1: PTB ausführen (Boss)

Auf **Instanz 1 (Boss)**:

- **Terminal:**  
  `/create-key-and-notify <LOCK_ID> <GAST_ADRESSE> 30 Dein Key ist aktiv.`  
  (30 = TTL in Tagen, danach die Nachricht)
- **Oder UI:** Projekt „Schlüssel & Tickets“ → Befehl „Key + Nachricht (PTB)“ → Lock-ID, Empfänger, TTL, Nachricht → Ausführen.

**Ergebnis:** Eine Transaktion wird ausgeführt. Im Explorer: diese TX öffnen (letzte TX der Boss-Adresse).

### Schritt 2: Im Explorer zeigen

- **Summary / Object Changes:** Es erscheint ein **Created**-Objekt (AccessKey) mit Owner = Gast.
- **Transaction / Commands:** Eine TX mit **mehreren** Move-Calls (z. B. `create_access_key` und `store_plaintext_message` oder `send_plaintext_message`).

**Satz für die Demo:** „Drei Dinge in einer halben Sekunde zum Preis von einer winzigen Gebühr – Key ausstellen, Nachricht senden, eine Bestätigung.“

---

## Demo automatisch

Wenn beide APIs laufen (3342, 3345): im Projektordner **`npm run demo:2`** ausführen. Das Skript führt `/create-key-and-notify` aus und gibt die Object-ID aus; danach im Explorer die letzte TX der Boss-Adresse prüfen.

---

## Kurz-Checkliste

- [ ] LOCK_ID und Gast-Adresse wie in Demo 1
- [ ] Boss: `/create-key-and-notify <LOCK_ID> <GAST> 30 <Nachricht>` ausgeführt
- [ ] Explorer: eine TX mit mehreren Commands sichtbar

**Weiter:** [DEMO-VORBEREITUNG.md](DEMO-VORBEREITUNG.md) (Demo 3/4) · [DEMO-VORFUEHRUNG.md](DEMO-VORFUEHRUNG.md) (Punkt 4 Boss-Signer).
