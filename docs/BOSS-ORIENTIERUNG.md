# Boss-Orientierung: Überblick behalten — Vorlagen, Keys, was ist schon da?

**Zweck:** Gegen „in drei Monaten weiß niemand mehr, was wohin gehört“ — **eine** Einstiegsseite: Ist vs. Vision, typische Fehler, Links ins „Gesetzbuch“. **Lite-UI (Boss):** `GET /api/doc?name=BOSS-ORIENTIERUNG.md`. **Messenger-PWA (Next):** eingebettetes Handbuch unter **`/handbook`** (Markdown aus `frontend/public/handbook/`, siehe `docs/PWA-HANDBUCH-OFFLINE.md`).

**Verwandt:** `docs/API-INITIAL-PROFILE.md`, `docs/API-EINSATZ-ROLE-TEMPLATES.md`, `docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md`, `docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`, `docs/UI-BEFEHLE-CHECKLISTE.md`, `docs/PWA-HANDBUCH-OFFLINE.md`, `docs/ROLLENWECHSEL-TEAM-EINSATZ.md` (Provisioning vs. `DEVICE_ROLES`, kein Auto-Push zum Helfer).

---

## 1. Drei Ebenen (kumulativ, nicht widersprüchlich)

**A. Doku als Quelle der Wahrheit** — Welche technischen Namen (`metadata`-Keys, `deploymentChannelTag`) gelten? → **`API-INITIAL-PROFILE.md`** (Namens-Anker) + diese Datei für Navigation.

**B. Vorlagen auf dem Boss-PC** — Welche Anzeige-Labels wähle ich beim Anlegen? → **`GET/POST /api/einsatz-role-templates`** → `.morgendrot-einsatz-templates.json` (Rollen-Template, optional **`defaultDeploymentChannelTag`**).

**C. UI-Automatik** („Sektor-Süd“ → `metadata.teamid`) — **Noch nicht** als generischer Feld-Katalog — siehe §4 Backlog. Bis dahin: **`metadata`** im JSON (Provisioning) **oder** nur **`deploymentChannelTag`** (ein Kanal-String).

---

## 2. Kritische Prüfung eurer Erzählung (Namens-Anker + Dropdown)

- **„Zukunfts-Feld 1 heißt immer teamid“** — **Richtig als Team-Konvention**; technisch: **`initialProfile.metadata.teamid`** (String). Keys im **`API-INITIAL-PROFILE.md`**-Anker festhalten.

- **„Dropdown Sektor-Süd → teamid“** — **UX-Ziel**; **Ist:** Dropdowns für **Einsatz-Rollen-Templates** (Rolle, `roleId`, Kanal-Tag). **Nicht Ist:** beliebig viele Metadata-Dropdowns ohne Schema-Erweiterung.

- **„Automatik im Hintergrund“** — **Teilweise:** Template setzt Kanal + Rolle. Für mehrere Keys (`gear`, `teamid`) fehlt ein **Felddefinitions-Store** — sonst **zweites Excel** neben der Doku.

- **„Gesetzbuch = API-INITIAL-PROFILE“** — **Richtig** — Magic-Strings ohne Doku = stiller Schulden.

---

## 3. Vermeidbare Fehler

- **Doppelte Semantik:** Einen räumlichen Bereich **einmal** modellieren: entweder **`deploymentChannelTag`** („Sektor Nord“) **oder** `metadata.teamid` — nicht dieselbe Information zweimal mit driftenden Werten.
- **Metadata ≠ Sicherheit:** Werte sind **Klartext** im Provisioning-Paket — keine medizinischen oder geheimen Inhalte ohne extra Verschlüsselung (siehe Kritik-Dokument).
- **„App lernt automatisch“:** Nein — jedes neue Feld braucht später **Client-Logik** (Anzeige, Filter). Metadata ist nur **Transport**.

---

## 4. Backlog (wenn ihr „Sektor-Süd“-Menüs für teamid/gear wollt)

- Persistierte **Definitionsdatei** z. B. `metadataFieldCatalog` mit `key`, `label`, `allowedValues[]` + API + Validierung gegen `initialProfile.metadata`.
- Oder Erweiterung von **`EinsatzRoleTemplate`** um optionale **`metadataDefaults`** — nur nach Schema-Review (Max-Größe, Versionierung).

---

## 5. Schnell-Links (Repo-Pfade)

- **`docs/API-INITIAL-PROFILE.md`** — Request/Response, `metadata`, Kontakte.
- **`docs/API-EINSATZ-ROLE-TEMPLATES.md`** — Boss-Vorlagen-Liste.
- **`docs/UI-BEFEHLE-CHECKLISTE.md`** — welche API hat welchen Button.
- **`docs/ROADMAP-FAHRPLAN.md`** — § **H.3g** (Einsatzleitung / Pakete), **§ H.7** (Standalone-Smartphone / Handoff-ZIP).
- **`docs/WANDERER-STANDALONE-BUNDLE.md`** — „Wanderer“-Abgabe; Bundle + Handoff-ZIP (~3 KB).
- **Handoff:** **`docs/HANDOFF-IMPORT-UX.md`** · **`docs/HANDOFF-PROFILE-UX.md`** · **`docs/HANDOFF-ZIP-ENCRYPTION.md`** — Export **Einstellungen** oder **Einsatzleitung → Export-Assistent**, Import **Einstellungen → Handoff importieren**; API **`POST /api/standalone-smartphone-handoff-zip`** (öffentliche `.env`, ohne Secrets).

## 6. Messenger-PWA: Handbuch offline & Einsatz-Notiz

- **Service Worker** cacht u. a. statische Dateien unter **`/handbook/*.md`** — Details und Grenzen: **`docs/PWA-HANDBUCH-OFFLINE.md`**.
- **`initialProfile.offlineBriefing`** — optionale Kurznotiz (Boss → Helfer); nach Import in der PWA unter Einstellungen sichtbar (Browser-Speicher), **nicht** automatisch „im verschlüsselten Vault“ ohne eigenen Vault-Schritt.
- **Papier-QR am Gerät** — Low-Tech-Backup; Nutzlast im QR begrenzt — Kurzparameter oder Verweis, siehe **`PWA-HANDBUCH-OFFLINE.md`** §3.

---

## 7. Kurztext für Einsatz-Folie / Schulung: Lieferwege Boss → Helfer

**Den folgenden Absatz könnt ihr 1:1 auf eine Folie oder ins Schulungsheft übernehmen** (ohne Marketing-Zusätze; Stand Abgleich mit API und UI):

**Lieferwege (Boss → Helfer, technisch korrekt):** Nach `POST /api/provision-device` liegt das Paket zuerst im **Boss-Browser** — es gibt **keinen** automatischen „Server-Push“ zur Helfer-App. **Mit Netz** übergibt ihr das Paket **manuell**: Datei (`.env` / JSON), **Export**, **QR** (kompakte Einrichtungsdaten), optional **ZIP-Handoff** für das Standalone-Smartphone-Bundle (`POST /api/standalone-smartphone-handoff-zip`, nur öffentliche Keys), oder Kopie per Messenger/USB — je nach Einsatz. **LoRa/Mesh** ist im Morgendrot-Repo v. a. für **Nachrichten** und Funk-Brücken spezifiziert, **nicht** als durchgängiger Standardweg für das **vollständige** Provisioning inkl. großem Bundle aus dem Wizard. **QR im Provisioning:** Der **Boss zeigt** den QR; Inhalt sind **Metadaten zur Einrichtung** (Rolle, Boss-Adresse, Package-ID, RPC, …) — **nicht** „der Helfer hält sein Handy hin, Boss scannt den Public Key, um das Paket zu verschlüsseln“. **Backup:** typische Exporte sind **Klartext-Artefakte** — Übertragungskanal absichern; verschlüsselte Sonderformate sind **andere** Produkte (z. B. Einsatzbericht). **Low-Tech:** kleiner **Text-QR** am Gerät (Parameter kurz halten) bleibt sinnvoll.

---

*Stand: Abgleich mit `src/einsatz-role-templates.ts`, `src/initial-profile-provision.ts`, Lite-UI `/api/doc`, Next `/handbook`, `frontend/public/sw.js`.*
