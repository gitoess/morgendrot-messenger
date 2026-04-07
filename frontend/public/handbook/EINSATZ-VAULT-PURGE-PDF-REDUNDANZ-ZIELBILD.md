# Einsatz-Ende: Purge, Redundanz, PDF — Zielbild mit kritischen Korrekturen

**Status:** Konzept- und Abwägungs-Dokument. Verknüpft mit `docs/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md`, `docs/NOTFALL-PURGE-MESSENGER.md`, `docs/EINSATZBERICHT-EXPORT.md`. **Kein** vollständiger Implementierungsstand für „nur Vault im Bild“ oder „PDF enthält extrahierbaren Vault“.

---

## 1. „Purge-Garantie“ und Schreddern — technisch präzise

### 1.1 Vault „nur im Bild“, keine `.morgendrot-vault`

Wenn das System so gebaut ist, dass der **Arbeits‑Vault** ausschließlich in einer **Trägerdatei** (Bild + angehängter Blob) liegt, entfällt eine zweite Klartext-Datei — **das ist ein Zielbild**, nicht der aktuelle Kern-Code.

### 1.2 „Pixel mit Zufallsrauschen überschreiben“ — oft der falsche Hebel

| Träger-Technik | Was zerstört die Nutzlast? |
|----------------|------------------------------|
| **Append** (Ciphertext **nach** JPEG/PNG-EOF, siehe Stegano-Dok § 2.1) | **Nicht** das Überschreiben sichtbarer Pixel allein — Viewer ignorieren den Anhang; die Bytes sitzen **am Dateiende**. Zuverlässig: **gesamte Datei** mit Zufallsdaten überschreiben (oder mehrfach) und löschen, oder gezielt den **Tail** entfernen. |
| **LSB** in Pixeln | Zerstörung/Noise in den **Pixeldaten** kann die Nutzlageträger beschädigen — hier ist „Rauschen“ sinnvoll, sofern das Format passt. |

**Fazit:** Die Formulierung „Pixel überschreiben und Datei löschen“ ist nur dann „wesentlich sicherer als normales Löschen“, wenn **alle** relevanten Bytes (mindestens die **gesamte** Bilddatei inkl. Anhang) überschrieben werden — nicht nur die sichtbare Bildmatrix bei **Append**.

### 1.3 Optional: „Einsatz beenden & Spuren verwischen“

Als **Produktidee:** ein geführter Ablauf, der **Trägerbild** (User-Dir), **`.morgendrot-vault`**, **Inbox-Cache**, optional **Chain-Purge** in der vom Nutzer gewählten Kombination anstößt — mit klarer Checkliste, was **heute** schon automatisch geht (siehe `NOTFALL-PURGE-MESSENGER.md`) und was **zusätzlich** implementiert werden müsste.

---

## 2. Online-Zwang für Helfer? — Abwägung

**Nur Online-Vaults** (ausschließlich Registry) wären in **Blackout**, **Höhle**, **Katastrophe** riskant:

- Ohne Netz: **keine** Erst-Anlage, **kein** Anker — bei Geräteverlust ohne lokalen Stand **datenvernichtend**.
- **Latenz/Energie:** Chain-Upload ist teurer als lokales Schreiben; unter Stress unattraktiv.

**Morgendrot-konform (Zielbild):** **Offline First, Online Second** — lokaler Stand (z. B. Trägerbild im User-Dir) **immer** möglich; **optional** bei Netz: „**Aktuellen Stand in der Chain verankern?**“ (`vault-onchain` o. Ä.). So bleibt **Einsatzfähigkeit** ohne Internet, **Redundanz** mit Internet.

---

## 3. Hybrid: Feld → Basis → Archiv

Ein plausibler **Soll-Ablauf** (nicht alles ist im Repo voll automatisiert):

1. **Im Feld:** Arbeit mit lokalem Vault (Datei und/oder Trägerbild).
2. **Mit Netz:** Nutzer **entscheidet**, ob ein **verschlüsselter** On-Chain-Backup (`VAULT_REGISTRY_ID`) aktualisiert wird — nicht implizit „immer sofort synchron“.
3. **Stabs-/Boss-Archiv:** Einsatzbericht laut `docs/EINSATZBERICHT-EXPORT.md` (JSON/ZIP, PDF eher Phase 2).

**Dreifache Redundanz** (lokal / Chain / physisch-digital) ist **sinnvoll als Prinzip** — aber nur, wenn jede Schicht **bytegenau** oder **protokollkonform** wiederherstellbar ist (siehe § 4).

---

## 4. PDF und „das Foto ist die Datenbank“ — große technische Vorsicht

Die Idee, das **Trägerbild** in einen **PDF-Einsatzbericht** einzubetten und Jahre später den Vault **aus demselben Bild** zu extrahieren, ist **narrativ stark**, aber:

- **PDF-Engines** betten Bilder oft **neu komprimiert** oder als **neuen Stream** ein — dabei kann ein per **Append** angehängter Blob **verloren gehen** oder **verschoben** werden.
- **Zuverlässige** Varianten wären: **Originaldatei** als **Byte-identischer Anhang** (nicht „nochmal durch JPEG-Encoder“), separates **ZIP** neben dem PDF, oder **explizites** Format „ein Pixelraster pro Byte“ — **vor** Produktversprechen validieren.

**Langfristigkeit:** Auch **PDF** ist kein Garant für „50 Jahre ohne Migrationsaufwand“ — Viewer, Verschlüsselung, Signaturen alternieren. Die Aussage „Chain tot, PDF ewig“ ist **zu absolut**; realistischer: **mehrere** unabhängige Träger (Chain, Datei, physisch) reduzieren **Single-Obsoleszenz**.

---

## 5. Boss, Seed und Vault-Inhalt — Rollenklärung

- **Provisioning** variiert: Nicht in jedem Modell hat der Boss jemals den **Helfer-Seed**; oft liegen **Adresse/Keys** anders (`docs/BOSS-ORIENTIERUNG.md`).
- **Vault-Inhalt** (Passwortmanager, Notizen, rotierte Keys **nach** Provisioning): liegen **verschlüsselt** im Vault — der Boss hat sie **nicht automatisch**, es sei denn, der Helfer **exportiert** oder **chain-ankert** und gibt Zugriff.
- **Fazit:** „Boss hat Hausschlüssel (Seed), aber nicht den Inhalt der Schubladen“ ist **didaktisch** richtig — rechtlich/operativ vom **konkreten** Rollenmodell abhängig.

---

## 6. Entschlüsseln: Passwort vs. Seed

- **Vault öffnen:** typischerweise das **Vault-Passwort** (PBKDF2 + AES im bestehenden Format) — **nicht** zwingend die gleiche Entropie wie der IOTA-Seed.
- **Seed:** identifiziert die **Wallet-/Chain-Adresse**; **kein** Ersatz für das Vault-Passwort beim Entpacken des Blobs.
- **Zusätzliche Verifikation:** Signatur mit Wallet kann **Herkinft** belegen — **optional**, nicht „Seed = Schlüssel zum Vault“.

---

## 7. Szenario „Purge nach Archivierung“ — Ist-Code vs. Zielbild

| Erzählung | Realität im Messenger-Kern (siehe `NOTFALL-PURGE-MESSENGER.md`) |
|-----------|-------------------------------------------------------------------|
| „Gerät komplett leer nach Purge“ | **Notfall-Purge** entfernt **On-Chain-Vault** und schreddert **Inbox-Cache**; **lokale Vault-Datei** und **Trägerbild** werden **nicht** automatisch gelöscht — dafür bräuchte es erweiterte „wipe local files“. |
| „Alles klebt am PDF“ | Nur, wenn das Bild **unverändert** im Archiv landet (§ 4). |

**Operatives Fazit:** Die **Story** (Bild ins Archiv → Gerät wischen) ist **taktisch** kohärent; die **technische Garantie** erfordert **zusätzliche** Löschpfade für Trägerdatei und ggf. `.morgendrot-vault`.

---

## 8. Verwandte Dokumente

- `docs/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md` — Trägerbild, User-Dir, UI  
- `docs/VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md` — Rettung: vorgefertigte Träger, Beschriftung, Ordnung  
- `docs/NOTFALL-PURGE-MESSENGER.md` — was Purge heute tut  
- `docs/EINSATZBERICHT-EXPORT.md` — Export-Stand  
- `docs/BOSS-ORIENTIERUNG.md` — Provisioning, keine falschen QR-Mythen  

---

*Stand: kritische Zielbild-Notizen; keine Implementierungspflicht.*
