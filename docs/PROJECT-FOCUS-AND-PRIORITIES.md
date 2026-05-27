# Ausrichtung, Prioritäten und Reihenfolge (Morgendrot Messenger)

**Zweck:** Ein gemeinsames Bild für Mensch und KI — **gegen Feature-Creep** und **falsche Parallelität**.  
**Stand:** **2026-05-20** — **Strategie:** IOTA **bleibt gekoppelt** (Boss-Deploy, Mailbox, E2EE online, Pfad 4, Outbox) — im Feld aber **nicht immer sichtbar** (`mesh-first`, `SIMPLE_MODE`). **Default-Transport = LoRa**; **Delayed LoRa → IOTA** = Phase B. Simple Mode = **weniger UI**, nicht ohne Chain. Kanonisch: **`docs/TRANSPORT-AND-IOTA-LAYERS.md`**.  
**Merge-Ritual (Messenger/Frontend):** **`TESTING.md`** § *Qualitätsritual vor Merge* + CI **`frontend-checks`**.

**Kanonische Umsetzung:** **`docs/ROADMAP-FAHRPLAN.md`** **§ C.0b**, **§ H.0**, **§ H.0-SIMPLE** — dieses Dokument definiert die **Leitplanke**; der Fahrplan füllt **Womit** und **Priorität**.

---

## 0. Produktversprechen (2026-05 — verbindlich)

| | |
|---|---|
| **Kernziel** | **Boss-geführtes Einsatz-Messenger-System** für trainierte Teams (Feuerwehr, THW, Bergrettung, kleine taktische Einheiten). |
| **Sekundär (Privat/Solo)** | Wanderer, Prepper, Familien — **eigener Modus**, kein Boss-Handoff; siehe **`docs/HANDOFF-UND-MODUS-ZIELBILD.md`**. |
| **Maßstab** | **Unter 20 Sekunden** vom Handoff zum funktionierenden Helfer-Gerät (Export-Assistent, Presets, Autofill). |
| **Nicht-Ziel** | Kein universeller Ersatz für **Signal**, **ATAK** oder **Meshtastic-Frontends** in deren Kerndisziplin. |

**Metapher für Endnutzer (Simple Mode):** **„Team-Postfach + persönlicher Chat“** — nicht „Chain + Package-ID + Relay + Expert“.

**Satz für Planer:** *IOTA gekoppelt, aber nicht immer sichtbar* — Boss trägt Chain/RPC/Mailbox; Helfer startet mit **Funk**; Archiv (Pfad 4 / später Delayed Upload) läuft nebenher oder nach Netz.

---

## 1. Transport- und Produkt-Schichten (architektonische Wahrheit)

**Kanonisch:** **`docs/TRANSPORT-AND-IOTA-LAYERS.md`** (vier Transportmodi, Delayed Upload, Offline-TX, Verschlüsselung pro Kanal).

### 1.1 Zustellung vs. IOTA-Plattform

| Schicht | Rolle | Helfer-UI (Simple) |
|---------|--------|---------------------|
| **LoRa / Meshtastic** | **Default-Zustellung** im Feld (Klartext oder Kanal-PSK) | Sichtbar: Funk, Offline-Queue |
| **IOTA / Chain** | **Plattform** (immer im Deploy) — Mailbox, E2EE online, Pfad 4, Outbox; **Delayed Upload** Phase B | UI-Expert ausgeblendet; Funktion bleibt (Pfad 4, Drain, Boss-Handoff) |
| **Team-Mailbox** | On-chain (**`create_team_mailbox`**) — Boss/Kommandant | Multi-Select nur Expert |
| **Handoff / Provisioning** | Boss bereitet PACKAGE_ID, RPC, Mailbox vor | Preset **mesh-first** = Funk-Default, **nicht** ohne IOTA-Backend |
| **Telegram** | Optional Zustell/Alarm (**§ H.26**) | Ausgeblendet im Simple Mode |

**Wichtig:** **„Mesh-first“** = **zuerst Funk im Composer**, nicht **„Produkt ohne IOTA“**. Nachrichten können **LoRa → Queue/Gateway → Tangle** (**`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**); **keine** volle signierte TX im LoRa-Frame (**§ H.3m**).

### 1.2 Env-Profile (Zielbild — schrittweise im Code)

Drei unabhängige Achsen (Handoff-Assistent und `env/roles/*` setzen sie):

| Variable | Werte | Bedeutung |
|----------|-------|-----------|
| **`DEPLOYMENT_PROFILE`** | `einsatz` \| `consumer` | Organisation vs. privat/Wanderer |
| **`TRANSPORT_PROFILE`** | `mesh-first` \| `iota-anchored` \| `iota-full` | **mesh-first** = Funk-Default in UI; IOTA-Expert-UI nur bei `iota-*` (Chain bleibt aktiv) |
| **`UI_VARIANT`** | `full` \| `messenger` | Volldashboard vs. schlanke Messenger-Oberfläche |
| **`SIMPLE_MODE`** | `true` \| `false` | **Erzwingt** UI-Gates serverseitig — **kein** versteckter Expert-Pfad per `localStorage` allein |

**Einsatz-Default (Minimal-Pfad):**

```env
DEPLOYMENT_PROFILE=einsatz
TRANSPORT_PROFILE=mesh-first
UI_VARIANT=messenger
SIMPLE_MODE=true
ROLE=messenger   # oder arbeiter — je Handoff-Preset
```

**Boss/Kommandant (Expert):**

```env
DEPLOYMENT_PROFILE=einsatz
TRANSPORT_PROFILE=iota-anchored
UI_VARIANT=full
SIMPLE_MODE=false
```

**Privat / Solo (Wanderer, Prepper — kein Einsatz-Boss):**

```env
DEPLOYMENT_PROFILE=consumer
TRANSPORT_PROFILE=mesh-first
UI_VARIANT=messenger
SIMPLE_MODE=true
# Selbst konfiguriert — nicht über Export-Assistent der Einsatzleitung
```

Kanonisch: **`docs/HANDOFF-UND-MODUS-ZIELBILD.md`**

**Implementierungsstand (2026-05-20):** `DEPLOYMENT_PROFILE`, `UI_VARIANT`, **`TRANSPORT_PROFILE`**, **`SIMPLE_MODE`** + **`GET /api/status`** = **Ist**. Frontend: **`messenger-role-capabilities.ts`**, Handoff-Presets + PSK-Hinweis, Chat-Gates, Offline-Banner, Pfad-4-Hinweis (Simple). **§ H.0-SIMPLE** = **weitgehend erledigt** (Fahrplan).

### 1.3 Abgrenzung zu § H.15 (Handy-first / Client-IOTA)

**§ H.15** bleibt gültig für **Teams, die IOTA aktivieren:** Client-Signatur, direkter RPC-Upload, optionaler Node als Relay.

**Neu (2026-05):** Handy-first = **Client signiert/puffert lokal**, Upload wenn Netz da (**§ H.15**). **UI:** Helfer startet mit **Funk**; IOTA läuft weiter (Boss-`.env`, Pfad 4, Outbox, geplant Delayed Upload).

Doku: **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**, **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**.

---

## 2. Rollen und Simple Mode

| Rolle | Modus | Sichtbar (Kern) | Ausgeblendet / Expert-only |
|-------|-------|-----------------|----------------------------|
| **Boss** | Expert (Default) | Einsatzleitung, Handoff, Vorlagen, Forensik | — |
| **Kommandant** | Expert | Team-Mailboxen, Team-Status, Kontakte | Boss-Modus-Kachel |
| **Arbeiter / Helfer** | **Simple (Pflicht)** | Chat, Funk, Team-Postfach, Offline-Queue | Package-ID, Relay, R1/R2, Pulse-IDs |
| **Wanderer** | **Simple (strikt)** | Chat, Funk, Notfall, Seed-Backup | Team-Mailbox multi, Chain, Einsatzleitung |

**Regel:** In `SIMPLE_MODE=true` darf **kein** Expert-Menü über Dev-Flags (`morgendrot.dev.expertTools`) erreichbar sein — Gates über **`GET /api/status`** → `uiMode`, `transportProfile`, Capabilities (**§ H.0-SIMPLE**).

---

## 3. Meshtastic-First (unverändert technisch)

**Meshtastic:** Baukasten — Standard-Firmware und -Ökosystem; **kein** großes eigenes Funkprotokoll, wenn vermeidbar (**`docs/MESHTASTIC-BUILDING-BLOCKS.md`**).

**Gerät:** Eine Basis (Heltec + Meshtastic + Morgendrot-Anbindung); Ausbaustufen (mit/ohne Host, Relais).

**Internet / Basis-Gateway:** CM4/LTE an der Basis; Vortrupp nur LoRa — **`hardware/README.md`**.

Verknüpfte Doku: **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**, **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`**.

### Frequenz-Strategie (868 / 433 / BOS)

| Stufe | Hardware | Recht | Nutzen |
|-------|----------|-------|--------|
| **868 MHz** | Standard | ISM | Schneller Start |
| **433 MHz** | Modul+Antenne | ISM | Höhle/Berg — mittelfristiges Ziel |
| **BOS** | Spezial | Genehmigung | Nur behördliche Einsätze |

---

## 4. Reihenfolge der Arbeit (verbindlich)

### Phase A — Simple Mode & Runtime (**weitgehend erledigt**)

**Keine neuen Move-Publishes** in dieser Tranche.

| # | Inhalt | Status |
|---|--------|--------|
| 1 | P0-Doku (`TRANSPORT-AND-IOTA-LAYERS`, dieses Dokument, § H.0-SIMPLE) | **Ist** |
| 2 | Config + Status-API | **Ist** |
| 3 | UI-Gates + Handoff (PSK-Hinweis, Presets) | **Ist** |
| 4 | Chat-Feinschliff (funk-Default, Offline-Banner, Pfad-4-Hinweis) | **Ist** |

### Block 2 — Feldtest (**als Nächstes**, 3–5 Tage)

**Schritt-für-Schritt:** **`docs/FELDTEST-BLOCK2-SIMPLE-HANDOFF.md`** (Boss ZIP → Arbeiter import → Chat-Checks).

```powershell
npm run env:role:boss    # Handoff-ZIP, dann Backend neu starten
npm run env:role:arbeiter # Handoff importieren, Chat prüfen
```

| Flow | Notiz |
|------|--------|
| Boss → Handoff-ZIP | Export-Assistent, PSK, optional README Archiv |
| Arbeiter → import | **Einstellungen → Handoff importieren** (ZIP ~3 KB) — **`docs/HANDOFF-IMPORT-UX.md`** |
| Profil-Badge / Theme | **`docs/HANDOFF-PROFILE-UX.md`** |
| ZIP verschlüsseln (`handoff.morg.enc`) | **Ist** — Export-Assistent Checkbox; IOTA optional Backlog |
| Chat Simple | funk-Default, Offline-Streifen, Pfad-4-Hinweis, kein Expert |
| Handshake 2. Wallet | Spätere Tests #1 |
| Team beitreten | #3 |
| PWA L1–L5 | **`docs/PWA-MANUAL-CHECKS.md`** |

**Keine** parallelen großen Refactors; **keine** neuen Expert-Features.

### Block 3 — Phase B (**erst danach**)

Delayed LoRa → IOTA (Pfad 4 ausbauen), Meshtastic-Stabilität + SOS, Heltec/Firmware — **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**.

Produkt-/Einsatz-UX kann **§ A**-Feinarbeit überholen, wenn Abgabe drängt.

### Phase B — danach: Mesh-Kern + LoRa→IOTA-Brücke

- Zuverlässiges Senden/Empfangen (Web-BT, Klartext, S-ARQ).
- **Delayed LoRa → IOTA** (**`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**) — **bleibt Kern**; Gateway/MQTT + Queue.
- Optional **`MORG_TX_RELAY_V1`** — signierte Submit-Artefakte **nutzlastarm** über Funk.
- **Telegram Phase B2** Long Polling (Ist-Code) — Spez **`docs/TELEGRAM-INTEGRATION-ZIELBILD.md`**.

### Phase C — später (bewusst zurückgestellt)

| Thema | Hinweis |
|-------|---------|
| Volle Chain-of-Custody pro Hop | Optional nach Gateway-MVP |
| IOTA-Makros → LoRa | **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`** — nach Phase B |
| ATAK/CoT | Backlog **§ H.9** — kein Kernversprechen |
| Zentralserver / globales Relay | **§ I** — nicht vor Phase B verkaufen |

---

## 5. Sicherheit (§ H.23 — keine Halbheiten)

| Option | Entscheidung |
|--------|--------------|
| **A — Status quo** | ECDH + AES-GCM, **transport-strong, kein Forward Secrecy** — mit **sichtbarer Stufen-Kennzeichnung** im Chat |
| **B — Double Ratchet** | Nur **1:1 Direct-Chat**, nicht über LoRa/Chain — **Go/No-Go** bis **2026-Q3** (Fahrplan **§ H.23**) |

**Bis zur Entscheidung:** Keine Marketing-Formulierung „Signal-Niveau“. Siehe **`docs/HANDSHAKE-PERSISTENZ-UND-H23.md`**, **`SECURITY-RATING.md`**.

---

## 6. Warnsignal Feature-Creep

**Regel:** Neue Ideen in **Spec schreiben** ist ok; **implementieren** nur gemäß **Phase A → B → C** und entlang des **Einsatz-Default-Pfads**.

**Explizit zurückgestellt:** Paralleler Ausbau IOTA + LoRa + Telegram + Discord + ATAK als **gleichwertige** Nutzerpfade.

**Produkt schneiden:** Der **Default-Einsatz-Pfad** (Mesh + Team-Postfach + Handoff) hat **Vorrang** vor vollem Hybrid in der UI.

---

## 7. Kurz-IST (Orientierung)

- **`chat-view.tsx`:** Verdrahtung → **`use-chat-view-core`** → **`ChatViewMainContent`**.
- **Rollen-Feldtest:** `npm run dev:role:*`, **`docs/TEST-ROLLE-PROFILES.md`**.
- **Export-Assistent:** **`BossHandoffExportPanel`**, Presets **`frontend/frontend/lib/handoff-export-presets.ts`**.
- **Bundle:** Quelle **`src/`** / `frontend/` — nicht manuell in **`exports/`** pflegen.

---

## 8. Verweise

| Thema | Dokument |
|-------|----------|
| Transport, Delayed Upload, Offline-TX | **`docs/TRANSPORT-AND-IOTA-LAYERS.md`** |
| Simple Mode, Wanderer, Einsatz-Default | **`docs/ROADMAP-FAHRPLAN.md` § H.0-SIMPLE** |
| Fahrplan, H.15, H.23, H.26 | **`docs/ROADMAP-FAHRPLAN.md`** |
| Wanderer-Abgabe | **`docs/WANDERER-STANDALONE-BUNDLE.md`** |
| Rollen-Workspaces | **`docs/UI-ROLLEN-WORKSPACES.md`** |
| Telegram Long Polling | **`docs/TELEGRAM-INTEGRATION-ZIELBILD.md` § Phase B2** |
| Test-Rollen | **`docs/TEST-ROLLE-PROFILES.md`** |

---

*Leitplanke 2026-05: **IOTA-gekoppelt**, **Funk-Default im Feld**, **Delayed LoRa → Tangle bleibt**, **Simple Mode** = UI — kein universelles Konkurrenz-Produkt.*
