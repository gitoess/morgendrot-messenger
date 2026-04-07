# Trägerbild in der Rettung: Organisation statt „Spionage“

**Status:** Zielbild / Produktidee. Technische Grundlagen (Append, User-Dir, PDF-Risiken): `docs/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md`, `docs/EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md`.

---

## 1. Einordnung: wofür das gut ist

Ohne Tarn-Narrativ ist der Kernnutzen **taktisch-organisatorisch**:

| Nutzen | Kurz |
|--------|------|
| **Weniger Daten-Chaos** | Ein **Träger** (eine Bilddatei) kann neben dem sichtbaren Foto den **verschlüsselten Vault-Blob** tragen — Schlüssel, Passwortmanager, Notizen **gebündelt**, statt verteilt über viele Ordner/Exporte. |
| **Kommunikation** | „**Das** ist das Bild vom Siphon / der Lage — **darin** steckt der aktuelle technische Stand“ ist für Teams leichter verständlich als „hier ein Blob und drei Metadaten-Dateien“. |
| **Portabilität** | Bilder lassen sich wie andere Medien **kopieren, per SD weitergeben, an Stabsstellen schicken** — ohne separates Datenbank-Setup. |
| **Archivierung** | Bilder werden in Einsatzberichten und Medienarchiven **häufig** länger mitgeführt als lose Textdateien — **kein** Garant für „ewig“, aber **praktisch oft** robuster in der Langzeitablage (sofern die Datei **bitgenau** bleibt, siehe PDF-Kapitel in `EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md`). |
| **Verlust des Geräts** | Unbefugter sieht zuerst eine **Fotogalerie**; ohne Passwort bleibt der Anhang **nutzlos**. Das **ersetzt** keine zentrale Sperre von Zugängen — verschafft aber **Zeit**, bis Zugänge gedreht werden. |

---

## 2. Vorgefertigte Träger: „Helfer A · Trupp B · Sanitäter 1“

### 2.1 Idee

Die **Einsatzleitung** (oder der Boss-Workflow) stellt **pro Rolle / pro Person** ein **definiertes Trägerbild** bereit — analog zu **beschrifteten Karten**:

- Dateiname oder Metadaten: z. B. `einsatz_wald_2026-05-05_trupp2_sanitaeter1.jpg`
- Inhalt sichtbar: **neutraler Hintergrund** oder **Lagefoto-Vorlage** + optional **Klartext-Beschriftung** (siehe § 3)

**Vorteil:** Im Archiv und auf der SD-Karte ist sofort erkennbar, **welches** Bild zu **welcher** Rolle gehört — weniger Verwechslung als fünf gleich aussehende „wallpaper_01.jpg“.

### 2.2 Datenschutz (PII)

**Sichtbarer Text auf dem Bild** (Name „Johan“, Funktion, Datum) ist **personenbezogen** und kann bei **Verlust oder Weitergabe** des Files sensibel sein.

**Abwägung:**

- **Volle Namen** nur, wenn die **Einsatzordnung** das ohnehin vorsieht und das Medium **geschützt** bleibt.
- **Pseudonyme / Codes** („SAN-T1-WALD-2026“) statt Klarnamen, wenn die **Zuordnung intern** über Register/Excel erfolgt.

---

## 3. Bilder **erzeugen** mit Text: „Johan · Sanitäter · Trupp 1 · Rettung Wald · 5.5.2026“

### 3.1 Umsetzung (Zielbild)

1. **Vorlage** (Hintergrundfarbe, Logo, Raster) aus dem System oder vom Boss.
2. **Textzeilen** aus strukturierten Feldern: Anzeigename oder Code, Rolle, Trupp, Einsatzbezeichnung, Datum/Uhrzeit (Zeitzone klar angeben).
3. **Rendering** zu einem **einmaligen** PNG oder JPEG (Server- oder Client-Canvas, Headless-Renderer o. Ä.).
4. **Danach** den **verschlüsselten Vault** per **Append** an diese **fertige** Datei hängen (siehe Stegano-Dok § 2.1, § 7).

**Wichtig:** Jede **nachträgliche Bearbeitung** des Bildes (Fotobearbeitung, „Speichern unter“, **PDF-Einbettung mit Re-Encoding**) kann den Anhang **zerstören**. Der Workflow muss sein: **generieren → Vault anhängen → Datei nicht mehr pixelbearbeiten**.

### 3.2 Was **nicht** automatisch mitkommt

- **Live-Aktualisierung des Beschriftungstextes** bei jedem Vault-Speichern wäre aufwendig (neu rendern + neu appenden). Praktischer: **Beschriftung = Einsatzbindung**, Vault-Inhalt = **laufender** Stand; oder **Export** erzeugt ein **neues** Bild zu definierten Zeitpunkten.

---

## 4. Zusammenfassung für Morgendrot (ohne Spionage-Story)

- **Ordnungs- und Übertragungswerkzeug:** eine **Datei** pro klarer Zuordnung (Rolle/Einsatz).
- **Portabel** zwischen Geräten und Helfern.
- **Archivfreundlich**, sofern **Originalbytes** erhalten bleiben (Vorsicht bei PDF/Cloud-Foto-Backup — siehe verlinkte Dokumente).
- **Basis-Schutz bei Verlust** durch Verschlüsselung + unauffällige äußere Form — **kein** Ersatz für organisatorisches Widerrufen von Zugängen.

---

## 5. Verwandte Dokumente

- `docs/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md` — Append, User-Dir, UI-Skizze  
- `docs/EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md` — PDF, Purge, Shred  
- `docs/EINSATZBERICHT-EXPORT.md` — Export-Stand Stabsstelle  
- `docs/BOSS-ORIENTIERUNG.md` — Rollen, Übergabe  

---

*Stand: Zielbild Einsatzorganisation; Implementierung optional.*
