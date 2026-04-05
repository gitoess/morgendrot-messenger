# Architektur-Skelett: Provisioned Autonomy, Relay, Gas-Sponsoring, Credits

**Status:** Zielbild / Referenz für Design und Reviews. **Kein** vollständiger Ersatz für den konkreten Ist-Codepfad des Messengers; wo etwas bereits existiert (z. B. Sponsor-Gas, Messenger-Credits), ist das unten vermerkt.

**Zweck:** Einheitliche Begriffe für „Nutzer ohne Wallet-App, aber mit eigener On-Chain-Identität“, „Server zahlt Gas“, „Credits regeln Berechtigung“, „Chat-Inhalt E2E“.

---

## 1. Identität: „Provisioned Autonomy“

**Was:** Einmalige Bereitstellung einer **dedizierten Adresse** (Schlüsselpaar) für einen Nutzer.

**Ablauf (Soll):**

1. Server erzeugt Schlüsselmaterial **nur flüchtig** (idealerweise RAM, kein Klartext-Log).
2. Übergabe an das Endgerät **verschlüsselt**, z. B. über ein **ECDH**-geleitetes Geheimnis (Client sendet Ephemeral-Public-Key, Server antwortet mit verschlüsseltem Paket).
3. Nach bestätigtem Import: Server **verwirft** das Schlüsselmaterial; der Nutzer (Gerät) ist **allein** in der Lage, im Namen dieser Adresse zu **signieren**.

**Kritisch / Randbedingungen:**

- **ECDH allein** authentifiziert den Server **nicht**. Ohne **TLS**, **Zertifikats-Pinning**, **signierte Server-Antwort** oder anderes **Trust-Anchor**-Modell ist ein **MITM** möglich (Angreifer liefert falsches „Wallet-Paket“).
- **„Löschen“** auf dem Server ist eine **Betriebs**eigenschaft (kein mathematischer Beweis): Backups, RAM-Dumps, kompromittierte Hosts bleiben Risiken.
- In der **Erzeugungsphase** hatte der Server **vollen** Zugriff — das ist **zeitlich begrenztes Custody**, kein dauerhaftes, aber auch kein „Server war nie beteiligt“.

---

## 2. Treibstoff: Gas-Station / Sponsoring (IOTA Rebased, Move)

**Problem:** On-Chain-Aktionen verursachen **Gebühren** (typisch MIST/Gas). Nutzer ohne eigene Coins können nicht selbst „tanken“.

**Soll-Logik:**

- Der **Nutzer** signiert mindestens den **Intent** (was soll passieren): z. B. Hash der Nutzlast, Empfängerbezug, Nonce — genau im **vertraglich vorgesehenen** Format.
- Der **Server** (Sponsor-Wallet) trägt die **Gebühr** für die Einreichung der Transaktion, **sofern** die Regeln des Move-Pakets und des Netzwerks das erlauben (Sponsored-Transactions-Muster).

**Ergebnis (Zielbild):** Die Kette speichert die Nachricht (oder den Verweis darauf) gemäß eurem **Messaging-Modul**; die **Kosten** trägt der Dienst, die **inhaltliche Autorisierung** kommt vom Nutzer-Schlüssel.

**Kritisch:**

- Die **exakte** Signaturkette (wer signiert welche `TransactionData`-Teile) hängt von **SDK und Move-Entrypoints** ab — nicht pauschal „Server hängt nur Gas dran“. Das muss **pro Release** mit der echten PTB/Sponsor-API abgeglichen werden.
- **Ist-Stand im Repo:** Sponsored Transactions und Gas-Sponsor sind für **andere** Flows angelegt (z. B. `SPONSOR_GAS_OWNER`, `sponsorForSender`); siehe **`docs/INDUSTRY-FEATURES.md`**, **`.env.example`** (`SPONSORED_TRANSACTION_ENABLED`, `SPONSOR_*`). Messenger-spezifisches Sponsoring ist **nicht** automatisch identisch mit diesem Skelett.

---

## 3. Absicherung: On-Chain Credits

**Was:** Berechtigung, den Server zum **Bezahlen** zu veranlassen, soll **nicht** nur in einer Datenbank stehen, sondern in **Move-Objekten** (Credits), die ihr ausgebt und regelbasiert verringert.

**Soll-Prüfung vor Sponsoring:**

1. **Chain-Read:** Credits-Objekt existiert, gehört zur **Nutzer-Adresse** (oder ist an sie gebunden), Restguthaben **> 0** (oder vergleichbare Regel).
2. **Kryptografischer Beweis:** Die eingereichte **Signatur** passt zu einem Schlüssel, der zu **dieser** Adresse gehört (bzw. zu dem in eurem Modell erlaubten Schlüsseltyp).
3. **Erst dann** baut der Server die (gesponserte) Transaktion ein.

**Kritisch:**

- **Objekt-IDs allein** reichen nicht — wer die ID kennt, darf noch nicht senden. Es braucht **Besitznachweis** (Signatur).
- **Atomarität:** „Nachricht speichern“ und „Credit abziehen“ sollten im **gleichen** Move-Design **konsistent** sein (eine TX oder klar definierte Reihenfolge mit Failure-Handling), sonst drohen **Race Conditions** oder **Doppelverbrauch**.

**Ist-Stand:** `MESSENGER_CREDITS_OBJECT_ID` und Credits-Anzeige in **`/api/status`** — Details der Vertragslogik im Move-Package prüfen.

---

## 4. Privatsphäre: E2E für Inhalt („Blind Relay“)

**Was:** Der **Klartext** der Nachricht soll für Backend und für unbeteiligte Chain-Beobachter **ohne Schlüssel** nicht lesbar sein.

**Soll:**

- Endgerät verschlüsselt **lokal** (E2E mit dem Kommunikationspartner gemäß eurem Messenger-Protokoll).
- Relay leitet **Ciphertext** weiter; idealerweise **kein** Klartext-Logging.

**Grenzen:**

- **Metadaten** (Zeitpunkt, Größe, Absender-Adresse des Relay-Clients, IP, Rate) sind **sichtbar** — das ist **nicht** durch E2E beseitigt.
- **Blockchain:** Speicherformat (z. B. verschlüsselte Blob in Mailbox) ist öffentlich **sichtbar** als Daten; **Vertraulichkeit** = Verschlüsselung, nicht „unsichtbar“.

---

## Transportunabhängigkeit

Die **gleiche** logische Reihenfolge gilt unabhängig vom Kanal:

| Schritt | Client | Server | Chain |
|--------|--------|--------|--------|
| 1 | E2E-Verschlüsselung der Nutzlast | — | — |
| 2 | Signatur über vereinbarten Intent / Nutzlast | — | — |
| 3 | Übergabe an Relay (HTTPS, später LoRa-Gateway, …) | Prüft Credits + Signatur | — |
| 4 | — | Stellt gesponserte TX bereit / reicht ein | Speichert + verringert Credits (laut Vertrag) |

LoRa ist nur **Transport** mit anderen **Latenz- und Größen**limits — keine eigene Kryptologie.

---

## Zusammenfassung (ein Satz pro Säule)

1. **Provisioned Autonomy:** Einmalige sichere Übergabe der Identität ans Gerät; Server ohne dauerhaften Schlüssel — **mit** klarem Trust-Modell bei Erzeugung und ECDH.
2. **Sponsoring:** Nutzer autorisiert Inhalt/Intent; Server zahlt Gas nur bei gültiger Berechtigung — **exakte** TX-Form vom Stack vorgeben.
3. **Credits:** Berechtigung und Abrechnung **regelbasiert** on-chain — **mit** Besitznachweis und sauberer Atomarität.
4. **E2E:** Inhalt nur auf Endgeräten lesbar; Relay **blind** für Klartext — **ohne** Illusion „keine Metadaten“.

---

## Gerätewechsel: Messenger-Identität „mitnehmen“

**Ja, möglich** — sobald die **On-Chain-Identität** (Adresse) durch ein **vom Nutzer dauerhaft kontrolliertes** Geheimnis ableitbar ist. Der Server kann den Schlüssel nach dem Provisioning gelöscht haben; **die Kette** „erinnert“ sich weiter an **Credits und Kontostand dieser Adresse**.

### Weg 1: Recovery Phrase (klassisch, „analog“ sichern)

- Beim **ersten** Setup (oder in einem dedizierten Sicherungsdialog) zeigt die App eine **mnemonische Phrase** (typisch 12–24 Wörter), aus der sich dieselbe **Keypair-/Adress-Ableitung** ergibt wie bei der ursprünglichen Provisionierung — **nur wenn** ihr beim Erzeugen dieselbe **Derivationslogik** (BIP-ähnlich o. Ä.) verwendet und die Phrase **wirklich** zu genau diesem Schlüssel gehört.
- **Nutzer:** Phrase **offline** aufbewahren (Papier, Safe); **nicht** in Messenger-Chats, Screenshots oder Klartext-Cloud legen.
- **Neues Gerät:** App installieren, **Wiederherstellung** wählen, Phrase eingeben → dieselbe Adresse → **Credits-Objekte** und Mailbox-Bezug zu dieser Adresse sind wieder nutzbar (sofern das Move-Modell an die Adresse bindet).

**Kritisch:** Eingabe der Phrase auf einem **neuen** Phone hat dieselben Risiken wie überall (Phishing, Keylogger, Blick über die Schulter). **Alternative:** Hardware-Wallet / Secure-Element-Pfad, wo die Phrase **nie** in ein Web-Textfeld muss.

### Weg 2: Export verschlüsselter Backup-Datei

- Nutzer setzt ein **starkes Passwort**; App exportiert **verschlüsseltes** Key-Material (Datei oder QR-Chunking). Auf dem neuen Gerät Import + Passwort.

**Vorteil:** Keine Phrase auf Papier nötig; **Nachteil:** Passwortverlust = Verlust der Identität (wie Phrase verloren).

### Weg 3: Kein Backup (bewusst)

- Verlust des Geräts **ohne** Phrase/Export = typischerweise **kein** Zugriff mehr auf die Signatur zu dieser Adresse — **Credits** können on-chain noch existieren, sind aber **praktisch unbenutzbar** ohne Schlüssel (sofern kein Social Recovery im Vertrag vorgesehen).

### Was die Chain „von selbst“ liefert — und was nicht

Die **Adresse** aus dem Schlüssel ist der **Anker** für alles, was **on-chain** wirklich an **diese** Adresse gebunden ist (Ownership, Events mit `sender`/`recipient` = du, in eurem Messaging-Modell).

| Thema | Typisch automatisch wiederfindbar? | Anmerkung |
|--------|-------------------------------------|-----------|
| **Credits-Objekt(e)** | **Oft ja**, wenn die App weiß, **welchen Objekttyp** sie unter welchem **Package** sucht (Move-Modul). Dann: Indexer/RPC → Objekte des Nutzers filtern. | Ohne **Package-ID / Typ-Information** kann kein Client „raten“, welche von Millionen Objekten deins sind — die **PACKAGE_ID** ist das **deployte Programm**, oft **netzweit gleich**, nicht pro Nutzer aus der Adresse ableitbar. |
| **PACKAGE_ID** | **Nein**, nicht „magisch“ aus der Adresse. | Kommt aus **Deployment** / **Netzwerk-Konfiguration**: App-Bundle, Server-Default, oder einmalige Nutzer-Eingabe. Derselbe Nutzer nutzt dasselbe Package wie alle anderen Clients des Dienstes — es ist **kein** persönliches Geheimnis. |
| **MAILBOX_ID** | **Nein** als persönliche Ableitung. | **Gemeinsames** Mailbox-Objekt im Move-Design; ID steht in **Konfiguration** (`.env`, `/api/status`), nicht „auf der Adresse berechnet“. |
| **Streams / Anchor** | **Nein** automatisch aus der Seed-Phrase. | `STREAMS_ANCHOR_ID` etc. sind **Dienst-/Kanal-Konfiguration**, nicht die Wallet-Adresse. |
| **Nachrichten (Mailbox/Events)** | **Teilweise:** Fetch-Logik braucht **MY_ADDRESS** + **PACKAGE_ID** + ggf. **MAILBOX_ID** und fragt dann gezielt ab. | Ohne diese Parameter „saugt“ die App **nicht** die ganze Welt-Historie; sie **indexiert** nach eurem Protokoll. **Pruning:** Alte Events können je nach Node **nicht mehr vollständig** abfragbar sein. |
| **Kontakte / lokale UI-Daten** | **Nein** auf der Chain, sofern nicht explizit on-chain gespeichert. | Nur was ihr **persistiert** (Gerät, Server, Vertrag), kommt zurück. |
| **E2E-Chat-Inhalt** | Wiederherstellung nur mit den **richtigen** Schlüsseln pro Gespräch (ECDH/Session), nicht automatisch nur durch die Seed-Phrase — je nach eurem Protokoll. | **Seed-Phrase** = Identität auf L1; **Chat-Entschlüsselung** kann **zusätzliche** Geheimnisse (Session-Keys, Partner-Handshakes) brauchen, die **nicht** allein aus der Chain kommen. |

**Kurz:** Die Blockchain ist die **Wahrheit für On-Chain-Status** (Credits, was unter eurem Move-Modell gespeichert ist). **Package-ID, Mailbox-ID, Anchor** sind in der Praxis **Konfiguration + Protokoll**, keine automatische Folge der 12 Wörter. Ein **Morgendrot-Server** ist weiterhin nützlich für **RPC-URL**, **Defaults** und **komfortable** Synchronisation — auch wenn der Nutzer „identisch“ wiederhergestellt ist.

### Kurz

| Frage | Antwort |
|--------|---------|
| Kann der User das Handy wechseln? | **Ja**, mit **Wiederherstellung** aus einem **Backup des Schlüssels** (Phrase oder verschlüsselter Export). |
| Sind Credits „mit dabei“? | Sie hängen an der **Adresse** auf der Chain, nicht am Gerät — der Zugriff kommt vom **Schlüssel**. |
| Weiß das neue Gerät automatisch Package-ID / Mailbox / Anchor? | **Größtenteils nein** — das sind **Netzwerk- und App-Konfiguration**, nicht die Adresse. **Ja** für alles, was ihr **explizit** aus der Chain ableitet (z. B. „meine Objekte vom Typ X unter Package Y“), sobald **Y** und **Typ** bekannt sind. |
| Was muss das Produkt explizit tun? | **Ein** klares Recovery-Konzept (Phrase anzeigen, bestätigen, Wiederherstellungs-Flow), **kein** stilles Wegwerfen der Identität ohne Nutzerhinweis. |

---

## Skalierung: Server bündelt zu PTB? Zeitfenster?

**Kurzantwort:** **Ja, das ist ein gangbar Weg** — der Server kann **berechtigte** Einzeloperationen in einer **Warteschlange** sammeln und bei Bedarf **eine** Transaktion mit **mehreren** Move-Aufrufen (Programmable Transaction Block, PTB) einreichen. **Zeitlich zu begrenzen** (und/oder nach **Anzahl**) ist **empfehlenswert**, sonst warten Nutzer zu lange oder die Transaktion wird zu groß/teuer.

### Bündeln (Batching)

- **Queue:** Eingehende Anfragen (nach Credits-/Signatur-Prüfung) werden in eine **Queue** gelegt.
- **PTB:** Statt N-mal Netzwerk-Roundtrips mit N einzelnen TX baut der Dienst **eine** Transaktion mit **N programmierten Aufrufen** (typisch mehrere `moveCall`s an dasselbe oder verschiedene Objekte — genau nach eurem Move-Design).
- **Nicht** „beliebig viele“: Pro TX gelten **maximale Transaktionsgröße**, **Gas-/Compute-Limits** und oft **praktische** Obergrenzen (z. B. einige Dutzend Aufrufe — **Messwerte vom Netz/SDK**, nicht pauschal „1000“).

### Zeitfenster und Schwellen (typisches Muster)

Zwei **kombinierte** Kriterien (welches **zuerst** eintritt, gewinnt):

| Schwellwert | Rolle |
|-------------|--------|
| **max_count** | Sobald **z. B. 10–50** (konkret zu messen) Einträge in der Queue sind → PTB **sofort** bauen und senden. |
| **max_wait_ms** | Wenn nach **z. B. 300–2000 ms** noch nicht genug da ist → **trotzdem** senden, damit die ersten Nutzer nicht hängen bleiben. |

**Ziel:** Balance zwischen **Kosten** (weniger Basis-Overhead pro Nachricht), **Latenz** (Messenger: oft **unter ~1–2 s** akzeptabel, ab **vielen Sekunden** fühlt sich „lahm“ an) und **Erfolgswahrscheinlichkeit** der TX (nicht an Gas scheitern).

### Warum begrenzen?

1. **Latenz:** Unbegrenztes Warten = schlechte UX.
2. **Gas / Größe:** Zu viele Schritte in **einer** TX → **Out of Gas** oder **Tx zu groß** → gesamter Batch schlägt fehl (je nach Move: oft **atomar** — ein fehlgeschlagener Aufruf kann die ganze TX invalidieren; das muss im Vertrag/Flow berücksichtigt werden).
3. **Fairness:** Längere Queues ohne Timeout bevorzugen „spätere“ kleine Batches gegenüber dem, der zuerst wartet — **Timeout** leert regelmäßig.

### Adress-Pool (parallel)

Wenn **mehrere** Sponsor-/Sender-Adressen (Pool) existieren, können **parallel** unabhängige PTBs laufen (jeweils eigene **Sequenz**/Objekt-Konten nach Rebased-Regeln). Das mildert ein **Nadelöhr** einer einzelnen Konto-Adresse — **ohne** mathematische „tausende pro Sekunde“-Garantie; immer noch begrenzt durch **RPC**, **Chain-Durchsatz** und **Kostenbudget**.

### Validierung ohne „User-Whitelist“

Das Move-Package muss Nutzer **nicht** vorab kennen: **Regeln** (z. B. Credits gehören Adresse A, Signatur passt) reichen. Neue Adressen funktionieren **sobald** sie on-chain gültige Objekte und Signaturen haben — das ist **kein** Ersatz für **Abuse-Schutz** (Rate-Limits, Monitoring) auf dem Relay.

### Was dies **nicht** ist

- **Kein** Ersatz für saubere **Ist-Implementierung** im aktuellen Morgendrot-Code — dieses Kapitel ist **Zielbild**.
- **Kein** alleiniger Skalierungshebel: zusätzlich **Indexer**, **Sharding** mehrerer Relays, **Kapazitätsplanung** RPC.
- Größen wie „3 KB“ in älteren Texten = **Beispiel**; die Logik gilt **generisch** für gebündelte Messenger-Operationen.

---

## Sponsor-Server rotieren: neuer Server-Seed, gleiche Nutzer

**Kern:** Der **Sponsor** (Server-Wallet) zahlt nur **Gas** / erfüllt die **Relay-Rolle**. **Nutzer-Identität** (Schlüssel auf dem Gerät) und **Credits an Nutzer-Adressen** sind davon **logisch getrennt** — ein Wechsel der Server-Wallet erzwingt **keinen** Verlust der Nutzerdaten in der beschriebenen Architektur.

### Drei praktische Wege (Client ↔ neuer Relay)

| Weg | Idee | Kritik / Präzisierung |
|-----|------|-------------------------|
| **1. Gleiche API-URL (DNS)** | Clients rufen weiterhin z. B. `https://api.example.com` auf; der **DNS**-Eintrag zeigt auf die **neue** Maschine/IP. Neuer Prozess nutzt **neuen** Sponsor-Key in `.env`. | Nutzer merken oft **nichts**, sofern API-Vertrag gleich bleibt. **TLS**-Zertifikat und **Domain-Kontrolle** müssen stimmen, sonst MITM-Risiko. |
| **2. On-Chain Berechtigung** | Im Move-Package existiert eine **Rollen-/Allowlist-Logik** (z. B. welche Adresse **sponsorn** oder **Credits minten** darf). Mit **Admin-/Owner-Key** (offline gut verwahrt): alte Sponsor-Adresse **entziehen**, neue **eintragen**. | **Voraussetzung:** Das ist **im Vertrag** vorgesehen und **getestet**. Ohne solche Objekte hilft „neuer Seed“ allein **nicht** — die Chain akzeptiert weiterhin alte Regeln. |
| **3. Client-Update** | Server-URL oder **Server-EPH-Public-Key** (ECDH) steht **hart** in der App → **PWA-/App-Update** verteilen. | Unvermeidbar, wenn kein stabiler DNS-Name und keine Chain-Steuerung genutzt wird. |

**Korrektur:** Ein Sponsor-Wechsel bedeutet **typischerweise keine neue PACKAGE_ID** — das **Move-Paket** bleibt; geändert wird die **Sponsor-Adresse** / **Berechtigung** oder die **Anbindung** zum Backend. **PACKAGE_ID** wechselt eher bei **neuem Deployment** eines **anderen** Vertrags (Migration), nicht bei jedem Server-Tausch.

### Was sich **nicht** ändert (wenn Nutzer-Keys gleich bleiben)

- **Nutzer-Schlüssel / „Shadowwallet“** in den Geräte-Vaults.
- **Credits-Objekte**, die **Nutzer-Adressen** gehören (sofern das Modell das so abbildet).
- **E2E-Ciphertext** — der neue Server sieht dieselbe **Unkenntnis** wie der alte, sofern nie Klartext auf dem Relay verarbeitet wurde.

Neu ist nur: **wer** die Transaktionsgebühr auf der Sponsor-Seite **signiert** und **welches** Relay die Requests annimmt.

### Notfallplan (straff)

1. **Betroffene Rechte on-chain anpassen** (falls vorgesehen): alte Sponsor-/Minter-Rolle **sperren**.
2. **Neuen** Sponsor-Account mit **frischem** Key und **Gas** (MIST) bestücken.
3. **Traffic** (DNS / Load-Balancer) auf die neue Instanz; Clients weiterhin gleiche URL oder Update ausrollen.

---

## SPOF-Analyse: Server-Seed / Sponsor-Wallet

| Aspekt | Bei Kompromittierung / Verlust des Server-Seeds |
|--------|-----------------------------------------------|
| **Verfügbarkeit** | **Ja, SPOF** für den **Dienst** „Relay sponsort Gas“: ohne funktionierende Wallet mit Mitteln können **keine** (oder keine neuen) gesponserten TX eingereicht werden. |
| **Finanzen** | Token/MIST auf der **Server-Adresse** können **abfließen** — **Betriebs-/Treasury-Risiko**, kein Nutzer-E2E-Inhalt. |
| **E2E-Inhalt der Chats** | **Typisch sicher**, wenn der Server **nur** Ciphertext weiterreicht und **nie** die Klartext-Keys der Nutzer hält. Der Dieb „sieht“ weiterhin nur **Blob**. |
| **Nutzer-Identität (Signatur Chat)** | **Sicher**, solange **Nutzer-Private-Keys** nur auf Endgeräten liegen — der Server-Seed ersetzt **keine** Nutzersignatur für deren Adresse. |
| **Credits der Nutzer** | **Nicht** beliebig „umschreibbar“ ohne **Nutzer-Signatur**, sofern das Move-Modell **Ownership** korrekt setzt. |
| **Minter-/Admin-Rolle** | **Hohes Risiko:** Wenn derselbe kompromittierte Key **unbegrenzt Credits minten** oder Rollen ändern darf → **wirtschaftlicher** und **betrieblicher** Schaden. **Gegenmaßnahmen:** getrennte Keys (Minter vs. Sponsor), **Multisig**, **Timelock**, **Limits**, **Monitoring**, **Notfall-Pause** im Vertrag. |

**Kurz:** Der Server-/Sponsor-Seed ist ein **SPOF für Betrieb und Treasury**, **kein** Ersatz für „alles weg“ bei **Nutzer-Vertraulichkeit** — **sofern** E2E und Schlüsselhaltung wie beschrieben umgesetzt sind. **„Perfekt“** oder **„unkaputtbar“** sind **unzutreffend**; es bleiben **Metadaten**, **Relay-Verfügbarkeit** und **Minter-/Admin-Design**.

---

## Verwandte Dokumentation

- Messenger-Datenfluss Posteingang: **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**
- Sponsor-Gas (Ist, andere Use-Cases): **`docs/INDUSTRY-FEATURES.md`**, **`docs/ENV-ERKLAERUNG.md`**
- Konfiguration: **`.env.example`**

---

*Bei Änderungen am Move-Package oder am Sponsor-Flow dieses Skelett und die „Ist“-Verweise aktualisieren.*
