# Credits nach Nachrichtengröße, Storage & wer darf löschen (kritische Policy)

**Zweck:** Produktideen (**1 vs. 5 Credits**, Speicher-Miete, Nutzer-Löschen mit Rebate, kein willkürlicher Server-TTL) mit **technischer Realität** (Move, Rebate-Regeln, Ist-Code) abgleichen.

**Verknüpfung:** **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`** (PTB, Gas, Credits ≠ MIST), **`docs/PROTOCOL-CHANNELS-TX-VS-STREAMS.md`**, **`docs/EINSATZBERICHT-EXPORT.md`**, **`docs/SPONSORING-AND-CREDITS-DOUBLE-FLOOR.md`**.

---

## 1. Credits nach Größe (z. B. Text vs. 3-KB-Medium)

### 1.1 Produktidee

| Regel (Beispiel) | Abzug |
|------------------|--------|
| Nutzlast **≤ 500 Bytes** (reiner Text) | **1 Credit** |
| Nutzlast **> 500 Bytes** (z. B. komprimiertes Bild ~3 KB) | **5 Credits** |

**Sinn:** Größere On-Chain-Speicherung verursacht typisch **höhere** Storage-Kosten; der Nutzer sieht **vorher** einen höheren Tarif (UX: „Medien-Tarif“).

### 1.2 Kritische Korrekturen

| Aussage | Realität |
|---------|----------|
| „3 KB kostet ~30× mehr Speicher als 100 Bytes Text“ | **Groben Vergleich** kann man zeigen — **exakte** Kosten hängen von **Objektlayout**, **Feldern**, **Verschlüsselung**, **Netzwerk-Storage-Formel** ab. Vor Produktversprechen: **am Zielnetz** messen (Gas/Storage pro Nachricht). |
| „Move prüft einfach Bytes“ | **Muss im Vertrag** implementiert werden (Argumentlänge / Feldgröße); **kein** automatisches Verhalten. |
| „5 Credits decken immer das Storage-Gas“ | **Unsicher**, solange **MIST-Kurs**, **Netzlast** und **Batching** schwanken — eher **Puffer** im Tarif als mathematische Garantie. |
| **Batching (PTB)** | Mehrere Operationen **in einer** TX können **Gas amortisieren** — das ist **kein** „Text-User subventioniert Bild-User“ im Sinne fairer **Credit-Abrechnung**, solange ihr **pro logischer Nachricht** korrekt abzieht. Wirtschaftlich kann ein Batch **trotzdem** günstiger pro Op sein; **Buchhaltung** (Credits) und **Technik** (eine TX) sind **getrennt** zu denken. |

### 1.3 UX (Lite-UI / Next)

**Zielbild:** Vor Senden anzeigen: „**Kosten: 1 Credit**“ bzw. nach Anhang „**5 Credits (Medien-Tarif)**“.

**Ist:** Dazu müssen **Größe** der Nutzlast und **Tarifregeln** in der **App** bekannt sein — **Implementierungsaufgabe**, nicht nur Doku.

---

## 2. Server-TTL vs. Datenhoheit

| Problem | Einordnung |
|---------|------------|
| **Server löscht eigenmächtig** | Kollidiert mit **Self-Sovereign**-Narrativ: wer löscht, hat **Macht** über die Historie. Technisch oft **einfacher** (Cache/TTL), rechtlich/vertrauenslich **heikel**. |
| **Archiv-Wert** | Viele Einsätze brauchen **langfristige** Lesbarkeit → **Chain + lokale Exporte** (`EINSATZBERICHT-EXPORT`) statt „wegwischen“. |
| **3-KB-Kosten** | Storage ist **nicht** immer „existenzbedrohend“ klein — trotzdem **kumulativ** relevant; **Purge** sollte **Policy** sein, nicht Panik. |

**Richtung:** **Kein** stiller Server-Hausputz ohne **transparente** Regeln und ideally **Nutzer-Kontrolle**.

---

## 3. Nutzer-gesteuertes „Recycling“ (Löschen → Rebate → Credits)

### 3.1 Idee

- Beim Senden liegt **Storage Deposit** / gebundenes Gas an der Nachricht (je nach Move-Modell).
- Nutzer **löscht** Nachricht **on-chain** (Purge) → **Storage Rebate** wird frei (Sui-/Rebed-typisch: Teil zurück an den, der Speicher freimacht — **genaue Regel** im **aktuellen Protokoll** lesen).
- **Produktidee:** Rebate fließt an **Sponsor-Server**; Server **gutschreibt** dem Nutzer **1–2 Credits** als Anreiz.

### 3.2 Kritik / Aufwand

| Thema | Risiko |
|--------|--------|
| **Rebate-Empfänger** | Nicht automatisch „immer der Sponsor“ — **Move + Transaktionsstruktur** müssen das **explizit** regeln, sonst landet der Rebate beim **Signer** der Purge-TX. |
| **Credit-Gutschrift** | Braucht **Minter**-Regeln, **Anti-Abuse** (kein endloses Löschen/Erzeugen zum Credit-Farmen), **Idempotenz**. |
| **Event-basiert** | Server muss **zuverlässig** Purge-Events sehen (Indexer, eigener Listener) — **Betriebsaufwand**. |

**Fazit:** Attraktives **Zielbild**, aber **ein eigenes** Move- + Backend-Design — nicht „ein Satz im Relay“.

---

## 4. „Cold Storage“ vor Chain-Löschen

**Ablauf:** (1) **Lokal exportieren** (Vault, Datei, SD, verschlüsselt) — (2) Nutzer bestätigt — (3) **Purge on-chain**.

**Passt zu:** bestehenden **Export**- und **Vault**-Konzepten; rechtlich/psychologisch sauber („meine Beweise erst weg, wenn ich sicher bin“).

---

## 5. Wer darf löschen?

| Regel | Sinn |
|--------|------|
| **Nur Sender und/oder Empfänger** (laut Vertrag) | Standard für **Mailbox**/Nachrichten-Objekte — **kein** zentraler Admin, der Klartext liest, nur um zu löschen (außer ihr **designt** das so). |
| **Server-Notlöschung nach langer Inaktivität** | Nur mit **klarer Policy**, **Frist**, **Ankündigung** — sonst **Vertrauensbruch**. Technisch: **sehr** vorsichtig mit **E2E**-Inhalten (Server sollte **keinen** Klartext brauchen). |

**Ist-Code:** Purge-Befehle existieren (siehe README, `messenger-command-handler`) — **genaue** On-Chain-Berechtigung im **Move-Package** prüfen.

---

## 6. Kurzfassung

| Thema | Status |
|--------|--------|
| **1 / 5 Credits nach Größe** | Sinnvolles **Produkt** + **Move-Pflicht**; Zahlen **am Netz** validieren; UX **„Kosten: X Credits“** separat bauen. |
| **Storage „löst Problem“** | Teils — **Kosten** bleiben, werden nur **tarifiert** und **transparent**. |
| **Kein willkürlicher Server-TTL** | Mit **Nutzer-Purge + Export** besser erzählbar als **stilles** Löschen. |
| **Rebate → Credits** | **Möglich**, braucht **sauberes** ökonomisches und **technisches** Design (Missbrauch!). |

---

*Bei Implementierung: dieses Dokument mit konkreten Move-Entrypoints und gemessenen Storage-Werten pro Nachrichtentyp aktualisieren.*
