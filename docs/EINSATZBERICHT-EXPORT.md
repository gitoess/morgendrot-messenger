# Einsatzbericht & Exporte (Messenger)

## Zwei Welten (bewusst getrennt)

| Format | Zielgruppe | Inhalt | Öffnen mit |
|--------|------------|--------|------------|
| **`.morg-pkg` / `.morg-pkg.json`** | Intern, Morgendrot | ECDH + AES-GCM wie `/send`; volle Wire-Daten | Nur mit Morgendrot-Keys + Handshake zum Absender |
| **Einsatzbericht** | Extern / Stabsstelle | Chronologie, Metadaten, Klartext-Wires im JSON | JSON direkt; **verschlüsselt** mit Passwort + statische Seite `einsatzbericht-decrypt.html` |

## .morg-pkg – häufige Fehlerquellen

1. **Nicht verbunden:** Backend braucht **`/connect`** und `peerMap`. Import-Button ist deaktiviert ohne `connected`.
2. **Absender fehlt in peerMap:** Paket muss von einem Partner stammen, mit dem ein Handshake lief.
3. **UTF-8-BOM:** Wird beim Import automatisch entfernt.
4. **Große Bundles:** API-Timeout für Import/Export **180 s**.

## Einsatzbericht (UI)

- **Bericht JSON:** Vollständiger Export `morgendrot.einsatzbericht.v1` (chronologisch, inkl. `content` pro Nachricht – kann groß/sensibel sein).
- **Bericht .txt:** Kurzfassung lesbar.
- **Bericht verschl.:** PBKDF2 (210k) + AES-256-GCM, Schema `morgendrot.einsatzbericht.enc.v1`.  
  **Entschlüsseln:** Im Next-Build unter **`/einsatzbericht-decrypt.html`** (Datei `frontend/public/einsatzbericht-decrypt.html`).
- **ZIP (Klartext):** Archiv mit JSON/TXT; optional zusätzlich **`.zip.enc.json`** (verschlüsselte Hülle um die ZIP-Bytes).

### Stand (2026-03)

- **Posteingang:** Anzeige paginiert (z. B. 50 pro Seite); **„Weitere Nachrichten laden“** lädt ältere Einträge per Offset – **unabhängig** vom Export.
- **Export:** Vollständiger Verlauf über die API (nicht nur die aktuell sichtbare Seite); siehe auch **`docs/ROADMAP-FAHRPLAN.md`** (Punkt 2).

## Roadmap (erweiterte Vorschläge)

- **ZIP mit Anhängen:** Binärdateien (extrahiert aus MORG_*-Wires) als eigene Dateien im Archiv; Metadaten als `manifest.json`. Umsetzung sinnvoll **serverseitig** oder mit kleiner ZIP-Lib im Browser.
- **Passwort-ZIP (7-Zip-kompatibel):** Standard AES-Zip im Browser ist aufwendig; Alternative: **serverseitiger** Export-Job oder CLI-Tool.
- **PDF:** Layout, Seitenumbrüche, eingebettete Bilder – eher **Phase 2**; zuerst strukturiertes JSON/ZIP.
- **Zusammenfassung (KI):** Optional zweite Datei `summary.md`, nur nach expliziter Nutzerzustimmung (Datenschutz).

## Messager-Transport-UI

- **Online (🌍):** IOTA/Mailbox/Tor – kein Bluetooth.
- **Funk (📡) / Ad-hoc (📱):** LoRa/Meshtastic bzw. Platzhalter; **Web Bluetooth** nur unter „Partner verbinden“ bei Meshtastic. Beim Wählen von **funk** erscheinen **Nächste Schritte** + Link, das Setup-Panel zu öffnen.

Verknüpft: **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/MESSENGER-BUNDLE-SOURCE-OF-TRUTH.md`** (kein manuelles Leeren von `exports/`).
