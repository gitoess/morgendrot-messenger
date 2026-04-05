# Credits-Kauf: „Server kennt keine Codes“ — wann stimmt das, was ist übertrieben?

**Kontext:** Frage, ob der Relay **wissen muss, wer gekauft hat**, und ob sich **Berechtigung (Credits)** vollständig über **IOTA Rebased / Move** abbilden lässt.  
**Bezug:** **`docs/ARCHITECTURE-PROVISIONED-AUTONOMY-RELAY.md`** (Credits, Sponsoring), **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`**.

---

## 1. Was an der „reinen IOTA“-Story **richtig** ist

- **Keine klassische „Code-Datenbank“ ist zwingend:** Wenn **Credits** als **Move-Objekte** existieren, die **eurem Package** unterstehen und an eine **Nutzer-Adresse** gebunden sind, ist die Chain die **Quelle der Wahrheit** für „dieses Konto hat noch Guthaben“.
- **Der Server muss keine E-Mail→Code-Map speichern**, um beim Senden zu prüfen: Er kann (über RPC/Indexer) prüfen, ob **für die signierende Adresse** ein gültiges Credits-Objekt mit Restbestand existiert — **plus** Signatur des Nutzers, je nach Design (**`ARCHITECTURE-PROVISIONED`** §3).
- **„Wer darf minten?“** läuft über **Move-Regeln** (Admin-Capability, Publisher, Modul-Owner), nicht über eine Server-SQL-Tabelle. Ein kompromittierter **Admin-Key** ist dann **wirtschaftlich** kritisch (unbegrenztes Minten möglich) — Gegenmaßnahmen: getrennte Rollen, Multisig, Limits, Monitoring (**`ARCHITECTURE-PROVISIONED`** § Risiken).

---

## 2. Kritische Korrekturen (häufige Überzeichnung)

### 2.1 „Web2 / Datenbank komplett weg“

**Zu stark formuliert.**

- **Fiat-Zahlung** (Karte, PayPal, Rechnung) läuft fast immer über **Zahlungsdienstleister** und **Buchhaltung** — das ist **nicht** durch „alles on-chain“ ersetzt, außer ihr nehmt **nur Krypto** und der Kauf ist **selbst** eine Chain-TX.
- Selbst dann: **Shop-Frontend**, **Support**, **Rückerstattung**, **Betrugsprävention** brauchen oft **irgendwo** Vorgänge — nur die **Berechtigung** („hat Credits“) kann **on-chain** leben.

**Präziser:** Ihr könnt die **Berechtigung** (Credits-Objekt) **ohne** zentrale Kundendatenbank für **diese** Funktion führen — **nicht**, dass „alles Web2“ verschwindet.

### 2.2 „Der Server erkennt nur seine eigene Unterschrift“

**Richtung stimmt, Formulierung unpräzise.**

- In Move geht es nicht um eine beliebige „Morgendrot-Signatur“ im Marketing-Sinn, sondern um **vertraglich definierte** Objekte: z. B. nur Typ **`Credits`** aus **Package X**, erzeugt nur durch Entry-Funktionen, die eine **bestimmte Capability** brauchen.
- Der Relay prüft beim Lesen typischerweise: **Objekt-ID / Typ / Owner / Restwert** gemäß eurem Modul — nicht „irgendein NFT von irgendwo“.

### 2.3 Mint „an die Shadowwallet beim ersten ECDH“

**Machbar als Zielbild**, aber:

- Für den **Kauf** muss die **Empfänger-Adresse** dem Mint-Prozess bekannt sein — üblich: Nutzer zeigt **QR** oder kopiert **Adresse** in Checkout. Das ist **pseudonym** (Adresse), aber **nicht** „der Server weiß von nichts“, wenn derselbe Server den Checkout bedient.
- **ECDH** allein liefert **kein** automatisches „die Chain weiß meine Adresse vom Handshake“ für einen **fremden** Webshop — es sei denn, der gesamte Kauf läuft **in eurer App** und die App reicht die Adresse an die Mint-TX.

### 2.4 „Keine Datenbank zum Hacken für Gratis-Codes“

**Teilweise richtig.**

- Ein **klassischer Code-Leak** aus einer SQL-DB entfällt, wenn es **keine** solche Codes gibt.
- **Neue Angriffsflächen:** kompromittierte **Admin-/Minter-Keys**, **RPC/Indexer**-Manipulation (selten, aber Supply-Chain), **Phishing** („sende Seed, wir minten Credits“).
- Der **Relay** kann trotzdem eine **Betriebs-DB** für Sessions, Rate-Limits, Logs haben — das ist **orthogonal** zu Credits on-chain.

### 2.5 Gutschein-NFT → Burn → Credits auf Wanderer

**Sinnvoll als Produktidee**, aber **vertraglich** sauber zu bauen:

- **Einmal-Einlösung:** Burn oder Transfer an **Treasury**, danach **neues** Credits-Objekt an Zieladresse — mit **Idempotenz** / Replay-Schutz (**`MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`** Idempotenz-Thema).
- **Doppelte Einlösung** verhindern: nur im **Move-Modul** garantierbar, nicht „nur Relay-Policy“.

### 2.6 „Neues Handy, neue Phrase — einfach Chain scannen“

**Widerspruch, wenn wirklich **neue** Phrase:**

- **Neue Mnemonic** ⇒ in der Regel **neue Adresse** ⇒ **alte** Credits-Objekte hängen an der **alten** Adresse.
- **Wiederherstellung** der Credits funktioniert, wenn die App dieselbe **Adresse** rekonstruiert — also **dieselbe** Phrase / dasselbe Backup wie zuvor (**`ARCHITECTURE-PROVISIONED`** „Gerätewechsel“).

**Korrekt:** „Chain scannen“ findet Objekte für **die Adresse, die die App gerade aus dem Schlüssel ableitet“ — nicht magisch für eine **frische** Identität.

---

## 3. Kurzantwort auf die Titel-Frage

| Frage | Antwort |
|--------|---------|
| **Woher weiß der Server, wer gekauft hat?** | Er **muss** es **nicht** als Person kennen, wenn **Berechtigung = on-chain Credits** an **Adresse A**. Er muss **Adresse A** beim Senden **authentifizieren** (Signatur) und das **Objekt** per Chain-Read prüfen. **Kauf** und **Person** können weiter außerhalb liegen (Händler, Zahlungs-API). |
| **Kann man das über IOTA lösen?** | **Ja** — als **Move-Design**: Minter-Rolle, Credits-Objekt, Abbuchungsregeln, optional NFT-Einlösung. **Nicht** „alles ohne Trade-offs“: Betrieb, Zahlungsweg, Admin-Key-Schutz, Metadaten am Relay bleiben Themen. |

---

## 4. Fazit für Morgendrot

Die **Blockchain als fälschungssichere „Kundenkarte“** für **Guthaben** (nicht für Klartext-Inhalt) ist **konsistent** mit eurem Relay-/Sponsor-Zielbild — **sofern** das Move-Package **Ownership, Mint, Burn und Abbuchung** eindeutig regelt und ihr **Recovery vs. neue Identität** klar kommuniziert.

**Übertrieben:** „Keine Web2-Datenbank mehr irgendwo“, „Server weiß von nichts“, „neue Phrase, alles findet sich von selbst“.

---

*Technische Details des Ist-Codes: Move-Package unter `move-test/`, Messenger-Credits-Integration u. a. `/api/status` — bei Änderungen am Modell Tests und Migration planen.*
