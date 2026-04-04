# Demo 1: Ownership – Ablauf Schritt für Schritt

**Ziel:** Zeigen, dass der digitale Schlüssel ein Objekt ist, das dem Gast **gehört** (on-chain Owner = Gast-Adresse). Kein Datenbank-Eintrag.

---

## Vor dem Start (einmalig)

1. **Wallet 1 (Boss)** läuft **vollständig** (Passwort eingegeben, App „bereit“) mit:
   - `MY_ADDRESS` = deine Adresse (Boss)
   - `PACKAGE_ID` gesetzt (z. B. aus `.morgendrot-package-id`)
   - Optional in `.env`: `LOCK_ID=0x<64 Hex>` (eine feste Lock-ID für die Demo; z. B. `0xdddd...` 64 Zeichen)
2. **Wallet 2 (Gast)** – zweite Instanz oder zweites Gerät mit eigener `MY_ADDRESS` (Gast-Adresse).
3. **Explorer:** https://explorer.iota.org (Testnet) im Tab öffnen.

---

## Ablauf

### Schritt 1: Key ausstellen (Boss)

Auf **Instanz 1 (Boss)**:

- **Terminal:**  
  `/create-key <LOCK_ID> <GAST_ADRESSE> 7`  
  (7 = TTL in Tagen)
- **Oder UI:** Projekt „Schlüssel & Tickets“ → Befehl `/create-key` → Felder: Lock-ID, Empfänger (Gast-Adresse), TTL z. B. 7 → Ausführen.

**Ergebnis:** TX wird gebaut und ausgeführt. Ausgabe enthält eine **Object-ID** (der neue AccessKey). Diese ID im Explorer suchen (oder die letzte TX deiner Boss-Adresse öffnen).

---

### Schritt 2: Beim Gast prüfen (Owner = Gast)

Auf **Instanz 2 (Gast)**:

- **UI:** Tab „Schlüssel & Tickets“ oder „Eigene Objekte“ → Liste der Keys. Dort erscheint der neue Key (lock_id = deine LOCK_ID, Owner = Gast-Adresse).
- **Oder API/Befehl:** `/list-keys` (oder GET `/api/list-keys?owner=<GAST_ADRESSE>`) → Key mit gleicher Object-ID wie in Schritt 1.

**Satz für die Demo:** „Der Gast öffnet seine Wallet – der Schlüssel ist da. Er gehört ihm, on-chain.“

---

### Schritt 3: Im Explorer zeigen (optional)

- Im Explorer: **Object-ID** des AccessKeys eingeben (oder über die TX von Schritt 1 zur Object-ID navigieren).
- Anzeige: **Owner** = Gast-Adresse (nicht Boss).

**Satz für die Demo:** „Das ist kein Eintrag in meiner Datenbank – das Objekt liegt auf der Chain, und der Besitzer ist der Gast.“

---

## Kurz-Checkliste

- [ ] LOCK_ID in .env oder als Argument (64 Hex, z. B. `0xdd...`)
- [ ] Gast-Adresse bekannt (MY_ADDRESS der zweiten Instanz oder PARTNER_ADDRESS)
- [ ] Boss: `/create-key <LOCK_ID> <GAST> 7` ausgeführt
- [ ] Gast: Key in Liste sichtbar (oder `/list-keys`)
- [ ] Explorer: Object-ID → Owner = Gast

---

## Wenn etwas fehlt

| Problem | Prüfen |
|--------|--------|
| PACKAGE_ID ungültig | `.morgendrot-package-id` oder .env, Format `0x` + 64 Hex |
| Key erscheint beim Gast nicht | Einige Sekunden warten; RPC/Explorer auf Testnet; Empfänger = exakt Gast-Adresse |
| LOCK_ID | Beliebige gültige 0x64-Hex (z. B. `0x` + 64× `d`) für reine Demo |

**Demo automatisch durchspielen:** Wenn beide Instanzen laufen (API 3342 + 3345), im Projektordner `npm run demo:1` ausführen. Das Skript stellt den Key aus und prüft die Liste beim Gast (siehe `scripts/run-demo-1-ownership.ts`).

**Weiter:** Nach Demo 1 → [DEMO-VORBEREITUNG.md](DEMO-VORBEREITUNG.md) Demo 2 (PTB) oder [DEMO-VORFUEHRUNG.md](DEMO-VORFUEHRUNG.md) Punkt 2.
