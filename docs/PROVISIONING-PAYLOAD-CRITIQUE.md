# Provisioning-Payload & „Identity-Credits“ — kritische Einordnung (Ist vs. Vision)

**Zweck:** Produktvision (Kontaktliste, Rollen-Tags, Kanäle, SOS-Anchor, erweiterte Credits) **sauber** von **Ist-Code**, **Move-Realität** und **Privacy** trennen — bevor Umsetzung und Marketing auseinanderlaufen.

**Verwandt:** **`docs/ARCHITECTURE-PROVISIONED-AUTONOMY-RELAY.md`**, **`docs/WANDERER-REDEEM-PROVISIONING-FLOW.md`**, **`docs/CREDITS-PURCHASE-ONCHAIN-CRITIQUE.md`**, **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`**, **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`** (Offline-Relay-Queue vs. Credits-Mint; `initialProfile`), **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`** (Medic/Scout, Rollen-Manager, Provisioning-Maske), **`docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md`** (Metadata-Container, Präsenz vs. Profil, SOS-Schicht), Roadmap **`docs/ROADMAP-FAHRPLAN.md` § H.3f** / **§ H.3g** / **§ H.3h**.

---

## 1. Was die Vision verlangt (Kurz)

| Baustein | Ziel |
|----------|------|
| **Provisioning-Payload** | Beim Einrichten/Handshake: nicht nur Seed, sondern **Metadaten-Paket** — Kontakte (Pubkeys/Adressen), Rollen-Labels, vordefinierte Kanäle (Object-IDs), Standard-SOS-Ziel. |
| **Credits als „Identity“** | Statt reiner Zähler: **Verweise** auf Einsatz-Module (Leitung, Kanäle), damit die App nach Start „weiß“, wer was ist. |

Das ist **sinnvoll** als **Gesamtbild** für Einsatz-Organisationen — technisch ist es **kein** kleiner Patch, sondern **Protokoll + ggf. Move-Upgrade + Privacy-Review**.

---

## 2. Häufige Missverständnisse (Fehler im naiven Bild)

### 2.1 „Der Server schickt beim Handshake ein Paket mit Metadaten“

**Ist (Chain):** `EcdhInit` ist ein **fest definiertes** Event im Move-Paket (`messaging.move`): u. a. **sender, recipient, pub_key, nonce** — **kein** freies JSON-/Metadaten-Feld für Adressbuch oder Kanäle.

**Folge:** Ein „mitgeschicktes“ Kontakt-/Kanal-Paket **im selben** Handshake-Event existiert so **nicht**. Mögliche echte Pfade:

- **Separater** On-Chain-Schritt (zweites `moveCall`, neues Struct/Events) — **Package-Upgrade**, Kosten, Indexer.
- **Off-Chain:** Boss-API / Provision-Export (ZIP, `.env`, verschlüsseltes Bundle) — bereits teilweise (**`/api/provision-device`**, Export-Env), Kontakte **nicht** automatisch aus einem einzelnen EcdhInit.

**Verbesserung der Formulierung:** „Nach Identität + optional Credits“ liefert die **Organisation** ein **signiertes oder Boss-geprüftes** Konfigurationspaket (lokal/Vault), nicht „der Server hängt es an den ECDH-Handshake“.

### 2.2 „Public Keys vom Boss … sofort lokal gespeichert“

**Ist:** Partner-Erkennung läuft über **Handshake-Events** und **Peer-State**; ein **Kontaktverzeichnis** (Anzeigenamen, Mesh-Felder) gibt es als **Client-Daten** (`/api/contact-labels`, lokale Speicherung) — **kein** automatisches „alle Boss-Pubkeys einmal laden“ aus dem Handshake-Event allein.

**Pubkeys:** ECDH nutzt **P-256 Raw-Public-Keys** in Events; **IOTA-Adressen** sind ein anderes Konzept — „Adressbuch ohne Tippen“ braucht ein **definiertes** Übertragungsformat (QR, Bundle, Registry), nicht nur „Handshake“.

### 2.3 „Role: Medic / Scout“ in der UI

**Ist:** Sichtbare Rolle und Rechte kommen primär aus **`.env`** (`ROLE`, `ROLE_ID`, optional `DEVICE_ROLES`) und Hierarchie-Bits — **nicht** aus einem dynamischen Chain-Feld „Medic“ pro Nutzer im Standard-Messenger.

**Folge:** Rollen-Tags als **UI-Anpassung** brauchen entweder **Konfig-Provisionierung** (Env/Vault) oder ein **neues** On-Chain-/Sync-Modell — nicht durch „Credits-Objekt lesen“ allein, solange `MessengerCredits` nur Tarif-Felder hat (siehe unten).

### 2.4 „Vorkonfigurierte Kanäle / mehrere Gruppen-Mailboxen“

**Ist:** Typisch eine **`MAILBOX_ID`** (und Package) pro Deployment; mehrere benannte Kanäle („Rettung“, „Logistik“) sind **kein** fertiges Produkt-Feature im Sinne „alles aus einem Credits-Scan“ — das wären **weitere** Object-IDs / Move-Module / Klartext-Routing-Policies.

### 2.5 „SOS standardmäßig an Adresse X“

**Ist:** SOS-/Sprach-Pfade sind an **Chat-Konfiguration** und Transport gebunden — eine **globale** „Notfall-Anchor“-Adresse als Standardziel ist **nicht** deckungsgleich mit einem Feld im Credits-Objekt ohne **eigenes** UI- und Sende-Protokoll.

---

## 3. Move: `MessengerCredits` heute

In **`move-test/sources/messaging.move`** ist `MessengerCredits` ein **Owned Object** mit u. a.:

`balance`, `max_balance`, Refill-Parametern, `cost_ecdh_init`, `cost_store_message`.

Es gibt **keine** Felder für Kontaktliste, Rollen-Strings, Kanalnamen oder SOS.

**Snapshot im Node:** `getMessengerCreditsSnapshot` (`src/chain-access.ts`) liest **nur** Typprüfung + `balance` / `max_balance`.

**Kritik am Vorschlag „Credits = Identity mit Links“:**

- **Sinnvoll** als **langfristiges** Produkt: ein **weiteres** Owned-Object oder eine **kontrollierte Erweiterung** (neue Struct-Version, Migration), nicht „einfach Felder drauf“ ohne Gas-/Größen- und **Privacy**-Check.
- **Öffentliche Objekte:** Inhalte können **indexierbar** sein — **keine** Klartext-Geheimnisse oder interne Namen ohne Bewusstsein.
- **Trennung:** Tarif/Credits (Verbrauch) und **Profil/Einsatz-Kontext** zu mischen erhöht **Upgrade-Risiko** und Kopplung; oft besser: **zwei Objekte** oder **Verweis** Credits → Profil-ID.

---

## 4. Was bereits zum Provisioning existiert (ohne neues Move)

- **`POST /api/provision-device`** (Boss): Gerät minten / Env erzeugen — siehe **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**, **`README.md`** (Skripte).
- **`POST /api/boss-provision-handshake`:** Boss signiert **Handshake-TX** für Adresse/Partner/Pubkey — **kein** Metadaten-Blob.
- **Export:** `buildMessengerExportEnv` / Bundle — kann **`MAILBOX_ID`**, **`creditsObjectId`**, **`roleId`** setzen (**`src/config.ts`** `buildMessengerExportEnv`).
- **Kontakte:** manuell / API **`/api/contact-label`**, nicht „aus Credits scannen“.

---

## 5. Empfohlene Umsetzungsrichtung (gestuft)

| Stufe | Inhalt | Aufwand |
|-------|--------|---------|
| **A** | Provisioning **weiter** über Boss-Export (ZIP/.env) + **Vault-Notizen** oder JSON-„Einsatzprofil“ **lokal** (verschlüsselt) — **kein** Chain-Upgrade | gering–mittel |
| **B** | **Neues** Move-Struct (z. B. `OperationalBinding`) oder **separates** Objekt mit **nur Object-IDs** + Version; Credits bleiben primär **Abrechnung** | hoch (Audit, Migration) |
| **C** | Event-Erweiterung / zweiter Kanal neben `EcdhInit` — nur mit **Package-Review** und PTB-Limits | hoch |

**Privacy:** Jedes „öffentliche“ Profil auf der Chain braucht **Threat-Model** (Wer darf welche Metadaten sehen?).

---

## 6. Fahrplan

Siehe **`docs/ROADMAP-FAHRPLAN.md` § H.3f** — Vision festhalten, **nicht** vor **Mesh-/Stabilitäts-Zielen** (Phase B) als Pflichtsprint.

---

*Stand: Abgleich mit `messaging.move` (`MessengerCredits`, `EcdhInit`), `chain-access.ts`, `api-server.ts` (provision, boss-provision-handshake), `config.ts` (ROLE, Export).*
