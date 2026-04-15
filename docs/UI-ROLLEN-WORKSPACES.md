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

- **Ist:** `dashboard.tsx` blendet für **Arbeiter/Lock** zuerst **Action Center** ein; **Geräte-Radar** (`DeviceRadarView`) oben nur bei Arbeitsbereich **`morgendrot_workspace_tile_set` = `full`** — im Messenger-Bundle nur **`boss`**, im Hauptprojekt zusätzlich **`kommandant`** mit `full`. **Messenger + Boss + `full`:** Kachel-Whitelist nur **`chat`**, **`vault`**, **`boss`** (kein `lock`/`monitor`). **`workspace-projects-panel.tsx`** zeigt je Rolle einen kurzen Hinweis (inkl. Boss-Volldashboard im Bundle).
- **Lite-Messenger (`GET /api/status` → `uiVariant: 'messenger'`, entspricht `UI_VARIANT=messenger` am Backend):** Für alle Rollen **außer `boss`** ist das sichtbare Kachelset auf **Nachrichten + Tresor** (inkl. Notfall-Purge) begrenzt; Schalter **„Volldashboard“** (= **`full`**) ist für diese Rollen **deaktiviert**. **`boss`** kann **`full`** wählen (alle Kacheln + Radar). **`kommandant`** im Lite-Bundle: nur Messenger-Kacheln.
- **Offen:** Vollständige **Workflow-Oberfläche** (Spec § 3) ohne Kachel-Navigation — weiterhin Backlog.

## 6. Glossar: nicht verwechseln (**H.17**)

| Wort in der UI / im Team | Gemeint ist **nicht** | Gemeint ist |
|--------------------------|----------------------|---------------|
| **„Volldashboard“**-Button (Arbeitsbereich & Projekte) | Weder Chat-**Boss-Übersicht** noch „alle Einstellungen der Welt“ | Nur **`morgendrot_workspace_tile_set`** = **`full`**: Dashboard mit **vollem Kachel-Set**; **Geräte-Radar** erscheint **nur** in diesem Modus (s. `dashboard.tsx`). |
| **Volle Oberfläche** / „Alle Funktionen (Kacheln)“ (Arbeiter/Lock) | Arbeitsbereich **`full`** | Nur **`morgendrot_show_all_tiles`**: Action Center vs. Kachel-Grid umschalten. |
| **Chat → Boss-Übersicht** (`bossView`) | Radar oder Arbeitsbereich | Nur **Posteingang-API**: Boss sieht optional Traffic **an Kommandanten** (`/inbox` mit Flag). **Separater** Code-Pfad — **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**. |
| **Geräte-Radar** | Das gesamte „Volldashboard“ | Eine **Monitoring-Sektion** (`DeviceRadarView`, `/api/monitor-status`) **oben** auf dem **Haupt-Dashboard**, wenn **`full`** aktiv (und Rolle laut Deploy). |

**Produktlinien:** **Morgendrot Messenger** (Bundle) = schlanke Boss-Oberfläche + später weniger Kacheln als das **Hauptprojekt**; Hauptprojekt behält alle Kacheln für Entwicklung — Deploy/`UI_VARIANT` entscheidet.
