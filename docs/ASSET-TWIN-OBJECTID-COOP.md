# Real-World-Ablauf: Morgendrot + ObjectID Kooperation

Kooperation im industriellen Umfeld: **Morgendrot** = operative Steuerung (die „Maschine“), **ObjectID** = rechtssicheres Zertifikat (der „Ausweis“). Am Beispiel eines Hochsicherheits-Bauteils (z. B. Flugzeugturbine, medizinische Anlage).

---

## Die vier Phasen

### 1. Die „Geburt“ (Morgendrot erstellt den Twin)

| Was | Details |
|-----|---------|
| **Aktion** | In Morgendrot wird das Asset in der Kachel **„Asset-Twin / Inventar“** angelegt (Name, Metadaten, optional Streams-Anchor-ID). |
| **Morgendrot-Part** | Erzeugt die **Object-ID** auf der IOTA-Chain, setzt optional den **Streams-Anker** für Live-Daten (Temperatur/Druck) und verknüpft Access-Keys für Wartungstechniker. |
| **Status** | Das Teil ist im System registriert und „funktioniert“ (Monitoring läuft). |

---

### 2. Die Veredelung (ObjectID zertifiziert)

| Was | Details |
|-----|---------|
| **Aktion** | Der Hersteller (z. B. Siemens) will garantieren, dass dieses Teil ein **Original** ist. |
| **Coop-Schnittstelle** | In Morgendrot: Button **„Mit ObjectID verifizieren“** → die Object-ID wird an die ObjectID-API bzw. das ObjectID-Portal übergeben. |
| **ObjectID-Part** | Verknüpft die ID mit der offiziellen Firmen-Domain (z. B. siemens.com) via **DID** (Decentralized Identifier); erstellt ein **Verifiable Credential (VC)**, das beweist: „Dieses Objekt wurde von der verifizierten Domain des Herstellers signiert.“ |
| **Ergebnis** | Der digitale Zwilling erhält ein „goldenes Siegel“ (Marken-Echtheit, Compliance). |

---

### 3. Der Einsatz (Verifikation beim Kunden)

| Was | Details |
|-----|---------|
| **Szenario** | Ein Prüfer steht vor der Turbine und scannt den QR-Code. |
| **Morgendrot-Layer** | Zeigt sofort: **„Gerät online, letzter Heartbeat vor 5 Sek., Wartung fällig in 10 Tagen.“** (Operative Daten, Stream, Keys.) |
| **ObjectID-Layer** | Ein grüner Haken: **„Verifiziert durch hersteller.de. Originalbauteil. Dokumente (PDF-Handbuch) unverändert auf Chain hinterlegt.“** (Echtheits-Beweis, rechtssicher.) |

---

### 4. Der Lebenszyklus (Wartung & Übergabe)

| Was | Details |
|-----|---------|
| **Wartung** | Der Techniker nutzt seinen **Morgendrot-Key**, um die Wartung im Stream zu protokollieren. |
| **Besitzwechsel** | Wird die Turbine verkauft: Morgendrot überträgt das Objekt (oder Purge + Neuanlage beim Käufer); ObjectID kann den Status im globalen Register auf **Transferred** aktualisieren. |

---

## Win-Win: Wer bringt was mit?

| Feature | Morgendrot (Der Macher) | ObjectID (Der Notar) |
|--------|--------------------------|------------------------|
| **Fokus** | Steuerung, Heartbeats, Keys, Streams, Rebate. | DID, Domain-Linkage, PDF-Integrität, Verifiable Credentials. |
| **Nutzen** | Das Teil „arbeitet“ im Alltag. | Das Teil ist „echt“ und „legal“. |
| **Stärke** | Prozess-Effizienz (schnell & günstig). | Compliance (rechtssicher & global). |

---

## Strategische Empfehlung

- **Lite-Version in Morgendrot** für den schnellen Eigenbedarf der Kunden (Asset anlegen, QR, Purge, Stream).
- **Button „Mit ObjectID verifizieren“** in der Asset-Twin-Kachel: Klickt der User darauf, wird die Object-ID an das ObjectID-Portal bzw. die ObjectID-API übergeben; der Nutzer kann dort den „Premium-Ausweis“ (Domain-Verknüpfung, VC) buchen.
- **Vorteil für Morgendrot:** Die komplexe DID/Domain-Logik muss nicht selbst gebaut werden; trotzdem wird eine Profi-Lösung für Kunden angeboten, die Marken-Echtheit und Compliance brauchen.

---

## Anknüpfung an die Implementierung

- **UI:** In der Kachel „Asset-Twin / Inventar“ pro Asset (und nach Erstellung) ein Button **„Mit ObjectID verifizieren“** → öffnet konfigurierbare URL (z. B. `OBJECTID_VERIFY_URL`) mit der aktuellen Object-ID als Parameter (z. B. `?objectId=0x…` oder ObjectID-spezifisches Format).
- **Backend:** Optional env `OBJECTID_VERIFY_URL` (Default z. B. `https://objectid.io` oder Verifizierungs-Deep-Link), falls die genaue URL von ObjectID bekannt ist.

Siehe auch: `docs/ASSET-TWIN-OBJECTID-STRATEGY.md`, `docs/ASSET-TWIN-SZENARIO.md`.
