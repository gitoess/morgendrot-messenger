# Drohne, Ballon & „fliegender Messenger“ – Strategie (Minimal-Ansatz)

**Status:** Architektur-Leitlinie (kein eigener Firmware-Modus „Flying Relay“).  
**Verknüpft:** **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** (Queue, Custody, IOTA-Upload), **`meshtastic/PHASE-2-FIRMWARE-SPEC.md`**, **`hardware/README.md`**.

---

## 1. Zielbild

- **Keine** tiefgreifende Drohnen-Firmware-Anpassung: die Plattform bleibt Standard (Fernsteuerung, Flugrecht, Gimbal optional).
- **Nutzlast** = **normaler umgebauter Messenger**: z. B. **Heltec Wireless Stick Lite V3** + optional **ESP32-CAM** (oder vergleichbares Modul), gleiche Morgendrot-/Meshtastic-Software wie am Boden.
- **Verhalten:** **Delay-Tolerant Node** – empfängt **LoRa** während des Einsatzes, **puffert** lokal, **synchronisiert** bei **Internet/IOTA** (manuell oder automatisch gemäß Spec) – identisch zum Boden-Gateway, nur **mobil**.

Daraus folgt: **kein** separater Produktmodus „Flying Relay“ in der App; höchstens UI-Hinweise („Gerät in der Luft – Funklage prüfen“).

---

## 2. Kritische Einordnung (Schwachstellen & Risiken)

| Thema | Risiko | Mitigation |
|--------|--------|------------|
| **Gewicht / Strom** | Heltec + CAM + Akku + Antenne beeinflussen Flugzeit und Zentrierung. | Minimales Setup; kurze Missionen; Reserve-Akku. |
| **EMV / HF** | LoRa-TX nahe FC-Elektronik kann stören. | Abstand/Abschirmung, reduzierte TX-Leistung wo möglich, Testflüge. |
| **Recht** | Drohnenflug, Sichtflug, Naturschutz, Höhenlimits – **lokal** klären. | Dokumentation „Einsatzverantwortung vor Ort“. |
| **Duty Cycle** | Gleiches **1 %-Limit** (868) bzw. bandabhängig (433) wie am Boden – **kein** Freifahrticket in der Luft. | **Airtime-Anzeige** (siehe LORA-Spec **§9.7**). |
| **Sicherheit** | Verlorene Drohne = möglicher **physischer Zugriff** auf Gerät. | Geräte-PIN, Vault, **remote wipe**-Konzept optional. |

---

## 3. Wetterballon / Höhenrelais (Ergänzung)

- **Nutzen:** in **offenem Gelände** (Berge, Dschungel- Lichtung) kann **~100 m** Höhe die **Fresnel-Zone** verbessern und **LoS** erhöhen.
- **Kosten:** oft **günstig** vs. fest installierter Mast.
- **Nachteile:** **Wind**, Wetter, **Bergung**, zeitlich begrenzte Mission, rechtliche Fragen (Luftrecht, NOTAM je Region).
- **Technik:** derselbe **Messenger als Nutzlast** wie bei der Drohne; Ballon nur **Träger**, keine Sonder-App.

---

## 4. Dual-Band (433 MHz + 868 MHz) an der Basis

| Aspekt | Inhalt |
|--------|--------|
| **Gewinn** | Zwei **unabhängige** ISM-Bänder ⇒ **zwei Duty-Budgets** ⇒ echtes **paralleles** Senden möglich (nicht zwei Sender auf **derselben** Frequenz – dort kaum Nutzen + Interferenz). |
| **Einordnung** | Sinnvoll an **Basis / schwerem Relais**; **Vortrupp** typisch **ein** Modul (Gewicht, Strom, UX). |
| **Architektur** | Zwei **RF-Pfade** im Node (zwei Meshtastic-Instanzen oder ein Host + zwei USB-Heltec) – **Klärung in Implementierung**; UI: Airtime **pro Band** (LORA-Spec **§9.7**). |

---

## 5. Airtime- & Queue-Bezug

- **Airtime:** siehe **`LORA-IOTA-DELAYED-UPLOAD-SPEC.md` §9.7** – Schätzung, Warnung, keine falsche Präzision.
- **Outbound-Queue & IOTA-Status:** **§9.6** + **§5 UI** – Chat zeigt **pending** / **anchored** für gepufferte LoRa-Nachrichten.

---

## 6. Kurztext für Stakeholder (konsistent mit Messenger-Prioritäten)

- **IOTA** = primärer **Settlement**-Pfad, wenn Netz da ist.  
- **LoRa** = **Notfall-/Offline-Fallback** und **Feld-Funk**.  
- **Drohne/Ballon** = **Träger** für denselben **Messenger-Knoten**, keine parallele Software-Linie.

---

*Minimaler Architektur-Strang: „fliegender oder hängender normaler Knoten“, keine dedizierte Drohnen-Firmware-Produktlinie.*
