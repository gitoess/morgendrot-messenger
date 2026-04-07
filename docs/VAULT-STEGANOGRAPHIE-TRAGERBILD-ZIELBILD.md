# Vault in Bildern verstecken (Steganographie) – Zielbild und kritische Einordnung

**Status:** Konzept- und Risiko-Dokument. **Kein** vollständiger Implementierungsstand im Messenger-Kern: der Vault liegt weiterhin typischerweise in einer Datei (z. B. `.morgendrot-vault`) oder on-chain; siehe `docs/NOTFALL-PURGE-MESSENGER.md`, `docs/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md`.

---

## 1. Idee in einem Satz

Statt einer offensichtlichen Dateiendung kann der **verschlüsselte Vault-Blob** in oder an eine **Bilddatei** gelegt werden. Für einen **oberflächlichen** Zugriff (Ordner durchsehen, nach `.vault`/`.db` suchen) wirkt der Ordner wie harmlose Medien — der tatsächliche Geheimtext bleibt **ohne Passwort** weiterhin nur nutzloser Binärinhalt.

---

## 2. Zwei übliche Techniken (und ihre Grenzen)

### 2.1 Anhang nach dem Bildende (Append / „JPEG EOF“)

- **Vorgehen:** Der ciphertext wird **hinter** die letzten Bytes eines gültigen Bildes geschrieben (z. B. JPG/PNG). Viele Viewer decodieren nur bis zum Bildende und zeigen das Foto normal.
- **Vorteil:** Einfach, robust gegen **reines Anzeigen** des Bildes; keine Pixel-Manipulation.
- **Grenze:** Für einen **motivierten** Angreifer mit Festplattenimage ist das **kein** starkes Versteck: Werkzeuge zum **Carving** oder Entropie-Scans finden angehängte Blobs oft schnell. Es ist **Tarnung gegen schnelle Suche**, nicht „unsichtbar vor Forensik“.

### 2.2 Least Significant Bits (LSB) in Pixeln

- **Vorgehen:** Bits des Ciphertexts in die **niedrigwertigsten** Farbbits einbetten; für das Auge oft unverändert.
- **Vorteil:** Kein offensichtlicher „Anhang“ am Dateiende; verteilte Nutzlast.
- **Grenzen:**
  - **Kapazität:** Nur wenige Bit pro Pixel → große Vaults brauchen große Bilder oder starke Kompression der Nutzlast (Vault ist bereits komprimiert/verschlüsselt — wenig Spielraum).
  - **Verarbeitung:** Jede **Neu-Kompression**, **Skalierung**, „Optimierung“ durch App-Store-CDN oder Bildbearbeitung kann die Nutzlast **zerstören**.
  - **Detektion:** Statistische Tests können LSB-Stego aufdecken.

**Fazit:** Beide Verfahren erhöhen den **Aufwand für den Angreifer**, verschieben aber das Problem: Ohne Passwort bleibt der Inhalt sicher; **mit** vollständigem Datenträger-Image kann ein Profi systematisch alle Bilder testen. Das ist **kein Ersatz** für starkes Passwort und **kein** Ersatz für **On-Chain- oder physisches Backup**.

---

## 3. App-Icon / Logo als Träger – psychologisch klug, technisch heikel

### 3.1 Psychologische Tarnung (stimmt oft)

- Suchprofile: Dokumente, Datenbanken, Klartext-Notizen. **Statische „App-Ressourcen“** (Icons, Hintergrundbilder) werden bei schneller Durchsuchung oft **nicht** als Geheimcontainer vermutet.

### 3.2 Schutz vor versehentlichem Löschen (nur bedingt)

- **Intuition:** Wer die App behalten will, löscht selten das **Logo**, das zur Installation gehört.
- **Einschränkung:** „Icon weg = App kaputt“ gilt nicht überall gleich (Web-PWA, mehrere Icon-Größen, Cache). **Verwechslungsgefahr:** Nutzer kopiert „nur das Bild“ ohne Vault oder ersetzt es durch ein Update.

### 3.3 Build- und Update-Risiko (wichtig)

In diesem Projekt werden PWA-Icons u. a. aus **`frontend/public/icon.svg`** per **`npm run build:pwa-icons`** erzeugt (siehe `docs/ROADMAP-FAHRPLAN.md`, `docs/PWA-MANUAL-CHECKS.md`). Ein **Standard-Release** liefert **identische** Icon-Binaries für alle Nutzer — ein **individueller** Vault **darf nicht** in das **git-versionierte** Standard-Icon gepackt werden (sonst wäre es ein Leck für alle Builds).

**Realistisches Modell:**

- **Feld:** Ein **vom Nutzer gewähltes** Bild oder ein **mitgeliefertes Standard-Trägerbild als Vorlage** (siehe **§ 8**): wichtig ist nur, dass die **mit Vault beschriebene Datei** im **nutzerspezifischen Datenbereich** landet, nicht im überschreibbaren App-Bundle.
- **Update:** Überschreibt ein Update **nur** die Installation im Programmordner, bleibt die Kopie unter **`…/userdata/…`** unangetastet. Gefahr besteht weiterhin bei **„App-Daten löschen“**, **Werk zurücksetzen** oder manuellem Löschen — deshalb **Chain-** und **Offline-Backup**.

**Empfehlung:** Wenn Trägerbilder genutzt werden, **vor** riskanten Systemaktionen: Vault **exportieren**, **Chain-Backup** prüfen (`vault-onchain`), oder **physisches Backup** (Zuhause).

---

## 4. „Home-Anker“ vs. „Feld“ vs. Chain

| Ort | Rolle |
|-----|--------|
| **Zuhause (USB o. Ä.)** | Klassisches **Master-Backup** — unabhängig vom Mobilgerät. |
| **Feld (lokal, getarnt)** | Bequemer Zugriff; höheres Verlust-/Update-Risiko für die **Datei**. |
| **Chain (`VAULT_REGISTRY_ID`)** | Notfall-Backup ohne SD-Karte; **Notfall-Purge** löscht gezielt den On-Chain-Teil — siehe `docs/NOTFALL-PURGE-MESSENGER.md`. |

Ein versteckter lokaler Vault **ändert nichts** an der Notfall-Purge-Semantik: On-Chain-Purge betrifft die Registry; die **Trägerdatei** muss **zusätzlich** gelöscht werden, wenn lokale Spuren verschwinden sollen.

---

## 5. Bedrohungsmodell (kurz)

| Angreifer | Was Tarnung bringt | Was sie nicht ersetzt |
|-----------|--------------------|------------------------|
| **Zufälliger Zugriff auf Gerät** | Weniger offensichtliche Datei | Passwort, Full-Disk-Zugriff |
| **Forensik / Image der Festplatte** | Nur Zeit/Aufwand | Systematische Suche nach Blobs/LSB |
| **Cloud-Backup des Fotos** | Ggf. nichts | Vault könnte **mit** ins Backup — **Klartext-Metadaten** des OS je nach Anbieter |

**Double-Lock** (Passwort + Unbekanntheit des **Ortes**) ist **kein** zweiter kryptografischer Faktor — es ist **Security through Obscurity** als **zusätzliche** Hürde, sinnvoll nur **mit** starkem Passwort und **mit** Backup-Strategie.

---

## 6. Mögliche Produkt-Schritte (Roadmap, nicht versprochen)

1. **„In Bild tarnen“ / „Aus Bild laden“** mit **Append** (oder definiertes Format mit Magic-Header am Ende).
2. **Speicherort:** nur **nutzerspezifisches Datenverzeichnis** (siehe **§ 7.3**), nie die schreibgeschützte Vorlage im App-Installationsordner.
3. **Vor** Factory-Reset / „App-Daten löschen“: Hinweis; optional automatischer Export.
4. PWA/Build: **Kein** persönlicher Vault in **`icon.svg`**-generierten Icons; Standard-Trägerbild ist eine **eigene, große** Asset-Datei (**§ 7.1**), nicht das 192×192-Launcher-Icon.

---

## 7. Produktvision: Standardbild, eigene Wahl, Speicherort, UI (Zielbild)

Die folgenden Punkte präzisieren die Nutzerstory **ohne** Implementierungsversprechen. Sie lösen den Widerspruch „offizielles Branding vs. persönlicher Vault“, indem **Vorlage** und **beschriebene Datei** strikt getrennt werden.

### 7.1 Standard-Trägerbild („Morgendrot-Edition“)

- **Inhalt:** Ein hochwertiges, atmosphärisches Foto (z. B. Landschaft, Höhle, Sonnenaufgang) — **nur** als **unveränderliche Vorlage** im Lieferumfang (z. B. JPEG/PNG unter `resources/` o. Ä.).
- **Psychologischer Vorteil:** Bei einer schnellen Durchsuchung wirkt die Datei wie **normales Branding oder ein Hintergrundbild**, nicht wie ein Schlüsselbund.
- **Technik:** Beim ersten Gebrauch liest die App die **Vorlage** und schreibt eine **Kopie** ins **User-Datenverzeichnis**; an **diese Kopie** wird der verschlüsselte Vault angehängt (§ 2.1). Die Original-Vorlage im App-Ordner bleibt **ohne** Nutzdaten.

### 7.2 „Eigene Wahl“ (höhere Tarnung)

- Nutzer wählt ein beliebiges Bild (Hund, Zeichnung, Urlaubsfoto) ohne Bezug zu Morgendrot — **maximale** plausible Harmlosigkeit für Außenstehende.
- Gleicher technischer Ablauf: **Append** an eine Kopie unterhalb des User-Dirs; keine Abhängigkeit vom App-Update-Pfad.

### 7.3 Überschreiben durch Updates vermeiden

| Falsch | Richtig |
|--------|---------|
| Träger nur im App-Installationsordner | Träger-**Kopie** im **nutzerspezifischen** Bereich (z. B. Linux: `XDG_DATA_HOME`/„Morgendrot“; Windows: `%APPDATA%`; Android: app-spezifisches Scoped Storage; **CM4**/Embedded: z. B. `/home/<user>/.local/share/...` o. Ä. — konkreter Pfad ist **plattformabhängig**) |
| Dateiname `vault_image.jpg` | **Neutrales** Muster: `wallpaper_01.jpg`, `img_2024_cache.jpg` — wirkt wie Medien-Cache (**kein** Vault im Namen) |
| `.bin` neben Fotos | Optional möglich, wirkt in Foto-Alben oft **fremder** als eine große JPEG; **eher Bildcontainer-Format** wählen, das zur Story passt |

**Kern:** App-Updates ersetzen Programmdateien, **nicht** automatisch den Ordner mit Nutzerdaten — sofern das OS den nicht leert.

### 7.4 Größenordnung (realistisch, keine Garantie „klein“)

Der verschlüsselte Blob wächst mit **Passwortmanager** (max. **300** Einträge, Felder begrenzt — `sanitizePersonalSecrets` in `src/vault-local.ts`) und **Freitext-Notizen** (max. **500.000** Zeichen). Im **Worst-Case** kann der JSON-Payload **mehrere MB** erreichen; typische Nutzung ist **deutlich kleiner**.

- **Trägerbild:** Ausreichend große Auflösung/Datei wählen, sodass **Bild + Anhang** noch wie ein normales „schweres“ Hintergrundbild wirken (auf Smartphones sind **mehrere MB** für Wallpapers üblich).
- **Versprechen vermeiden:** Nicht behaupten, der Container sei „immer unauffällig klein“ — besser: **„größenmäßig im üblichen Wallpaper-Bereich haltbar“**.

### 7.5 UI-Workflow (Zielbild)

**Tab „Sichern“ (o. Ä.):** Aktion **„In Bild tarnen“**.

| Schritt | Nutzeraktion | System |
|--------|----------------|--------|
| A | **„Morgendrot-Standardbild“** | Vorschau der Vorlage; Speichern = Kopie nach User-Dir + Vault anhängen |
| B | **„Eigenes Bild wählen“** | Dateiauswahl; Kopie/Ziel im User-Dir; dann derselbe Append-Vorgang |
| Hinweis | — | Kurzer Satz: **„Ohne Passwort bleibt der Anhang nutzlos; Backup: Chain/Zuhause.“** |

**Kommunikation:** Begriffe wie **„Tresor in diesem Foto verstecken“** sind für Laien klarer als „steganographische Operation auf Header-Ebene“ — die **technische** Realität bleibt meist **Append nach JPEG/PNG** (§ 2.1), nicht LSB, es sei denn, ihr plant explizit LSB mit allen Nachteilen.

### 7.6 Grenzen (erneut)

- **Forensik** (§ 2) bleibt gültig.
- **Cloud-Foto-Backup** kann die Datei **mitkopieren** — ggf. Risiko je nach Anbieter (§ 5).

---

## 8. Verwandte Dokumente

- `docs/NOTFALL-PURGE-MESSENGER.md` — was bei Purge wirklich weg ist  
- `docs/EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md` — Purge/Shred vs. Append, Online/Offline, PDF-Fallen  
- `docs/VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md` — Rettung: eine Datei pro Rolle, Beschriftung, ohne Spionage-Fokus  
- `docs/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md` — Vault vs. Chatverlauf  
- `docs/ROADMAP-FAHRPLAN.md` — PWA-Icons und Build-Kette  

---

*Stand: Zielbild und Risikoabwägung; § 7 Produktvision; Implementierung im Kern optional/zukünftig.*
