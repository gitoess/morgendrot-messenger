# Messenger (Chat): Sendepfad, Verschlüsselung, SOS, Sprache

**Zweck:** Ausführliche Hinweise, die früher direkt in der Chat-UI standen — hier gebündelt für Nachlesen (PWA-Handbuch, offline nach erstem Abruf möglich).

**Stand:** 2026-07-03 — Telegram-ähnliche Chat-Oberfläche (Seitenleiste, Inbox vor Composer), Sendepfad + **SOS im Kopf**, Gruppe verwalten als Sheet, Peering-QR unter **Ich**; § *IOTA vs. Server* (Threat Model).

**Verwandt:** `docs/PWA-HANDBUCH-OFFLINE.md`, `docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`, `docs/MESSENGER-CAPABILITIES-OVERVIEW.md`, `docs/GRUPPENCHAT-ZIELBILD.md`, `docs/EXPORT-ASSISTENT-REFERENZ.md`.

---

## Oberfläche (Chat, Kurzüberblick)

| Bereich | Inhalt |
|---------|--------|
| **Chat-Kopf** | Sendepfad (Online / Funk / …), **SOS — Hilferuf** (1:1, nicht Telegram), Kanal-Titel, Tresor, **Handbuch**, **Einstellungen** |
| **Seitenleiste** (1:1 / Gruppe) | **Ich**, Alle, Kontakte, Gruppen; Suche oben; Doppelklick **Ich** → Profil + Peering-QR; Doppelklick **Gruppe** → Gruppe verwalten |
| **Mitte** | **Posteingang** (Nachrichten) **über** dem Composer |
| **Composer** | `[+]` (Anhang, Telefonbuch, Emoji, …), Text, Sprache, Senden |
| **Konversation ⋮** | Profil, Export, Verlauf leeren, **Verschlüsselt/Klartext**, **Gruppe verwalten** |

**Dashboard:** Kachel **Nachrichten** öffnet den Chat. **Telefonbuch** zusätzlich über `[+]` im Composer, Sidebar oder Kontakt-Detail.

---

## Verschlüsselung und Partner-Key

**Verschlüsselt:** Nachrichten sind **nur mit dem Partner-Schlüssel** sinnvoll lesbar. Die **Entschlüsselung** erfolgt auf **diesem Node** (Backend), wenn der **Tresor entsperrt** ist. Das ist **kein** Signal-artiges Perfect Forward Secrecy (PFS): wer Langzeit-Schlüssel und gespeicherte Ciphertexte hat, kann bei späterem Zugriff mitentschlüsseln — Threat Model bewusst mitdenken.

**Unverschlüsselt · online:** Klartext erscheint in der Chain (`/send-plain`); Modus **Nur Event** vs. **Mailbox** steuert die Speicherlogik (siehe `MESSAGING-MAILBOX-SSOT-SPEC.md`).

**Unverschlüsselt · funk:** Meshtastic-**Klartext** (LongFast). Für **Ende-zu-Ende** den Transport **online** wählen (oder Verschlüsselung aktivieren — wechselt bei Bedarf automatisch zu online).

**Schloss / Verschlüsselung:** Gilt für **Sendepfad online** (Morgendrot-E2E). Umschalten im **Konversations-Menü** (⋮, Verschl./Klar) oder im erweiterten Setup (**Verschlüsselt**-Karte, wenn sichtbar). Bei **funk** steuert die Meshtastic-Kanalwahl (Primary/Secondary + PSK) die Funkverschlüsselung auf dem Radio — nicht der App-Schalter.

---

## IOTA vs. Server — Kurz (Threat Model)

Morgendrot ist **Hybrid**: Boss-**Server** (Setup, LAN, API) + **IOTA** (Archiv auf der Chain) + optional **Funk**. Das ist **kein** reiner Blockchain-Messenger und **kein** reiner Matrix-Ersatz.

| | **IOTA (Online-Pfad)** | **Eigener Server** |
|--|------------------------|---------------------|
| **Stärke** | Archiv bleibt, wenn der Boss-PC weg ist; Nachweis/Verifizierbarkeit on-chain | Schnell, einfacheres Key-Management, Metadaten unter **eurer** Betriebspolicy |
| **Schwäche** | **Metadaten** (Adressen, Zeitpunkte, Postfächer) öffentlich analysierbar; **kein** Signal-artiges Forward Secrecy (Ist) | Ein Betreiber kann abschalten; Logs/IPs unless gehärtet |

**Praktische Regeln:**

- **Verschlüsselt** senden, wenn Inhalt geheim bleiben soll — das schützt den **Text**, nicht das „Wer spricht wann mit wem“ auf der Chain.
- **Funk** für taktische Reichweite ohne Netz; **Online** für E2E und Archiv.
- **Seed/Tresor** sichern — Verlust = Identität on-chain weg (wie bei jeder Wallet).
- Für **Anonymität** gegen Ledger-Analyse ist Morgendrot **nicht** das richtige Werkzeug — eher für **Einsatz-Archiv** und **Server-unabhängige Speicherung**.

Ausführlich: **`docs/ROADMAP-FAHRPLAN.md`** § **I.0b** · Krypto: **`docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`**.

---

## Sendepfad: Online (IOTA/Mailbox) vs. Funk (LoRa/Meshtastic)

| Kanal | Online (IOTA) | Funk (Meshtastic) | Ad-hoc | Telegram |
|-------|---------------|-------------------|--------|----------|
| **1:1** | ✓ | ✓ (DM an Node oder Klartext) | ✓ (Platzhalter) | ✓ (mehrere Chat-IDs) |
| **Gruppe** | ✓ (Team-Broadcast, siehe unten) | ✓ (Secondary Channel, PSK) | — | — (Boss-Alarm: Roadmap § B4) |
| **Pinnwand** | ✓ | — | — | — |

In der App sind nur sinnvolle Kombinationen wählbar (z. B. kein Ad-hoc + Pinnwand).

### Meshtastic vs. Morgendrot-Kanäle (Funk)

Laut [Meshtastic Channel Configuration](https://meshtastic.org/docs/configuration/radio/channels/):

| Meshtastic | Bedeutung | Morgendrot-Kanal |
|------------|-----------|------------------|
| **Secondary Channel** (Name + PSK, AES256) | Geschlossener Gruppenchat — QR/Link teilen | **Gruppe** |
| **DM an Node** (PKC ab FW 2.5) | 1:1 zwischen zwei Knoten | **1:1 Privat** |
| **Primary Broadcast** (Default-PSK oft öffentlich) | **An alle** im offenen Mesh (Klartext) | **Kanal 1:1** + Sendepfad **Funk**, Haken „an Node-ID“ **aus** — **≠ Pinnwand** |

**Pinnwand** in Morgendrot = IOTA-Broadcast mit **BROADCAST_AUTHORIZED_SENDERS** — das gibt es auf LoRa nicht 1:1. Funk-Gruppenchat = **Secondary Channel** in der Meshtastic-App anlegen und PSK mit dem Team teilen (QR).

**Ist (App, § H.3o):** Funk-Senden nutzt standardmäßig den **Primary-Kanal** des verbundenen Heltec (Klartext). In **Gruppe verwalten** kann pro Gruppe **Kanalindex 0–7**, **Kanalname** und **PSK-Ref** gespeichert werden; im Composer (Expert, `[+]`) optional derselbe Index. PSK/Frequenz bleiben in der **Meshtastic-App** — Morgendrot sendet auf dem vorkonfigurierten Index. **Offen:** Feldtest mit random PSK (Roadmap § H.3o.6 Schritt 4).

#### LoRa „An alle“ — nicht Pinnwand

**Kurz:** Primary-Broadcast auf Funk heißt in der App **„An alle“** (nur **Klartext**, Kanal **1:1**, Sendepfad **Funk**). Das ist **kein** eigener Kanal-Tab und **keine** Morgendrot-Pinnwand.

| | **Pinnwand** (Kanal-Tab) | **An alle** (Funk in 1:1) |
|---|--------------------------|---------------------------|
| **Sendepfad** | Online (IOTA) | Funk (Meshtastic Primary) |
| **Verschlüsselung** | Klartext (IOTA-Policy) | **Nur unverschlüsselt** (LongFast-Klartext) |
| **Wer liest mit?** | Alle mit `PACKAGE_ID`; Schreiben nur autorisierte `0x` | Alle im **selben** Primary-Mesh (Default-PSK oft öffentlich) |
| **Archiv** | Chain / Posteingang Pinnwand | Funk-Posteingang lokal, kein IOTA-Brett |

**Gruppe + Funk** = Meshtastic **Secondary Channel** (PSK, geschlossenes Team) — wieder **nicht** „An alle“.

**Kritische Grenzen „An alle“:** Kein Sender-Whitelist, kein IOTA-Archiv, Inhalt für jeden mit Default-Key mitlesbar — nur für kurze Lage/SOS im offenen Mesh, nicht für vertrauliche Einsatzinfos.

**Strikt getrennt:** **IOTA/Mailbox** läuft nur über das **Backend** und die **Chain** — hier ist **Verschlüsselung** möglich. **LoRa/Meshtastic** sendet **Klartext** (Meshtastic-Text / **Pfad 4**) — **ohne** IOTA-Transaktion für denselben Funk-Klick.

Der frühere **Mesh-v2-/PRIVATE_APP-Versand** ist im **Produkt abgeschaltet** (nur noch **Empfang** älterer Nachrichten).

**Visuell getrennt:** Oben **Online** = Wallet, Chain, ggf. **Tor** (siehe unten). Unten **Funk / Ad-hoc** = **Heltec** über **Web Bluetooth** im Browser — kein „WLAN-Funk“, sondern BLE zum Gerät.

---

## Reihenfolge: online zuerst, ein Klartext-Funk-Versuch

**online:** Zuerst **IOTA/Mailbox** (Timeout typisch **ca. 120 s**). Schlägt das fehl und **Heltec** ist verbunden → **automatisch ein** Versuch per **Funk** (Klartext). Ohne Funk nur Fehlermeldung — dann **funk** wählen und koppeln.

**funk:** **Klartext** per Meshtastic (**kein** verschlüsselter Mesh-v2-**Versand** mehr).

**Wichtig:** Bei **online** zuerst; bei Fehler **kein** automatischer **verschlüsselter** Funk-Fallback — Verschlüsselung bleibt der **Online-/Mailbox**-Pfad.

---

## Tor / SOCKS und RPC_SOCKS_PROXY

**Tor/SOCKS:** Wird vom **Backend** genutzt, wenn **`RPC_SOCKS_PROXY`** in der Server-**`.env`** steht (oder über die **Konfigurationsoberfläche** geschrieben wurde). **Ohne** Proxy sieht der angebundene **IOTA-Knoten** typischerweise die **IP deines Servers/Rechners** (nicht die des Endnutzer-Browsers).

---

## SOS — Hilferuf (Text)

**Wo:** Roter Button **SOS — Hilferuf** im **Chat-Kopf** (unter dem Sendepfad), nur bei **1:1 Privat** — nicht bei Telegram-only oder mit offenen Anhängen.

**Produktregel (2026-06-16):** SOS ist **immer unverschlüsselt** — Hilfe und Reichweite gehen vor Diskretion. **Kein** Verschlüsselungs-Schalter beim SOS. Normaler Chat bleibt unberührt (verschlüsselt optional).

**Ziel-UI (Roadmap B2.5):** Dialog/Sheet mit Lage-Text, automatisch **Name, Standort, IOTA-`0x`, Funk-Node, Telegram** (wenn konfiguriert) — Vorschau vor dem Senden; **alle erreichbaren Wege** parallel (Funk, Online, Telegram). Hinweis: *„Geht offen raus — im Funk-Netz ggf. mitlesbar.“*

**Ist (minimal):** Text eingeben oder diktieren → Bestätigung → **ein** Sendepfad wie im Composer, Marker **`MORG_EMERGENCY_V1`**. **Kein** automatischer **112**-Ruf.

Spezifikation: **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** (**§9** Zivil-SOS).

---

## Sprachmemo und Einsatzmodus-Diktat

**Sprachmemo:** Maximal **ca. 35 s**, nur bei **Online/IOTA** (Opus; nicht über Meshtastic-Funk wie normales Memo). Datei per **Drag & Drop**, **Datei importieren** oder **Kamera/Webcam** — danach **Senden**.

**Einsatzmodus Diktat:** Textfeld fokussieren und **OS-Diktat** nutzen — **Windows:** **Win+H** | **Android:** **Mikrofon** in der Tastaturleiste.

---

## Vertraulichkeit: Klartext-Konfiguration

Wenn das Backend **`ENABLE_PLAINTEXT_CHANNEL`** und/oder **`MAILBOX_STORE_PLAINTEXT`** aktiv hat, können Nachrichteninhalte **zusätzlich oder ausschließlich als Klartext** in der Mailbox bzw. auf der Chain landen. Für maximale Inhaltsvertraulichkeit beide Optionen in der Server-**`.env`** aus und nur den **verschlüsselten** Pfad nutzen. Prüfen in **Einstellungen → System & Identität** / Konfiguration.

---

## Einstellungen: System & Identität

- **IOTA-RPC (Node):** kleiner Status in der Kopfzeile von „System & Identität“ (Erreichbar / nicht erreichbar) — Check beim Öffnen und über **Aktualisieren**.
- **Backend & Offline:** Verbindung zur **Basis** siehst du auf der **Startseite** (Karte „Verbindung zur Basis“) — nicht als eigene Liste in den Einstellungen.
- **Meine Adresse:** vollständige `0x`-Wallet oben in „System & Identität“ (kopierbar) — nicht noch einmal maskiert im Puls-Panel.
- **Package-ID / RPC_URL:** je ein Bearbeitungsfeld oben; in **Erweiterte Konfiguration (.env)** nicht doppelt.
- **`.env` vs. Move-Deploy:** Die meisten Keys betreffen nur die laufende Node (Runtime sofort, sonst Neustart). **Neues Move-Deploy** nur bei geändertem Smart-Contract — dann neue **PACKAGE_ID** und ggf. **MAILBOX_ID** nach `create_globals`.
- **Erweiterte Konfiguration (.env):** Im **Messenger** nur Chat-/Mailbox-/Einsatz-relevante Keys (kein Shop/Tickets, Lock, Monitor, Stripe). Im **Morgendrot Projekt** alle Keys.
- **PARTNER_ADDRESS** in `.env`: Legacy für Lite-UI **`/connect`** — im Messenger **Telefonbuch + Handshake**, nicht mehr als fester Partner-Button in der Chat-UI.
- **Streams-Anchor:** nur **Puls/Monitor** (Gerät lebt), nicht der Chat-Posteingang (Mailbox).

### Mailbox · Direkt-RPC · Streams-Puls

**IDs und Status:** Beim Öffnen des Panels liest die App **`/api/status`** und zusätzlich **`/api/current-ids`** (Package, Mailbox, eigene Adresse, Streams-Anchor), sofern die Morgendrot-Basis erreichbar ist. Zum Kopieren stehen die Zeilen im Panel bereit (im Chat auch Package-ID; in den Einstellungen steht Package-ID bereits oben).

**Direkt-IOTA ohne dauernd erreichbare Basis:** Package-ID, Mailbox-ID und Absender-Adresse manuell eintragen und im Browser **`localStorage`** speichern (**Ketten-IDs speichern**). Optional **Optimistische Flags**, wenn `/api/status` zuletzt nicht verfügbar war. Siehe Architektur **§ H.15**.

**Session-Signer (Mainnet-Direkt-Send):** Für Direkt-RPC braucht der Browser einen **Session-Signer** (Mnemonic nur im RAM). Normalerweise wird er beim **Tresor entsperren** geladen. Ist der Tresor auf dem Server schon offen, fehlt aber der Signer im Browser, erscheint ein Banner **„Signer laden“** — Vault-Passwort eingeben (Dialog ist schließbar). Details: Puls-Panel unter **Mailbox · Direkt-RPC · Streams-Puls** (Expert).

**Checkliste Direkt-Pfad** (Einstellungen → System & Identität → „Mailbox · Direkt-RPC · Streams-Puls“):

1. **Fullnode-URL** eintragen und speichern  
2. **„Direkt-Mailbox-Drain“** einschalten  
3. **Session-Signer (Mnemonic)** anwenden (nur RAM) — oder **Signer laden** nach Entsperren  
4. **Package, Mailbox, Absender** speichern (von Basis übernehmen oder manuell)  
5. Ggf. Basis einmal verbinden für `/api/status`-Flags — oder **Optimistische Flags**

**Partner-Adresse austauschen (QR):** Tauscht Partner-**Wallet** (`0x`) und optional **ECDH-Pub** für **verschlüsselten Online-Chat** — nicht für LoRa/Mesh. Anschließend **Handshake** im Posteingang oder Telefonbuch. Siehe **Peering-QR** unten.

---

## Peering-QR (§ H.16)

**Mein Peering-QR** / **Peering-QR scannen** / **QR-Text einfügen:** Partner-**Wallet-Adresse** (`0x…`) und optional **ECDH-Pub** (Verschlüsselung) **lokal** austauschen — **ohne** laufende Morgendrot-Basis und **ohne** 64 Hex-Zeichen abtippen. Optional im QR: **Fullnode-URL** und **Package-ID** (Mini-Konfiguration).

**Wo in der UI:**

- Sidebar **Ich** → **Doppelklick** → Dialog **Meine Kontakt-ID** (Peering-QR scannen / anzeigen)
- **Handshake-Leiste** am Composer, wenn verschlüsseltes Senden noch blockiert ist
- **Einstellungen → System & Identität** (Expert, Puls-Panel)
- Legacy: aufklappbar unter **Verschlüsselt** in der Setup-Karte (wenn Expert-UI sichtbar)

**Wichtig:** Der QR **ersetzt kein Internet** für IOTA. Handshake, Connect und verschlüsseltes Senden brauchen weiterhin **RPC/Fullnode**. Der QR ist **Setup vor Ort** (zwei Handys, face-to-face), **kein** Offline-Transport.

### Wann brauchst du Peering-QR?

| Situation | Peering-QR |
|-----------|------------|
| **Zwei Standalone-APKs** ohne Boss-PC, ad-hoc **verschlüsselter 1:1-Chat** | **Ja** — Partner + Pub ohne Relay |
| **Neuer Kontakt** außerhalb Handoff/Telefonbuch (Wanderer, Zivilkontakt) | **Ja** |
| Du willst **0x + ECDH-Pub** nicht manuell eintragen | **Ja** |
| Optional: **RPC + Package** mitgeben, wenn kein Handoff-ZIP da ist | **Ja** (Boss zeigt QR mit Netz-Hints) |

### Wann brauchst du Peering-QR **nicht**?

| Situation | Stattdessen |
|-----------|-------------|
| **Normaler Einsatz-Helfer** mit **Handoff-ZIP** — Boss/Partner schon in `.env` | Posteingang **Annehmen** oder Telefonbuch |
| Nur **Pinnwand**, **Gruppe** (Klartext-Team-Broadcast) oder **Funk/LoRa** | Kein Peering-QR nötig |
| Erwartung: *„QR scannen → danach ohne Netz IOTA senden“* | **Geht nicht** — Mesh/Funk ist ein anderer Kanal |
| Boss hat Helfer schon per **Export / Telefonbuch-QR** eingerichtet | Handoff reicht |

### Ablauf (kurz)

```
1. Peering-QR scannen     →  lokal: Adresse + Pub (+ optional RPC/Package)
2. Handshake / Connect    →  on-chain (Internet / Fullnode nötig)
3. Verschlüsselt senden   →  on-chain (Internet nötig)
```

Weiter: Fahrplan **§ H.16**, **`docs/WANDERER-STANDALONE-BUNDLE.md`** (Variante B).

---

## Handshake und Connect (Ist-UI)

| Ort | Aktion | Bedeutung |
|-----|--------|-----------|
| **Verschlüsselt** (Setup/Transport) | **Handshake starten** | Sendet Handshake an die eingetragene **Partner-`0x`** (64 Hex). |
| **Posteingang** (grüner Streifen) | **Annehmen** / **Als Partner** | Eingehende Handshake-Anfrage von der Chain/Mailbox annehmen. |
| **Composer** (Handshake-Leiste) | **Handshake senden** / **annehmen** | Erscheint, wenn verschlüsseltes Senden blockiert ist (Partner noch nicht verbunden). |
| **Gruppe → Verschlüsselt** | **Senden** / **Annehmen** pro Mitglied | Je Gruppenmitglied separater Handshake. |
| **Terminal / Lite-UI** | **`/connect 0x…`** | Connect mit expliziter Adresse; **`/connect`** ohne Adresse nutzt **`PARTNER_ADDRESS`** aus der Server-**`.env`**. |

**Hybrid Connect:** Läuft über Morgendrot-API **oder** Direkt-RPC (Peer-Pub aus Chain lokal). Nach Erfolg Status **„verbunden“** abwarten — erst dann verschlüsselt über Online/Mailbox (Funk bleibt Klartext).

**Adresse prüfen:** Vor Handshake die **Partner-`0x`-Adresse** verifizieren (Tippfehler, Phishing, falsches Clipboard). Falscher Handshake = ECDH mit dem Falschen.

Weiter: **`docs/HANDSHAKE-PERSISTENZ-UND-H23.md`**, Abschnitt **Handshake Vertrauen und Risiken** unten.

---

## Kanäle, Speicher und Mailboxen

**Drei Ebenen** nicht vermischen: (1) **Kanal** 1:1 / Gruppe / Pinnwand, (2) **Speicher** Event vs. Mailbox, (3) **Ziel-Mailbox** Server / Team / Privat. Verschlüsselung (Schloss oben) ist unabhängig — verschlüsselt braucht Handshake zwischen zwei `0x`-Adressen.

**Senden (Persistent, online):** Kontakt-Mailbox im Telefonbuch → aktiv gesetzte Team- oder Private-Mailbox → Server-`MAILBOX_ID`.

**Posteingang:** Server-Shared (`.env`) + optional die **aktive** Team- oder Private-Mailbox + Team-Broadcast-Postfächer verknüpfter Gruppen. Gruppen-Filter zeigt Nachrichten **aller Mitglieder** (Union).

**Speicher auf der Chain (online):** **Flüchtig (Event)** = kein Mailbox-Eintrag. **Persistent (Mailbox)** = Ziel unter **Einstellungen → Meine Mailboxen** (Server immer mitgelesen; Team oder Privat **aktiv** setzen), dann Posteingang **Aktualisieren**. Klartext vs. verschlüsselt steuert das Schloss oben.

| Kanal / Ziel | Persistenz | Wer sieht was? |
|--------------|------------|----------------|
| **1:1 Privat** | Event oder Mailbox | Nur Gesprächspartner (`0x`) |
| **Gruppenchat** | Team-Broadcast (Mailbox) | **1× TX** in Team-Mailbox; alle mit gleicher Team-Object-ID |
| **Pinnwand** | meist Klartext | Alle mit gleicher `PACKAGE_ID`; Schreiben nur autorisierte `0x` |
| **Server · Einsatz** | Mailbox | Alle auf diesem Knoten (`MAILBOX_ID`) |
| **Team / Privat** | Mailbox | Object-ID kennen; **aktiv** unter **Einstellungen → Meine Mailboxen** |

Doku: `docs/SENDEWEGE-KANAL-MAILBOX-UEBERSICHT.md`, `docs/TEAM-MAILBOXES.md`, `docs/MAILBOX-BEGRIFFE-UND-NUTZUNG.md`, `docs/DEPLOY-MOVE-M2c-TEAM-BROADCAST.md`.

**Auf Chain löschen (Rebate):** Posteingang → Zeile **⋯** → **Auf Chain löschen (Rebate)** — nur bei Mailbox-Zeilen (Badge **Mailbox** oder **Team-Broadcast**). Entfernt den Dynamic-Field-Eintrag on-chain und gibt Storage-Gas zurück.

| Art | Wer darf purgen? | Hinweis |
|-----|------------------|---------|
| **1:1 pairwise** | Empfänger oder Sender (je nach Move-Regel) | Shared- oder Private-Mailbox |
| **Team-Broadcast** | Original-Sender **jederzeit**; **nach TTL jeder** | Team-Mailbox-Object-ID; Badge **Team-Broadcast** |

Ganzes Private-Mailbox-Object: **Einstellungen → Meine Mailboxen** → Aufräumen / `purge_private_mailbox`. Team-Mailbox als Ganzes wird on-chain **nicht** zerstört — nur einzelne Broadcasts purgen.

**Voraussetzung:** Move-Package mit `purge_team_plaintext_broadcast` (siehe `docs/DEPLOY-MOVE-M2c-TEAM-BROADCAST.md`).

**Ziel-Postfach (Kontakt):** Im Composer kann pro Kontakt ein anderes Postfach gewählt werden; die **Empfänger-Wallet** (`0x`) bleibt unverändert — es ändert sich nur die Mailbox-Object-ID für den Submit.

---

## Posteingang

**Navigation:** Dashboard-Kachel **Nachrichten** → Chat. Im **1:1-/Gruppenmodus** links die **Seitenleiste** (Kontakte/Gruppen); Mitte der **Posteingang**, darunter der **Composer**. **Telefonbuch** über `[+]` im Composer, Sidebar oder Kontakt-Detail — nicht mehr als fester unterer Tab im Chat.

| Funktion | Beschreibung |
|----------|--------------|
| **Kategorien / Filter** | z. B. Direkt, Klartext (Pinnwand), Gruppe — je nach Kanal und Rolle. |
| **Antworten** | Menü an der Zeile — übernimmt **Kanal** und **Sendepfad** in den Composer (1:1, Gruppe, Funk, Pinnwand, Telegram). |
| **Anheften** | Pinnwand-Posts lokal oben halten (`sessionStorage`). |
| **Handshake-Anfragen** | Grüner Streifen oben: **Annehmen**, **Als Partner**, **Löschen**. |
| **Badges** | **Mailbox**, **Team-Broadcast** — unterscheidet Speicherart on-chain. |
| **Pakete** (Dropdown) | ECDH-**.morg-pkg** Import/Export und **Paket-Archiv** — Inhalt landet **nicht** im normalen Posteingang, sondern im Archiv-Sheet. |
| **Export** | Nachrichten-Forensik (JSON/TXT/ZIP) über Posteingang-Menü. |

**Offline-Warteschlange:** Bei fehlender Basis werden Sends lokal gequeued; Status-Streifen im Chat.

---

## Kontakte (Import und Export, JSON)

**Telefonbuch** (Sheet/Dialog) ist die zentrale Oberfläche zum Anlegen, Bearbeiten und Zuordnen von Kontakten (Name, `0x`, Mesh, Mailbox-Slots pro Kontakt). Namen aus dem Telefonbuch erscheinen auch in **Gruppe verwalten** (Anzeige und Eingabe der Mitglieder).

### Kontakt anlegen (Telefonbuch-Dialog)

| Feld | Pflicht | Hinweis |
|------|---------|---------|
| **Name** | empfohlen | Anzeige in Sidebar und Posteingang |
| **IOTA-Adresse (0x…)** | ja, außer nur Telegram | Für Online-Send und Handshake |
| **Meshtastic Node-ID** | nein | Für Sendepfad Funk (`!…`) |
| **Telegram Chat-ID** | ja ohne 0x | Nur Telegram-Hinweise; speicherbar ohne Wallet |
| **Postfach-ID** | nein | Unter „Erweitert“ — ein on-chain Postfach (Privat); Team/Einsatz/Puffer nur für Experten |

**QR-Code scannen** übernimmt Wallet + optional Postfach aus Peering-QR. Erklärungen zu Mailbox-Slots und Composer-Zielwahl: siehe Sendepanel „Ziel-Postfach“ beim Senden an einen Kontakt.

**Telefonbuch → Kontakte verteilen** (Boss/Kommandant) bietet schnelle Datei-Aktionen oberhalb der Kontaktliste:

| Aktion | Format | Hinweis |
|--------|--------|---------|
| **Importieren** | `initialProfile` | Schreibt ins Telefonbuch (Backend-Kontaktdatei), **nicht** die volle Telefonbuch-Struktur mit allen Mesh-Feldern |
| **Exportieren** | `initialProfile` v1 | Gleiches Schema wie Import |
| **Funk · Node-IDs sichern** | Passwort-JSON (Export/Import) | Am **Ende** des Telefonbuchs eingeklappt — verschlüsselte 0x↔Meshtastic-Zuordnung für Gerätewechsel; **nicht** dasselbe wie `initialProfile` |

Details zu JSON-Formaten und Helfer-ZIP: siehe unten und **Einsatzleitung → Export-Assistent** (`docs/EXPORT-ASSISTENT-REFERENZ.md`).

### Akzeptierte Import-JSON-Formen

1. **Root `initialProfile`:** Objekt mit `version: 1` und `contacts[]` (auch verschachtelt in Handoff-`jsonConfig` / Device-JSON aus einer ZIP).
2. **Direkt:** `{ "version": 1, "contacts": [ … ] }` — gleiche Struktur wie Export.

**Kontakt-Eintrag (minimal):**

```json
{
  "name": "Medic",
  "address": "0x…64 hex…",
  "roleTags": ["Medic"]
}
```

Optional auf Root-Ebene: `deploymentChannelTag`, `offlineBriefing`, `validUntil`, `metadata` (siehe `docs/API-INITIAL-PROFILE.md`).

**Abweichungen / nicht über initialProfile:**

- **Volles Telefonbuch** (alle Slots, Labels, versteckte Einträge): **Funk · Node-IDs sichern** (Telefonbuch, eingeklappt) oder manuell — Export „Kontakte“ erzeugt bewusst nur `initialProfile`.
- **Handoff-ZIP** für Helfer: **Einsatzleitung → Helfer einrichten** — Profil, Rechte, Partner, Team (`docs/HANDOFF-ZIP-ENCRYPTION.md`).
- **`npm run bundle:messenger`:** Entwickler-Standalone-Ordner — **kein** Ersatz für Handoff-ZIP.

---

## Einsatzleitung — Orientierung {#einsatzleitung-orientierung}

Wo welche Funktion liegt (Messenger, Boss):

| Thema | Ort |
|--------|-----|
| **Team-Übersicht** (provisionierte Helfer, Seeds, Roster, Team-Postfächer) | **Einsatzleitung → Mein Team** |
| **Seed erneut anzeigen** (Registry, nur Boss) | **Mein Team → Provisionierte Helfer** |
| **Helfer ↔ Messenger-Gruppe** zuordnen | **Mein Team → Provisionierte Helfer** (Dropdown) oder im Schnell-Assistenten |
| **Handoff-ZIP** (Profil, Rechte, Partner, Team) | **Einsatzleitung → Helfer einrichten** |
| **Neues Helfer-Handy** (Seed + Handoff-ZIP + QR) | **Helfer einrichten** → **Neues Gerät** → Seed + QR |
| **TTL / Purge** für bestehende Geräte | **Helfer einrichten** → **Bestehende Geräte** |
| **PWA im WLAN** (nur App installieren) | **Helfer einrichten** → **WLAN-QR** (neben ZIP/IOTA) |
| **Move-Upgrade / Chain-Status** | **Einsatzleitung → Erweitert** |
| **Kontakte** anlegen, Import/Export JSON, verschl. Backup | **Telefonbuch** (`[+]` im Composer, Sidebar, Kontakt-Detail) |
| **Team-/Private-Mailboxen** aktiv setzen | **Einstellungen → Meine Mailboxen** |
| **Nachrichten-Forensik** (Verlauf JSON/TXT, ZIP) | **Posteingang** → Export-Menü |
| **Handoff importieren** (Helfer-Gerät) | **Einstellungen → Handoff importieren** (oder Posteingang bei IOTA-Zustellung) |

**Nicht verwechseln:** `npm run bundle:messenger` = Entwickler-Standalone auf dem Server — **kein** Ersatz für die Helfer-Handoff-ZIP.

---

## Handoff: .env, Move und Package {#handoff-env-move-und-package}

### Kurzantwort

| Begriff | Was ist das? | Pro Helfer neu? |
|---------|----------------|-----------------|
| **`.env` im Handoff-ZIP** | Geräte-Konfiguration: `ROLE`, `ROLE_ID`, Partner-Adressen, Mailbox-Object-IDs, RPC, `PACKAGE_ID`-Verweis, PSK-Hinweise | **Ja** — jeder Export erzeugt eine **eigene** `.env` (oder verschlüsselte `handoff.morg.enc`) für **dieses** Zielprofil |
| **Move-Package (`PACKAGE_ID`)** | On-Chain-Vertrag / Einsatz-Instanz auf IOTA — gemeinsame „Move-Umgebung“ | **Nein** — normalerweise **dieselbe** `PACKAGE_ID` wie beim Boss (alle Helfer im **gleichen** Einsatz) |
| **Mailboxen auf der Chain** | Objekte (Server-, Team-, Private-IDs), die Nachrichten speichern | **Nein** — vom Boss (oder Betrieb) **angelegt**; der Helfer bekommt nur die **IDs und Rechte** in seiner `.env` |
| **Export-Assistent** | UI zum Bündeln: Profil + Partner + Team-Postfächer → ZIP | Erzeugt **kein** neues Move-Deploy, nur Konfiguration + README |

### Muss jeder Helfer eine eigene `.env` bekommen?

**Ja**, wenn Rolle, Partner, Team-Postfächer oder Rechte (`ROLE_ID`, Capabilities) **unterschiedlich** sind — oder wenn du bewusst getrennte Presets (Helfer vs. Führer vs. Spezial) ausrollst.

**Gleiche** `.env` für mehrere Geräte ist nur sinnvoll, wenn sie **identisch** provisioniert werden sollen (selten; Passwort-Schutz trotzdem pro Auslieferung empfohlen).

### Muss jeder Helfer ein eigenes Move-Package?

**In der Regel nein.** Alle im **selben Einsatz** teilen sich `PACKAGE_ID` (und die vom Boss konfigurierten Registry-/Mailbox-Strukturen). Nur bei **einem anderen** on-chain Einsatz (anderes deploytes Package) wählt der Boss in **Erweiterte Technik** eine abweichende `PACKAGE_ID` — das ist Expert-Fall, nicht Standard.

### Ablauf (Boss)

1. Move/Mailbox-Struktur auf dem **Boss-PC** betreiben.
2. **Helfer einrichten:** Profil + **Rechte** (Matrix / Medic / Reporter) → Team & Partner → **ZIP** / **IOTA**; neues Handy → **Seed + QR**; App installieren → **WLAN-QR** (ohne Handoff).
3. **Bestehende Geräte:** TTL/Purge → **Handoff** im selben Panel.

Weiter: `docs/HANDOFF-IMPORT-UX.md`, `docs/HANDOFF-ZIP-ENCRYPTION.md`, `docs/API-EINSATZ-ROLE-TEMPLATES.md`.

**Export-Assistent (Handoff-ZIP):** `docs/EXPORT-ASSISTENT-REFERENZ.md` · **Move on-chain (nur Messenger):** `docs/MOVE-MESSENGER-KONFIGURATION.md` · **Alle `.env`-Keys in den Einstellungen:** `docs/ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md` · Laientext gesamt: `docs/ENV-ERKLAERUNG.md`

---

## Einsatzleitung (Boss): WLAN-QR vs. Handoff

| Funktion | Zweck |
|----------|--------|
| **WLAN-QR** | PWA im LAN installieren (`install-qr`, Schema `mi`); LAN-IP via **`GET /api/lan-install-urls`**. **Keine** Rolle, **keine** Kontakte. |
| **Helfer einrichten** | Handoff-ZIP: Rolle, `ROLE_ID`, Capabilities, Partner, Team-Mailboxen, optional verschlüsselt. |
| **Einsatz-Vorlagen** | Dropdown / „Als Vorlage speichern“ im Experten-Block — `.morgendrot-einsatz-templates.json` (`docs/API-EINSATZ-ROLE-TEMPLATES.md`). |

Zielbild: `docs/EINSATZ-HELFER-EINRICHTEN-ZIELBILD.md`

---

## Gruppenchat

**Kurz:** Lokale **Gruppenliste** + gefilterter **Posteingang** (Union aller Mitglieder) + **Hybrid** aus IOTA-Archiv und Funk-Echtzeit. Kein Telegram-Gruppenraum — bewusst anderes Modell (`docs/GRUPPENCHAT-ZIELBILD.md`).

### Gruppe einrichten und verwalten

Kanal **Gruppe** wählen (Sendepfad im Kopf oder Sidebar) → **Gruppe verwalten**:

- **⋮** (Konversations-Menü) → **Gruppe verwalten…**, oder
- **Doppelklick** auf die Gruppe in der **Sidebar**

Im Sheet **Gruppe verwalten** (blockiert den Nachrichtenfluss nicht):

1. **Gruppe wählen** oder **Neue Gruppe** (leere Mitgliederliste).
2. **Gruppenname** (z. B. „Einsatz Alpha“).
3. **Mitglieder** — je Zeile oder Komma:
   - **Name aus Telefonbuch** (wird intern als `0x` gespeichert), oder
   - **`0x` + 64 Hex** direkt.
   - Button **Mitglieder aus Telefonbuch** — mehrere Kontakte übernehmen.
4. **Team-Postfach (Pflicht für Chain):** Team-Mailbox **wählen** oder (Boss) **neu erstellen**. Die **Object-ID** an alle Mitglieder weitergeben (Handoff, Kopieren, QR). Ohne Team-Postfach: kein Team-Broadcast on-chain.
5. Optional **Funk-Gruppenkanal (Meshtastic Secondary):** Kanalindex **0–7**, Kanalname, PSK-Ref — muss zur Meshtastic-App passen.
6. **Gruppe speichern**.

**Handoff:** Beim Boss-Export kann **`MESSENGER_GROUP_HANDOFF`** (Gruppe + Team-Postfach) in der ZIP liegen — siehe `docs/EXPORT-ASSISTENT-REFERENZ.md`.

### Posteingang

Alle Mitglieder sehen Nachrichten der Gruppe im gefilterten Posteingang (1:1-Dialoge der Mitglieder **plus** Team-Broadcast-Zeilen mit Badge **Team-Broadcast**).

### Senden (Composer)

| Modus | Sendepfad | Persistenz | Verhalten |
|-------|-----------|------------|-----------|
| **Unverschlüsselt** | **online** | **Mailbox** | **1× Team-Broadcast** in Team-Postfach (günstig; früheres N× pairwise entfernt) |
| **Unverschlüsselt** | **funk** | — | Klartext an Gruppe (Secondary-Kanal / Mitglieder im Mesh) |
| **Verschlüsselt** | **online** | Mailbox | **Noch kein** Team-Broadcast — je Mitglied Handshake nötig; Hinweis in UI |
| **Verschlüsselt** | **funk** | — | **Deaktiviert** — Verschlüsselung nur über online |

**Verschlüsselung umschalten:** Im Sheet **Gruppe verwalten** oder im **Konversations-Menü** (⋮, Verschl./Klar). Wechsel zu Unverschlüsselt bei aktivem Schloss: Warnhinweis (Klartext on-chain).

### Handshake in der Gruppe

Im Sheet **Gruppe verwalten** unter **Verschlüsselt:** Liste **Handshake pro Mitglied** (Senden / Annehmen). Peering-QR wie bei 1:1 (Sidebar **Ich** oder Handshake-Leiste).

### Was Gruppenchat **nicht** ist

- **Kein** gemeinsamer Chain-Thread ohne Team-Postfach (ohne M2c war es N× pairwise — **ersetzt** durch Team-Broadcast).
- **Kein** Ersatz für **Pinnwand** (Brett mit autorisierten Sendern).
- **Verschlüsselter Team-Broadcast** on-chain: Backlog § H.22 / Gruppen-E2EE.

---

## Pinnwand einbinden

**Gemeinsam** braucht ihr dieselbe Move-Instanz (`PACKAGE_ID`). Online-Klartext: Empfänger = **Broadcast-Adresse** aus `/api/status` (wenn `ENABLE_BROADCAST_PINNWAND` + `BROADCAST_PINNWAND_ADDRESS` gesetzt). **Sendepfad:** Pinnwand läuft über **Online (IOTA)** — Meshtastic-Primary-Broadcast ist kein Ersatz (keine Sender-Autorisierung, anderer Kanal). Für Funk-Gruppenchat: Kanal **Gruppe** + Secondary Channel in der Meshtastic-App (Handbuch § Sendepfad).

**Posteingang:** Filter **„Klartext“** für Pinnwand-Ketten; **Anheften** über Menü ⋯ an der Nachricht (lokal, `sessionStorage`). Spezifikation: `docs/BROADCAST-PINNWAND.md`.

---

## Handshake Vertrauen und Risiken

**Adresse prüfen:** Vor **Handshake starten** oder **`/connect`** die **Partner-`0x`-Adresse** verifizieren (Tippfehler, Phishing, falsches Clipboard). Ein Handshake mit der **falschen** Adresse liefert ein **ECDH-Geheimnis mit dem Falschen** — der Chat/Mailbox-Kanal ist dann nicht mit dem gewollten Partner vertraulich.

**Mailbox ≠ Tresor:** Nach erfolgreichem Handshake kann der Partner im Rahmen der **Mailbox** mit dir kommunizieren — **Tresor**, operative Daten und **On-Chain-Berechtigungen** sind **separat** abzusichern.

**Coins und Fernausführung:** Der Messenger ersetzt **keine** Wallet-Policy. Wenn am Node (oder angebundenem Client) **automatische Ausführung** empfangener Befehle aktiv ist (z. B. Listener mit **`ENABLE_AUTO_EXECUTE`** o. Ä.), kann ein missbräuchlicher Partner im Extremfall **Schaden bis zu fern ausgelösten Transfers** erzeugen — im Projekt README u. a. als Warnung vor **„sende X coins“**-Szenarien beschrieben. **Standard:** keine stillen Transfers ohne explizite, verstandene Konfiguration.

---

## Funk Klartext Einsatzmodus

**Meshtastic-Klartext (LongFast / Text):** Standard-Meshtastic-Text — **ohne** Morgendrot-Mesh-v2 und **ohne** `/connect`. **An alle:** Broadcast im Primary-Kanal (Haken „an Node-ID“ aus) — **nur unverschlüsselt**, Kanal **1:1**. **An einen Knoten:** Ziel-Node (`!…`) mit Haken „an Node-ID senden“.

**Nur Klartext + „funk“:** **Verschlüsselung** läuft über den **Online/IOTA-Pfad** — nicht über den Funk-Composer (bei aktivem Schloss wechselt die UI entsprechend).

**Expert-Option Kanalindex (0–7):** Im Composer (`[+]` → Mesh-Optionen) oder in **Gruppe verwalten** optional ein **Meshtastic-Kanalindex** setzen. **Leer** = Geräte-Default (typisch Primary). Ein falscher Index kann dazu führen, dass Empfänger im Team nichts sehen.

**Policy (UI):** Verschlüsselter LoRa-Funk ist in Morgendrot **deaktiviert**. Für Ende-zu-Ende: Sendepfad **online** mit verbundenem Partner (Handshake/`/connect`).

**Heltec koppeln:** Unter **Funk & Geräte** (Setup) **Bluetooth verbinden** / **USB verbinden** — der Browser zeigt die Geräteliste. Kein Web Bluetooth: Chrome/Edge; bei Brave ggf. `brave://flags`.

---

## Funk-Kontext Telefonbuch und Mesh-Export

**Telefonbuch Funk** (Setup → Funk & Geräte): Speichert im **Kontaktverzeichnis**, welche **IOTA-Adresse (`0x…`)** zu welcher **Meshtastic Node-ID (`!…`)** gehört.

| Feld | Zweck |
|------|--------|
| **0x… (64 Hex)** | IOTA-/Mailbox-Adresse des Kontakts — für Anzeige im Posteingang, Handshake/Online, Telefonbuch. **Nicht** die LoRa-Zieladresse beim Senden. Für Broadcast („An alle“) brauchst du **keine** 0x im Nachrichtenfeld. |
| **!… Node-ID** | Funk-ID wie am Radio — erscheint im Telefonbuch und kann im Composer unter **„An Node-ID senden“** als Ziel gewählt werden (getrennt vom 0x-Feld). |

**Mesh-Export / Import** (passwortgeschütztes JSON-Bundle): Alle gespeicherten Funk-Zuordnungen (0x, Node-ID, optional BLE-UUID) **verschlüsselt** auf einen anderen Rechner oder ins Handy übertragen — z. B. nach Gerätewechsel oder für QR-Handoff im Feld. Passwort min. 8 Zeichen; Export erzeugt JSON, Import merged ins lokale Telefonbuch.

---

## Pfad 4 LoRa und eigene Verankerung

Nach erfolgreichem **Klartext-Funk**: optionale Kopie per **Klartext-Mailbox** an **deine MY_ADDRESS** (Tangle) + optionale **Forensic-Attestation**. Unterstützt **Kurztext** sowie **LoRa-Bildzweiteiler (LUMA/CHROMA)** als Klartext-Funk; **kein** App-Mesh-v2-Versand. **Nicht** unterstützt in diesem Pfad: **Audio**, **.txt**, **IOTA-Kompaktbild** direkt.

---

## Package-ID und Posteingang

Wenn du eine **ID** per Messenger, Datei oder mündlich erhältst: hier eintragen. **Aktiv speichern** schreibt sie wie **`/set-package-id`**. **Nur Posteingang** lädt die Mailbox für diese ID **ohne** die lokale Datei zu ändern.

Bei mehreren Package-IDs in `.env` und **package-id-history** liest der Posteingang eine **Event-Union** über alle IDs — das ist Betreiber-Konfiguration, kein UI-Hinweis nötig.

---

## .morg-pkg (Paket-Archiv)

**Posteingang → Pakete:** ECDH-verschlüsselte **`.morg-pkg`**-Dateien für Sneakernet / Offline-Übergabe.

| Aktion | Bedeutung |
|--------|-----------|
| **Import: .morg-pkg → Archiv** | Entschlüsselt (Tresor + Handshake zum Absender) → **Paket-Archiv**, nicht Posteingang |
| **Export: Dateien → .morg-pkg** | Mehrere Dateien zu einem Paket bündeln und herunterladen |
| **Paket-Archiv** | Sheet mit importierten Bundles; Einzeldateien öffnen/weiterleiten |
| **Aus Nachricht exportieren** | Kontextmenü an Mailbox-Zeile (wenn implementiert) |

Voraussetzung Import: **Handshake** zum Absender der Datei (Peer in `peerMap`).

---

## Heltec, Web Bluetooth und Mesh-Posteingang

**Verbindung:** **Bluetooth verbinden** nutzt die Meshtastic-Bibliothek (**`TransportWebBluetooth`**) — der Browser zeigt die System-**Bluetooth-Geräteliste**. **USB am PC** optional über **USB verbinden** (Serial). **Brave** hat Web Bluetooth oft standardmäßig aus — **`brave://flags`** aktivieren oder **Chrome/Edge** nutzen; **sicheren Kontext** beachten (HTTPS oder `localhost`).

**Eingehende** Texte und **`PRIVATE_APP`** Binary v2 erscheinen im **Posteingang** (Zuordnung über Adress-Fingerprint). **Export/Import:** Mesh-Metadaten inkl. **`bleUuid`**-Reserve.

---

*Stand: 2026-06-16 — Sidebar-Chat, SOS/Sendepfad im Kopf, Gruppe-verwalten-Sheet, Peering-QR unter Ich, Inbox vor Composer.*
