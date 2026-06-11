# ID-Übersicht: Wann welche ID – und wo in Morgendrot

Damit die „Alphabet-Suppe“ der Blockchain-IDs übersichtlich bleibt: **Wer** (Rolle) braucht **welche ID** **wozu**, **wo sie in der UI** steht und **ob es eine Historie** gibt.

---

## 1. Drei Rollen – wer braucht was?

| Rolle | Beschreibung | Typische IDs |
|-------|--------------|--------------|
| **Boss (Architekt)** | Richtet die Fabrik ein, deployt Code, verwaltet Tresor und Geräte. | Package-ID, UpgradeCap-ID, Vault-Registry-ID, Vault-ID, ggf. Streams-Anchor (Provisioning). |
| **Asset (Maschine / Pumpe)** | Das physische Ding – braucht Identität, Kanal, Briefkasten, Sensor. | Asset-ID (Object-ID), Streams-Anchor-ID, Monitor-Device-ID, Mailbox-ID, optional Package-ID, Vault-Registry-ID, Authorized-Key-ID. |
| **Arbeiter (Nutzer / Techniker)** | Bedient die Maschine, braucht Erlaubnis. | Authorized-Key-ID (Access-Key), ggf. Partner-/Lock-Adressen. |

---

## 2. Schnell-Check: „Wenn ich das tun will … brauche ich diese ID“

| Wenn du das tun willst … | … dann brauchst du diese ID | Rolle |
|--------------------------|-----------------------------|--------|
| **Etwas reparieren / Code updaten** | **Package-ID** (welcher Code?) + **UpgradeCap-ID** (darf ich das?) | Boss |
| **Eine Tür / Pumpe öffnen** | **Authorized-Key-ID** (Dienstausweis) | Arbeiter |
| **Wissen, ob die Pumpe läuft** | **Monitor-Device-ID** (Adresse des Sensors/Geräts) | Boss / Monitor |
| **Wartungsprotokoll / Live-Daten lesen** | **Streams-Anchor-ID** (wo stehen die Daten?) | Boss / Arbeiter |
| **Die Pumpe identifizieren** | **Asset-ID (Object-ID)** (welches Teil ist das?) | Alle |
| **Backup wiederherstellen / Keys sichern** | **Vault-Registry-ID** (wo ist der Tresor?) | Boss |
| **Direktbefehl an die Maschine schicken** | **Mailbox-ID** (Briefkasten des Geräts) | Boss / Steuerung |
| **Welche Software-Regeln gelten?** | **Package-ID** (am Asset als „Created with Package“) | Asset-Twin / Langzeit |

---

## 3. Alle ID-Typen im Detail

### 3.1 Identity & Steuerung (Asset = Maschine)

| ID | Bedeutung | Wo in der UI | Historie? |
|----|-----------|--------------|-----------|
| **Asset-ID (Object-ID)** | Weltweit eindeutige „Geburtsurkunde“ des physischen Objekts auf der Chain. | Asset-Twin: pro Asset angezeigt; QR-Label, „→ Übertragen“, ObjectID-Verify. | Nein (Liste = aktuelle Assets; alte nach Purge weg). |
| **Streams-Anchor-ID** | Der Datenkanal (Pinnwand) für dieses Asset – wo Live-Daten/Heartbeats fließen. | Asset-Twin: beim Anlegen; Liste „Streams: 0x…“; „Zur Überwachung“. Streams-/Monitor-Kachel: Kanal wählen. **IDs & Verlauf:** Anchor-Liste. **Popup „IDs & Adressen“:** STREAMS_ANCHOR_ID. | **Ja** – „IDs & Verlauf“ → Streams Anchor-IDs; Setup/Config. |
| **Authorized-Key-ID** | Der Access-Key: Wer diesen Key besitzt, darf die Pumpe/das Lock steuern. | Asset-Twin: optional beim Anlegen (Verknüpfungen); Liste „Key: 0x…“; „Komplettes Paket übertragen“. Schlüssel & Tickets: Keys mit Object-ID. | Keys in Rebate-Tabelle (Boss); keine zentrale „Key-Historie“ pro Asset. |
| **Package-ID** | Welche Software-Version (Move-Package) für die Logik gilt. Am Asset: „Created with Package“. | Setup: Eingabe + Verlauf; **IDs & Verlauf:** Package-IDs (aktuell, Verlauf, von Chain). **Popup:** PACKAGE_ID. Asset-Twin: optional „Package-ID (Logic)“ beim Anlegen; Liste „Package: 0x…“; Link „Package“. | **Ja** – „IDs & Verlauf“ + Setup-Verlauf + discovered. |
| **Mailbox-ID** | Briefkasten des Geräts – für direkte Befehle (z. B. „Update starten“). | **Popup:** MAILBOX_ID. Asset-Twin: optional beim Anlegen; Liste „Mailbox: 0x…“; Button „Zum Chat“. | Nein (nur in Config / .env). |
| **Monitor-Device-ID** | Adresse des Sensors/Geräts, das die Pumpe überwacht (Heartbeat-Zeile im Monitor). | Asset-Twin: optional beim Anlegen; Liste „Monitor: 0x…“; „Zum Chat“ nutzt sie als Partner. Überwachung: MONITOR_DEVICES (Liste von Adressen). | Nein (Config / Geräteliste). |
| **Vault-Registry-ID** | Zentraler Tresor auf der Chain (ein Objekt = eine Registry). | **Popup:** VAULT_REGISTRY_ID. Tresor-Kachel: Hinweise. Asset-Twin: optional „Vault“ beim Anlegen; Liste „Vault: 0x…“; Link „Vault“. | Nein (Config). |

### 3.2 Boss-spezifisch: Code & Infrastruktur

| ID | Bedeutung | Wo in der UI | Historie? |
|----|-----------|--------------|-----------|
| **UpgradeCap-ID** | Der „Generalschlüssel“ für das Package: Nur wer diese Object-ID besitzt, darf das Package upgraden (Code reparieren/ändern). Wird beim ersten Deploy erzeugt; gehört dem Wallet, das deployt hat. | **Einsatzleitung → Einsatz-Konfiguration** (Boss); `.env` `UPGRADE_CAP_ID`; siehe **`docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md`**. | Nein. |
| **Vault-Registry-ID** | Siehe oben – Boss legt sie einmal an (create_globals), trägt sie in .env ein. | Popup, Config, Tresor, optional am Asset. | Nein. |
| **Vault-ID** | Einzelnes „Schließfach“ innerhalb der Registry (pro Adresse). | Wird intern genutzt; keine eigene Anzeige als ID. | — |

**Empfehlung UpgradeCap:** Die UpgradeCap-ID nach dem ersten Deploy notieren und **im Tresor (Vault) oder sicher offline** aufbewahren. Verlierst du den Zugriff auf das Wallet mit dieser ID, kannst du das Package nicht mehr updaten.

---

## 4. Wo findest du was in der UI?

| Was | Wo |
|-----|-----|
| **Alle kopierbaren IDs auf einen Blick** | Header-Button 📋 → „IDs & Adressen“ (MY_ADDRESS, PACKAGE_ID, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, VAULT_REGISTRY_ID, MAILBOX_ID, COMMAND_REGISTRY_ID, BOSS_ADDRESS, PARTNER_ADDRESS, LOCK_ID, CONNECTED_ADDRESSES). |
| **Package-IDs inkl. Verlauf & von der Chain** | Kachel **IDs & Verlauf** → „Listen aktualisieren“ → Package-IDs (aktuell, Von der Chain, Verlauf). |
| **Streams-Anchor-IDs (Kanäle)** | Kachel **IDs & Verlauf** → Anchor-IDs; **Streams** / **Überwachung** → Kanal wählen/setzen. |
| **Asset-IDs + alle Verknüpfungen** | Kachel **Asset-Twin** → Liste (Object-ID, Streams, Package, Mailbox, Monitor, Vault, Key); Buttons „Zur Überwachung“, „Zum Chat“, „Package“, „Vault“. |
| **Key-Object-IDs** | **Steuerung (Boss)** → Rebate-Tabelle → Access-Keys (Object-ID pro Key). |
| **Setup (Package setzen, deployen)** | **Setup** → Package-ID, Verlauf, „Neu bauen & deployen“. |

---

## 5. Was fehlt aktuell?

- **UpgradeCap-ID:** In **Einsatz-Konfiguration** (Boss) + `UPGRADE_CAP_ID` in `.env` nach `deploy:move-package`. Upgrade: **`npm run upgrade:move-package`** — siehe **`docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md`**.
- **Zentrale „Historie“ für Keys/Mailbox/Vault-Registry:** Es gibt nur Config/Popup – keine Verlaufsliste wie bei Package/Anchor. Für typischen Betrieb reicht die einmalige Konfiguration.

---

## 6. Kurzfassung für die Asset-Kachel

Ein **Super-Asset** bündelt am Twin (der Pumpe) alle relevanten IDs:

| Feld | ID | Wann brauchst du sie? |
|------|-----|------------------------|
| Identity | Asset-ID (Object-ID) | „Welches Teil ist das?“ |
| Control | Authorized-Key-ID | „Wer darf steuern?“ |
| Data | Streams-Anchor-ID | „Wo fließen Live-Daten?“ |
| Monitor | Monitor-Device-ID | „Welcher Sensor überwacht?“ |
| Chat | Mailbox-ID | „Wohin direkte Befehle?“ |
| Logic | Package-ID | „Mit welcher Software-Version?“ |
| Tresor | Vault-Registry-ID | „Wo liegen asset-eigene Dokumente?“ |

Morgendrot verknüpft sie für dich – der Admin sieht am Ende den Namen (z. B. „Hochdruckpumpe P-101“) und die Aktionen (Zur Überwachung, Zum Chat, Package, Vault, Übertragen).
