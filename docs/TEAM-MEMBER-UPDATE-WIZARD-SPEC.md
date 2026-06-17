# Team-Member-Update & Einstiegs-Wizard — Spec (P0–P2)

**Stand:** 2026-06-16 (§8 Transport LAN+IOTA ergänzt)  
**Status:** **Spec** — Implementierung startet mit **P0 Wizard-Skelett**; Wire + LAN-Zustellung **Phase P1**, Join-Request **P2**  
**Zweck:** Geführter **linearer** Erststart (Boss / Helfer / Wanderer) + **spontaner Helfer-Zugang** mit boss-signiertem Team-Update und Empfänger-Bestätigung — **ohne** Duplikat des Handoff-Export-Assistenten.  
**Verwandt:** `docs/EXPORT-ASSISTENT-REFERENZ.md`, `docs/GERAET-PROVISIONIEREN-WIZARD.md`, `docs/HANDOFF-UND-MODUS-ZIELBILD.md`, `docs/API-INITIAL-PROFILE.md`, `docs/PROVISIONING-PAYLOAD-CRITIQUE.md`, `docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`, `docs/TRANSPORT-AND-IOTA-LAYERS.md`, `docs/TELEGRAM-INTEGRATION-ZIELBILD.md` **§6** (Telegram-Alarmgruppe optional), `docs/ROADMAP-FAHRPLAN.md` **§ H.16** (Boss-LAN Ist), **§ H.36** (dieses Paket)

---

## 1. Leitprinzipien (verbindlich)

| Prinzip | Bedeutung |
|---------|-----------|
| **Orchestrieren, nicht duplizieren** | Wizard ruft bestehende Panels/APIs auf (Handoff, Seed-QR, Telefonbuch, Mailbox, Funk) — kein zweiter Export-Assistent. |
| **Linear für den Nutzer** | Feste Schritte, Fortschrittsanzeige, „Weiter / Zurück / Später“ — auch wenn intern mehrere Komponenten wechseln. |
| **IOTA = Persistenz** | Vollständiges Update **authoritativ** in Team-Mailbox (oder 1:1) — Quelle der Wahrheit, Offline/Fernhelfer. |
| **LAN = Zustellung** | Wenn Boss im gleichen Netz erreichbar: **schneller Push** über Boss-HTTP (bestehendes Relay) — **zusätzlich** zu IOTA, nicht stattdessen. |
| **Funk = Weckruf** | Kurzer Hinweis „Update seq N“ — **kein** volles Roster über LoRa. |
| **Boss = Autorität** | Join nur nach Boss-Freigabe; Updates boss-signiert oder Boss-ECDH-`.morg-pkg`. |
| **Empfänger bestätigt** | Jedes Gerät: Systemnachricht + **Ja / Nein** — kein stilles Überschreiben. |
| **Wanderer außerhalb** | Kein zentraler Boss-Sync; Solo-Wizard + Peering, kein Join-Request an Stab. |

---

## 2. Abgrenzung: Handoff vs. Team-Update vs. Wizard

| | **Handoff-ZIP** (Ist) | **Team-Member-Update** (Soll) | **Einstiegs-Wizard** (Soll P0) |
|--|----------------------|-------------------------------|--------------------------------|
| **Wann** | Boss provisioniert **vor** dem Feld | Helfer kommt **später** dazu oder Daten ändern sich | **Erster Start** oder „Einrichtung fortsetzen“ |
| **Inhalt** | `.env`, Capabilities, Partner-Adressen, README | **Ein** Mitglied (+ Metadaten), `seq`, Boss-Signatur | Geführte Schritte zu Identität, IOTA, Funk, Team |
| **Empfänger** | **Ein** neues Gerät | **Alle** bestehenden Team-Mitglieder (mit Bestätigung) | **Derselbe** Nutzer auf **eigenem** Gerät |
| **Transport** | ZIP / QR / optional IOTA-Handoff | IOTA Persistenz + LAN-Push + Funk-Ping | Lokal + Deep-Link; WLAN-QR → Basis-URL (§ H.16) |
| **Kontakte** | Partner-**Adressen** im ZIP; `initialProfile` **separat** | Merge in Telefonbuch wie `initialProfile.contacts[]` | Telefonbuch/Funk am Ende des Wizards |
| **UI-Ort** | Einsatzleitung → Helfer einrichten | Posteingang + Einsatzleitung (Join-Queue) | Dashboard / Erststart-Karte |

**Regel:** Wer **bereits** ein Handoff-ZIP hat → Wizard **überspringt** erledigte Schritte (Package, Mailbox, Rolle). Wer **neu** ohne ZIP startet → Helfer-Wizard endet mit Handoff-Import oder Join-Request.

---

## 3. Wire-Format

### 3.1 Text-Marker (Kanal: IOTA-Klartext-Mailbox)

Präfix analog `[[MORG_EMERGENCY_V1:…]]`:

```
[[MORG_TEAM_MEMBER_UPDATE_V1:{…json…}]]
```

**JSON-Envelope (Pflichtfelder):**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `v` | `1` | Schema-Version |
| `kind` | `"add"` \| `"update"` \| `"remove"` | Art des Updates |
| `seq` | number | Monoton pro Team (`boss` + `teamId`); Empfänger ignorieren `seq ≤ lastApplied` |
| `teamId` | string | z. B. `metadata.teamid` oder `deploymentChannelTag` — max. 64 Zeichen |
| `boss` | string | Boss-IOTA-Adresse (`0x` + 64 Hex) |
| `issuedAt` | number | Unix ms |
| `member` | object | Siehe §3.2 (bei `remove`: nur `address` Pflicht) |
| `sig` | string | Boss-Signatur über kanonisches JSON **ohne** `sig` (Ed25519/secp256k1 — Freeze in P1; bis dahin Boss-ECDH-`.morg-pkg` als Transport) |

**Größe:** Ziel **≤ 4 KiB** UTF-8 pro Update (ein Mitglied). Kein Multi-Member-Bulk in v1.

### 3.2 `member`-Objekt (Anschluss an `initialProfile.contacts[]`)

| Feld | Typ | Pflicht | Anmerkung |
|------|-----|---------|-----------|
| `address` | string | ja | `0x` + 64 Hex |
| `name` | string | ja | Anzeigename / Callsign (1–120 Zeichen) |
| `roleTags` | string[] | nein | z. B. `["Medic","Funker"]` — wie `API-INITIAL-PROFILE.md` |
| `meshNodeId` | string | nein | Meshtastic `!…` — Telefonbuch-Feld |
| `telegramChatId` | string | nein | falls bekannt |
| `roleId` | number | nein | 0–63, Informationszweck (Rechte weiter aus `.env`) |
| `handoffLabel` | string | nein | Bezeichnung aus Boss-Registry |

**Merge bei „Ja“:** `POST /api/contact-labels/apply-initial-profile` bzw. Client-Äquivalent — **ein** Kontakt aus `member` in `contacts[]`-Form.

### 3.3 Join-Request (Helfer → Boss)

```
[[MORG_TEAM_JOIN_REQUEST_V1:{…json…}]]
```

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `v` | `1` | |
| `requestId` | string | UUID / random id — Dedup |
| `applicant` | object | Gleiche Felder wie §3.2 `member` (mindestens `address`, `name`) |
| `teamId` | string | optional — wenn aus Boss-QR/Handoff bekannt |
| `boss` | string | Ziel-Boss-Adresse |
| `issuedAt` | number | Unix ms |
| `note` | string | optional, max. 500 Zeichen („Medic, Sektor Süd“) |

**Kein** Join-Request ohne erreichbare Boss-Adresse (aus Handoff, QR oder manuell).

### 3.4 Funk-Weckruf (Fallback, optional P3)

```
[[MORG_TEAM_UPDATE_PING_V1:{"v":1,"seq":42,"teamId":"…","boss":"0x…"}]]
```

Nur **Hinweis** — Empfänger holt volles Update per IOTA/Queue. **Kein** `member`-Body über LoRa.

---

## 4. UI — Boss-Einstiegs-Wizard (linear)

**Einstieg:** Erster Boss-Start, oder Einstellungen → „Einrichtung fortsetzen“.  
**Modus:** Vollbild oder mehrstufiges Sheet mit **Schritt X von Y**.

| Schritt | Titel (Nutzer) | Inhalt (orchestriert) | Überspringen wenn |
|---------|----------------|------------------------|-------------------|
| 1 | **Wer bin ich?** | Callsign, Rolle bestätigen, Kontakt-ID anzeigen | `.env` vollständig |
| 2 | **IOTA & Postfach** | Package-ID, Mailbox, RPC — Link „Erweitert“ | Handoff / Status grün |
| 3 | **Funk** | Meshtastic Node-ID, Kanal, Test-Hinweis | Node-ID gespeichert |
| 4 | **Team** | Team-Name / `teamId`, Team-Mailbox(en) | bereits in `.env` |
| 5 | **Erste Helfer** | Kurzlink **Helfer einrichten** (bestehendes Panel) | optional „Später“ |
| 6 | **Fertig** | Checkliste + Dashboard | — |

**Nicht im Wizard:** Seed-Generierung für **andere** (bleibt Helfer einrichten). **Nicht:** zweite Capabilities-Matrix — nur Link „Feineinstellung“.

---

## 5. UI — Helfer-Einstiegs-Wizard (Einsatz)

| Schritt | Titel | Inhalt | Überspringen wenn |
|---------|-------|--------|-------------------|
| 1 | **Handoff** | ZIP importieren **oder** „Noch kein ZIP — Join anfragen“ | Handoff bereits angewendet |
| 2 | **Wallet** | Seed-QR / Mnemonic (`GERAET-PROVISIONIEREN-WIZARD.md`) | Keys in Sitzung |
| 3 | **Ich im Team** | Callsign, Node-ID; optional **Telegram-Alarmgruppe** (Link/QR, „Später“ — **`docs/TELEGRAM-INTEGRATION-ZIELBILD.md`** §6.6) | Felder gesetzt |
| 4 | **Peering** | Boss-QR scannen / Kontakt-ID | Partner gesetzt |
| 5 | **Fertig** | Chat öffnen | — |

**Zweig „Spontan ohne ZIP“ (Schritt 1b):** Formular §3.3 → sendet Join-Request an Boss → „Warte auf Freigabe“.

---

## 6. UI — Wanderer-Wizard (Privat/Solo)

| Schritt | Titel | Inhalt |
|---------|-------|--------|
| 1 | **Privat starten** | Abgrenzung: kein Boss, kein Team-Sync |
| 2 | **Wallet** | Seed import / neu / App-PW |
| 3 | **Funk** (optional) | Node-ID |
| 4 | **Fertig** | Nachrichten |

**Kein** Join-Request, **kein** Team-Member-Update-Empfang über Boss-Kanal ( höchstens manuelles Peering mit Freunden).

---

## 7. Join-Request + Update-Flow (Einsatz)

```mermaid
sequenceDiagram
  participant H as Neuer Helfer
  participant B as Boss
  participant T as Team-Mailbox
  participant M as Bestehendes Mitglied

  H->>B: MORG_TEAM_JOIN_REQUEST_V1 (IOTA 1:1 oder Team)
  B->>B: Einsatzleitung: Pending-Liste
  B->>B: Freigeben / Ablehnen
  B->>T: MORG_TEAM_MEMBER_UPDATE_V1 (kind=add, seq++) — IOTA Persistenz
  B->>M: LAN-Push wenn Basis-URL = Boss erreichbar
  B->>M: optional 1:1-IOTA-Kopie
  Note over B,M: Funk: MORG_TEAM_UPDATE_PING_V1 nur seq
  M->>M: Posteingang: Systemkarte
  M->>M: Ja → Telefonbuch merge
  M->>M: Nein → verwerfen, seq merken
```

### 7.1 Zustände (Boss-Registry / lokal)

| Status | Bedeutung |
|--------|-----------|
| `join_pending` | Request eingegangen |
| `join_rejected` | Boss abgelehnt |
| `update_published` | `MORG_TEAM_MEMBER_UPDATE_V1` gesendet (`seq` bekannt) |
| `member_active` | Mindestens ein Mitglied hat „Ja“ bestätigt (Boss-Sicht) |

### 7.2 Systemnachricht im Posteingang (Empfänger)

**Titel:** `Neues Team-Mitglied`  
**Text:** `{name} ({callsign}) — Funk {meshNodeId oder „—“}`  
**Aktionen:** **`Daten übernehmen`** (Ja) · **`Ablehnen`** (Nein)  
**Hinweis:** „Von Einsatzleitung ({boss kurz}) · Update #{seq}“

Bei **Ja:** Merge §3.2 → Toast „Kontakt übernommen“.  
Bei **Nein:** Eintrag in `rejectedTeamUpdates[]` (localStorage), gleiches `seq` nicht erneut naggen.

### 7.3 Boss-UI (Einsatzleitung)

Neuer Block **„Beitrittsanfragen“** (P2):

- Liste pending Requests mit Vorschau
- **Freigeben** → erzeugt §3.1 + verteilt
- **Ablehnen** → optional kurze Antwort an Applicant (Klartext, kein neuer Wire-Typ in v1 nötig)

---

## 8. Transport: Persistenz vs. Zustellung

### 8.1 Zwei Achsen (nicht verwechseln)

| Achse | Frage | Regel |
|-------|--------|--------|
| **Persistenz** | Wo liegt die authoritative Kopie? | **IOTA-first** — Team-Mailbox (oder 1:1), boss-signiert, `seq` monoton |
| **Zustellung** | Wie kommt es schnell an? | **LAN-first**, wenn Boss erreichbar — **parallel** zu IOTA, nicht als Ersatz |

Formel: **„IOTA speichert, LAN liefert schnell.“**

### 8.2 Bereits im Repo (Ist — Onboarding + Chat-Relay)

| Baustein | Code / API | Nutzen heute | Nutzen Team-Update |
|----------|------------|--------------|-------------------|
| **LAN-IP ermitteln** | `GET /api/lan-install-urls`, `src/lib/lan-install-urls.ts` | WLAN-QR in Helfer einrichten | Boss-IP für Basis-URL |
| **Install-QR** | `frontend/lib/install-qr.ts`, `LanInstallQrPanel` | PWA + `http://<LAN>:3342` | Helfer im gleichen WLAN |
| **Boss-Relay HTTP** | Basis-URL → `/api/*` (`messenger-standalone-relay.ts`, `mailbox-send-hybrid.ts`) | Chat, Posteingang, Handshake | **P1:** dedizierter Team-Sync-Push |
| **Peering-QR mit LAN** | `peering-qr-actions.tsx` | RPC/Package ohne Handoff-ZIP | Wizard Schritt Peering |

**Lücke (Soll P1):** Kein Transport-Layer wählt automatisch **LAN vor IOTA** für `MORG_TEAM_MEMBER_UPDATE_V1`; kein UI „Zugestellt über …“.

### 8.3 Zustell-Hierarchie (Team-Member-Update)

Boss erzeugt **ein** Update (`seq++`), dann **parallel**:

| Prio | Kanal | Wann | Inhalt | Phase |
|------|--------|------|--------|-------|
| **0** | **Boss-LAN HTTP** | Client: Basis-URL zeigt auf Boss-LAN **und** `GET /api/status` OK | Volles Update — zunächst als Klartext-Nachricht über Relay; **P1b:** optional `POST /api/team-sync/push` | **P1** |
| **1** | **IOTA Klartext** | Immer (Persistenz) | `MORG_TEAM_MEMBER_UPDATE_V1` → Team-Mailbox | **P1** |
| **2** | **IOTA 1:1** | Keine Team-Mailbox | Gleiches Update an jedes Mitglied | **P1** |
| **3** | **Boss-Offline-Queue** | Boss ohne Netz | Retry IOTA + LAN wenn Basis wieder da | **P1** |
| **4** | **Funk Ping** | Kein LAN, IOTA verzögert | Nur `MORG_TEAM_UPDATE_PING_V1` (`seq`, `teamId`, `boss`) | **P3** |
| **5** | **Boss-`.morg-pkg`** | Signatur noch offen | ECDH-Envelope statt Klartext-Marker | **P1** (Fallback) |

**Nicht in dieser Hierarchie:** Sendepfad **Ad-hoc** = **BLE Handy↔Handy** (Platzhalter) — **≠ WLAN/LAN**. Siehe `docs/TRANSPORT-AND-IOTA-LAYERS.md`, Roadmap Ad-hoc-Backlog.

**mDNS/Bonjour:** **P2-Komfort** — für Einsätze reicht oft WLAN-QR + gespeicherte Basis-URL (§ H.16).

### 8.4 UI-Feedback (Boss + Empfänger)

Nach Freigabe / beim Empfang anzeigen (Beispiel):

```
Zugestellt: Lokales Netz ✓ · IOTA ✓ · Funk-Hinweis ✓
```

| Rolle | Anzeige |
|-------|---------|
| **Boss** (nach Freigabe) | Pro Kanal: OK / ausstehend / fehlgeschlagen; Retry-Button für IOTA-Queue |
| **Empfänger** (Systemkarte §7.2) | Zeile „Empfangen über: LAN“ oder „IOTA (Mailbox)“; bei nur Ping: „Funk-Hinweis — Update wird geladen …“ |
| **Wizard** (Helfer Schritt 1) | „Mit Boss im gleichen WLAN?“ → Basis-URL testen (bestehende Verbindungskarte) |

Persistenz-Gate: **Ja/Nein** erst, wenn Payload verifiziert (Boss + `seq`) — unabhängig vom Zustellkanal.

### 8.5 Erkennung „gleiches Netz“ (v1 pragmatisch)

| Signal | Bedeutung |
|--------|-----------|
| `getApiBase()` = `http://192.168.x.x:3342` (oder RFC1918) | LAN-Relay-Kandidat |
| `GET /api/status` erfolgreich | Boss erreichbar → LAN-Push versuchen |
| Keine Basis-URL / Standalone ohne Relay | Nur IOTA (+ später Funk-Ping) |
| Gleiche `teamId` + gleicher `boss` in Handoff | Team-Kontext (kein Auto-Discovery ohne QR) |

---

## 9. Implementierungsphasen

| Phase | Lieferumfang |
|-------|----------------|
| **P0** | Wizard-Skelett Boss / Helfer / Wanderer; Schritte + Skip-Logik; Deep-Links in bestehende Panels; kein neuer Wire |
| **P1** | `MORG_TEAM_MEMBER_UPDATE_V1` Parser + Posteingang-Systemkarte Ja/Nein + Merge; **LAN-Push** wenn Boss erreichbar; **IOTA** parallel; UI Kanal-Feedback §8.4 |
| **P2** | `MORG_TEAM_JOIN_REQUEST_V1` + Boss Pending-UI + Freigabe → Update; optional mDNS |
| **P3** | Funk-Ping + Offline-Queue-Boss; Boss-Signatur `sig` freeze |

**P0-Dateien (Vorschlag):** `frontend/frontend/components/onboarding/` — `BossOnboardingWizard.tsx`, `HelperOnboardingWizard.tsx`, `WandererOnboardingWizard.tsx`, `onboarding-progress-store.ts`.

---

## 10. Sicherheit & Grenzen

- **Spoofing:** Updates ohne verifizierte Boss-Herkunft (`boss`-Adresse + `sig` oder Boss-`.morg-pkg`) → **nur anzeigen**, nicht auto-mergen.
- **Replay:** `seq` monoton; alte Updates verwerfen.
- **Privacy:** Keine Seeds, keine Handoff-Passwörter im Team-Update-Wire.
- **Größe LoRa:** Nie volles `member`-JSON per Funk — nur Ping (§3.4).
- **Move/Chain:** Kein neues On-Chain-Struct in v1 — alles Mailbox-Klartext + lokales Telefonbuch.

---

## 11. Offene Punkte (Freeze vor P1-Code)

1. Exaktes Signatur-Schema (`sig`) — bis P1: Boss-ECDH-`.morg-pkg` als tragfähiger Transport.  
2. Eindeutige `teamId`-Quelle: `metadata.teamid` vs. `deploymentChannelTag`.  
3. Soll **Freigabe** automatisch den Neuling auch in **bestehende** Helfer-Handoffs (Partner-Liste) schreiben — oder nur Telefonbuch-Sync?  
4. **P1b:** Eigener Endpoint `POST /api/team-sync/push` vs. bestehendes `/api/send-plain` mit System-Marker?

---

**Nächster Schritt:** P0 Wizard-Skelett gemäß §9 — linear, orchestriert, ohne neuen Wire.
