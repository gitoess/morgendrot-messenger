# MORGENDROT-Messenger — Einführung ohne Fachchinesisch

**Stand:** 2026-05-20 · **kanonisch abgeglichen** mit Code und `docs/TRANSPORT-AND-IOTA-LAYERS.md`  
**Für Technik:** `docs/POSITIONING.md`, `docs/HANDOFF-UND-MODUS-ZIELBILD.md`, `docs/CAPABILITIES-MATRIX-ZIELBILD.md`

---

Stell dir MORGENDROT vor als **sicheres Team-Walkie-Talkie** mit **optionalem Notizbuch auf der Blockchain** — gebaut für Katastrophenschutz und Einsatzteams, wenn normales Handy-Netz oder WLAN ausfallen können.

> **Wichtig:** MORGENDROT erfindet Chat nicht neu. Es **verbindet** Funk (Meshtastic/LoRa), Internet (IOTA-Mailbox, optional Telegram) und eine **Boss-Vorbereitung** für viele Geräte auf einmal.

---

## Die 3 Ebenen (Transport — nicht 3 getrennte Apps)

Das System wählt **je nach Situation und Rolle**, welcher Weg sinnvoll ist. Im Einsatz ist **Funk oft Standard**; Internet und Chain laufen **mit**, werden für Helfer aber oft **einfach** dargestellt.

### 1. Feldebene — Krisen-Funk (LoRa / Meshtastic)

**Wenn** Strom da ist, aber Mobilfunk/WLAN tot sind (oder der Einsatz das so vorsieht), geht der Chat über **Funk**.

| So ist es | So ist es *nicht* |
|-----------|------------------|
| Handy verbindet sich oft per **Bluetooth (Web-BT)** mit einem **Funk-Modul** (z. B. Heltec V3) | Nicht „jedes Handy sendet LoRa ohne Zusatzgerät“ |
| Nachrichten laufen **Gerät zu Gerät** im Meshtastic-Mesh | Nicht 100 % unabhängig von jeder Infrastruktur — ihr braucht **Team-Kanal + PSK** (Schlüssel) vom Boss |
| Abhörsicher im Team über **Kanal-Verschlüsselung (PSK)** | Kein separates „Morgendrot-Funk-Passwort“ pro Nachricht im Standard |

**Helfer-UI:** Sendepfad **„Funk“** (Simple Mode). Optional später: **nur verschlüsselt senden** (Capabilities).

### 2. Organisationsebene — Internet (IOTA-Mailbox, optional Telegram)

**Wenn** Internet normal funktioniert, nutzt das System **Online-Zustellung** (IOTA Rebased: Mailbox, Partner-Adressen, Handshake).

| Kanal | Kurz |
|-------|------|
| **IOTA / Mailbox** | Verschlüsselter Chat zwischen **0x-Adressen**; Tresor auf dem Gerät; für Einsatzleitung und Archiv |
| **Telegram** | **Optional**, oft am **Server/Runtime** konfiguriert — **Klartext** über Bot-API; **kein** Ersatz für Funk oder Forensik |

> **Korrektur zum Populärtext:** Helfer im **Simple Mode** sehen Telegram oft **gar nicht** — Standard ist **`mesh-first`** (Funk zuerst). Telegram ist Zusatzkanal für Alarme/Rücklauf, nicht „das normale WhatsApp-Ersatzprogramm“ in der Hosentasche.

### 3. Notar-Ebene — IOTA / Forensik

**Wichtige Nachrichten** können **zusätzlich** auf der IOTA-Blockchain verankert werden — für spätere Auswertung durch die Einsatzleitung.

| So ist es | So ist es *nicht* |
|-----------|------------------|
| **Pfad 4 / Archiv:** Nach Funk kann eine **Kopie** an die eigene Mailbox (mit Netz) | **Nicht** jede Klein-Nachricht landet automatisch und sofort on-chain |
| **Delayed Upload** (geplant): erst dünn über Funk, später voll auf Chain | **Nicht** die ganze Blockchain-TX passt in ein Funk-Paket |
| Forensik / Export für Stab | **Kein** automatisches „gerichtsfest“-Versprechen ohne Betriebskonzept |

---

## Die Rollen — wer sieht was?

Damit Helfer im Stress nicht von Technik abgelenkt werden, gibt es **Simple Mode** (einfach) und **Expert Mode** (mehr Schalter).

| Rolle | Wer | Oberfläche (typisch) |
|-------|-----|---------------------|
| **Helfer / Arbeiter** | Einsatzkraft im Team | Wie ein schlanker Chat: Text, SOS, Sendepfad **Funk** oder **Online**; keine Gas-Dialoge |
| **Kommandant (Führer)** | Truppführer | Team-Postfächer anlegen, Telefonbuch, Einsatzleitung-Tab |
| **Boss (Leitung)** | Vorbereitung am PC | Export-Assistent, Handoff-ZIP, Vorlagen, Rechte (ROLE_ID + **Capabilities**) |
| **Wanderer / Prepper** | **Privat**, nicht vom Boss „eingeteilt“ | Eigenes Bundle, **kein** Einsatz-Export-Assistent; Consumer-Profil |

> **Korrektur:** Der **Boss** provisioniert **Untergebene im Einsatz** — er richtet **keine** Wanderer/Prepper-Zielgruppe per Export-Assistent ein. Wanderer = **eigener** Messenger (`docs/WANDERER-STANDALONE-BUNDLE.md`).

> **Korrektur „3 Knöpfe Chat / Funk / Notfall“:** Die App hat z. B. **Nachrichten**, **Einsatzleitung** (nur Führer/Boss), **Telefonbuch** — kein separates „Funk-App-Icon“ als dritte Hauptwelt. Funk ist **im Chat** der gewählte Sendepfad.

---

## Handoff — Gerät in wenigen Minuten startklar

**Großer Vorteil:** Keine E-Mail, keine Handynummer für die **technische Identität** — das Gerät bekommt eine **Krypto-Adresse (0x…)** beim ersten Entsperren (Tresor/Wallet).

### So läuft es **heute** (Einsatz)

1. **Boss** stellt im **Export-Assistenten** ein: Rolle (Helfer/Führer/Spezial), Rechte (**ROLE_ID**-Bits + **Capabilities**), Partner, Team-Postfächer, Funk-Schlüssel-Hinweise.
2. Boss gibt **ZIP-Datei** (~3 KB) oder sendet dasselbe Paket **per IOTA** an Partner mit Handshake.
3. **Helfer:** Einstellungen → **Handoff importieren** (ZIP) oder Posteingang → Handoff — optional **Passwort** wenn verschlüsselt.
4. Seite neu laden, Tresor entsperren — fertig.

| Populär gesagt | Technisch korrekt |
|----------------|-------------------|
| „Boss hält QR-Code hin“ | **QR** gibt es für **Team-Mailbox beitreten**, **Kontakte**, **Handshake** — Handoff selbst ist primär **ZIP / IOTA-Datei**, nicht ein 20-Sekunden-QR-Scan |
| „Unter 20 Sekunden“ | **Ziel** nach Übung (Import + Reload); erste Einrichtung inkl. Wallet kann länger dauern |
| „Wer er ist“ | **Bezeichnung** im Paket (z. B. „Sanitäter 1“) + **ROLE** / Rechte — nicht zwingend Personalausweis |

Im ZIP stecken u. a.:

- `morgendrot-standalone-handoff.env` — öffentliche Einstellungen (kein Seed!)
- `.morgendrot-runtime-config.json` — feine Rechte (**LoRa/Telegram/IOTA** getrennt lesen/schreiben)
- `README-HANDOFF.txt` — Funk-PSK-Hinweis für den Kanal

---

## Rechte heute: zwei Schichten (einfach erklärt)

| Schicht | Was der Boss klickt | Wofür |
|---------|---------------------|--------|
| **ROLE_ID-Bits** | D, LW, BW, L, S, P (Checkboxen) | Chain: Gas, Senden on-chain, Pinnwand, … |
| **Capabilities** | Tabelle LoRa / Telegram / IOTA × Lesen/Schreiben | **Funk ja, Telegram nur lesen, IOTA aus** (Medic-Funker-Preset) |

> **Das löst das S-Bit-Problem:** Früher bedeutete „Senden aus“ oft: **überall** stumm — auch Funk. Mit **Capabilities** kann der Boss z. B. **LoRa-Schreiben an, IOTA-Schreiben aus** lassen.

---

## Zusammenfassung für Neulinge

MORGENDROT verbindet:

1. **Alltags- und Einsatz-Komfort** über Internet (Mailbox, Partner, optional Telegram) — wenn Netz da ist.  
2. **Ausfallsicherheit im Feld** über Meshtastic-Funk — mit Team-Gerät und Kanal-Schlüssel.  
3. **Nachweis und Auswertung** für die Leitung über IOTA (optional, geplant ausgebaut) — nicht jede Zeile sofort, aber planbar.

**Nicht das Ziel:** Signal, WhatsApp oder ein reines Meshtastic-App-Ersatzprodukt ohne Vorbereitung.

---

## Weiterlesen (1 Seite je Thema)

| Thema | Dokument |
|-------|----------|
| Transport & Archiv | `docs/TRANSPORT-AND-IOTA-LAYERS.md` |
| Einsatz vs. Privat | `docs/HANDOFF-UND-MODUS-ZIELBILD.md` |
| Boss-Export | `docs/HANDOFF-EXPORT-HYBRID.md` |
| Rechte-Matrix | `docs/HANDOFF-PERMISSIONS-MATRIX.md`, `docs/CAPABILITIES-MATRIX-ZIELBILD.md` |
| Handoff importieren | `docs/HANDOFF-IMPORT-UX.md` |
| Telegram (optional) | `docs/TELEGRAM-INTEGRATION-ZIELBILD.md` |
