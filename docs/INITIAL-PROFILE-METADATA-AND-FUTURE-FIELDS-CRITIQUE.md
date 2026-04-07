# `initialProfile`: Metadata-Container & „Einsatz-Puzzle“ — kritische Einordnung

**Zweck:** Die Idee **„Sonstige“ / `customAttributes` / `metadata`** sowie fünf Erweiterungen (Präsenz, Sichtbarkeit, SOS, Waypoints, Ablauf) **gegen Ist-Architektur** prüfen — **was gehört wohin**, was ist **Marketing vs. Umsetzung**, und wie bauen wir **Zukunftsschutz** ohne Scheinsicherheit.

**Verwandt:** **`docs/API-INITIAL-PROFILE.md`**, **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`**, **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`**, Roadmap **`docs/ROADMAP-FAHRPLAN.md` § H.3h**.

---

## 1. Der Metadata-Container (Key-Value)

### Stärke

- **Erweiterbarkeit** ohne sofort jedes neue Feld als **Pflicht-Spalte** in Move, DB oder UI-Typen zu gießen.
- Komplexe Werte lassen sich als **JSON-String** in einem Metadata-Wert ablegen (z. B. `waypoints_json`), bis es eine **Version 2** mit festem Schema gibt.

### Grenzen und Risiken (nicht wegdiskutieren)

| Risiko | Einordnung |
|--------|------------|
| **„Die App lernt später automatisch“** | **Nein** — jedes neue Feld braucht **explizite** Client-Logik (Anzeige, Sortierung, Rechte). Metadata ist nur **Transport**, keine Magie. |
| **Sicherheit** | Metadata ist **Klartext** im Provisioning-Paket — **keine** Geheimnisse, keine medizinisch sensiblen Daten ohne separates Verschlüsselungskonzept. |
| **Validierung** | Völlig offene Objekte sind **Angriffsfläche** (Größe, tiefe Verschachtelung). **Ist:** Server akzeptiert **`metadata` nur als flache `Record<string, string>`** (v1) mit Grenzen — siehe **`src/initial-profile-provision.ts`**. |
| **Quelle der Wahrheit** | **Sichtbarkeit / wer darf wen sehen** erfordert **Policy + Durchsetzung** (API filtert, oder Chain). Nur ein Feld `visibilityLevel` im JSON **ohne** Server-Logik = **UI-Hinweis**, kein Schutz. |

### Struktur-Empfehlung (Konzept)

| Block | Inhalt | Ist-Stand |
|-------|--------|-----------|
| **Core** | `version`, ggf. `validUntil` | API validiert |
| **Team** | `contacts[]` | API validiert |
| **Taktik / Kanal** | `deploymentChannelTag` | API validiert |
| **Versicherung** | `metadata` (flach, string values) | API validiert (v1) |

---

## 2. Checkliste: fünf Punkte — richtige Schicht

### 2.1 Status / Präsenz / Akku (`lastSeen`, `batteryLevel`)

- **Problem:** „Sanitäter“ in der Kontaktliste sagt **nichts** über **Jetzt online**.
- **Falsch:** Diese Werte nur in **`initialProfile`** beim Provisioning — sie wären **sofort veraltet**.
- **Richtig:** **Laufzeit-Pfad** — Heartbeat, Streams, Meshtastic-Status, ggf. **`/api/monitor-status`**, Mesh-Metadaten in **`/api/contact-label** (bereits Mesh-Felder).  
- **Fahrplan:** Eigene Arbeitspakete (Events, TTL, Datenschutz) — **nicht** nur ein Feld im statischen Profil.

### 2.2 Gruppen-Hierarchie / Sichtbarkeit (`visibilityLevel`, `teamId`)

- **Nutzen:** Filter in der UI, Einsatzorganisation.
- **Ohne Durchsetzung:** Nur **Labels**; jeder Client könnte alle Kontakte sehen, wenn die Daten lokal liegen.
- **Mit Durchsetzung:** Server-seitige Filterung geteilter Kontakte, oder getrennte Provisioning-Pakete pro Rolle — **Architekturentscheid**.

### 2.3 Nachrichten-Priorität / SOS (`isEmergency`)

- **Schicht:** **Nachrichten-Header / Wire-Format / Mailbox-Events** — **nicht** `initialProfile`.
- **Ist:** Verschlüsselte Nutzlast und App-Logik (Pinning, Vibration) — siehe **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**, Move-Events.

### 2.4 Karten-Anker / Waypoints (`sharedWaypoints`)

- **Passt** zu **Provisioning** als **Konfiguration** (Koordinaten, Labels) — entweder:
  - **Strukturiert** in einer späteren Schema-Version, oder
  - **Konvention:** Key in **`metadata`**, z. B. `shared_waypoints` = JSON-String — bis die App eine feste UI dafür hat.

### 2.5 Ablaufdatum (`validUntil`)

- **Sinnvoll** im Profil: **Unix-Zeit** (ms), nach der Clients Kontakte **ausblenden oder löschen** sollen.
- **Grenze:** **„Selbstzerstörung“** ist **clientseitig ehrlich** — ein manipulierter Client kann ignorieren. Für echte **Zwangslöschung** bräuchte es verschlüsselte Daten mit serverseitigem Schlüsselabzug o. Ä. — **nicht** nur JSON.

**Ist (API):** optionales Feld **`validUntil`** (Zahl) wird **mitvalidiert** und durchgereicht; **Umsetzung** in Lite-UI/Next (Timer, Purge) = **Backlog**.

---

## 3. Zusammenfassung „Zukunftsschutz“

- **Metadata-Container (flach, begrenzt)** = pragmatische **Versicherung** für vergessene Felder **ohne** sofort alle UI-Pfade zu bauen.
- Die **fünf Checklistenpunkte** sind zu **teilen** in: **statisches Profil**, **Laufzeit-Sync**, **Nachrichtenprotokoll**, **Policy/Security** — alles in **einem** JSON zu vereinen wäre **falsch gekoppelt**.

---

*Stand: Abgleich mit `initial-profile-provision.ts`, Messaging-Architektur, Roadmap § H.3h.*
