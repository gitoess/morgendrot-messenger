# Rollen-basiertes Dashboard (Workspaces)

**Problem:** Die aktuelle UI ist **funktionsorientiert** (technische Kacheln: Ticket, Key, Vault, Nachrichten, Überwachung, Steuerung). Manche Kacheln haben nichts miteinander zu tun; andere sind für **Arbeiter** (z. B. Tor in einer Bank) nötig, liegen aber auf verschiedenen Kacheln – z. B. Heartbeat in „Überwachung“, Ticket-Prüfung in „Zugang“. Ein Bank-Tor braucht keinen „Tickets erstellen“, sondern einen zusammengefassten Ablauf: Heartbeat, Befehlsempfang, Ticket-Validierung, ggf. Purge.

**Lösung:** Dashboard in **dynamische Arbeitsbereiche (Workspaces)** umbauen. Abhängig von `role` / `roleId` (vom Backend `/api/status`) werden unterschiedliche Workspaces angezeigt; die technischen Kacheln verschmelzen zu **Workflows**.

---

## 1. Drei Szenarien

| Szenario | Rolle(n) | Was die Instanz ist | UI |
|----------|----------|----------------------|-----|
| **A: Hardware-Arbeiter** | `arbeiter`, `lock` | Bank-Tor, Tür, Spind-Scanner | Headless oder **Minimal-Terminal**. Keine Kachel „Tickets erstellen“. Modul: Heartbeat + Befehlsempfang (Observer) im Hintergrund. **Anzeige:** Status (Online), letzte Aktion (z. B. „Tor auf“), Guthaben. Optional: QR-Scanner-Frontend, Ticket-Validierung, Purge in **einer** Ansicht (Action Center). |
| **B: Zutritts-Management** | `boss`, ggf. `kommandant` | Airbnb-Host, Spind-Betreiber | **Wizard.** Kombination aus „Tickets/Keys erstellen“, „Vault“ (Passwort), „Messaging“ (Link an Gast senden) in **einem** Ablauf. Anzeige: Gästeliste mit TTL. |
| **C: System-Admin (Boss)** | `boss` | Flotten-Inhaber | **Volle Kontrolle.** „Radar“: alle Arbeiter (Tore) mit Status (Heartbeats). Rebate-Tacho. Provisioning-Wizard. Alle Kacheln verfügbar, aber priorisiert: Geräte-Radar oben, dann Wizard, dann Rest. |

---

## 2. Modulare Dashboard-Logik (Widget-System)

- **Context:** Die App liest `role` und `roleId` aus `GET /api/status`.
- **Widget-Loading:**
  - **Arbeiter / Lock (z. B. roleId 14):** Nur **Action Center** (Heartbeat-Status, Log, letzte Aktion, Guthaben; optional QR + Ticket-Check + Purge) – keine Kacheln „Tickets erstellen“, „Vault“ usw.
  - **Boss:** Kacheln wie heute **plus** oben **Geräte-Radar** (Liste aller Geräte/Worker mit letztem Heartbeat aus `GET /api/monitor-status` oder Audit-Events).
  - **Kommandant:** Ähnlich Boss, aber eingeschränkt (keine Hierarchie-Änderung); Geräte-Radar sinnvoll.

---

## 3. Beispiel: Einlass am Bank-Tor (kombinierter Workflow)

- **Hintergrund:** HeartbeatProvider sendet alle 30 s (bereits im Backend).
- **Vordergrund (Action Center):** Ein Bildschirm mit:
  - Status: Online / letzter Heartbeat
  - QR-Scanner (oder manuelle Ticket/Key-Eingabe)
  - Nach Scan: Arbeiter prüft AccessKey/Ticket (Säule 3), meldet Erfolg (Messenger/Säule 2), kann altes Ticket purgen (Säule 4)
- **Ohne** Kachel-Wechsel: Alles in **einer** Logik-Schleife / einer Ansicht.

---

## 4. Umsetzungsauftrag (Frontend)

1. **Rollen-basiertes Dashboard**
   - `role` und `roleId` aus `/api/status` nutzen (bereits geliefert).
   - Statt für alle dieselben 6 Kacheln: **Workspace pro Rolle**:
     - **Boss:** Kacheln + **Geräte-Radar** oben (Liste Worker mit Status aus `/api/monitor-status`).
     - **Arbeiter / Lock:** **Action Center** statt Kachel-Grid (Heartbeat, Ticket-Validierung, Purge, Guthaben in einer Ansicht).
     - **Kommandant:** Wie Boss ohne Hierarchie-Änderung; Geräte-Radar optional.
     - **Messenger / Sonstige:** Bisheriges Kachel-Grid (Fallback).

2. **Action Center für Arbeiter**
   - Eine View: Heartbeat-Status, letzte Aktion, Guthaben.
   - Kopplung: Heartbeat-Anzeige, Ticket/Key-Validierung (z. B. Aufruf Backend), Purge-Button für abgelaufene Keys/Tickets (wenn Berechtigung).
   - Kein separates Durchklicken durch „Überwachung“ und „Zugang“.

3. **Geräte-Radar für Boss**
   - Neue Sektion oben im Boss-Workspace.
   - Daten: `GET /api/monitor-status` → `devices` (bereits vorhanden).
   - Anzeige: Tabelle/Liste mit Gerät (device), Status (online/offline/warning), letztes Heartbeat (lastSeen).

**Referenzen:** `frontend/frontend/components/dashboard.tsx`, `src/api-server.ts` (status: role, roleId), `src/config.ts` (getHierarchyPermissions), `/api/monitor-status`, `/api/audit-events`.

---

## 5. Stand Umsetzung (2026-03, H.0 #3)

- **Ist:** `dashboard.tsx` blendet für **Arbeiter/Lock** zuerst **Action Center** ein; **Geräte-Radar** (`DeviceRadarView`) oben nur bei Arbeitsbereich **`morgendrot_workspace_tile_set` = `full`** — im Messenger-Bundle nur **`boss`**, im Hauptprojekt zusätzlich **`kommandant`** mit `full`. **Messenger + Boss + `full`:** Kachel-Whitelist nur **`chat`**, **`vault`**, **`boss`** (kein `lock`/`monitor`). Kurztexte zum Arbeitsbereich/Radar liegen in **§7** (früher im Panel „Arbeitsbereich & Projekte“).
- **Morgendrot Messenger (`uiVariant: 'messenger'`):** Festes Messenger-Kachelset für **alle** Rollen; **kein** Umschalter auf Morgendrot Projekt (s. **`docs/PRODUCT-MESSENGER-VS-PROJEKT.md`**). Boss/Kommandant: zusätzlich Einsatzleitung; Boss optional Kachel „Steuerung“. Kein Lock/Monitor/Radar.
- **Morgendrot Projekt (`uiVariant: 'full'`):** Panel **„Morgendrot Projekt“** mit Arbeitsbereich **`full`** oder **Messenger-Vorschau** (`messenger` in `localStorage`). Geräte-Radar nur bei **`full`**.
- **Offen:** Vollständige **Workflow-Oberfläche** (Spec § 3) ohne Kachel-Navigation — weiterhin Backlog.

## 6. Glossar: nicht verwechseln (**H.17**)

| Wort in der UI / im Team | Gemeint ist **nicht** | Gemeint ist |
|--------------------------|----------------------|---------------|
| **„Morgendrot Projekt“** (früher „Volldashboard“) | Weder Chat-**Boss-Übersicht** noch Messenger-Produkt | Nur im **Projekt-Deploy** (`UI_VARIANT=full`): **`morgendrot_workspace_tile_set`** = **`full`** — volles Kachel-Set + Radar. Im **Messenger** gibt es diesen Schalter **nicht**. |
| **Volle Oberfläche** / „Alle Funktionen (Kacheln)“ (Arbeiter/Lock) | Arbeitsbereich **`full`** | Nur **`morgendrot_show_all_tiles`**: Action Center vs. Kachel-Grid umschalten. |
| **Chat → Boss-Übersicht** (`bossView`) | Radar oder Arbeitsbereich | Nur **Posteingang-API**: Boss sieht optional Traffic **an Kommandanten** (`/inbox` mit Flag). **Separater** Code-Pfad — **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**. |
| **Geräte-Radar** | Das gesamte „Volldashboard“ | Eine **Monitoring-Sektion** (`DeviceRadarView`, `/api/monitor-status`) **oben** auf dem **Haupt-Dashboard**, wenn **`full`** aktiv (und Rolle laut Deploy). |

**Produktlinien:** **Morgendrot Messenger** (Bundle) = schlanke Boss-Oberfläche + später weniger Kacheln als das **Hauptprojekt**; Hauptprojekt behält alle Kacheln für Entwicklung — Deploy/`UI_VARIANT` entscheidet.

---

## 7. Geräte-Radar vs. Messenger (und ehemalige Panel-Texte)

### 7.1 Was ist das Geräte-Radar — und braucht es der Messenger?

Das **Geräte-Radar** (`DeviceRadarView`) ist eine **Monitoring-Sektion** oben auf dem Next-Dashboard: Geräte/Worker mit Status aus **`GET /api/monitor-status`** (Heartbeats, online/offline). Sie richtet sich an **Einsatzleitung / Flotte** (typisch **Boss**, im **Hauptprojekt** zusätzlich **Kommandant** mit **Volldashboard**).

- **Messenger-Arbeitsbereich** (`morgendrot_workspace_tile_set` = **`messenger`**): Das Radar wird **nicht** eingeblendet — der schlanke Modus fokussiert **Chat + Tresor** (und das vom Deploy erlaubte Kachelset). Für reine Messenger-Nutzung ist das Radar **absichtlich weg**; es ist **kein** Messenger-Kernfeature.
- **Sinnvoll** wird das Radar, wenn du **Volldashboard** wählst und eine Rolle/Deploy-Kombination greift, die Monitoring vorsieht — näher an der **Hauptprojekt-Linie** (viele Geräte, Observer) als an einer einzelnen Messenger-PWA.

Implementierung: `showDeviceRadar` in `frontend/frontend/components/dashboard.tsx`.

### 7.2 Messenger-Projekt vs. Standalone / Lite-UI

**„Messenger-Projekt“** im Panel blendet dieselbe **Kachel-Kombination** ein wie der exportierbare **Standalone-Messenger** (Chat + Tresor). Der **Export** selbst bleibt ein **Repo-Befehl** (`npm run bundle:messenger`, siehe README) oder die **Lite-UI** auf dem API-Port. **Ports, Next vs. API, `UI_VARIANT`:** `docs/DASHBOARD-PORT-UND-OBERFLAECHE.md`.

### 7.3 Hinweis: `morgendrot_workspace_tile_set` vs. Einstellungen vs. Chat

- **`morgendrot_workspace_tile_set`** (**Volldashboard** = `full`): Nur der **Arbeitsbereich** in Next (Radar nur bei `full`, s. §7.1). **Nicht** dasselbe wie …
- **`morgendrot_show_all_tiles`** in den **Einstellungen** (Arbeiter/Lock: „alle Kacheln“): **Action Center** vs. **Kachel-Grid**.
- **Chat → Boss-Übersicht** (`bossView`): Nur **Posteingang** — siehe `docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`.

### 7.4 Rollen-Kurzhinweise (früher violettes Infofeld im Panel)

- **Boss / Kommandant:** Bei **Volldashboard** (`full`) erscheint **oben** das Geräte-Radar (Monitor-Status), darunter Kacheln. Bei **Messenger-Projekt** (`messenger`) **kein** Radar — erst nach Umschalten auf Volldashboard; das ist eine **eigene Monitoring-Sektion**, **nicht** die Chat-**Boss-Übersicht** (`bossView`).
- **Boss (Messenger-Bundle, Volldashboard):** Kachelfläche absichtlich schlank (Nachrichten, Tresor & Notfall, Steuerung) — **kein** Zugang-/Überwachungs-Grid wie im Morgendrot-Hauptprojekt; Radar oben dennoch wenn `full`. Fahrplan **§ H.17**.
- **Arbeiter / Lock:** Standard **Action Center**; mit Lite-Messenger nur **Nachrichten + Tresor** über den entsprechenden Schalter; sonst „alle Kacheln“ für volles Kachel-Grid.
- **Kommandant (Lite-Messenger):** Volldashboard nur für **Boss**; du siehst Nachrichten und Tresor; Radar und weitere Kacheln im Bundle nicht freigeschaltet.

### 7.5 Code-Trennung: „nur Messenger“ vs. „Volldashboard“ (Next)

| Frage | Stand heute |
|--------|----------------|
| Kann ein Kunde **ohne** Projekt-Code nur den Messenger bekommen? | **Ja:** (1) **ZIP** `npm run bundle:messenger` → Lite-UI `ui/` ohne `frontend/`; (2) **Next** `npm run build:messenger` → `messenger-dashboard.tsx` ohne Imports von Lock/Monitor/Radar. Siehe **`docs/PRODUCT-MESSENGER-VS-PROJEKT.md`**. |
| Ist die **Next-App** byte-getrennt? | **Ja (2026-05-28):** `app/page.tsx` lädt per **dynamic import** nur `messenger-dashboard` **oder** `projekt-dashboard`. Schwere Views nur in `projekt-dashboard.tsx`. |
| **Boss „kommt dazu“** im Messenger — ist das dasselbe wie **Hauptprojekt-Volldashboard**? | **Nein.** Bei **`UI_VARIANT=messenger`** und Rolle **Boss** + Arbeitsbereich **`full`** sind nur die Kacheln **`chat`**, **`vault`**, **`boss`** erlaubt (`MESSENGER_BOSS_FULL_TILE_IDS`) — **kein** volles Hauptprojekt-Grid (Zugang/Überwachung/…). Das ist **Boss im Messenger-Ökosystem**, nicht „alles wie Hauptrepo“. |
| **„Messenger-Projekt“**-Schalter in Next (`morgendrot_workspace_tile_set` = **`messenger`**) | Nur **`chat`** + **`vault`** — Boss-Steuerungskachel **ohne** `full` nicht in dieser Whitelist; Boss erweitert den Funktionsumfang über **`full`** im **Lite-Deploy**, nicht über ein zweites Haupt-Dashboard. |
