# Physical-to-Digital-Gap: Zwei Pumpen, ein Code

## Das Problem („Welche ist die echte?“)

Du hast **zwei Pumpen** – eine echte und eine Fälschung. Du druckst den **gleichen QR-Code** zweimal aus und klebst ihn auf beide. Beim Scan zeigt **jede** Pumpe denselben, sauberen Lebenslauf auf der Chain. **Welche ist die echte?**

Das ist das klassische **Physical-to-Digital-Gap**: Der QR-Code beweist die **Existenz** der Identität auf der Chain, aber nicht die **Eindeutigkeit** des physischen Objekts. Ein kopierter Aufkleber ist optisch nicht von dem auf der echten Pumpe zu unterscheiden.

---

## Drei Eskalationsstufen der Lösung

### Stufe 1: Der „Digitale Fingerabdruck“ (einfach)

- **Idee:** Beim Anlegen des Assets Merkmale hinterlegen, die man **nicht mitkopieren** kann.
- **Beispiel:** Im **Vault** ein Foto von einer spezifischen Schweißnaht oder einem Kratzer der echten Pumpe speichern.
- **Abgleich:** Prüfer scannt den Code, öffnet das Foto aus dem Vault und vergleicht: „Die Pumpe vor mir hat diesen Kratzer nicht → Fälschung.“

### Stufe 2: Die „Interaktive Komponente“ (Morgendrot-Spezial)

- **Idee:** Die Pumpe ist **aktiver Teilnehmer** (Heartbeat, Keys). Nur die echte Pumpe kann auf Befehle reagieren.
- **Ablauf:** Prüfer klickt in der App z. B. „Signal leuchten“ oder „Drehzahl kurz erhöhen“. Nur die **echte** Pumpe reagiert, weil nur sie den passenden Access-Key bzw. die Geräte-Anbindung hat. Die Fälschung bleibt stumm.
- **Fazit:** Der kopierte Aufkleber ist wertlos, wenn das physische Objekt nicht „antworten“ kann.

### Stufe 3: Hardware-Bindung (NFC – Kopierschutz)

- **Idee:** Statt nur Papier-QR einen **NFC-Industrie-Tag** aufkleben (oder im Gehäuse verbauen). Jeder Chip hat eine **weltweit eindeutige, unveränderliche Hardware-UID**.
- **Bindung:** Diese UID wird **einmalig** mit der Object-ID des Assets auf der IOTA-Chain verknüpft (`nfc_uid` im PhysicalAsset).
- **Effekt:** Den QR-Code kann man kopieren; die **Hardware-UID des Chips** nicht. Ein Fälscher müsste die echte Pumpe aufbrechen, um an den Chip zu kommen.
- **Echtheits-Check:** Prüfer hält das Handy an die Pumpe. Die App liest die NFC-UID und fragt: „Passt diese UID zur Object-ID auf der Chain?“ → Nur bei Übereinstimmung: **Grünes Siegel (NFC-verifiziert)**.

---

## Sicherheitssiegel in der Asset-Kachel

| Stufe | Icon | Bedeutung |
|-------|------|-----------|
| **Digital-Only** | ⚪ Grau | Objekt existiert nur auf der Chain, noch kein physischer Marker. |
| **QR-Linked** | 🟡 Gelb | QR-Code wurde erzeugt. Identität prüfbar, aber physisch kopierbar. |
| **NFC-Verified** | 🟢 Grün | Hardware-UID eines NFC-Chips ist fest mit der Object-ID on-chain verknüpft. Goldstandard gegen Kopien. |

Optional: **Monitoring aktiv** (Streams-Anchor gesetzt) kann als Zusatz-Icon (z. B. blau) angezeigt werden.

---

## QR vs. NFC (Kurzvergleich)

| Merkmal | QR-Code (Standard) | NFC-Tag (Kopierschutz) |
|--------|---------------------|-------------------------|
| Kosten | Sehr gering (Drucker) | ca. 0,50–2 € pro Tag |
| Kopierschutz | Gering (nur optisch) | Hoch (Hardware-UID) |
| Haltbarkeit | Kann ausbleichen/zerkratzen | Robust, oft säurefest/vergossen |
| Bedienung | Sichtkontakt nötig | Berührungslos (auch durch Gehäuse) |

**Empfehlung:** Für einfache Paletten reicht QR. Für teure oder sicherheitskritische Bauteile (Pumpen, Turbinen): **NFC-Zwillings-Anker** nutzen.

---

## Technik: NFC in Morgendrot

- **On-Chain:** PhysicalAsset hat optionales Feld `nfc_uid` (vector&lt;u8&gt;). Einmalige Kopplung per `link_nfc_uid` (nur Besitzer, nur wenn noch nicht gesetzt).
- **Frontend:** „Hardware-Tag koppeln“ – Web NFC API (Chrome Android) liest `serialNumber` des Tags; Backend schreibt sie in das Asset.
- **Verifizieren:** Prüfer liest NFC-UID vor Ort; Abgleich mit der im Asset hinterlegten UID → nur bei Match: grünes Siegel.
- **Hinweis:** Web NFC wird aktuell v. a. auf **Android** (Chrome) unterstützt; **iOS** blockiert sie im Browser. Für iPhones: PWA oder spätere native App.

---

## Zusammenfassung

- **Die Fälschung** hat das richtige „Namensschild“ (QR), aber kein „Gehirn“ (Key/Heartbeat) und keine **gebundene Hardware** (NFC-UID).
- Im **Lite-Asset-System** ist der QR-Code der **Existenzbeweis**; **Echtheit** liefert erst die **Interaktion** (Stufe 2) oder die **NFC-Bindung** (Stufe 3).
- Das **Sicherheitssiegel** (Grau/Gelb/Grün) macht im Dashboard sofort sichtbar: „Diesem Objekt kann ich vertrauen (NFC)“ oder „Hier genauer hinschauen (nur QR)“.

Siehe auch: `docs/ASSET-TWIN-SZENARIO.md`, `docs/ASSET-TWIN-OBJECTID-STRATEGY.md`.
