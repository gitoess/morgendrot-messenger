# Voucher vorproduzieren (IOTA) vs. Webshop: Was muss der Server „kennen“?

**Kurzantwort:** Wenn **Gutscheine** als **Move-Objekte** (Voucher) existieren, muss der **Messenger-Relay** beim **Einlösen** **keine** SQL-Liste von „Codes“ prüfen — die **Chain** entscheidet. **Trotzdem** braucht ihr für den **Verkauf** fast immer einen **automatisierten Dienst**, der **nach bezahltem Kauf** eine **Chain-Transaktion** auslöst: Voucher von der **Treasury-/Admin-Adresse** an die **Käufer-Adresse** transferiert. Das ist **nicht** dasselbe wie „Relay kennt alle Codes“, aber es ist **eine** Verbindung **Zahlung → Chain**.

**Verknüpfung:** **`docs/CREDITS-PURCHASE-ONCHAIN-CRITIQUE.md`**, **`docs/WANDERER-REDEEM-PROVISIONING-FLOW.md`**, **`docs/ARCHITECTURE-PROVISIONED-AUTONOMY-RELAY.md`**.

---

## 1. Zwei Rollen sauber trennen

| Rolle | Muss „Codes“ kennen? | Typisch |
|-------|----------------------|---------|
| **Einlöse-Logik (Messenger / Move)** | **Nein** — prüft **Besitz** des Voucher-Objekts + **Vertragsregeln** (Burn/Mint). | Nutzer signiert mit Wallet, das das Objekt hält. |
| **Verkaufs-Fulfillment (Shop-Backend)** | **Kein Klartext-Code in DB nötig**, aber: muss wissen, **welches** on-chain Objekt (oder welcher „Slot“) an **welche Käufer-Adresse** nach Zahlung geht — oder eine **Queue** von noch nicht zugewiesenen Objekten. | Webhook vom Shop → Skript `transfer(voucher_id → buyer_address)`. |

**Präziser als „Server blind“:** Der **Relay** kann blind für **Klartext-Codes** sein; eine **Treasury-/Fulfillment-Komponente** ist beim **Verteilen** der Voucher-Objekte **nicht** wegzudenken — außer der Käufer **kauft direkt on-chain** (Krypto) und **zieht** sich den Transfer selbst.

---

## 2. Pre-mint: „1.000 Voucher-Objekte“ auf IOTA

**Idee:** Einmalig (oder in Chargen) **N** Objekte eures Typs minten; sie liegen auf der **Admin-/Treasury-Adresse**, bis sie verkauft/weitergegeben werden.

| Pro | Contra / Aufwand |
|-----|------------------|
| Keine **Code-Tabelle** für die **Gültigkeit** des Gutscheins | **Gas + Speicher** für Batch-Mint; Planung Treasury-Mittel |
| Öffentlich nachvollziehbar, **wie viele** Objekte noch bei Treasury (Indexer/RPC) | **Admin-Key** kompromittiert = Kontrolle über Voucher-Vorrat — **Multisig**, **getrennte** Rollen |
| Einlösen per **Move**: Burn Voucher → Mint Credits (atomar in **einer** TX, wenn so designed) | **Vertrag** muss **Replay**, **Fälschung** und **Typ-Prüfung** exakt regeln |

**Kritik an „verschlüsselter Secret-Hash im Objekt“:** On-Chain-Daten sind je nach Modell und **show**-Feldern **öffentlich einsehbar**. Was genau im Objekt steht, muss **pro Move-Design** geklärt sein (nur Hash eines Geheimnisses vs. Referenz-ID; **kein** Klartext-Code in der Chain). Oft reicht: **typisierter** Voucher + **Nonce**, Einlösen nur mit **Besitz** + **Signatur** des Owners.

---

## 3. Webshop „muss nicht wissen, was ein Messenger-Code ist“

**Stimmt grob:** Der Shop verkauft ein **Produkt** („Guthaben-Paket“). Technisch löst die Fulfillment-Schicht eine **Wallet-Transaktion** aus: **Transfer** eines **bestehenden** Objekts an die vom Käufer angegebene **IOTA-Adresse** (oder an einen **Escrow**/Zwischen-Schritt).

**Was der Shop trotzdem braucht:**

- **Zahlungsbestätigung** (Webhook, API).
- **Empfänger-Adresse** für den Voucher — entweder der Kunde gibt sie im Checkout ein, oder ihr nutzt ein **Konto-Wallet** (dann wieder **Custody** beim Händler).

**E-Mail als Ziel:** „An E-Mail senden“ ist **kein** nativer Chain-Begriff — ihr braucht entweder **Link** („verbinde Wallet und claim“) oder **vorher** bekannte Adresse.

---

## 4. Einlösen: Burn & Mint in einer Transaktion

**Richtig als Zielbild:** In **einer** atomaren TX: Voucher wird **verbraucht** (Burn/Consume), Credits-Objekt für die **Ziel-Adresse** des Wanderers entsteht — dann **kein** „halbes“ Zustand bei Netzwerkfehlern (sofern Move und PTB korrekt).

**Voraussetzungen:**

- Wanderer-Adresse muss **im Entry-Funktionsaufruf** festliegen (oder aus dem Signatur-Kontext).
- **Idempotenz** außerhalb der einen TX (Retries) weiterhin beachten (**`MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`**).

---

## 5. „Offline-Voucher auf Papier“ (QR) — kritisch

Ein **QR mit nur einer Object-ID** beweist **keinen** Besitz — IDs sind **öffentlich**. Sinnvolle Muster:

- **Voucher ist bereits** auf der **Wallet des Nutzers** (nach Kauf-Transfer); QR in der App zeigt nur **Verweis**/Deep-Link.
- Oder **Claim-Ticket**: einmaliges **Geheimnis** (off-chain oder nur Hash on-chain), das erst beim Einlösen offengelegt wird — dann **kein** reines „Object-ID auf Papier“ allein.

**Papier** = Diebstahl/Abfotografieren — wie Bargeld; Produktkommunikation anpassen.

---

## 6. Was „besser als Datenbank“ wirklich heißt

| Aussage | Korrektur |
|---------|-----------|
| Kein Leak von „Code-Liste“ | **Stimmt** für **Klartextcodes in SQL** — Voucher sind **Objekte**, Diebstahl = Wallet-Kompromittierung oder **physischer** Diebstahl, nicht DB-Export. |
| Server „blind“ | **Nur** für die **Einlöse-Validierung** ohne Legacy-Code-DB — **nicht** für **Shop-Fulfillment** und **Treasury-Keys**. |
| Blockchain = Notar | **Stimmt** für **Integrität** und **Regeln** — **nicht** für Datenschutz der Käuferperson (Metadaten, Shop-Logs). |

---

## 7. Kurztabelle (Architektur)

| Komponente | Rolle | „Codes“? |
|------------|-------|----------|
| **Treasury (Admin)** | Hält Vorrat an Voucher-Objekten | Besitz der Objekte |
| **Shop + Fulfillment** | Zahlung → **Transfer** Voucher → Käufer-Adresse | Mapping **Bestellung → Objekt/Slot** (minimal), ggf. keine Klartext-Codes |
| **Move-Package** | Burn Voucher / Mint Credits | **Regeln** |
| **Messenger-Relay** | Chat, Sponsoring, ggf. kein Voucher-Check | **Keine** Code-DB nötig, wenn alles on-chain |

---

## 8. Bezahlflow: Webhook → Zuweisung → Einlösen (Schrittfolge + kritische Präzisierung)

Zielbild für **Fiat-Shop** (Shopify, WooCommerce, Stripe, …) + **Voucher on-chain**. **Ist-Code:** Fulfillment-/Claim-Endpunkt wie unten ist **Produkt-Spezifikation** — im Repo gibt es z. B. **`POST /api/provision-device`** (Boss-Werkstatt), **kein** fertiger öffentlicher **`/claim`-Shop-Flow**.

### 8.1 Trigger: Webhook vom Zahlungsdienst

1. Kunde zahlt (z. B. 5,00 €).  
2. Der **Zahlungsanbieter** ruft euren Server auf (**Webhook**): z. B. „Zahlung für **Bestellung #456** erfolgreich“, oft mit **E-Mail**, **Kunden-ID**, manchmal **Metadaten** (z. B. gewünschtes Produkt).

**Kritik / Betrieb:**

- Webhook **signieren** (HMAC/Signatur des Anbieters) und **Idempotenz** (dieselbe Zahlung nicht zweimal verarbeiten).
- **5,00 €** ist **kein** Chain-Betrag — Fulfillment löst **eure** definierte Chain-Aktion aus (Transfer/Buchung).

### 8.2 Zuweisung: Wohin mit dem Voucher?

| Variante | Ablauf | Vorteil | Kritik |
|----------|--------|---------|--------|
| **A — Claim-Link (E-Mail)** | Server reserviert ein **Voucher-Objekt** aus dem Treasury, erzeugt ein **einmaliges, hohentropisches Geheimnis** (nicht ratbar), speichert serverseitig **Mapping** `token → Objekt-ID / Bestellung` (oder nur „Token gültig bis Einlösung“). Link z. B. `https://morgendrot.app/claim?t=<token>` (**HTTPS**). E-Mail an Kundenadresse. | Kunde braucht **beim Kauf** noch **keine** IOTA-Adresse. | Ihr **habt** einen **Server-Zustand** (Token/Reservierung) — das ist **kein** reines „nur Chain“. Token **einmalig verbrauchen**, **Leak**-Risiko (Weiterleiten der Mail) beachten. |
| **B — Direkt-Transfer** | Webhook → TX: **Transfer** des Voucher-Objekts an die im Checkout angegebene **0x-Adresse**. | Sofort sichtbar in der Wallet/Explorer. | Adresse **muss stimmen** (Tippfehler = Verlust); Checkout muss **Adresse** erfassen. |

**Präzision:** „Server nimmt Objekt aus Pool“ = typisch **Treasury signiert** `transfer` — **Gas** und **Keys** im Fulfillment-Dienst.

### 8.3 Einlösen („Proof of Buy“) — zwei verschiedene Geschichten

**Fall B (Voucher schon auf Nutzer-Wallet):** Einlösen kann **direkt on-chain** im Move sein (**Burn → Credits**), **ohne** eure SQL — Nutzer signiert mit der Wallet, die das Objekt hält.

**Fall A (nur Claim-Link):** Der Ablauf „App generiert Messenger-Wallet, schickt Code an Backend“ entspricht einem **Provisionings-/Claim-Service**:

1. Nutzer öffnet Link oder gibt Token in der App ein.  
2. App erzeugt ggf. **ephemeren Schlüssel** / startet **Provisioning** (siehe **`docs/WANDERER-REDEEM-PROVISIONING-FLOW.md`**).  
3. Backend prüft: **Ist Token gültig und noch nicht benutzt?** (hier ist die **Datenbank/Store** für **Claim-Tokens** — **nicht** dieselbe wie „Gültigkeit des Vouchers“, die die **Chain** bei Fall B allein regelt).  
4. Backend führt **Burn & Mint** aus **oder** der **Nutzer** signiert — **entscheidend:** wer laut Move **Owner** des Vouchers ist. Liegt das Objekt noch bei der Treasury bis zum Claim, ist die erste TX oft **Treasury + Nutzeradresse** im selben Flow (Design!).

**Korrektur zur Formulierung „Server prüft Code in DB als bezahlt“:** **Bezahlt** ist durch den **Webhook** schon geklärt; die **DB** dient hier eher **Claim-Token / Reservierung**, nicht doppelt „bezahlt ja/nein“, wenn ihr nicht zwei Welten vermischt.

**Endpunkt-Name:** **`/api/provision`** war im Text **Beispiel** — im Repo heißt die Boss-Route u. a. **`/api/provision-device`**; ein **öffentlicher Claim-Endpoint** wäre **neu** zu spezifizieren (Auth, Rate-Limits).

### 8.4 Sicherheit (kurz)

| Aussage | Präzisierung |
|---------|----------------|
| **Kein Doppelkauf** | **On-chain:** Ein Voucher-Objekt kann nur **einmal** verbraucht werden, **wenn** das Move-Modell so definiert ist. **Claim-Link:** zusätzlich **Token einmalig** invalidieren, sonst theoretisch **zweimal** klickbar bis zur ersten erfolgreichen TX. |
| **Vollautomatisch** | Webhook + guter Fulfillment-Code ja — **trotzdem** Monitoring, Zahlungsausfälle, Support-Fälle. |

### 8.5 Fazit-Satz (übernommen, geschärft)

Der Server ist die **Brücke**: er **übersetzt** die **Fiat-Zahlung** (Webhook) in eine **Chain-Aktion** (Voucher reservieren/transferieren; nach Claim **Burn/Mint**). Er ersetzt **nicht** die **Regeln** auf der Chain — die bleiben im **Move-Package**.

---

*Umsetzung = Move-Modul + Fulfillment-Service + klare UX (Adresse im Checkout). Nicht im Repo als fertiges Modul vorausgesetzt — siehe `move-test/` und Credits-Ist in `/api/status`.*
