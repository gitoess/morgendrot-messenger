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

## Verwandte Dokumentation

- Messenger-Datenfluss Posteingang: **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**
- Sponsor-Gas (Ist, andere Use-Cases): **`docs/INDUSTRY-FEATURES.md`**, **`docs/ENV-ERKLAERUNG.md`**
- Konfiguration: **`.env.example`**

---

*Bei Änderungen am Move-Package oder am Sponsor-Flow dieses Skelett und die „Ist“-Verweise aktualisieren.*
