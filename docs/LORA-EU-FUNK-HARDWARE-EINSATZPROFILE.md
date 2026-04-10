# LoRa / EU-Funk: Subbänder, Hardware, Einsatzprofile (Doku)

**Status:** **Produkt- und Architektur-Einordnung** für Phase B (Mesh, Delayed Upload) — **keine** rechtliche Zulassungsberatung und **keine** Garantie für Reichweite oder Behördenfreigabe. Betreiber und Einsatzführung tragen Verantwortung für **konformen Funkbetrieb** (u. a. ETSI / nationales Recht, CE, Leistung, Duty Cycle).

**Verknüpft:** **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**, **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`**, **`docs/MESHTASTIC-HOP-LIMIT-AND-BRIDGE.md`**, **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**, **`heltec/README.md`**, **`docs/ROADMAP-FAHRPLAN.md`** § **H.3j**, **§ H.3k**.

---

## 1. Für wen der Messenger gedacht ist (überlappend, nicht exklusiv)

| Nutzungskontext | Typische Erwartung an Funk/LoRa | Morgendrot-Rolle |
|-----------------|-----------------------------------|------------------|
| **Privat / Wanderer / kleine Gruppe** | Leichtgewicht, wenig Bastelaufwand; oft **ein** Kanal, Standard-Profil (EU868) | Offline-Fallback, Chat/Tresor; **kein** Pflicht-Funkprofi |
| **Freunde, Verein, Nachbarschaftshilfe** | Vereinbarte Geräte/Kanäle; ggf. **Basis** mit besserer Antenne | Gleiches Produkt, **klar dokumentierte** Topologie (wer ist Relais) |
| **Hilfsorganisationen / ehrenamtliche Rettung** | Abgestimmte Frequenzen, Schulung, Einsatzordnung | Messenger + optional Gateway; **Brücke** zur Einsatzkette, nicht Ersatz für behördlichen Funk |
| **Professionelle Einsatzkräfte (z. B. Bergrettung, SAR, Behörden)** | Hohe Anforderungen an **Verfügbarkeit**, **Nachweis**, **Abstimmung** mit internen Funkdisziplinen | Werkzeug in einem **definierten** Einsatzkonzept; Integration (z. B. ATAK/CoT) siehe **`docs/ATAK-COT-INTEGRATION-ZIELBILD.md`** — **Backlog** |

**Hinweis „taktische oder sicherheitsrelevante Einsätze“:** Derselbe **technische** Katalog (Antenne, Strom, Mesh) kann für **Szenen mit erhöhter Störanfälligkeit oder Eile** relevant sein — **ohne** dass Morgendrot ein **spezielles Kampfmittel** ist. Vertraulichkeit, Zulassungen und **Trennung** zu offiziellen Behördenfunk bleiben **Sache der Organisation** und der **lokalen Vorschriften**.

---

## 2. Szenarien (nicht nur Höhle)

| Szenario | Funk-Herausforderung | Sinnvolle Priorität |
|----------|------------------------|---------------------|
| **Höhle / Bergwerk / Trichter** | Dämpfung, keine LTE-Deckung | Relais an der Oberfläche, **externe Antenne**, ggf. Kabel-/Brückenkonzepte (Roadmap § A.8) |
| **Katastrophe / Blackout / Infrastrukturausfall** | Viele parallele Nutzer, Störungen | **Kanaldisziplin**, weniger „Turbo“ als **stabiles** Mesh; IOTA/Bridge wenn wieder Uplink |
| **Wandern / abgelegene Touren** | Gewicht, Akku, Einfachheit | Standard-Meshtastic/Morgendrot-Pfad; **USB statt BT** wenn möglich |
| **Professionelle Such- oder Rettungsübung** | Koordination mit **Führung** und ggf. Leitstelle | Morgendrot = **Insel** bis zur **menschlichen** oder dokumentierten Brücke (siehe Notfall-Reichweite-Doku) |

---

## 3. EU868 und „Subband P“ (869,4–869,65 MHz) — technisch sauber

- In der EU gibt es im **SRD-Umfeld** **verschiedene Teilstreifen** mit unterschiedlichen Grenzen (**ERP/ EIRP**, **Duty Cycle**, ggf. weitere Bedingungen). Der Bereich um **869,4–869,65 MHz** wird häufig mit **höher zulässiger Leistung** und **strengem Duty Cycle** in Verbindung gebracht — **konkrete Zahlen** immer an **aktueller Norm** und **Gerätezulassung** messen, nicht an Marketing.
- **Ein** SX1262 (typisch Heltec) hat **eine** HF-Kette: **kein** echtes gleichzeitiges Dual-Band. „Zwei Bänder“ bedeuten **nacheinander** andere Frequenzen nutzen (Kanal-/Moduswechsel).
- **Kritischer Mesh-Punkt:** Wenn ein Gerät **kurz** auf eine andere Frequenz springt, um einen **großen** Block zu senden, müssen die **Empfänger** dort **mithören** (abgestimmte Policy, **Gateway**, **zweites Radio** am Relais oder **alle** Knoten mit derselben Umschaltlogik). Ohne Abstimmung ist der Sendevorgang ein **Monolog**.
- **Airtime:** Große Nutzlasten (Bilder) erfordern **Fragmentierung** und **Pausen** — unabhängig von der Sendeleistung.

---

## 4. Hardware: was sich lohnt (und was nicht)

| Maßnahme | Einordnung |
|----------|------------|
| **Gute 868-MHz-Antenne** (abgestimmt, sauber montiert; Helix/Dipol/Yagi je nach Szenario) | **Größter** Hebel bei gleicher Sendeleistung; für **RX** oft wichtiger als mehr Watt Senden |
| **USB-C / UART** Handy ↔ Heltec | **Empfohlen** für **Daten** und ggf. **Strom** — weniger Pairing-Stress als BT; **OTG**-Limits** und Akku-Hitze beachten |
| **LTE-/5G-Handyantenne „für LoRa“** | **Nein** — abgestimmt auf **Zellularfrequenzen**, nicht zuverlässig für **868 MHz**; LoRa braucht **eigene** Antenne am Funkpfad |
| **Externer PA (hohe Wattzahl)** | Risiko **über** erlaubte **SRD-Grenzen**; **Akku**, **Störungen**, **Zulassung**; nur mit **messbarer** Konformität |
| **LNA (Empfangsverstärker)** | Kann **RX** verbessern; **Filter** und **Übersteuerung** beachten (starke Sender, Nahbereich) |
| **„Superhet extra“** | Moderne LoRa-Chips haben integrierte Empfangsketten; oft **LNA + Filter + Antenne** statt generischem Superhet-Bastelpfad |

**Pragmatischer Leitsatz:** *Wer besser hört, muss weniger „schreien“* — aber nur im Rahmen der **Regeln** und mit **abgestimmter** Topologie.

---

## 5. „Handy-Mesh“ und Antennen

- **RF-Switch**, der die **Handy-Antenne** mit dem LoRa-Modul teilt: für **Standard-Smartphones** **unrealistisch** (falsche Band, kein freier HF-Zugang) und **fehleranfällig** für Rettungsnutzung.
- **Robuster:** Heltec mit **SMA/BNC** und **externer LoRa-Antenne**; im Notfall **Wurfleitung** / **Richtantenne zur Basis** — klarer **Bedienungsstandard** statt Sonder-HF am Telefon.

---

## 6. Abgrenzung zum Messenger-Produkt

- Morgendrot liefert **Software**, **Bridge-Konzepte** und **Doku** — **keine** Zertifizierung von **PA/LNA/Antennen-Kombinationen**.
- **Lite-Messenger**, **Boss**, **Rettungskette**: siehe **`docs/UI-ROLLEN-WORKSPACES.md`**, **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`** — Funk verbessert **Erreichbarkeit im Team**, ersetzt aber **nicht** Leitstellenfunk.

---

*Stand: 2026-03-28 — konsolidiert aus technischer Review; für Implementierung Phase B und Feldtests.*
