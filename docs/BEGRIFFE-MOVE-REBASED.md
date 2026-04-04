# Begriffe: Move (IOTA Rebased) und MORGENDROT

**Ziel:** Einheitliche, messerscharfe Trennung der Objekttypen und Begriffe, damit Code und Doku nicht kollidieren (z. B. „Schlüssel“ nicht für zwei verschiedene Dinge verwenden).

---

## 1. Was ist was in diesem Move-Package?

Im Package **move-test** (IOTA Rebased) gibt es folgende **On-Chain-Objekte**:

| Begriff in MORGENDROT | Move-Struktur | Zielgruppe | Ablauf | Purge |
|----------------------|---------------|------------|--------|--------|
| **AccessKey** | `AccessKey` (NFT, key+store) | **Gäste** (Airbnb, Spind, Tür) | Erstellen → an Gast senden (oder QR, Key beim Boss) → Nutzung → **purgen** | Nur **Besitzer** kann purgen → Rebate an Besitzer (Gast bei Transfer; **Boss bei QR/ohne Transfer**, §9) |
| **Ticket** | `Ticket` (NFT, key+store) | **Events** (Festival, Einlass) | Erstellen → Versand oder QR → Einlass (use_ticket) → optional purgen | Wie AccessKey: Besitzer purgt (§7–8); **ohne Transfer** Boss purgt, Rebate an Boss (§9) |
| **Vault** | `Vault` (pro Owner) | Boss/Kommandant/Lock | ECDH-Keys, Streams-Anchor; `/vault-save`, `/vault-onchain` | Eigenes Purge-Modell |
| **Mailbox** | `Mailbox`, `Handshake`, `Message` | Chat/Nachrichten | Handshake, Nachrichten (Plain/Encrypted) | Purge Handshake/Message |

---

## 2. AccessKey = Zutritts-Berechtigung (nicht Infrastruktur)

- **AccessKey** ist der **digitale Schlüssel für Tür/Zugang**.
- **Zielgruppe:** Gäste (Airbnb, Spind, Hotel, Schließfach). Der **Empfänger (recipient)** ist die Wallet des Gastes.
- **Ablauf:** Boss/Schloss-Betreiber erstellt AccessKey → Objekt wird an **recipient** (Gast) übertragen → Gast präsentiert das Objekt dem Schloss (On-Chain-Prüfung oder über Gateway) → Tür öffnet. Nach Checkout: **Purge** (Rebate), damit das System nicht mit 100 abgelaufenen Keys überlädt.
- **Nicht:** AccessKey ist **kein** „Dauer-Abo“ für Geräte. Er ist **kein** Worker-Zertifikat und **kein** Geräte-Personalausweis.

**Move-Entsprechung:** Ein **Owned Object** (gehört dem Gast). `create_access_key` → `transfer::transfer(key, recipient)`.

---

## 3. Geräte-Identität (Worker / Tor / Sensor) = kein eigener Key-Typ on-chain

- Die **Identität eines Geräts** (Arbeiter, Tor-Sensor, Tiny) wird in diesem Package **nicht** als separates On-Chain-Objekt „WorkerCap“ oder „DeviceCapability“ abgebildet.
- **Wie Geräte identifiziert werden:**
  - **On-Chain:** Die **Adresse (MY_ADDRESS)** des Geräts bzw. die Adresse, unter der das Gateway für das Gerät signiert. Optional: `device_origin_id` in TicketUsed-Events (welches physische Gerät hat eingelöst).
  - **Off-Chain / Streams:** Heartbeat, Befehle, Sensor-Daten laufen über IOTA Streams (L0.5) oder Nachrichten; die **Geräte-Adresse** und ggf. HMAC/Secret identifizieren das Gerät.
- **Fazit:** Es gibt **keinen** zweiten „Schlüssel“-Typ für Hardware. Der AccessKey ist **ausschließlich** die Zutritts-Berechtigung für Gäste (Tür/Spind/Airbnb). Geräte-Identität = Adresse + Streams/Heartbeat, nicht ein eigenes Key-Objekt.

---

## 4. Ticket = Event-Ticket (Einlass, Festival)

- **Ticket** = zeitgebundenes NFT für **Einlass/Veranstaltung** (event_id = Gate/Event, recipient = Besucher).
- **Ablauf:** Erstellen → ggf. Massen-Versand → Besucher ruft `use_ticket` / `use_ticket_from_registry` auf → Einlass; optional Purge nach Event.
- **Unterscheidung zu AccessKey:** Ticket ist an ein **Event** (event_id) gebunden und hat **valid_from_ms / valid_until_ms**; wird typischerweise **einmal eingelöst** (used = true). AccessKey ist an ein **Schloss (lock_id)** gebunden und kann bis Ablauf mehrfach genutzt werden.

---

## 5. Kurzfassung für Code und UI

| Wenn wir meinen … | Begriff verwenden | Nicht verwenden |
|-------------------|-------------------|------------------|
| Gast-Schlüssel für Tür/Spind/Airbnb | **AccessKey** | „Dauer-Abo“, „Infrastruktur-Schlüssel“, „WorkerCap“ |
| Gerät (Arbeiter, Tor, Sensor) identifizieren | **Geräte-Adresse** / **device_origin_id** / **Streams/Heartbeat** | „AccessKey für Gerät“, „Worker-Key“ |
| Einlass bei Event/Festival | **Ticket** (EventTicket) | „AccessKey“ (das ist für Tür/Zugang) |

**Code:** Die Move-Struktur heißt `AccessKey`; in TypeScript/API heißen die Befehle weiterhin `/create-key`, `/purge-key`, `/list-keys` – semantisch immer **Zutritts-Berechtigung für Gäste**, nicht Geräte-Infrastruktur.

---

## 6. Geräteidentität = IOTA-Adresse (und warum „WorkerCap“ hier nicht existiert)

- **Untere Schicht:** In IOTA Rebased ist die **Geräteidentität** die **IOTA-Wallet-Adresse** (Public Key des Geräts bzw. des Gateways, das für das Gerät signiert). Das ist das „Wer bin ich?“ (passiv).
- **Berechtigung („Was darf ich?“):** Im **aktuellen** Move-Package gibt es **kein** Objekt „WorkerCap“ oder „Dienstausweis“. Die Frage „Darf diese Adresse Befehle ausführen?“ wird **nicht** on-chain über ein Capability-Objekt geprüft, sondern über:
  - **Off-Chain:** Konfiguration (BOSS_ADDRESS, KOMMANDANT_ADDRESSES, AUTHORIZED_SENDERS), Rollen (ROLE), und ggf. Streams/Heartbeat.
  - **On-Chain:** Bei Nutzung von Tickets z. B. `hasValidTicket`; bei Zugang zum Schloss: Prüfung, ob der **Gast** einen AccessKey besitzt – nicht ob das **Gerät** eine WorkerCap besitzt.
- **Fazit:** Heute gilt: **Identität = Adresse.** Ein „Dienstausweis“-Objekt (WorkerCap) existiert im Package nicht. Wenn man das architektonisch einführen wollte („nur wer eine WorkerCap in der Wallet hat, darf Aktion X ausführen“), müsste man es im Move ergänzen. Aktuell reicht die Adresse + Konfiguration.

---

## 7. AccessKey/Ticket: Wem gehört das Objekt – und wer kann rebaten?

- **Tatsache:** Nach `create_access_key` wird das Objekt mit `transfer::transfer(key, recipient)` an den **Gast** übertragen. Es liegt also in der **Wallet des Empfängers**. Dasselbe gilt für Tickets: Sie gehören dem Empfänger.
- **Purge in Move:** `purge_key(key: AccessKey, ctx)` verlangt, dass der Aufrufer das **Objekt** übergibt. In Rebased/Move kann nur der **aktuelle Besitzer** das Objekt an die Funktion übergeben. Der **Issuer (Boss)** darf laut Contract zwar nach Ablauf purgen (`by == key.issuer`), hat aber das Objekt nicht mehr – es liegt beim Gast. **Folge:** In der Praxis kann nur der **Besitzer (Gast)** `purge_key` aufrufen. Der **Storage-Rebate** geht an den Signer der Purge-Transaktion, also an den **Gast**, wenn der Gast purgt.
- **Konsequenz:** Du kannst **nicht** als Boss „benutzte“ Schlüssel oder Tickets aus der Gästewallet heraus löschen und selbst rebaten. Sie gehören dem Empfänger; rebaten kann nur, wer das Objekt besitzt und die Purge-TX signiert.

---

## 8. Rebate-Optionen: Vor- und Nachteile

| Modell | Beschreibung | Vorteile | Nachteile |
|--------|---------------|----------|-----------|
| **Ist-Zustand (Owner purgt)** | Key/Ticket gehört dem Gast. Nur der Gast kann purgen und bekommt den Rebate. | Einfach, beweisbar besitzerorientiert, kein zusätzliches Contract-Design. Gast hat Anreiz zu purgen (Rebate). | Boss bekommt kein Rebate zurück. „Pfand“ geht an Gast. |
| **Anreiz „Schlüssel recyceln“** | Gast wird in der App aufgefordert, nach Checkout zu purgen und erhält den Rebate (z. B. 0,01 IOTA). | Kein Datenmüll, Boss spart Purge-Gas, Gast hat Nutzen. | Boss sieht das Pfand trotzdem nicht; Rebate geht an Gast. |
| **Shared Object / Pinnwand** | Key liegt nicht in privater Wallet, sondern in einem geteilten Objekt (Registry), auf das nur der Gast zugreifen darf. Nach Ablauf kann Boss (oder System) purgen. | Boss kann nach Ablauf rebaten, Kontrolle beim Betreiber. | Erfordert **neues Move-Design** (Shared Object, andere Nutzerführung). Nicht im aktuellen Package. |
| **„Pfandleih“ / Issuer behält Recht** | Contract so geändert, dass der Key nicht wirklich transferiert wird, sondern „geliehen“ ist; Boss kann nach TTL zurückfordern. | Boss könnte rebaten. | Erfordert **Contract-Änderung**, widerspricht dem üblichen Owned-Object-Modell („Key in Gästewallet“). Komplexität und Rechtssicherheit (Wer „besitzt“ den Schlüssel?) müssen geklärt werden. |
| **Gast ohne Wallet (QR, Key beim Boss)** | Key/Ticket wird **nicht** an den Gast transferiert. Boss erstellt, stellt QR/Link aus; Gast scannt am Tor. Objekt bleibt in Boss-Wallet. Nach TTL purgt der Boss. | **100 % Rebate an Boss.** Kein Contract-Change. Massentauglich (Festival, Airbnb). | Gast „besitzt“ kein Objekt; Zutritt nur über QR/Link. Siehe §9. |

**Empfehlung für 100 % klare Linie:**  
- **Jetzt:** Dokumentieren, dass **benutzte Keys/Tickets dem Empfänger gehören** und **nur der Besitzer rebaten kann**. Option „Gast recyceln & Rebate erhalten“ als Anreiz in der UI (Button „Schlüssel recyceln“) umsetzbar, ohne Move-Änderung.  
- **Später (optional):** Wenn Boss zwingend Rebate zurückhaben soll, müsste ein **neues Modell** (Shared Object oder explizite „Leih“-Logik) im Move entworfen und eingeführt werden – mit klaren Vor- und Nachteilen wie in der Tabelle.

---

## 9. Gast ohne Wallet – Massentauglichkeit (zKLogin, QR-Code)

Viele Gäste (Airbnb, Festival, Spind) haben **keine** IOTA-Wallet und sollen auch keine installieren müssen. MORGENDROT löst das durch **Abstraktion**: Der Nutzer merkt nicht, dass er eine Blockchain nutzt.

### 9.1 Zwei Wege: Schatten-Wallet vs. Key bleibt beim Boss

| Weg | Technik | Wer „besitzt“ on-chain? | Rebate |
|-----|---------|---------------------------|--------|
| **Schatten-Wallet (zKLogin/Enoki)** | Gast loggt sich mit Google/Apple ein → im Hintergrund wird eine IOTA-Adresse an seinen Account gebunden. Kein Seed, keine App. | Der Gast (über gebundene Adresse). Key kann an diese Adresse transferiert werden. | Wie §7–8: Nur Besitzer kann purgen → Rebate an Gast (oder Anreiz „Recyceln“). |
| **QR-Code-Link (Key bleibt beim Boss)** | Boss erstellt Key/Ticket, **transferiert nicht**. Stattdessen: QR-Code/Link an Gast (WhatsApp/E-Mail). Gast scannt am Tor; Einmal-Signatur oder Server-Prüfung legitimiert den Zutritt. Das Objekt bleibt in der Wallet des Bosses. | **Boss.** Der Gast „besitzt“ kein On-Chain-Objekt. | **Boss** kann nach Ablauf selbst purgen → **100 % Rebate an Boss.** |

### 9.2 Schatten-Wallet (zKLogin / Enoki)

- **Ablauf:** Gast öffnet einen Link, loggt sich mit Google oder Apple ein. Im Hintergrund: IOTA-Adresse wird an diesen Account gebunden (zKLogin/Enoki-ähnlich). Boss kann den Key an **diese** Adresse senden.
- **Vorteil:** Keine Wallet-App, keine Seed-Phrase. „Google-Login = mein Schlüssel.“
- **Rebate:** Objekt gehört der gebundenen Adresse (dem Gast). Purge/Rebate wie in §7–8 (Gast oder Anreiz „Recyceln“).

### 9.3 QR-Code-Link (Key bleibt beim Boss)

- **Ablauf:** Boss erstellt Key/Ticket, **ohne** `transfer` an den Gast. Stattdessen: QR-Code (oder Deep Link) mit Einmal-Token/Link. Boss sendet den QR per WhatsApp/E-Mail. Gast scannt am Tor; Arbeiter/Gate prüft Gültigkeit (z. B. gegen Boss-Server oder Einmal-Signatur auf der Chain). Das **Objekt** bleibt in der Wallet des Bosses.
- **Vorteil:** Gast braucht **nichts** – weder Wallet noch Login. Maximal massentauglich (Festival, Hotel, Spind).
- **Rebate:** Da der Boss das Objekt behält, kann er nach Ablauf (TTL) selbst **purgen** → Storage-Rebate zu **100 %** an den Boss. Kein Contract-Change nötig: Kein Transfer = Boss bleibt Owner.

### 9.4 Kurzfassung für den Wizard

- **Gast mit Wallet (oder Schatten-Wallet):** Key/Ticket an Gast-Adresse senden → Gast besitzt Objekt → nur Gast kann purgen → Rebate an Gast (oder UI-Anreiz „Schlüssel recyceln“).
- **Gast ohne Wallet (nur QR):** Key/Ticket **nicht** transferieren; QR/Link ausstellen. Objekt bleibt beim Boss → nach Ablauf Boss purgt → **Rebate zu 100 % an Boss.**
