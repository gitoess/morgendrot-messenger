# Asset-Twin: Vom QR-Code zum aktiven Industrie-Zwilling

## Kurzfassung

Der QR-Code am physischen Objekt (z. B. Pumpe) ist die „Haustür“ – Morgendrot ist das „Haus“, das entscheidet, was passiert, wenn man eintritt. Dieser Text prüft den beschriebenen Ablauf gegen den aktuellen Stand der Implementierung.

---

## 1. Scan → Brücke zur App

**Beschreibung:** Techniker scannt QR → landet nicht nur im Explorer, sondern die Morgendrot-App öffnet sich (via Deep-Link). App erkennt Object-ID und: „Das ist ein PhysicalAsset aus meiner Registry.“

**Stand:**

- **QR-Inhalt:** Der QR auf dem Asset-Label zeigt heute die **Explorer-URL** (z. B. `https://explorer.iota.org/object/0x…?network=testnet`). Beim Scan öffnet sich der **Browser mit dem Explorer**, nicht automatisch die Morgendrot-Lite-UI.
- **Deep-Link zu Morgendrot:** Wenn die App unter einer festen URL läuft (z. B. `https://morgendrot.firma.de` oder `http://127.0.0.1:3342`), kann ein **zweiter Link** oder derselbe QR (wenn die App die URL umschreibt) genutzt werden:
  - **Unterstützt:** Öffnung mit Object-ID per **Query-Parameter**:  
    `http://127.0.0.1:3342/?objectId=0x9dfaf…` oder `?asset=0x9dfaf…`  
    → Die App wechselt in die Kachel **Asset-Twin** und setzt die angegebene Object-ID als Kontext (Hinweis: „App mit Object-ID geöffnet …“).
  - **Einschränkung:** „Meine Assets“ listet nur **von der aktuellen Wallet besessene** Assets. Wenn der Techniker nicht Besitzer ist, erscheint das Asset nicht in der Liste; der Hinweis zur geöffneten Object-ID bleibt sichtbar.

**Empfehlung:** Für „Scan → direkt Morgendrot“ entweder (a) einen eigenen QR/Link auf die Morgendrot-URL mit `?objectId=0x…` ausgeben oder (b) die gleiche Explorer-URL nutzen und in der Firma einen Redirect einrichten (Explorer-URL → Morgendrot-URL mit objectId).

---

## 2. „Aktivierung“ durch den Key

**Beschreibung:** Morgendrot prüft: Besitzt der User einen Access-Key, der zu dieser Object-ID passt? Wenn **ja** → Steuerungs-Funktionen frei. Wenn **nein** → nur öffentliche Stammdaten, nichts verändern.

**Stand:**

- **Key–Asset-Verknüpfung on-chain:** Im Move-Contract hat `PhysicalAsset` **kein** Feld `authorized_key`. Die Zuordnung „dieser Key gehört zu diesem Asset“ ist **nicht** chain-seitig gespeichert.
- **Konvention:** In den **Metadaten** des Assets kann beim Anlegen z. B. `authorized_key: 0x<Key-Object-ID>` eingetragen werden. Das ist reine Konvention; die Chain erzwingt nichts.
- **„Passt dieser Key zu diesem Asset?“:** Eine automatische Prüfung „User hat Key X, Asset Y hat in Metadaten authorized_key: X“ ist **nicht** implementiert. Die UI zeigt heute:
  - **Asset-Twin:** Nur Assets, die der aktuelle User **besitzt** (Owner). Für diese kann er übertragen, purgen, „Zur Überwachung“ nutzen.
  - **Steuerung (Lock/Key):** Öffnen/Befehle werden vom **Lock** (Gerät) geprüft; das Gerät prüft den Key. Es gibt keine zentrale Stelle in der App, die „Key gehört zu Asset 0x…“ auswertet.

**Praktisch:** Wer das **Asset besitzt**, kann es in der App voll nutzen (Übertrag, Purge, Überwachung). Wer zusätzlich den **passenden Key** besitzt, kann das zugehörige Gerät (Lock) steuern. Eine explizite „Aktivierung“-Anzeige („Steuerung möglich, weil Sie Key X besitzen“) existiert nicht.

---

## 3. Der Zwilling wird „aktiv“ – die drei Wege

### A. Operative Wartung (Messaging)

**Beschreibung:** Techniker tippt „Ölwechsel durchgeführt“ → Morgendrot signiert mit dem Key der Pumpe → Nachricht an die Chain → Asset-Objekt wird um Zeitstempel „letzte Wartung“ aktualisiert.

**Stand:**

- **Nachrichten:** Verschiedene Messaging-Flows (verschlüsselt, Klartext, Streams) sind vorhanden.
- **Asset-Objekt aktualisieren:** Im Move-Contract hat `PhysicalAsset` **kein** Feld „letzte Wartung“ und **keine** Entry-Funktion zum Aktualisieren von Metadaten oder Zeitstempeln. Ein direkter „Asset-Zeitstempel Wartung“ on-chain ist **nicht** umgesetzt.
- **Workaround:** Wartungs-Info kann z. B. über **Streams** (Kanal des Assets) oder normale Nachrichten geführt werden; die App zeigt dann Streams-Nachrichten in der Überwachungs-Kachel.

### B. Live-Zustand (Monitoring)

**Beschreibung:** Über den im Asset hinterlegten Streams-Anker lädt die App die letzten Sensordaten (Temperatur, Vibration) und zeigt einen Live-Graphen der Pumpe.

**Stand:**

- **Streams-Anker im Asset:** Beim Anlegen des Assets kann **Streams Anchor-ID** (optional) gesetzt werden; sie wird on-chain in `streams_anchor_id` gespeichert und in „Meine Assets“ angezeigt.
- **„Zur Überwachung“:** In der Asset-Twin-Kachel gibt es pro Asset mit gesetztem Streams-Anker einen Button **„Zur Überwachung“**. Aktion:
  - Setzt **STREAMS_ANCHOR_ID** auf den Kanal dieses Assets.
  - Wechselt in die Kachel **Überwachung (Monitor)**.
  - Dort können Heartbeat/Live-Daten dieses Kanals genutzt werden (wie bisher in der Überwachungs-Kachel).

Damit ist die **Brücke Asset → aktiver Zwilling (Live-Daten)** umgesetzt: Ein Klick auf „Zur Überwachung“ macht den Kanal dieser Pumpe zum aktiven Kanal und zeigt die Überwachungs-Ansicht.

### C. Fernsteuerung (Steuerung)

**Beschreibung:** „Not-Aus“ in der App → OPEN_COMMAND/CLOSE über die Chain → Pumpe akzeptiert, weil der User den passenden Key hat.

**Stand:**

- **OPEN_COMMAND / Lock-Steuerung:** Vorhanden (Steuerungs-Kachel, Lock/Key-Modell). Das **Gerät (Lock)** prüft den Key; wer den Key besitzt, kann Befehle senden.
- **Verknüpfung Asset ↔ Key:** Siehe Abschnitt 2. Die App zeigt nicht explizit „Sie haben den Steuer-Key für dieses Asset“. Wer den Key hat, nutzt die Steuerungs-Kachel wie bisher (Gerät/Lock-Adresse, Befehl).

---

## 4. Besitzwechsel

**Beschreibung:** In der Asset-Kachel Pumpe wählen → „Besitz übertragen“ → Morgendrot führt eine PTB aus: Asset + Key an den Käufer. Beim Käufer ist der Zwilling sofort aktiv, beim Verkäufer grau (nur Leserecht).

**Stand:**

- **Asset übertragen:** Implementiert (Move: `transfer_physical_asset`, Befehl `/transfer-asset`, UI: „Asset übertragen“).
- **Key + Asset gemeinsam (atomar):** Implementiert (eine PTB mit zwei Move-Calls, Befehl `/transfer-asset-key-package`, UI: „Komplettes Paket übertragen“).
- **„Grau“ beim Verkäufer:** Die Liste „Meine Assets“ zeigt nur **eigene** Assets; nach Übertragung verschwindet das Asset dort. Es gibt keine separate „graue“ Leseansicht für ehemals besessene Assets (das wäre eine Erweiterung).

---

## 5. Was du im Frontend siehst

- **Unter der Pumpe (Asset) in der Asset-Twin-Kachel:**
  - **QR-Label**, **→ Übertragen**, **Hardware-Tag koppeln**, **ObjectID**, **Purge** wie bisher.
  - **Zur Überwachung** (nur wenn das Asset eine Streams Anchor-ID hat): Klick setzt den Kanal dieser Pumpe und wechselt in die **Überwachungs-Kachel** (Live-Daten, Heartbeat).
- **Öffnung mit Object-ID:** URL `…?objectId=0x…` oder `?asset=0x…` öffnet die App in der Kachel Asset-Twin und zeigt einen Hinweis zur geöffneten Object-ID.

---

## 6. Lücken vs. Beschreibung (Zusammenfassung)

| Punkt | Beschrieben | Implementiert |
|-------|-------------|----------------|
| Scan → Morgendrot öffnen | Deep-Link von QR | QR = Explorer. Morgendrot-Öffnung mit `?objectId=0x…` (oder `?asset=0x…`) unterstützt. |
| Erkennung „PhysicalAsset aus Registry“ | App erkennt Object-ID | Asset-Twin-View + Hinweis bei `?objectId=…`; Liste nur eigene Assets. |
| Aktivierung durch Key | Prüfung „Key passt zu Asset“ | Nicht automatisch; Besitz des Assets = volle Nutzung in der App; Key wird vom Lock geprüft. |
| Wartung → Asset-Zeitstempel | Asset wird on-chain aktualisiert | Kein Feld/Update für „letzte Wartung“ im Contract. |
| Live-Daten (Streams) | App lädt Sensordaten, Graph | Streams-Anker im Asset; Button „Zur Überwachung“ setzt Kanal und wechselt in Monitor. |
| Fernsteuerung | Not-Aus, OPEN_COMMAND | Vorhanden (Steuerungs-Kachel, Lock/Key). |
| Besitzwechsel | PTB Asset + Key | Vorhanden („Komplettes Paket übertragen“). |
| Button „Zur Steuerung / Monitoring“ | Unter Asset-ID | „Zur Überwachung“ umgesetzt; Steuerung über bestehende Steuerungs-Kachel. |

Damit ist der **Kern des „aktiven Zwillings“** (Asset mit Streams-Kanal → ein Klick zu Live-Daten in der Überwachung) umgesetzt; die **Key-Zuordnung zum Asset** bleibt konventionell (Metadaten / manuell), und **Wartungs-Zeitstempel** on-chain sind nicht implementiert.
