# Messenger (Chat): Sendepfad, Verschlüsselung, SOS, Sprache

**Zweck:** Ausführliche Hinweise, die früher direkt in der Chat-UI standen — hier gebündelt für Nachlesen (PWA-Handbuch, offline nach erstem Abruf möglich).

**Verwandt:** `docs/PWA-HANDBUCH-OFFLINE.md`, `docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`, `docs/MESSENGER-CAPABILITIES-OVERVIEW.md`, Fahrplan Nachtrag 2026-04-20 (verschlüsselter LoRa-Versand aus).

---

## Verschlüsselung und Partner-Key

**Verschlüsselt:** Nachrichten sind **nur mit dem Partner-Schlüssel** sinnvoll lesbar. Die **Entschlüsselung** erfolgt auf **diesem Node** (Backend), wenn der **Tresor entsperrt** ist. Das ist **kein** Signal-artiges Perfect Forward Secrecy (PFS): wer Langzeit-Schlüssel und gespeicherte Ciphertexte hat, kann bei späterem Zugriff mitentschlüsseln — Threat Model bewusst mitdenken.

**Unverschlüsselt · online:** Klartext erscheint in der Chain (`/send-plain`); Modus **Nur Event** vs. **Mailbox** steuert die Speicherlogik (siehe `MESSAGING-MAILBOX-SSOT-SPEC.md`).

**Unverschlüsselt · funk:** Meshtastic-**Klartext** (LongFast). Für **Ende-zu-Ende** den Transport **online** wählen (oder Verschlüsselung aktivieren — wechselt bei Bedarf automatisch zu online).

---

## Sendepfad: Online (IOTA/Mailbox) vs. Funk (LoRa/Meshtastic)

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

**Einsatzmodus:** Zuerst **Text eingeben** oder **diktieren**, dann **SOS senden**. Die Nachricht geht an den gewählten Chat-Empfänger (**Funk oder online** — wie eingestellt), mit Notfall-Kennzeichnung **`MORG_EMERGENCY_V1`**. **Kein** automatischer **112**-Ruf. Nur nutzen, wenn wirklich Hilfe nötig ist.

Spezifikation und Wire: **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`**.

---

## Sprachmemo und Einsatzmodus-Diktat

**Sprachmemo:** Maximal **ca. 35 s**, nur bei **Online/IOTA** (Opus; nicht über Meshtastic-Funk wie normales Memo). Datei per **Drag & Drop**, **Datei importieren** oder **Kamera/Webcam** — danach **Senden**.

**Einsatzmodus Diktat:** Textfeld fokussieren und **OS-Diktat** nutzen — **Windows:** **Win+H** | **Android:** **Mikrofon** in der Tastaturleiste.

---

## Handshake Vertrauen und Risiken

**Adresse prüfen:** Vor **Handshake starten** oder **`/connect`** die **Partner-`0x`-Adresse** verifizieren (Tippfehler, Phishing, falsches Clipboard). Ein Handshake mit der **falschen** Adresse liefert ein **ECDH-Geheimnis mit dem Falschen** — der Chat/Mailbox-Kanal ist dann nicht mit dem gewollten Partner vertraulich.

**Mailbox ≠ Tresor:** Nach erfolgreichem Handshake kann der Partner im Rahmen der **Mailbox** mit dir kommunizieren — **Tresor**, operative Daten und **On-Chain-Berechtigungen** sind **separat** abzusichern.

**Coins und Fernausführung:** Der Messenger ersetzt **keine** Wallet-Policy. Wenn am Node (oder angebundenem Client) **automatische Ausführung** empfangener Befehle aktiv ist (z. B. Listener mit **`ENABLE_AUTO_EXECUTE`** o. Ä.), kann ein missbräuchlicher Partner im Extremfall **Schaden bis zu fern ausgelösten Transfers** erzeugen — im Projekt README u. a. als Warnung vor **„sende X coins“**-Szenarien beschrieben. **Standard:** keine stillen Transfers ohne explizite, verstandene Konfiguration.

---

## Funk Klartext Einsatzmodus

**Meshtastic-Klartext (LongFast / Text):** Standard-Meshtastic-Text — **ohne** Morgendrot-Mesh-v2 und **ohne** `/connect`. **Broadcast** an alle im Kanal, oder **Ziel-Knoten** (`!…` wie am Radio angezeigt) mit der Option „An Node-ID senden“.

**Nur Klartext + „funk“:** **Verschlüsselung** läuft über den **Online/IOTA-Pfad** — nicht über den Funk-Composer (bei aktivem Schloss wechselt die UI entsprechend).

---

## Pfad 4 LoRa und eigene Verankerung

Nach erfolgreichem **Klartext-Funk**: optionale Kopie per **Klartext-Mailbox** an **deine MY_ADDRESS** (Tangle) + optionale **Forensic-Attestation**. Unterstützt **Kurztext** sowie **LoRa-Bildzweiteiler (LUMA/CHROMA)** als Klartext-Funk; **kein** App-Mesh-v2-Versand. **Nicht** unterstützt in diesem Pfad: **Audio**, **.txt**, **IOTA-Kompaktbild** direkt.

---

## Package-ID und Posteingang

Wenn du eine **ID** per Messenger, Datei oder mündlich erhältst: hier eintragen. **Aktiv speichern** schreibt sie wie **`/set-package-id`**. **Nur Posteingang** lädt die Mailbox für diese ID **ohne** die lokale Datei zu ändern.

---

## Schnell verbinden und /connect

**Kein** separater **„Handshake annehmen“**-Knopf: **Schnell verbinden** führt intern **`/connect`** aus: Die Kette/Mailbox wird abgefragt. Kommt der Handshake deines Partners zuerst, antwortet das Backend automatisch mit deinem Handshake; sonst wird einmal dein Handshake gesendet und auf die Gegenpartei gewartet.

**Typischer Ablauf:** A trägt B ein und startet Handshake; B führt **Schnell verbinden** aus (nutzt **`PARTNER_ADDRESS`** / Kommandant aus **`.env`**) oder im Terminal **`/connect 0x…`** mit der Adresse von A. Ist links eine gültige **`0x`+64-Hex** eingetragen, verwendet Schnell verbinden genau diese Adresse (hilfreich z. B. beim Test mit dir selbst).

**Wichtig:** Nach dem Klick dauert die echte Verbindung oft noch Sekunden — erst wenn der Status **„verbunden“** zeigt, klappt **verschlüsselt über Online/Mailbox** (Funk = Klartext, kein App-Mesh-v2-Versand).

---

## Heltec, Web Bluetooth und Mesh-Posteingang

**Verbindung:** **Heltec (Web Bluetooth) verbinden** nutzt die Meshtastic-Bibliothek (**`TransportWebBluetooth`**) — der Browser zeigt die System-**Bluetooth-Geräteliste** (kein eigener „Gerät suchen“-Dialog in Morgendrot). **USB am PC** lädt ggf. nur Strom/Firmware-Serial; der Messenger-Pfad hier geht per **BLE** vom Rechner zum Heltec (PC-Bluetooth an, Heltec sendet im Mesh-Kanal). **Brave** hat Web Bluetooth oft standardmäßig aus — **`brave://flags`** aktivieren oder **Chrome/Edge** nutzen; **sicheren Kontext** beachten (HTTPS oder `localhost` — siehe auch die gelbe Warnung in der UI bei unsicherem Kontext).

**Eingehende** Texte und **`PRIVATE_APP`** Binary v2 erscheinen im **Posteingang** (Zuordnung über Adress-Fingerprint). **Export/Import:** Mesh-Metadaten inkl. **`bleUuid`**-Reserve.

---

*Stand: UI-Kürzung 2026-04-20; Partner-Setup / Handshake-Risiken / Funk-Pfad 2026-04-20.*
