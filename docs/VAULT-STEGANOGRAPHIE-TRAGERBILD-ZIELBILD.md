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

- **Feld:** Ein **vom Nutzer gewähltes** Bild (z. B. kopiertes `bg_stone.jpg` auf der SD-Karte), **nicht** das mitgelieferte Standard-Icon aus dem Repository; oder ein **separater Build** / Profil, das ein **nutzerspezifisches** Trägerbild einbindet.
- **Update:** Jede **Überschreibung** der Trägerdatei (App-Update, erneutes `build:pwa-icons`, Sync-Tool) kann den Vault **vernichten** oder **verändern**, wenn die Implementierung nicht vorher extrahiert oder auslagert.

**Empfehlung:** Wenn Trägerbilder genutzt werden, **vor** Updates: Vault **exportieren**, **Chain-Backup** prüfen (`vault-onchain`), oder **physisches Backup** (Zuhause).

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

1. Optionaler Modus: **„Vault aus Bild laden“** (Append oder definiertes Format mit Magic-Header).
2. **Vor** App-/Asset-Updates: Hinweis oder automatisches **Auslagern** des Blobs (temporäre normale Datei oder User-Prompt).
3. Dokumentation: **Nie** Standard-Release-Icons als persönlichen Träger verwenden; nur **eigene** Bilder oder dedizierte Profile.

---

## 7. Verwandte Dokumente

- `docs/NOTFALL-PURGE-MESSENGER.md` — was bei Purge wirklich weg ist  
- `docs/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md` — Vault vs. Chatverlauf  
- `docs/ROADMAP-FAHRPLAN.md` — PWA-Icons und Build-Kette  

---

*Stand: Zielbild und Risikoabwägung; Implementierung im Kern optional/zukünftig.*
