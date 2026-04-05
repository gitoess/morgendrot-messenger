# Wanderer-Einlösen (A–D): Abgleich mit Repo-Ist und Verbesserung

**Zweck:** Eure **Erzählung** (temporärer Schlüssel → Code einlösen → echte Wallet + Credits → Chain) gegen **Code** und **bestehende Architektur-Doku** spiegeln — ohne zu behaupten, alles sei schon gebaut.

**Verknüpfung:** **`docs/ARCHITECTURE-PROVISIONED-AUTONOMY-RELAY.md`**, **`docs/CREDITS-PURCHASE-ONCHAIN-CRITIQUE.md`**, **`docs/VOUCHER-PRE-MINT-AND-SHOP.md`** (Voucher vorproduzieren, Shop vs. Relay).

---

## 1. Die beschriebene Reihenfolge (Kurz)

| Schritt | Inhalt |
|---------|--------|
| **A** | PWA installieren; **lokal** temporäres Schlüsselpaar (nur für sicheren Kanal zum Relay). |
| **B** | **Kauf-Code** + **temporärer Public Key** ans Relay (Internet oder Gateway). |
| **C** | Relay prüft Code; erzeugt **dauerhafte** Identität (Seed) + packt sie **verschlüsselt** (z. B. mit Ephemeral-ECDH) zurück; Gerät speichert im Vault, verwirft Temp-Key. |
| **D** | Relay: **On-Chain** Credits für die **Adresse der dauerhaften Wallet**; **Gas** zahlt Sponsor — Nutzer braucht kein MIST für diesen Schritt. |

**Sinn:** Der **Katze-in-den-Schwanz**-Konflikt („Credits braucht Adresse, Adresse braucht Schutz beim ersten Kontakt“) wird durch einen **kurzen** Custody-Moment beim Relay plus **verschlüsselte** Übergabe aufgelöst — konsistent mit dem **Provisioned-Autonomy**-Zielbild.

---

## 2. Was das Repo **heute schon** hat (Ist)

| Thema | Ist im Code / Doku |
|--------|---------------------|
| **Sponsoring / Gas** | Sponsor-Wallet (`SPONSOR_*`, gesponserte TX) — siehe **`INDUSTRY-FEATURES.md`**, **`ARCHITECTURE-PROVISIONED`** §2. |
| **Credits sichtbar** | `MESSENGER_CREDITS_OBJECT_ID`, Anzeige über **`GET /api/status`** — Credits sind **konfiguriert**, nicht automatisch pro Wanderer gemintet. |
| **ECDH / Handshake / Vault** | Messenger-Handshake, Vault speichert **ECDH-Keys** für Chat — **nicht** derselbe Mechanismus wie „Einlöse-Ephemeral für Seed-Übergabe“. |
| **Boss-Provisioning** | **`/api/provision-device`**, Werkstatt-Flows, optional **`/api/provision-vault`** — Fokus **Boss → Gerät**, nicht **Wanderer + Voucher-Code ohne Boss-UI**. |
| **„Shadow“ im Code** | **`/api/shadow-sweep`**, `shadow-sweep.ts`: **Schatten-Mnemonic** → **Main-Wallet** sweep (Assets umziehen). Das ist ein **anderes** Konzept als eure **„Shadowwallet“ als Ziel-Identität** im Wanderer-Text — **Begriff nicht vermischen** (siehe §4). |

**Fazit:** Die **komplette Pipeline A→B→C→D** als **eine** definierte API („redeem voucher + ephemeral pubkey → encrypted mnemonic + mint credits“) ist im Repo **nicht** als durchgängiger Produktpfad nachweisbar — Teile (Sponsor, Credits-Objekt-ID, Vault, ECDH) **existieren** einzeln.

---

## 3. Wird es dadurch „verbessert“?

| Aspekt | Bewertung |
|--------|-----------|
| **Klarheit** | **Ja** — die Reihenfolge macht das **Trust-Modell** explizit: kurzes Relay-Custody, dann **nur noch** der Nutzer hat den Seed (wenn C sauber umgesetzt und Server-Secrets verworfen). |
| **Technische Konsistenz** | Passt zu **`ARCHITECTURE-PROVISIONED`** (ECDH-Übergabe, Sponsor für erste Chain-Schritte) und zu **on-chain Credits** (`CREDITS-PURCHASE-ONCHAIN-CRITIQUE`). |
| **Implementierungsaufwand** | **Neu** braucht ihr: **voucher-/Code-Logik** (einmalig, serverseitig oder on-chain), **API** für B/C, **harte** Sicherheits-Checks (TLS, Replay, Rate-Limits), **Move**-Pfad für Mint + ggf. atomare Reihenfolge mit Adresse. |

Ohne diese Implementierung bleibt es eine **gute Spezifikation** — sie **ersetzt** keine fehlenden Endpunkte, sie **beschreibt** sie.

---

## 4. Begriff „Shadowwallet“ vs. Code „Shadow“

- **Euer Text:** „Shadowwallet“ = die **eigentliche** Messenger-Adresse nach dem Einlösen.
- **Repo:** **Shadow-Sweep** = **alter** / **Schatten**-Mnemonic wird **aufgeräumt** und Vermögen **auf** eine Main-Adresse gezogen.

**Empfehlung:** In Produkt-Doku für den Wanderer-Pfad einen anderen Begriff nutzen (z. B. **„Messenger-Wallet“**, **„Haupt-Adresse“**), damit **kein** Konflikt mit **`shadow-sweep`** entsteht.

---

## 5. Kritische Punkte (kurz), die die Reihenfolge A–D nicht automatisch löst

1. **Code-Validierung:** Einmal-Einlösung — **Datenbank** oder **on-chain** Voucher/Burn; sonst Doppel-Einlösung.
2. **Reihenfolge C vs. D:** Adresse der **finalen** Wallet muss **vor** oder **in derselben** konsistenten Transaktionslogik für Credits-Mint feststehen — sonst Race / falsche Owner.
3. **Relay sieht den Seed** in C — das ist **zeitlich begrenztes Custody**; dokumentieren (wie in **`ARCHITECTURE-PROVISIONED`** §1).
4. **Transport:** Ohne **TLS** / Trust-Anchor ist Ephemeral-ECDH gegen **MITM** verwundbar — nicht nur „lokal generiert = sicher“.

---

## 6. Kurzfassung

- **Was wir haben:** Bausteine (**Sponsor**, **Credits-Objekt** in Config, **Vault**, **ECDH-Messenger**, **Provisioning** eher Boss-zentriert).  
- **Was die A–D-Erzählung leistet:** **Einheitliches Onboarding-Zielbild** für Wanderer + Voucher — **verbessert** Planung und Abstimmung mit **`ARCHITECTURE-PROVISIONED`** und Credits-on-chain.  
- **Was noch fehlt:** **Durchgängige** Implementierung des Einlöse-Endpunkts + klare **Begriffe** (nicht „Shadow“ mit `shadow-sweep` verwechseln).

---

*Bei Umsetzung: dieses Dokument mit konkreten API-Namen und Move-Entrypoints aktualisieren.*
