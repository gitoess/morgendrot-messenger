# Asset-Twin & ObjectID-Strategie

Positionierung der Morgendrot-Lite-Version für Objekt-Identität gegenüber [ObjectID](https://objectid.io) und Empfehlung für die Marktreife.

---

## 0. Status-Check: Bausteine vs. Fehlendes

**Was bereits da ist (Bausteine):**

| Baustein | Nutzung heute |
|----------|----------------|
| **AccessKeys & Tickets** | Technisch „Objekte“ mit eigener Object-ID; genutzt als Berechtigung (Zutritt) oder Gutschein (Einlösen). |
| **Explorer-Anbindung** | Jede Object-ID kann auf der Chain gefunden werden (EXPLORER_BASE_URL + objectId). |
| **Vault** | Sichere Speicherung (lokal/on-chain), aber nicht „am Objekt“ sichtbar. |

**Was für die Lite-Version (Asset-Twin / Inventar) fehlt bzw. ergänzt wird:**

| Lücke | Lösung |
|-------|--------|
| **Neutrales Objekt-Modell** | Ein Industrieprodukt (Motor, Palette) ist weder Schlüssel noch Ticket. → Typ **PhysicalAsset** im Move-Contract (Asset mit name + metadata). |
| **QR-Code aus objectId** | Noch keine Funktion, die aus einer objectId ein druckbares Label macht. → Kachel „Asset-Twin / Inventar“ mit **QR-Label-Button** (objectId + Explorer-Link). |
| **Metadaten am Objekt** | Seriennummer, Hersteller, letzte Wartung fest am Objekt (on-chain sichtbar). → PhysicalAsset.metadata (vector&lt;u8&gt;, z. B. JSON). |

**Warum es eingebaut werden soll:** Ohne diese Kachel ist Morgendrot ein reines Zutritts- und Kommunikationssystem. Mit der **Asset-Twin-/Inventar-Kachel** wird es zu einem **Inventar- und Logistiksystem**. Der „Morgendrot-Weg“: Statt DID und Domain-Linkage (wie ObjectID) die bestehende Registry/Chain nutzen; **Rebate beim Löschen** (Purge) macht Massen-Tracking kosteneffizient – das kann ObjectID so nicht.

---

## 1. Warum eine „Morgendrot-Lite“-Version absolut Sinn macht

In der Industrie zählt oft **Unabhängigkeit**. Wenn ein Werkleiter eine Palette kennzeichnen will, möchte er nicht erst ein DID-Dokument (Decentralized Identifier) erstellen oder eine Domain-Verknüpfung validieren. Er will:

- **Schnelligkeit:** Objekt scannen → Object-ID auf Chain erzeugen → QR-Code drucken.
- **Kostenkontrolle:** Er nutzt das bestehende **Storage-Rebate-System**. Wenn die Palette im Lager ankommt, kann er das Objekt löschen (Purge) und erhält Gas zurück. ObjectID ist auf Langlebigkeit ausgelegt, Morgendrot auf **Prozess-Effizienz**.
- **Integration:** Die Object-ID in Morgendrot kann direkt mit einem **Ticket** oder einem **Stream** verknüpft werden – ein geschlossener, logischer Kreislauf (z. B. Key/Ticket als Asset, Heartbeat/Stream für Status).

---

## 2. Wo die Grenze zu ObjectID liegt

Morgendrot sollte **nicht** versuchen, ObjectID zu kopieren.

| ObjectID | Morgendrot-Lite |
|----------|------------------|
| „Luxus-Limousine“ für rechtssichere Dokumente und Marken-Echtheit (DID, Domain-Linkage, Lifecycle) | „Gabelstapler“ für den täglichen Betrieb (schnelle Objekt-ID, QR, Purge, Verknüpfung mit Key/Ticket/Stream) |

- **Kooperation mit ObjectID:** Sinnvoll, wenn ein Kunde fragt: *„Kann ich beweisen, dass dieses Ersatzteil original von Siemens ist?“* → Antwort: *„Dafür nutzen wir die ObjectID-Schnittstelle.“*
- **Lite-Version:** Sinnvoll für: *„Ich muss tracken, welcher Techniker diesen Schaltschrank zuletzt gewartet hat.“* → Der Morgendrot-Key-/Ticket-Verlauf reicht aus.

---

## 3. Die „Industrie-Brücke“ (Alleinstellungsmerkmal)

Was Morgendrot kann, worauf ObjectID (alleine) nicht fokussiert:

- **Aktion aus Identität:** In Morgendrot führt die Identität (Object-ID) direkt zu einer **Berechtigung** (Key/Ticket) oder **Überwachung** (Stream).
- Bei ObjectID ist das Objekt oft ein **passiver** digitaler Zwilling. Bei Morgendrot ist das Objekt ein **aktiver Teilnehmer** am System (öffnen, warten, melden).

---

## 4. Empfehlung für die Marktreife

- **Lite-Kachel in Morgendrot einbauen**, aber **nicht** als „ObjectID-Klon“ bewerben, sondern unter dem Namen:
  - **„Asset-Twin / Inventar“** (alternativ: „Asset-Twin & QR-Inventory“)

- **Funktionen der Kachel (technische Vorgabe):**
  1. **Neutrales Objekt auf Chain:** Move-Typ **PhysicalAsset** `{ id, name, metadata }` – kein Key/Ticket, sondern einfaches Asset/Produkt. Erstellt via `create_physical_asset` → liefert `objectId`.
  2. **QR-Generator:** Button „QR-Label“ erzeugt ein druckbares Label mit `objectId` und Explorer-Link (EXPLORER_BASE_URL + objectId).
  3. **Status-Check:** Objekt existiert? Aktueller Besitzer? (Chain-Abfrage; Metadaten on-chain im PhysicalAsset.)
  4. **Rebate:** `purge_physical_asset` – Besitzer löscht Asset (z. B. bei Verschrottung) und erhält Gas zurück (wie bei Key/Ticket).

- **Fazit:**  
  Die Lite-Version ist der **Türöffner** für den schnellen Betrieb. Die **Kooperation mit ObjectID** ist der **Upgrade-Pfad** für High-End-Security und Compliance. Morgendrot bleibt das flexible „Ameisennest“ und kann bei Bedarf ObjectID („Hornissen“) dazuholen.

---

## 5. Technische Anknüpfung & Umsetzung

- **Bestehende Bausteine:** `create-key` / `create-ticket` liefern bereits `objectId` und Explorer-Link; QR-Bibliothek (qrcode) ist in der Lite-UI vorhanden (Provisioning, Lock-View). Rebate über `purge-key` / `purge-ticket`.
- **Move-Erweiterung:** Typ **PhysicalAsset** in `messaging.move`: `create_physical_asset(name, metadata)` → owned Object an Sender; `purge_physical_asset(asset)` → nur Besitzer, Rebate an Signer.
- **Backend:** `chain-access`: `createPhysicalAsset`, `purgePhysicalAsset`, `getOwnedPhysicalAssets`. `wallet-bridge`: Befehle `/create-asset`, `/purge-asset`, `/list-assets`. API hängt wie bei Key/Ticket `explorerLink` an.
- **Lite-UI:** Kachel **„Asset-Twin / Inventar“**: Asset anlegen (Name, Metadaten), Liste, Purge, **QR-Label-Button** (objectId + Explorer-Link als QR + Text).
- **Dokumentation:** ObjectID-Vergleich und Grenze: [objectid.io/solutions](https://objectid.io/solutions/), [objectid.io/knowledge-base](https://objectid.io/knowledge-base/).
- **Real-World-Ablauf:** Industrielles Asset-Management (z. B. Wartung Industriepumpe) in fünf Schritten: Initialisierung → QR-Anker → Betrieb/Stream → Verifikation vor Ort → Purge & Rebate. Siehe `docs/ASSET-TWIN-SZENARIO.md`.
- **ObjectID-Kooperation:** Real-World-Ablauf „Base-Layer + High-End“ (Geburt in Morgendrot → Veredelung bei ObjectID → Verifikation beim Kunden → Lebenszyklus). Button **„Mit ObjectID verifizieren“** in der Asset-Twin-Kachel übergibt die Object-ID an ObjectID (konfigurierbare URL). Siehe `docs/ASSET-TWIN-OBJECTID-COOP.md`.
- **Physical-to-Digital-Gap / Kopierschutz:** Zwei Pumpen, ein Code – welche ist echt? Drei Eskalationsstufen: (1) Digitaler Fingerabdruck (Foto im Vault), (2) Interaktive Komponente (Heartbeat/Key – nur echte Pumpe reagiert), (3) **NFC-Hardware-Bindung** (nfc_uid on-chain, einmalig koppelbar). **Sicherheitssiegel** in der UI: 🟡 QR-Linked, 🟢 NFC-verifiziert. Siehe `docs/ASSET-TWIN-NFC-SIEGEL.md`.
