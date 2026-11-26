# Einstellungen — Kurzhandbuch

**Stand:** 2026-11-24 · Eine Seite, Ist-UI. Keine Spez, keine Geschichte.

---

## Karte der Tabs

| Tab | Für wen | Kern |
|-----|---------|------|
| **Allgemein** | alle | Sprache, Wizard, Erscheinungsbild, Handbuch, **Handoff importieren** (Morgendrot-Helfer; **IOTA-Messenger-Produkt: ausgeblendet**). Nav = Sendepfad-Farben. Funk/Telegram-Tabs bleiben (Kanäle). |
| **IOTA** | alle | Netz (Boss/Kommandant), Gas, Chain-IDs, Mailboxen; **Expertenmodus + IOTA-Vertrag (Package-ID)**; Boss: **Package & Move-Upgrade** |
| **Funk** | Einsatz | Kurzhinweis + Link Meshtastic-App; Verbinden/Senden = Chat → Sendepfad Funk (§ H.3o) |
| **Telegram** | Boss (+ Helfer Join) | Bot, Klingel, optional Monitor/Alarmgruppe (Morgendrot). **IOTA-Messenger:** nur Bot + Eingang + Klingel — kein Monitor, keine Einsatz-Alarmgruppe |
| **Tresor** | alle | Ein Passwort: Seed anzeigen, Notizen/Passwörter, Backup lokal/Chain, Schatten, Notfall. Header-Badge = Sitzung. Netz-IDs → **IOTA** |

**.env:** nur Link ganz unten → „Konfiguration öffnen“. Nicht in Allgemein.

---

## Wo liegt was? (kein Vault-Mythos)

| Ding | Speicherort |
|------|-------------|
| Messaging-Keys, Passwortmanager, Notizen | **Vault-Datei** (+ optional On-Chain-Vault) |
| Package / Mailbox / RPC (aktiv) | Netzprofil + oft Boss-`.env` |
| Telegram Bot-Token, Admin-Chat-ID, Alarmgruppe | **`.morgendrot-runtime-config.json`** (Boss-PC) — **nicht** Vault |
| „Hinweis nach Online-Send“ an/aus | Browser **localStorage** |
| Eingangs-Ton (Master + 1:1/Gruppe/Pinnwand) | Browser **localStorage** — nur offener Tab, kein OS-Push |
| Kontakt-Telegram-ID | **Telefonbuch** |
| Chat-Klartext-Cache | `.inbox.enc` — nicht Vault |

---

## IOTA

### Wo senden? (Boss/Kommandant)

| | Übung (blau) | Produktion (violett) |
|--|--------------|----------------------|
| Netz | Testnet | Mainnet |
| Braucht | Package + Mailbox + RPC | **eigenes** Deploy + Postfach (nie Testnet-IDs) |

Ein aktives Netz. Signer-Status darunter (Browser-Signer für Direkt-Send).

**Mainnet einrichten** (selten, hinter **Expertenmodus**):

| | |
|--|--|
| **Wer** | Boss/Betreiber am PC mit Backend + IOTA-CLI + Mainnet-Gas — nicht Helfer |
| **Wann** | Vor dem ersten echten Produktions-Send; Testnet-Alltag braucht das nicht |
| **Deployen** | 1 Klick Publish + Postfach → speichert selbst, Speichern-Button unnötig |
| **Aus Boss-.env übernehmen** | Nur Morgendrot: `MAINNET_PACKAGE_ID` aus Server in lokale Felder ziehen; Mailbox oft noch tippen → dann **Speichern**. **IOTA-Messenger:** Button weg (kein Boss-.env-Pull) |
| **Manuell + Speichern** | Wenn Package/Mailbox schon existieren (Explorer/anderes Gerät) → IDs eintragen → Speichern → Produktion wählen |
| **Nicht verwechseln** | Felder = Mainnet-*Profil*. Chain-IDs oben = Anzeige. Experten-Vertrag darunter = aktiver Posteingang/Server-Package (Filter/Wechsel) — andere Aufgabe |

Alltag: nur Übung/Produktion umschalten, wenn Mainnet schon „bereit“ ist.

### Gas

- **Testnet:** „Testnet-Token anfordern“ = Faucet im Browser.
- **Mainnet:** Adresse kopieren → echtes IOTA senden → **Saldo aktualisieren**.

### Chain-IDs zum Sichern

Pro Netz: Package + **Postfach** (= Hauptpostfach/`MAILBOX_ID` zum Backup).

**Frühere Package- / Postfach-IDs:** Archiv (Kopieren/Sichern) auf dem Boss (`.morgendrot-package-id-history` / `.morgendrot-mailbox-id-history`). Aktualisiert bei Neu-Publish / ID-Wechsel. **Kein Umschalter** — Vertrag wechseln → **Expertenmodus** (gleiche IDs als Vorschläge). In-Place-Upgrade ändert die IDs nicht.

**Weitere On-Chain-IDs (früher „Globals“):** nur Anzeige aus aktiver Boss-`.env`, **nicht tippen**. Entstehen automatisch beim Erst-Deploy / `create_globals`:

| ID | Wozu | Ändern? |
|----|------|---------|
| **Vault-Registry** | On-Chain-Vault / Notfall-Purge (nicht der lokale Tresor unter „Tresor“) | Nur bei Neu-Deploy / Registry-Bootstrap |
| **Command-Registry** | On-Chain-Kommandos (gleiches `create_globals` wie Mailbox) | Wie oben |
| **Upgrade Cap** | Recht, Move-Code unter **derselben** Package-ID zu ersetzen | Beim Erst-Deploy in `.env`; fehlt → nur Neu-Publish |

Alltag: nichts eingeben — Werte prüfen/sichern/kopieren. Helfer brauchen sie in der Regel nicht.

**Nicht hier:** Team #n / Private #n — **Meine Mailboxen**.

### UpgradeCap (Boss)

| | |
|--|--|
| **Was** | On-Chain-Objekt + Eintrag `UPGRADE_CAP_ID` in Boss-`.env` |
| **Wozu** | Move-Bytecode unter **derselben** `PACKAGE_ID` ersetzen (Bugfix, neue Funktionen) |
| **Wer** | Nur Boss/Kommandant — **nicht** Helfer |
| **Erzeugen** | Automatisch beim Erst-Deploy; sonst Cap-ID aus Explorer/Wallet in `.env` |
| **Fehlt** | Nur Neu-Publish möglich (neue IDs + Handoff) |

### Wo senden? / Signer / Chain-IDs

**Wo senden?** = aktives Netz (Testnet/Mainnet): Package + Hauptpostfach + RPC — nicht Composer-Ziel und nicht „Meine Mailboxen“.

**Signer:** beim Login gesetzt, über Reload im Tab erhalten, beim Sperren gelöscht.

**Chain-IDs:** Pro Netz Package + Postfach (auch Boss-`.env` / Handoff). Neu-Publish → alte ID in „Frühere…“. In-Place-Upgrade ändert IDs nicht.

### Expertenmodus (IOTA)

**Pfad:** Einstellungen → **IOTA** → unter den Netz-Tabs (Karte „Expertenmodus“). **Default aus.**

Wenn **an**, erscheinen **in derselben Karte**: **Mainnet-Setup** (Deploy / IDs) → **IOTA-Vertrag** → Boss: **Move-Upgrade**. Alltag: nur Übung/Produktion umschalten.

| Begriff | Bedeutung |
|---------|-----------|
| **Grün** | Move-Funktion existiert im Package |
| **Move upgraden** | Confirm → Boss-API; braucht UpgradeCap. Danach Backend neu starten. |

### Meine Mailboxen

**Was:** Postfach = Speicherort on-chain (nicht Chat-Partner). Lesen: Haupt + bekannte Privat/Team. Schreiben: Composer. Kontakt-IDs: Telefonbuch → Erweitert.

**Team:** optionales Shared-Postfach. Beitritt: ID/QR · QR teilen · erstellen (Leitung) · Handoff · Spontan-Anfrage (Einsatzleitung). Schreiben: Composer-Ziel.

**Abfrage-Liste:** nur Morgendrot-Boss mit Backend, wenn Team on-chain + lokal da, aber Server noch nicht pollt (`TEAM_MAILBOX_IDS`). **IOTA-Messenger:** ausgeblendet (kein Boss-`TEAM_MAILBOX_IDS`-Sync).

**Mein Kontakt-QR:** Messenger-Identität für Telefonbuch — nicht IOTA-Hub „Empfangen“ (Coins). Funk/Telegram-IDs bleiben in ihren Tabs / Kontakt-Erweitert.

**Visitenkarte (Ist MVP):** Sidebar **Ich** → Kontakt-Detail / **Mehr zu Ich** → Block **Visitenkarte teilen**. Profilbild weiter Ziel/Backlog. Details: `docs/IDEEN-BACKLOG.md`.

### Passwort / Backup / Mailboxen / Schatten

| Block | Kurz | Ort |
|-------|------|-----|
| Passwort ändern | Vault-Datei neu verschlüsseln. **Voll sperren** = Chat-Header **Abmelden** (nicht unter Passwort ändern). Soft-Pause = Badge. **Auto-Sperren** optional, Default aus. F5 sperrt den API-Tresor nicht | **Sicherheit** / Tresor |
| Backup | Server-Datei + Download/Import + optional Chain | **Sicherheit** |
| Meine Mailboxen | Privat/Team-Postfächer ≠ Deploy-Mailbox unter „Wo senden?“ | **IOTA** |
| Schatten → Main | Einmal-Sweep temporäre Adresse → Main | **Sicherheit** |

### Meine Mailboxen (T3 — genau)

**Pfad:** Einstellungen → **IOTA** → **Meine Mailboxen** (Tresor offen, Backend/RPC erreichbar).

| Was | Bedeutung |
|-----|-----------|
| **Hauptpostfach (`MAILBOX_ID`)** | Setup-Shared. **Dieselbe ID** wie Chain-IDs → Postfach. Immer im Posteingang. |
| **Senden** | Ziel im **Composer** (Event vs. Postfach). Kein separates „Sendeziel“ mehr unter Meine Mailboxen. |
| **Team** | Beitreten (ID/QR) / Erstellen (Boss). Liste hier. |
| **Privat** | Eigenes Objekt; Posteingang lädt bekannte mit. |
| **Kontakt ↔ Postfach-ID** | **Telefonbuch** → Kontakt bearbeiten → Erweitert · Postfach-ID (optional). |
| **Amber Abfrage-Liste** | Team on-chain ok; fehlt nur in `TEAM_MAILBOX_IDS`. |

**Ablauf Privat (Smoke):**

1. Tresor entsperren.  
2. IOTA → Meine Mailboxen öffnen.  
3. Private Mailbox **anlegen** (oder vorhandene wählen).  
4. Diese Mailbox **aktiv** setzen.  
5. Im Chat Composer prüfen: Ziel unter „Wo senden?“ / Persistenz — klar, welches Postfach gemeint ist.  
6. Testnachricht (Klartext oder Schloss) senden → **Aktualisieren** im App-Header **neben Tresor** → Eintrag sichtbar.  
7. Optional zweite Private `#2` anlegen: nur eine kann aktiv sein — Wechsel bewusst testen.

**Ablauf Team (wenn Rolle Boss):**

1. Team-Postfach anlegen oder ID aus Deploy übernehmen.  
2. Aktiv setzen; Sync-Status / Fehlerhinweise lesen.  
3. Mitglied mit Telefonbuch-Eintrag; Team-Broadcast vs. 1:1 unterscheiden (Handbuch Messenger-Tabelle).

**Nicht verwechseln:** „Wo senden?“ = Ziel für *diese* Nachricht. Meine Mailboxen = welche Postfächer du *besitzt/liest*. Aufräumen/Purge löscht On-Chain-Inhalt — nur bewusst.

**Helfer ohne Netz-Schalter:** noch „System & Identität“ (Adresse/Package) — Boss nicht mehr.

---

## Telegram

**Scope (T42):** Telegram = Klingel / Inbound / Alarm — **kein** Video, kein NFT, kein E2EE über Telegram. Archiv und Beweis laufen über IOTA / Export+Hash.

Telegram = **optionaler Push/Hinweis**, kein Chat-Ersatz für IOTA/Funk.

**IOTA→Telegram-Klingel (Hinweis nach Online-Send):** Aufmerksamkeits-Ping („Es liegt was in Morgendrot“) — Handy vibriert über Telegram, App muss nicht offen sein. Inhalt/Verlauf bleiben in Morgendrot. **Nicht** der Composer-Sendepfad „Telegram“ (der ist ein eigener Bot-Kanal ohne IOTA). **Kein E2EE.** Die Einsatz-Alarmgruppe wird vom Klingel-Schalter **nicht** angeschrieben. Aus = kein Klingel-Hinweis nach IOTA-Send.

**Eingangs-Ton (App):** Einstellungen → Erscheinungsbild — Master + 1:1/Gruppe/Pinnwand. Nur **offener Tab**, kein System-Push. Chat-Kurzblatt: **`MESSENGER-CHAT-HANDBUCH.md`** § *Ton, Stumm, Telegram-Klingel*.

| Einstellung | Bedeutung |
|-------------|-----------|
| **System-Alarme** | Nur Monitor/Sensor → deine Chat-ID. Kann aus bleiben für normalen Chat. **IOTA-Messenger: ausgeblendet.** |
| **Bot-Token** | Von @BotFather. Ersetzen = alter Token weg (ein Slot). |
| **Persönliche Chat-ID** | Deine User-ID von **@userinfobot** — **nicht** die Zahl vor „:“ im Bot-Token (das ist die Bot-ID). Vorher den Bot in Telegram öffnen und **Start** tippen. Für Alarme + „Test an mich“. |
| **Relay-URL** | Optional **nur Monitor** (Default `http://127.0.0.1:8787`). Läuft ein lokaler Relay-Prozess? Sonst Probe = „nicht erreichbar“ — **normal**. Chat-/Klingel-/Alarm-Tests gehen **direkt** über die Telegram-Bot-API ohne Relay. Monitor-Webhook „inaktiv“ = System-Alarme aus oder Webhook nicht gesetzt. Statuszeile in der UI bewusst weggelassen (lärmt ohne Nutzen). |
| **Eingehende Antworten** | **Long Polling** läuft im API-Server (`npm run dev`). Nur Chats aus dem **Telefonbuch** (Telegram Chat-ID). Nach Speichern Backend neu starten, wenn der Poll nicht startet. Webhook braucht öffentliche HTTPS-URL. Aus = nur senden. |
| **Test an mich / Kontakt** | Admin-Chat-ID bzw. manuell eingegebene Partner-ID. |
| **Einsatz-Alarmgruppe** | Boss (nur **Morgendrot**): eine Telegram-**Gruppe** als Klingel für SOS / „Team alarmieren“. **Default aus.** **Aktivieren:** Schalter an → Felder → Speichern → „Test an Gruppe“ / „Team alarmieren“. **IOTA-Messenger: ausgeblendet** (kein SOS/Einsatz-Team). |
| **Hinweis nach Online-Send** | Optionaler Kurz-Ping nach **IOTA-1:1 Online**. Empfänger: Kontakt / Ich / Beide + optional CC (max. 5 Chat-IDs). Nicht die Alarmgruppe. |

**Einstieg:** App → **Einstellungen → Telegram**. Kurz-Setup: `TELEGRAM-INTEGRATION-EINRICHTUNG.md`. Architektur: `docs/TELEGRAM-INTEGRATION-ZIELBILD.md`.

---

## Sicherheit / Tresor (Ist)

**Einloggen / Entsperren** = Tresor-Passwort öffnet Keys, optional Seed, Notizen, Passwort-Einträge.

**Sitzung:** Header-**Badge** = Soft-Pause (grau, RAM bleibt, PW zum Weitersprechen). **Abmelden** = Keys + Inbox-Schnellcache weg (wie früher „Sitzung beenden“ unter Passwort — der Extra-Knopf ist weg, Doppel zu Abmelden). F5 sperrt den API-Tresor nicht. Notfall-Löschung darunter separat.

**Package / Mailbox / RPC** = Einstellungen → **IOTA** (Betrieb, auch bei Soft-Pause nötig) — **nicht** unter Tresor angezeigt.

**Tresor-Datei = Vault** (engl. Name derselben Datei `.morgendrot-vault`) — kein zweites Produkt.

**Badge im Chat-Kopf (nur zwei Labels):** `Tresor: bereit` = Keys + Browser-Passwort ok (Tippen = Soft-Pause). `Tresor: gesperrt` = alles andere (Abmelden, Soft-Pause, F5 ohne Browser-PW, Signer fehlt) — Tippen öffnet den **Passwort-Dialog** (Soft-Pause) bzw. Unlock.

**Sperrt sich der Tresor „von allein“?** Oft ja, ohne dass du Soft-Pause gewählt hast:

| Ursache | Was passiert |
|---------|----------------|
| **F5 / Tab neu** | Browser-PW-Session weg → Badge **gesperrt**, Keys oft noch im API-Prozess |
| **Idle** | Einstellungen → Tresor → Idle-Sperre (Default **aus**). Wenn Minuten > 0 → Hard-Lock |
| **PWA im Hintergrund** | Installierte PWA: nach ~45 s Hintergrund → `/vault-lock` (abschaltbar `morgendrot.pwaBackgroundVaultLock=0`) |
| **Abmelden** | Vollsperre |
| **API-Neustart** | Keys weg → gesperrt |

**Storage-Rebate (On-Chain-Vault / Burn):** **keine** Wallet-Karte „Rebate offen“ (anders als NFT-Leihe „zurückholen“) — bewusst nicht gebaut. Rebate fließt **in derselben TX** zurück. **Burn** im Posteingang (Zeilen-⋯ / Auswahl → „Von Chain löschen“); bei Erfolg Status ggf. **„Burn ok · Rebate …“** wenn `gasSummary.storageRebate` kommt. Details: `MESSENGER-CHAT-HANDBUCH.md` § *Burn*.

**Zwei-Wallet am PC (Enc testen):** zweites Profil / `dm:b` — siehe Chat-Handbuch § *Zwei-Wallet* und `PC-STAGE2-DIRECT-IOTA-SMOKE.md`.

Toast **„Tresor sichern?“** nach relevanten Änderungen (Notizen/Safe o. Ä.).

### Was gehört in die Tresor-Backup-Datei?

| Rein (Ist / Ziel) | Urteil |
|-------------------|--------|
| Messaging-Keys, Notizen, Passwort-Safe, optional Wallet-Seed | **Ist** |
| Telefonbuch / Kontakte (IOTA-Adressen, optional TG-/Funk-Felder am Kontakt) | **Ziel** (Backlog) — sinnvoll für Gerätewechsel |
| Snapshot Package-ID, Mailbox-ID(s), Absender | **Ziel** (Backlog) — Snapshot zum Restore, Live-Pflege weiter unter IOTA |
| Telegram Bot-Token / Runtime-Alarmgruppe | **Nein als Default** — Boss-Runtime (`.morgendrot-runtime-config.json`), nicht User-Tresor |
| Komplette `.env` / RPC-Secrets / Gas-Station | **Nein** — Maschinen-/Deploy-Config, zu breit und riskant |
| Meshtastic Region/Modem/PSK | **Nein** — Meshtastic-App; optional nur App-Metadaten (Kanalindex) am Kontakt |
| Chatverlauf | **Nein** — Chain / Inbox-Cache |

**Kurz:** Identität + Safe + (Ziel) Kontakte/ID-Snapshot. **Nicht** die ganze `.env` und nicht der Chat.

**Kein Cloud-Server:** „Tresor sichern“ = aktuelle Sitzung → verschlüsselte Arbeitsdatei **`.morgendrot-vault` im Projektordner dieses PCs** (`npm run dev`). Browser kann keine Geheimdatei still irgendwohin schreiben; deshalb Arbeitsdatei + optional „Kopie herunterladen“.

**Import allein reicht nicht:** Import lädt eine **schon vorhandene** Backup-Datei. Ohne vorheriges Sichern (oder ältere Kopie) gibt es nichts wiederherzustellen.

**Schutz der Datei:** AES-GCM mit **Tresor-Passwort** (Inhalt nie Klartext). Zusätzliches ECDH für die Backup-Datei lohnt nicht — die Messaging-Keys **sind** der Inhalt. **Kopie herunterladen** nur bei **entsperrtem** Tresor (Zugriffskontrolle).

**Wallet-Seed:** Schalter Entsperr-Dialog + Backup, Default an. Aus = nach Neustart Seed neu.

**Sicherster Alltag:** Seed an → Tresor sichern → Kopie herunterladen. Chain optional.

**Backup-Aktionen:**

| Aktion | Was passiert |
|--------|----------------|
| **Tresor sichern** | Sitzung → Arbeitsdatei auf **dieser Festplatte** (Projektordner). |
| **Kopie herunterladen** | Dieselbe PW-verschlüsselte Datei → Browser-Downloads. Unlock Pflicht. |
| **Backup importieren** | Vorhandene Datei vom PC → Sitzung (Wiederherstellen). |
| **Auf Chain sichern / laden** | Optional zweites Backup (`VAULT_REGISTRY_ID`). |

**On-Chain-Tresor (technisch):** Unter der **Vault-Registry** (Shared-Objekt, `create_globals`) liegt **pro Wallet-Adresse ein** Dynamic-Field mit **AES-Blob** (Tresor-Passwort) — kein Klartext-Event-Stream der Notizen. Zusätzlich Move-Events `VaultCreated` / `VaultUpdated` (Metadaten, kein Klartext). **Erster Speichern:** `create_vault`. **Weitere:** `update_vault` = **derselbe** Eintrag überschrieben (kein Versionsarchiv). Beim erneuten `create_vault` (Rotate) wird das alte Objekt gelöscht → Storage-**Rebate**. Normales Update: Objekt bleibt, Gas für die TX. Große Blobs brauchen höheres Gas-Budget (App skaliert; Fehler „Insufficient Gas“ = Budget/Blob). „Von Chain laden“ liest diesen einen Blob.

**Notfall-Löschung**, **Passwort ändern**, **Backup**, **Schatten → Main** bleiben. Badge = Soft-Pause; Abmelden = Keys weg.

---

## Funk

**Einstellungen → Funk:** Kurzhinweis (Port-Besitz) + Link „Meshtastic einrichten“ (`client.meshtastic.org`). Kein zweites USB/BT-Hook in den Settings (sonst Port-Kampf).

### Was wo?

| Ort | Zuständig für |
|-----|----------------|
| **Meshtastic-App** (oder Web-Client) | Region (EU_868), Modem (z. B. MediumFast Bilder / LongFast Feld), hop_limit, MQTT aus, Kanalname/PSK/Secondary |
| **Chat → Sendepfad Funk → Funk & Geräte** | USB/BT verbinden, Nodes, Kanal**index**, Klartext senden, „Bilder über Funk“ — bleibt im Chat (richtig so) |
| **Composer-Schloss** | Online/IOTA-Verschlüsselung — **nicht** dasselbe wie Funk-Luft (Klartext bzw. Channel-PSK in der App) |

**Parallel:** App auf USB, Morgendrot per Bluetooth (oder 2. Heltec). Am PC oft: USB nur für den Messenger, Config vorher in der App setzen und Port freigeben.

**Damit zwei Heltecs sich verstehen:** gleiche Region (z. B. EU_868), gleiches Modem (meist LONG_FAST; Desk-Bilder = MediumFast), gleicher Kanalindex + gleicher Kanalname/PSK. Primary (Index 0) = öffentliches Mesh; eigene Gruppen = Secondary mit geteiltem PSK. Modem/PSK nur in der Meshtastic-App — Messenger wählt Index und Nodes.

### Split (Roadmap § H.3o.3 — verbindlich für PC-Phase)

| Einstellung | Jetzt | Später (nur Absprache) |
|-------------|--------|-------------------------|
| **Region** (EU_868) | Meshtastic-App; UNSET = kein TX | Optional 1-Klick-Fix im Messenger, wenn Radio UNSET meldet |
| **Modem** (LongFast / MediumFast / …) | Meshtastic-App; Desk-Bilder = **MediumFast** (H.25a-Anker) | Optional 3 Profil-Buttons — **nicht** still am Encode-Freeze drehen |
| **hop_limit** | Meshtastic-App (Default oft 3) | Optional Slider 1–7 in Einstellungen→Funk |
| **MQTT / Uplink** | Meshtastic-App; Privat = **aus** | Optional Schalter „Internet-Gateway“ Default aus |
| **Kanal / PSK / Secondary** | Meshtastic-App; Messenger nur **Index** + Metadaten | H.3o Phase 2: QR/PSK-Ref aus Handoff — kein Frequenz-Editor |
| **1:1 / Gruppe / Verschlüsselung Funk** | Ist: Klartext + optional Channel-PSK in der App; App-E2E = Online/IOTA | H.3o.1 Feldtest random PSK; Mesh-v2-Versand bleibt aus |

**Nicht jetzt bauen:** volle Meshtastic-Config-UI im Messenger (T6 offen; H.3o.3: Modem/Frequenz bleiben Firmware/App). Profil-Buttons / hop_limit im Messenger = Roadmap später — nicht parallel zum H.25a-Anker.

## Expertenmodus / IOTA-Vertrag

**Pfad:** Einstellungen → **IOTA** → Expertenmodus.

Temporär = nur diese Programm-ID im Posteingang (ohne Server-Wechsel). Dauerhaft = wie `/set-package-id`. Nicht verwechseln mit Datei-Paket `.morg-pkg` unter Nachrichten → Optionen. Nur in diesem Browser gespeichert. Details: **`docs/INBOX-PACKAGE-EXPERT-MODE.md`**.

## Handoff (kurz)

Boss **exportiert** unter **Einsatzleitung → Helfer einrichten** (ZIP ~3 KB, kein Seed).  
Helfer **importieren** unter **Einstellungen → Allgemein → Handoff importieren** → neu laden → entsperren.  

**Warum nicht in der Einsatzleitung?** Helfer haben keinen Einsatzleitungs-Tab — Import muss auf dem Helfer-Gerät in den Einstellungen bleiben. Solo/Privat meist ohne. IOTA-Messenger-only: weg (Produkt-Split).

---

## Vollständigkeit (ehrlich)

| Bereich | Status |
|---------|--------|
| IOTA Boss-Netz + Gas + IDs | ausreichend für Alltag |
| IOTA Passwort/Backup/Schatten | → **Sicherheit** (T8/T9 erledigt); IOTA nur Hinweis |
| Telegram Bot + 1:1 + Gruppe | ausreichend |
| Telegram Journal/Webhook-URL-UI | fehlt / selten nötig |
| Sicherheit | Purge + PW/Backup/Schatten; Kurz-Karte 1–3 |
| Secrets-Landkarte als eigene UI | T11 Backlog; Ist = Kurz „Was im Tresor“ |

**Radikal kürzen / aufräumen** der Settings + Handbuch: Roadmap **T12** (am Schluss des Durchgangs oder früher, wenn blockierend).

---

*Bei Konflikt gewinnt die laufende UI; dieses Blatt beschreibt den Ist-Stand 2026-11-12.*
