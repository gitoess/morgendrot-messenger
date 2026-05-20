# PACKAGE-Profile wechseln — Zielbild (kein Chat-Raum)

**Zweck:** Produkt- und Architektur-Vorgabe für **mehrere `PACKAGE_ID`s** im Messenger — **später umsetzen** (Roadmap **§ H.24b**).  
**Stand:** 2026-05-20 (Entscheidungen § 7.5–7.6 ergänzt)  
**Status:** **Spezifikation / Backlog** — **nicht** MVP; heute nur `/set-package-id`, Server-`.env` und Workaround „zwei Ordner“ (**`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`**).

**Verknüpft:** **`docs/DEPLOY-CHECKLIST.md`** (zentrale Deploy-Schritte inkl. Manifest), **`docs/ROADMAP-FAHRPLAN.md`** § **H.24**, **`docs/MESSENGER-KANAL-MAILBOX-MEILENSTEINE.md`**, **`docs/MAILBOX-BEGRIFFE-UND-NUTZUNG.md`**, **`docs/DEPLOY-MOVE-M4d.md`**.

---

## 1. Leitplanke (zentral)

| | |
|--|--|
| **PACKAGE_ID wechseln ist** | Wechsel der **Einsatzumgebung / Organisation / Deploy** (Chain-Vertrag + Shared-Postamt + Regeln). |
| **PACKAGE_ID wechseln ist nicht** | Wechsel eines **Chat-Raums**, eines Partners oder eines „Kanals“ wie Pinnwand/Gruppe. |
| **Analogie** | Wie **Signal mit mehreren Accounts** — nicht wie WhatsApp-Gruppenliste. |

Partner-Adresse (`0x…`), Kanal (1:1 / Gruppe / Pinnwand) und Transport (IOTA / Funk) bleiben **innerhalb** eines aktiven Package-Profils.

---

## 2. Wann Wechsel sinnvoll ist

| Szenario | PACKAGE wechseln? | Bewertung | Kommentar |
|----------|-------------------|-----------|-----------|
| **Feuerwehr → Übergreifender Katastrophenschutz** | Ja | Sinnvoll | Andere Organisation → andere Rechte, `MAILBOX_ID`, Admins, Move-Regeln |
| **Täglicher Wechsel zwischen Einheiten** | Nein | Schlecht | Zu fehleranfällig; besser **ein Profil pro Rolle** oder getrennte Installation |
| **Großschadenslage / viele Verbände** | Besser **ein gemeinsames** Package | Empfohlen | Alle arbeiten unter **einem** Katastrophenschutz-`PACKAGE_ID` + Shared-Mailbox |
| **Testnet ↔ Mainnet** | Ja, aber **Profil** | Siehe **`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`** | Nicht „umschalten“ mitten im Einsatz ohne Warnung |

---

## 3. Zielbild: „Einsatzprofile“ im Messenger

### 3.1 Zwei Ebenen (kritisch — nicht vermischen)

| Ebene | Was | Wer nutzt es |
|-------|-----|--------------|
| **A — Installation / Einsatz** | **Eine** laufende Node-Instanz mit **fester** `.env` (`PACKAGE_ID`, `MAILBOX_ID`, `RPC_URL`, …) | Jeder produktive Einsatz (Feuerwehr-Posten, Katastrophenschutz-Leitstelle) |
| **B — Profil-Registry (Client)** | Gespeicherte **Verknüpfungen** zu Installationen oder Chain-Kontexten (Label, API-URL, IDs, Farbe) | Geräte, die **zwischen** Einsätzen wechseln (Boss-Laptop, Übung, Lab) |

**Produktentscheidung (§ 7.5):** **Kein** „Multi-Package in einem Server-Prozess“ durch stilles Umschreiben von `CFG` — **weiter eine Installation pro Einsatz**.  
Der Button **„Einsatz wechseln“** bedient **Ebene B**: Client wechselt **aktive Registry** (und ggf. `API_BASE`), **nicht** dass ein Feld-Posten-Backend zur Laufzeit drei Packages gleichzeitig bedient.

**Konsequenz für Helfer mit einem Bundle:** Standard ist **ein** aktives Profil (= die `.env` dieser Installation). Vorkonfigurierte Profile im Bundle (§ 7.6) sind **Auswahl beim Start** oder nach **Handoff** — nicht tägliches Hin- und Her-Schalten.

### 3.1b Profil-Katalog (Beispiele)

| Profil-Label | Herkunft | Typisch |
|--------------|----------|---------|
| **Katastrophenschutz** | **Bundle** (vorab) | Großschadenslage — schnell wählbar |
| **Feuerwehr Standard** | **Bundle** (vorab) | Dienst Alltag |
| **Training** | **Bundle** (vorab) | Übung / Testnet |
| Spezialeinheit Polizei XY | **Manuell** (Config-Rolle) | Flexibilität |

Felder pro Eintrag (Registry): `profileId`, `label`, `apiBaseUrl?`, `packageId`, `mailboxId`, `vaultRegistryId?`, `rpcUrl?`, `color`, `bundled: boolean`, `readOnly: boolean`.

### 3.2 Wechsel-UX: **große Warnung** + Button **„Einsatz wechseln“** (Produktentscheidung 2026-05-20)

**Nicht** versteckt in Setup oder nur `/set-package-id` — eigener, gut sichtbarer Einstieg:

| Element | Verhalten |
|---------|-----------|
| **Button „Einsatz wechseln“** | Persistent in Messenger (z. B. Setup, Posteingang-Toolbar oder Profil-Kachel) — öffnet Profil-Auswahl |
| **Profil-Liste** | Gespeicherte Profile (Label, Package-Kurz-ID, letzte Nutzung); „+ Profil hinzufügen“ nur mit Berechtigung (§ 7.1) |
| **Wechsel-Dialog** | **Modal / Vollbreite-Warnung** vor Aktivierung — nicht wegklickbar ohne Entscheidung |

**Dialog-Inhalt (Pflichttext, anpassbar pro Ziel-Profil):**

```
Achtung — Einsatz wechseln

Du wechselst zu: „Katastrophenschutz“ (Package 0xf817…e504).

• Private Mailboxes der Feuerwehr sind in diesem Einsatz nicht verfügbar.
• Handshakes gelten pro Einsatz — ggf. erneut verbinden.
• Der Posteingang zeigt nur Nachrichten dieses Packages.
• Telefonbuch-Kontakte bleiben dieselben; Kontakt-Mailbox-IDs können pro Einsatz unterschiedlich sein.

[ Abbrechen ]     [ Einsatz wechseln ]
```

Nach Bestätigung: Banner **„Einsatz: Katastrophenschutz“** (§ 3.4) + Client-Registry aktiv (ggf. **`API_BASE`** auf andere Installation) + profilbezogene lokale Daten — **ohne** Multi-Package auf einem Server (§ 7.5).

### 3.3 Daten-Trennung: **mittel** (Produktentscheidung 2026-05-20)

**Prinzip:** Partner kennt man **einmal**; Einsatz-Kontext (Package) wechselt **Regeln und Mailboxen**, nicht die Menschen.

| Domäne | Scope | Begründung |
|--------|--------|------------|
| **Telefonbuch / Basis-Kontakte** | **Global** | Gleiche `0x…`-Partner nicht doppelt pflegen; Name, Telegram-ID, Mesh-ID einmal |
| **`mailboxObjectId` am Kontakt** | **Pro aktivem Profil** (Override) | Dieselbe Person kann in Feuerwehr-Package andere private Mailbox-ID haben als in Katastrophenschutz — Wert gilt **im Kontext des aktiven Profils** |
| **Private Mailboxes** (M4d) | **Pro Profil** | Liste, aktiv, Archiv, Profil-QR |
| **Handshake / peerMap / Connect** | **Pro Profil** | Verbindungszustand ist einsatzbezogen |
| **Aktive Mailbox** (Shared + privat) | **Pro Profil** | „Wohin sende ich persistent?“ |
| **Posteingang / Fetch** | **Pro Profil** | Nur Nachrichten des aktiven `PACKAGE_ID` / zugehöriger `MAILBOX_ID` |
| **Persistenz-Modus, Transport-Defaults** | Optional pro Profil | Kann global bleiben; v1: pro Profil speichern wenn verwirrend |

**Regel:** Beim Profilwechsel **kein stilles Mischen** — Client: Namespace `packageProfileId` in `localStorage`-Keys; Server: aktives Profil setzt `CFG.PACKAGE_ID` + `MAILBOX_ID`.

**Ist heute:** alles global — Migration in **H.24b P3**.

### 3.4 Sichtbarkeit: „Du bist im Feuerwehr-Modus“

Dauerhaft sichtbar (nicht nur einmalige Toast-Meldung):

- **Top-Banner** mit Profil-Label (z. B. „Einsatz: Feuerwehr Kreis X“) + optional Farbe.
- In Mailbox-Liste: Shared-Zeile = **dieses** Profils `MAILBOX_ID`.
- Beim Senden: Kurzhinweis wenn Kontakt-`mailboxObjectId` aus **anderem** Profil stammt (optional P2).

### 3.5 Was nicht migriert wird (v1)

- **Keine** automatische Übertragung von Private-Mailbox-**Chain-Objekten** zwischen Packages (andere Move-Module).
- **Keine** „Merge“-Inbox über zwei Packages — Nutzer sieht Inbox des **aktiven** Profils.
- Admin-`MAILBOX_ID` / `create_globals` bleibt **pro Deploy** einmalig (**`docs/DEPLOY-MOVE-M4d.md`**).

---

## 4. Abgrenzung zu Ist-Features

| Feature heute | Verhalten | Später |
|-------------|-----------|--------|
| **`/set-package-id`** | Ersetzt globale `PACKAGE_ID` (Boss/CLI) | Wird **„Profil speichern / aktivieren“**-Backend |
| **Package-ID-Banner** | Posteingang vs. Status-Konflikt | Bleibt; ergänzt um **Profil-Name** |
| **Mailbox-Liste UI** | Shared + private, ein Server-`MAILBOX_ID` | Shared-Zeile **pro aktivem Profil** |
| **Zwei Ordner / zwei `.env`** | Workaround ohne App-Logik | **Bleibt kanonisch** pro Einsatz (§ 7.5); Registry + „Einsatz wechseln“ = Komfort darüber |

---

## 5. Vorteile / Nachteile (ehrlich)

**Vorteile**

- Saubere Trennung zwischen Organisationen und Einsatzregeln.
- Großschadenslage: temporär auf **ein** gemeinsames Package — ohne Datenmüll in vielen Einzel-Packages.
- Klare UX: Wechsel ≠ neuer Chat.

**Nachteile / Aufwand**

- Package-Management (Speichern, Aktivieren, Validieren, RPC/`MAILBOX_ID`-Konsistenz).
- UI-Komplexität (Profil-Liste, Warnungen, Badges).
- Migration bestehender lokaler Stores (Mailboxes, Telefonbuch-Metadaten).
- Tests: kein Cross-Profil-Leak (Inbox, Send, QR).

---

## 6. Umsetzungspaket (Roadmap § H.24b — Reihenfolge)

| Phase | Inhalt | Abhängigkeit |
|-------|--------|--------------|
| **P0** | Datenmodell `PackageProfile` + Manifest-Schema (`bundled`, `readOnly`, `apiBaseUrl`, IDs) | § 7.5–7.6 |
| **P1a** | **Bundle:** `package-profiles.manifest.json` (oder Handoff-Abschnitt) mit Standard-Profilen | Deploy-Pipeline |
| **P1b** | **Client:** Registry laden/merken, aktives Profil, `API_BASE`-Wechsel mit Warnung | P0 |
| **P1c** | **Server:** optional nur **ein** Profil pro Instanz dokumentieren; `/set-package-id` bleibt Admin-Lab — **kein** Produktions-Hot-Swap | § 7.5 |
| **P2** | UI: **„Einsatz wechseln“**, Modal, Top-Banner, „+ Profil“ (Config) | P1b |
| **P3** | Client-Namespaces (mittlere Trennung, § 7.2) | P2 |
| **P4** | Capabilities pro Package (**§ H.24a**) | P1b |

**Nicht in v1:** Multi-Package in **einem** Node ohne Neustart; Migration von On-Chain-Mailboxen zwischen Packages; täglicher Einheiten-Ticker.

---

## 7. Produktentscheidungen (festgelegt 2026-05-20)

### 7.1 Wer darf neue Package-Profile anlegen / aktivieren?

| Berechtigt | Bedingung |
|------------|-----------|
| **Boss / Admin** | `ROLE=boss` und `ENABLE_CONFIG_CHANGE` (wie heute Konfig-API) |
| **User mit Config-Rolle** | `GET /api/status` → `permissions.configChange === true` |

**API-Regel (H.24b):** Endpunkte z. B. `POST /api/package-profiles`, `POST /api/package-profiles/activate` prüfen dieselbe Berechtigung wie **`POST /api/config`** / `.env`-Schreiben (`configChange`).

**Ist-Code-Hinweis:** In der Ameisen-Hierarchie hat heute nur **Boss** `configChange`; **Kommandant** nicht — bei Umsetzung entweder `ROLE_ID`-Bit „Config“ oder explizites `packageProfileManage` ergänzen, damit „Config-Rolle“ fachlich passt. Messenger/Lock/Monitor (außerhalb boss/kommandant/arbeiter) haben `configChange: true` bereits.

**Arbeiter:** Profile **nicht** anlegen/aktivieren (nur nutzen, wenn Admin Profile vorab im Bundle hinterlegt hat — optional read-only Switch).

### 7.2 Daten-Trennung

**Entscheidung: mittel** — siehe § 3.3 (Telefonbuch global; private Mailboxes, Handshakes, aktive Mailbox pro Profil).

### 7.3 Wechsel-UX

**Entscheidung: große Warnung + Button „Einsatz wechseln“** — siehe § 3.2.

### 7.5 Betrieb: **eine Installation pro Einsatz** (festgelegt 2026-05-20)

**Entscheidung:** **Weiter eine Installation pro Einsatz** — feste `.env` pro Ordner/Bundle/Server-VM, **kein** Runtime-Wechsel mehrerer `PACKAGE_ID`s in **demselben** produktiven Node-Prozess.

| Aspekt | Regel |
|--------|--------|
| **Feuerwehr-Posten** | Ein Ordner → eine `PACKAGE_ID` + eine `MAILBOX_ID` → `npm run dev` / Dienst |
| **Katastrophenschutz-Leitstelle** | **Eigene** Installation (eigene `.env`, ggf. gemeinsames KS-Package) |
| **Wechsel im Alltag** | Bevorzugt: **anderer Starter** / anderes Bundle — nicht ständiges Umschalten in einer App |
| **Boss-Laptop / Lab** | **Profil-Registry** (§ 3.1): Verknüpfung zu mehreren `http://127.0.0.1:3342`-Instanzen oder Handoff-ZIPs |
| **`/set-package-id`** | Bleibt **Admin/Lab** auf **dieser** Installation — ersetzt kein zweites Produktions-Deploy |

**Kritische Klarstellung:** „Einsatz wechseln“ **ersetzt nicht** drei Organisationen auf **einem** Server. Es erleichtert den Wechsel der **Client-Anbindung** und der **profilbezogenen lokalen Daten** — die Chain-Seite bleibt an die **gewählte Installation** gebunden.

**Vorteil:** Weniger Fehlkonfiguration, klare Ops (Backup, Logs, RPC), passt zu **`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`**.  
**Nachteil:** Mehr Ordner/VMs bei vielen parallelen Einsätzen — bewusst in Kauf genommen.

### 7.6 Bundle: **Hybrid** — Standard-Profile + manuell (festgelegt 2026-05-20)

**Entscheidung:** **Mischung** — weder nur manuell noch nur fest verdrahtet.

| Quelle | Inhalt | Zielgruppe |
|--------|--------|------------|
| **Vorkonfiguriert im Bundle** | Standard-Profile mit **finalen** IDs (nach Org-Deploy), z. B. **„Katastrophenschutz“**, **„Feuerwehr Standard“**, **„Training“** | Großschadenslage, schneller Start, Helfer ohne Config-Rolle |
| **Manuell anlegbar** | Zusätzliche Profile (Label, IDs, API-URL) durch **Boss / Config-Rolle** | Spezialeinheiten, neue Projekte, Piloten |

**Begründung (Produkt):**

- **Hochwasser / Stromausfall:** Ein Tap auf **„Katastrophenschutz“** — kein Tippen von `0x…`, kein `create_globals` am Handy.
- **Spezialeinheit / Pilot:** Config legt **„Polizei SEK Region Y“** an, ohne neues Bundle-Release.

**Technik (Vorschlag H.24b P1a):**

```json
{
  "version": 1,
  "profiles": [
    {
      "id": "katastrophenschutz",
      "label": "Katastrophenschutz",
      "bundled": true,
      "readOnly": true,
      "packageId": "0x…",
      "mailboxId": "0x…",
      "rpcUrl": "https://api.testnet.iota.cafe",
      "color": "#b45309"
    },
    {
      "id": "feuerwehr-standard",
      "label": "Feuerwehr Standard",
      "bundled": true,
      "readOnly": true,
      "packageId": "0x…",
      "mailboxId": "0x…"
    },
    {
      "id": "training",
      "label": "Training",
      "bundled": true,
      "readOnly": true,
      "packageId": "0x…",
      "mailboxId": "0x…"
    }
  ]
}
```

- Lieferung: **`package-profiles.manifest.json`** im Standalone-Bundle + optional in **Handoff-ZIP** (`docs/BOSS-ORIENTIERUNG.md` / **§ H.7**).

**Dateien im Repo (2026-05-20):**

| Pfad | Zweck |
|------|--------|
| **`docs/examples/package-profiles.manifest.json`** | Referenz mit **echten** Testnet-IDs (`0xf817…`, `MAILBOX_ID`, Registry) + Kommentare in `meta` / `_labNote` |
| **`frontend/public/templates/package-profiles.manifest.json`** | **Vorlage** (`REPLACE_*`) — wird bei `npm run build:next` / `sync:package-profiles` nach `ui/` und `public/` kopiert |
| **`exports/…/package-profiles.manifest.json`** | Beim **`npm run bundle:messenger`** aus der Vorlage (plus `config/` und `docs/examples/` im Bundle) |
- **IDs im Bundle** müssen zu **echten** Deploys der Organisation passen — Platzhalter `0x…` sind wertlos; Pflege durch **Release** oder Boss-Export nach `create_globals`.
- **Arbeiter:** nur **Auswahl** aus Liste (`readOnly: true` bei bundled); **kein** Anlegen.
- **Config:** „+ Profil hinzufügen“ schreibt in **lokale** Registry (und ggf. Server, wenn dieselbe Installation Multi-Registry-Datei führt — nur Lab).

**Kritik / Risiken (ehrlich):**

| Risiko | Gegenmaßnahme |
|--------|----------------|
| Bundle-IDs veralten nach Re-Deploy | Manifest-Version + Hinweis „Profil veraltet“ wenn `GET /api/status`.packageId ≠ manifest |
| Zu viele bundled Profile verwirren | Max. 3–5 Standard; Rest manuell |
| Helfer wählt KS, API zeigt noch Feuerwehr-Backend | Registry muss **`apiBaseUrl`** pro Profil setzen — Warnung im Wechsel-Dialog |

## 8. Nach neuem Move-Package-Deploy (Pflege Manifest)

**SSOT für die komplette Reihenfolge:** **`docs/DEPLOY-CHECKLIST.md`**.

Nach **`npm run deploy:move-package`** und **`create_globals`** immer:

1. **Neue IDs in `.env`** — `PACKAGE_ID`, `MAILBOX_ID`, `VAULT_REGISTRY_ID`, `COMMAND_REGISTRY_ID` (aus Event `GlobalsCreated`).
2. **Backend neu starten** — z. B. `npm run dev`, damit `/api/status` die neuen Werte liefert.
3. **`package-profiles.manifest.json` aktualisieren:**
   - Datei: **`frontend/public/templates/package-profiles.manifest.json`**
   - Alle **`REPLACE_*`** durch die neuen `0x…`-IDs ersetzen (pro Profil: `packageId`, `mailboxId`, `vaultRegistryId`, `commandRegistryId`, `rpcUrl`, `apiBaseUrl`)
   - Label, Beschreibung und Farbe bei Bedarf anpassen
   - Referenz-Kopie optional pflegen: **`docs/examples/package-profiles.manifest.json`**
4. **Sync ausführen** (mindestens eines):
   ```bash
   npm run sync:package-profiles
   ```
   oder für Handoff-Bundles:
   ```bash
   npm run bundle:messenger
   ```
5. **Messenger:** Hard-Refresh → Profil-/Mailbox-Ansicht prüfen (später **„Einsatz wechseln“**; heute vor allem konsistente IDs im Bundle).

**Nicht automatisch:** `deploy:move-package` allein aktualisiert das Manifest nicht — das ist bewusst **manuell** nach `create_globals`, damit keine Platzhalter-IDs in Helfer-Bundles landen.

**Lab mit nur einer Installation:** Alle drei Standard-Profile dürfen **dieselben** Chain-IDs tragen; unterschiedliche **`apiBaseUrl`** (z. B. `3342` / `3343`) dokumentieren nur das Muster „zweiter Posten“. In Produktion: **eine Installation pro Einsatz** (§ 7.5).

### 7.7 Entscheidungs-Matrix (vollständig)

| # | Thema | Entscheidung |
|---|--------|--------------|
| 7.1 | Berechtigung | Boss/Admin + `configChange` |
| 7.2 | Daten | Mittel (Telefonbuch global; Rest pro Profil) |
| 7.3 | UX | Große Warnung + **„Einsatz wechseln“** |
| 7.5 | Server | **Eine Installation pro Einsatz** |
| 7.6 | Bundle | **Hybrid:** Standard-Profile + manuell |
