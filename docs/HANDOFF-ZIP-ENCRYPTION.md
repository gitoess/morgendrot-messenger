# Handoff-Verschlüsselung — kritische Bewertung & Fahrplan

**Stand:** 2026-05-20  
**Verwandt:** **`docs/HANDOFF-IMPORT-UX.md`**, **`docs/HANDOFF-PROFILE-UX.md`**, **`docs/TRANSPORT-AND-IOTA-LAYERS.md`**, **`docs/API-INITIAL-PROFILE.md`**

---

## 1. Was im Handoff steckt (Ist)

| Inhalt | Sensitivität | Bereits im ZIP |
|--------|--------------|----------------|
| `PACKAGE_ID`, `RPC_URL`, `BOSS_ADDRESS`, `TEAM_MAILBOX_IDS`, Partner-`0x…` | **Einsatz-Geheimnis** (Wer mit wem, welches Deploy) | Ja |
| `ROLE`, `SIMPLE_MODE`, `TRANSPORT_PROFILE` | Mittel (Taktik/UI) | Ja |
| Meshtastic-PSK-Hinweis (Text) | **Hoch** wenn echter PSK im README steht | optional README |
| Seed, Vault-Passwort, Mnemonic | **Kritisch** | **Nie** (by design) |

**Fazit:** Die ZIP ist heute **Klartext**. Auf verlorenem USB, Mail-Anhang oder geteiltem Cloud-Link kann jeder die Einsatz-Struktur lesen — auch ohne Wallet-Zugriff.

---

## 2. Kritische Bewertung deiner Idee

### 2.1 Passwort-geschützte ZIP — grundsätzlich richtig

| Aspekt | Bewertung |
|--------|-----------|
| Boss vergibt Passwort beim Export | **Ja** — sinnvolle UX |
| Passwort **getrennt** vom Medium (mündlich, 2. Kanal) | **Pflicht** — sonst kein Gewinn |
| Passwort **in README im ZIP** | **Nein** — würde den Schutz sofort aufheben |
| „6–8 Zeichen“ (z. B. `THW2026Süd`) | **Feldübung OK**, **reale Gegner schwach** — offline Knacken möglich |
| Standard-Zip-Passwort (ZipCrypto) | **Nicht empfohlen** — veraltet, leicht angreifbar |
| AES-256 (sinnvoll umgesetzt) | **Ja** — siehe § 3 |

### 2.2 Import mit Passwort-Dialog — richtig

Ablauf passt: ZIP wählen → Passwort → entpacken/entschlüsseln → Vorschau → Import → Seite neu laden.

**Wichtig:** Entschlüsselung **im Browser** (Web Crypto) oder Server nur, wenn Passwort nicht geloggt wird — bevorzugt **Client-seitig** für das Passwort.

### 2.3 „Handoff per IOTA“ — sinnvoll; **gesamte ZIP** ist klein genug

**Korrektur (Feldmaß):** Ein typisches Handoff-ZIP liegt bei **~3 KB** (nur `.env` + `README-HANDOFF.txt`) — **nicht** Megabyte. Die frühere Formulierung „nicht als große ZIP on-chain“ bezog sich auf **Standalone-Bundles** (hunderte MB), **nicht** auf den Export-Assistenten.

| Kanal | Größe (typ.) | Bewertung |
|-------|--------------|-----------|
| USB / AirDrop / Datei | ~3 KB ZIP | **Primär** — offline-first |
| **IOTA (Mailbox-Nachricht)** | ~3 KB (ggf. + AES-Envelope) | **Optional sinnvoll** — passt in übliche Mailbox-/Event-Payloads |
| On-chain **ohne** E2EE | ~3 KB Klartext | **Nein** — trotzdem Einsatz-Leak |
| Standalone-**Bundle** on-chain | sehr groß | **Nein** — Bundle bleibt USB/`npm run bundle:standalone-smartphone` |

**Phase C (optional):** Boss wählt **„ZIP herunterladen“** oder **„Handoff per IOTA senden“** — technisch dieselbe **~3-KB-Nutzlast** (idealerweise **verschlüsselt** + Passwort getrennt), als Anhang/Metadaten in **Team-Mailbox** oder an Partner-Adresse (E2EE wie Messenger-Nachrichten).

**Leitplanke:** IOTA-Handoff ersetzt **nicht** die Bundle-Installation — nur die **öffentliche `.env`-Konfiguration**. Helfer braucht weiterhin `exports/morgendrot-standalone-smartphone/` (oder Repo) auf dem Gerät.

### 2.4 Hybrid (ZIP + IOTA) — empfohlen als Produktbild

```
Primär (offline-first):     ~3-KB-ZIP (USB/Datei), optional AES + Passwort getrennt
Sekundär (mit Netz):        dieselbe Nutzlast per IOTA E2EE → Team-Mailbox / Partner
Bundle (einmalig):          npm run bundle:standalone-smartphone — nicht per IOTA
```

Beide Wege sollten **dieselbe Entschlüsselungslogik** nutzen (§ 3), nicht zwei Krypto-Formate.

---

## 3. Empfohlene Technik (verbessert gegenüber „ZIP-Passwort“)

### 3.1 Nicht: klassisches Zip-Passwort

`archiver` / normales `zip` + Passwort = oft **ZipCrypto** oder inkonsistent zwischen Tools.

**Stattdessen:** **Envelope** (einheitlich in Node + Browser):

| Datei im ZIP | Inhalt |
|--------------|--------|
| `handoff.morg.enc` | Ciphertext (AES-256-GCM) der `.env`-Zeilen (Binär) |
| `handoff.crypto.json` | `{ schema, kdf, iterations, saltB64, ivB64, algo }` — **ohne** Passwort |
| `README-HANDOFF.txt` | **Ohne** Passwort, **ohne** vollständige IDs wenn verschlüsselt — nur: „Passwort vom Boss separat“ |
| optional `README-HANDOFF.meta.txt` | Unkritisch: Bezeichnung, Datum (kein PACKAGE_ID) |

**Ohne Passwort:** weiter wie heute `morgendrot-standalone-handoff.env` (Abwärtskompatibilität).

### 3.2 KDF & Passwort-Richtlinie

| Einsatz | Empfehlung |
|---------|------------|
| Übung / Demo | Boss-Hinweis: min. 8 Zeichen, Beispiel nur in UI nicht in Datei |
| Echter Einsatz | **12+ Zeichen** oder **4-Wort-Passphrase**; UI: Stärke-Anzeige |
| Wiederholung | Feld „Passwort bestätigen“ beim Export |

PBKDF2 ≥ 100k Iterationen (oder Argon2id wenn Bibliothek eingebunden).

### 3.3 Was der Boss dem Helfer mitteilt

| Kanal | Inhalt |
|-------|--------|
| **Medium 1** (USB, AirDrop, Datei) | `.zip` (ggf. verschlüsselt) |
| **Medium 2** (mündlich, Telefon, anderer Funkkanal) | **nur Passwort** |
| **Nie in derselben Nachricht** | Passwort + Datei-Link zusammen unverschlüsselt |

Meshtastic-**PSK** bleibt **eigener** Kanal (bereits README-Hinweis) — nicht mit ZIP-Passwort verwechseln.

---

## 4. UX (Zielbild)

### 4.1 Export (Boss)

```
[ ] Handoff-ZIP mit Passwort schützen (empfohlen ab Einsatz mit Partner-Liste)
Passwort: [________]  Wiederholen: [________]
Hinweis: Passwort dem Helfer nur mündlich / über separaten Kanal mitteilen — nicht in die ZIP schreiben.
[ ZIP herunterladen ]
```

Optional: **„Passwort anzeigen / QR für zweites Handy“** nur **nach** Export, 60s — nicht in Datei speichern.

### 4.2 Import (Helfer)

```
ZIP gewählt → erkannt: verschlüsselt
→ Dialog: „Handoff-Passwort (vom Boss)“
→ falsch: klarer Fehler, kein Teil-Import
→ ok: Vorschau wie heute → Import bestätigen
```

### 4.3 IOTA-Variante (Phase C)

```
Boss: [ ZIP ]  [ An Team-Mailbox senden ]  (nur wenn Netz + Mailbox)
Helfer: Posteingang → „Handoff-Paket“ → Passwort (falls gesetzt) → Import
```

Technisch: kompaktes JSON + gleiches `handoff.env.enc`-Format als Anhang/Metadaten — Spez folgt mit **`docs/API-INITIAL-PROFILE.md`**.

---

## 5. Priorisierung

| Phase | Inhalt | Aufwand |
|-------|--------|---------|
| **A (Doku)** | Dieses Dokument, Boss-Schulung „2-Kanal“ | **Ist** |
| **B (MVP)** | Passwort-Envelope + Export-Checkbox + Import-Dialog | **Ist** (2026-05-20) |
| **B+** | README ohne Klartext-IDs bei Verschlüsselung | **Ist** (minimales README) |
| **C** | Handoff per IOTA (`[[MORG_HANDOFF_ZIP_V1:…]]`, E2EE, Posteingang-Import) | **Ist** (2026-05-20) |
| **D** | QR-Übertragung nur Passwort (optional) | Mittel |

**Nicht jetzt:** ZipCrypto, Passwort in README, schwache 6-Zeichen-Pflicht ohne Kontext.

---

## 6. Risiken & Grenzen

| Risiko | Mitigation |
|--------|------------|
| Boss schreibt Passwort auf USB-Stick | UI-Warnung, Schulung |
| Helfer speichert Passwort in Klartext-Notiz | Kurze Passphrase + Rotation pro Einsatz |
| Angreifer mit ZIP + schwachem Passwort | Stärke-Hinweis; KDF |
| Server sieht Passwort bei Upload | Entschlüsselung **im Browser** bevorzugen |
| „Sicher durch IOTA“ ohne E2EE | Nur mit bestehendem Mailbox-Verschlüsselungspfad |

---

## 7. Abgleich Code (Ist)

| Teil | Pfad |
|------|------|
| ZIP-Erzeugung (Klartext) | `POST /api/standalone-smartphone-handoff-zip` (`format=zip`), `api-server.ts` |
| Teile für Client-Krypto | `POST` mit `format=parts` → JSON `envContent` + `readme` |
| Verschlüsselung | `frontend/frontend/lib/handoff-zip-crypto.ts` (PBKDF2 210k + AES-256-GCM, **nur Browser**) |
| ZIP bauen / Import | `handoff-zip-build.ts`, `handoff-zip-import.ts`, `handoff-export-download.ts` |
| Export-UI | `boss-handoff-export-panel.tsx` — Checkbox + Passwort |
| Import-UI | `handoff-import-panel.tsx` — Passwort-Dialog |
| IOTA-Versand / -Import | `handoff-iota-wire.ts`, `handoff-iota-send.ts`, Posteingang-Menü, `handoff-pending-inbox.ts` |

---

## 8. Kurz-Fazit

Deine **Hybrid-Idee ist richtig**; die Umsetzung sollte:

1. **AES-256-GCM + KDF**, nicht klassisches ZIP-Passwort.  
2. **Passwort nie in der ZIP** (auch nicht README).  
3. **ZIP offline** (~3 KB) + **IOTA optional** für dieselbe Nutzlast (E2EE), nicht für das große Standalone-Bundle.  
4. **Import-Passwort-Dialog** — passt zum bestehenden Import-Flow.

Nächster sinnvoller Code-Schritt: **Phase C** (Handoff per IOTA, gleiches ZIP-Format), nicht parallel weitere Krypto-Varianten.
