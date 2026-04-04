# Real-World-Ablauf: Industrielles Asset-Management (Lite)

Brücke zwischen physischem Gegenstand und digitalem Zwilling am Beispiel **Wartung einer Industriepumpe**.

---

## Die fünf Schritte

### Schritt 1: Initialisierung (Die „Geburt“ des Zwillings)

| Was | Details |
|-----|---------|
| **Aktion** | Techniker öffnet die Kachel **„Asset-Twin / Inventar“** und klickt auf **„Neues Asset anlegen“** / **„Asset erstellen“**. |
| **Eingabe** | **Name:** z. B. „Hochdruckpumpe P-101“. **Metadaten:** Seriennummer, Hersteller (als Text oder JSON, z. B. `{"sn":"SN-12345","hersteller":"Pumpen AG"}`). |
| **On-Chain** | Das Backend erstellt ein Move-Objekt vom Typ **PhysicalAsset** auf der IOTA-Chain (name + metadata on-chain). |
| **Ergebnis** | Eindeutige **Object-ID** (z. B. `0xabc…`) und Explorer-Link; optional sofort **QR-Label** erzeugen. |

---

### Schritt 2: Physische Kennzeichnung (Der QR-Anker)

| Was | Details |
|-----|---------|
| **Aktion** | Morgendrot generiert einen **QR-Code**, der die Object-ID und den Link zum Explorer enthält (Button „QR-Label“). |
| **Hardware** | Techniker druckt das Label aus und klebt es direkt auf die Pumpe. |
| **Verknüpfung** | Optional: **Streams-Kanal (Anchor-ID)** direkt im Asset on-chain hinterlegen (Feld `streams_anchor_id` in der Kachel „Neues Asset anlegen“). Das Gerät nutzt dieselbe Anchor-ID für Live-Daten/Heartbeat. |

---

### Schritt 3: Der Betrieb (Live-Daten & Status)

| Was | Details |
|-----|---------|
| **Szenario** | Ein Sensor an der Pumpe sendet z. B. alle 10 Minuten Betriebsdaten (Temperatur, Druck). |
| **Ablauf** | Das Gerät nutzt die im Asset on-chain hinterlegte **Streams-Anchor-ID** (oder eine zentrale Konfiguration) und schreibt verschlüsselte Nachrichten in den Stream. |
| **Monitoring** | Der Boss sieht in der Kachel **„Überwachung“** live, ob die Pumpe „P-101“ gesund ist (Heartbeat, Geräte-Liste). |

---

### Schritt 4: Wartung & Verifikation (Vor Ort)

| Was | Details |
|-----|---------|
| **Szenario** | Ein externer Prüfer kommt zur Inspektion. |
| **Aktion** | Er scannt den **QR-Code** mit dem Smartphone (Morgendrot-App oder beliebiger QR-Scanner). |
| **Verifikation** | Der QR enthält den **Explorer-Link** → im Browser öffnen: |
| | • **Existiert das Objekt?** → Echtheits-Check (Objekt auf Chain sichtbar). |
| | • **Wer ist der Besitzer?** → Zugehörigkeits-Check (Owner im Explorer). |
| | • **Wartungshistorie** → Über den verknüpften Stream (Anchor) alle bisherigen Einträge einsehbar (wenn Zugang zum Kanal besteht). |

---

### Schritt 5: Lebensende & Wirtschaftlichkeit (Der Purge)

| Was | Details |
|-----|---------|
| **Szenario** | Die Pumpe wird nach 10 Jahren verschrottet. |
| **Aktion** | Admin öffnet „Asset-Twin / Inventar“, wählt das Asset und klickt auf **„Purge“** (Asset ausbuchen). |
| **Effekt** | Das Objekt wird auf der Chain gelöscht. |
| **Rebate** | Die Firma erhält das hinterlegte **IOTA-Pfand (Storage Rebate)** zurück. Das System hat über 10 Jahre Identität geliefert und refinanziert sich am Ende selbst. |

---

## Vorteil gegenüber „normalen“ Datenbanken

| Aspekt | Nutzen |
|--------|--------|
| **Manipulationssicher** | Niemand kann die Wartungshistorie nachträglich „schönrechnen“ – sie ist auf der Blockchain verankert (Stream + Asset-Identität). |
| **Firmenübergreifend** | Wird die Pumpe verkauft, überträgt man den **Besitz** der Object-ID (Transfer des PhysicalAsset an die neue Firma – optional als Erweiterung; heute: Purge beim Verkäufer, neues Asset beim Käufer oder zukünftig `transfer_physical_asset`). Alle Daten (Stream, Historie) bleiben der Object-ID zugeordnet. |
| **Kein Zentral-Server** | Selbst wenn die Firma pleitegeht, bleibt die **Identität der Pumpe** auf der IOTA-Chain für den Käufer oder Prüfer abrufbar (Explorer, öffentliche Chain). |

---

## Anknüpfung an die Implementierung

- **Schritt 1–2:** Kachel „Asset-Twin / Inventar“, „Neues Asset anlegen“ mit Name, Metadaten und optional **Streams Anchor-ID** (on-chain); Buttons „QR-Label“, „Mit ObjectID verifizieren“, Label-Drucker (Standard, 25×25 mm, 50×50 mm, 70×70 mm).
- **Schritt 3:** Bestehende Streams-/Überwachungs-Kachel; Geräte konfigurieren mit derselben Anchor-ID wie im Asset-Metadaten (oder zentral).
- **Schritt 4:** QR enthält Explorer-URL; Verifikation „existiert / Besitzer“ direkt im Explorer; Stream-Zugang über Morgendrot/Bridge.
- **Schritt 5:** Button „Purge“ in der Asset-Liste; Rebate wie bei Keys/Tickets.

**ObjectID-Kooperation:** Für Hochsicherheits-Bauteile (z. B. Turbine, Medizin): Asset zuerst in Morgendrot anlegen, dann mit Button **„Mit ObjectID verifizieren“** an ObjectID übergeben → rechtssichere Domain-Verknüpfung und Verifiable Credentials. Siehe `docs/ASSET-TWIN-OBJECTID-COOP.md`.

**Kopierschutz (Zwei Pumpen – welche ist echt?):** Optional **NFC-Tag** koppeln („Hardware-Tag koppeln“): Die Hardware-UID des Chips wird einmalig mit der Object-ID on-chain verknüpft. Sicherheitssiegel 🟢 = NFC-verifiziert. Siehe `docs/ASSET-TWIN-NFC-SIEGEL.md`.

Siehe auch: `docs/ASSET-TWIN-OBJECTID-STRATEGY.md`.
