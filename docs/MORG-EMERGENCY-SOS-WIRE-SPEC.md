# MORG_EMERGENCY_V1 / SOS — Zielbild (LoRa, Priorität, Basis, IOTA)

**Zweck:** Kanonisches **Zielbild** für einen **dedizierten Notfall-Sendepfad**: sofortiger SOS über LoRa/Mesh, **höchste App-Priorität**, kompaktes Wire-Format, **Basis** erkennt und **priorisiert** Verarbeitung (Queue, IOTA-Verankerung, optionale Webhooks).  
**Stand:** 2026-06-16 (Produktentscheidung **§9** Zivil-SOS Klartext-only) · zuvor 2026-03-28  
**Status:** **Spec / Phase B** — noch **kein** verbindliches Byte-Layout in allen Clients; Abgleich mit **`emergency-binary-wire.ts` (v2, Byte `0x02`)** bei Freeze.  
**Abgleich § H.3n (2026-03-29, Schreibtisch):** **`EmergencyBinaryWireVersionByte = 0x02`** — **`src/shared/opcodes.ts`**; **`buildEmergencyBinaryV2` / `tryParseEmergencyBinaryV2`** — **`src/shared/emergency-binary-wire.ts`**. **Text §7:** **`prependMorgEmergencyV1Marker` / `stripLeadingMorgEmergencyV1Marker`** — **`src/shared/morg-emergency-v1-text.ts`** + Spiegel **`frontend/frontend/lib/morg-emergency-v1-text.ts`** (Präfix unverändert). **B2 Retry:** **`sosMeshRetryDelayMs`**, **`SOS_MESH_RETRY_DEFAULTS.maxAttempts: 5`**, **`initialDelayMs: 12_000`** — **`src/shared/morg-sos-mesh-retry.ts`** + **`frontend/frontend/lib/morg-sos-mesh-retry.ts`** (Vitest: **`morg-sos-mesh-retry.test.ts`**). **§8.2 Mesh-Ack:** **`buildMorgSosAckV1Wire` / `tryParseMorgSosAckV1Plaintext`** — **`frontend/frontend/lib/morg-sos-ack-wire.ts`** (Vitest: **`morg-sos-ack-wire.test.ts`**); Node-Spiegel **`src/shared/morg-sos-ack-wire.ts`**. **§ 8.1 Gateway-ACK:** Command **`/sos-gateway-ack`** — **`src/messenger-nest/messenger-command-handler.ts`** (`logger.warn`, kein Mailbox-Write); Frontend **`sosGatewayAckDigest`** — **`frontend/frontend/lib/api/chat-commands.ts`**. **Ausgehende Kennzeichnung / Logs:** **`wireKindForLog` → `emergency_v1`**, **`morg.sos.outgoing`** — **`src/messenger-nest/messenger-chain-wrap.ts`**. **UI-Send:** **`priorityFlash`** bei SOS — **`use-chat-view-handle-send`** → **`sendMeshV2WireBurst`** (**`chat-view-mesh-send.ts`**).  
**Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md`** **§ H.3n**  
**Verwandt:** **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`** (**§ H.3m**), **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**), **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**, **`docs/MESHTASTIC-BUILDING-BLOCKS.md`** §3, **`src/shared/opcodes.ts`** (`MacroPriorityClass.Flash`), **`src/shared/emergency-binary-wire.ts`**, **`docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md`** (SOS ≠ `initialProfile`).

**Nutzer-Kurzfassung (UI):** Was der rote **„SOS — Hilferuf (Text)“**-Button und die **SOS-Sprache** in der PWA tun, steht in **`docs/MESSENGER-SPRACHAUFNAHME.md`** → Abschnitt *„SOS-Hilferuf: Text vs. Sprache“* (Umschlag `MORG_EMERGENCY_V1`, Priorität, was **nicht** passiert: kein automatischer 112-Ruf).

---

## 1. Idealzustand (Produkt)

| Anforderung | Zielbild |
|-------------|-----------|
| **SOS auslösen** | Physischer SOS (Hardware) **oder** prominenter **SOS-Button** in der App; optional getrennt **„SOS Text“** und **„SOS Sprache“**. |
| **Sofort** | Beim Auslösen wird **unmittelbar** ein **Emergency-Paket** erzeugt und in die **Sendewarteschlange** mit **höchster Priorität** eingereiht — **vor** Bild-Chunks und vor **deferierbarem** Routine-Traffic (**`MacroPriorityClass.Flash`** in **`opcodes.ts`**). |
| **Wiederholung** | **Automatische Wiederholung** mit **Backoff + Jitter** (z. B. Start 10–15 s, dann verlängern), bis **Bestätigung** von der Basis (oder Timeout / manueller Stopp) — siehe §4 (Duty Cycle). |
| **Inhalt (kompakt)** | Festes, **versioniertes** Layout: mindestens **Zeit** (kompakt), **Position** (falls verfügbar), **Kurzstatus** / Hash, **Nonce/Seq** gegen Replay, **Absender-Fingerprint** (wie heute Emergency v2: SHA-256 über kanonische Adresse) **oder** gleichwertiges Verfahren; optional **kurzer Klartext** nur wenn Policy + Airtime es erlauben. |
| **Kennzeichnung** | Explizites **Emergency-Flag** / Wire-Typ, damit **Basis und UI** eindeutig wissen: *Hilferuf*, kein normaler Chat. |
| **Basis** | Gateway erkennt Typ → **Priorität in der Upload-/Relay-Queue** → **IOTA-Verankerung** nach **`LORA-IOTA-DELAYED-UPLOAD-SPEC`** + optional **Webhook/SMS** an **konfigurierte** Empfänger (**`NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**). |

**Name:** Arbeitstitel **`MORG_EMERGENCY_V1`** (textueller Marker **`[[MORG_EMERGENCY_V1:…]]`** und/oder **Binär-Subtyp** unter dem bestehenden Emergency-v2-Header — **ein** Layout wird in Phase B **eingefroren**).

---

## 2. Kritische Korrekturen (Technik & Erwartung)

### 2.1 „Heltec priorisiert SOS vor allem“

**Meshtastic** priorisiert **nicht** automatisch nach Morgendrot-Klassen. **Vorrang** entsteht in der **Morgendrot-App** (und ggf. **minimal** in eigener Firmware nur wenn nötig): Sendequeue sortiert **`Flash`** vor Bildfragmenten; **Burst-Pausen** für große Nutzlasten dürfen **Emergency** nicht verhungern lassen. Quelle: **`docs/MESHTASTIC-BUILDING-BLOCKS.md`** §3.

### 2.2 Größe und „Signatur“

- **LoRa/Mesh:** weiterhin **≈200–237 B** pro Airtime-Frame (siehe **`LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`**).  
- **Keine** vollständige **IOTA-PTB-Signatur** über Funk. On-Air: **kurzer** kryptografischer Anhang (z. B. **Fingerprint**, **MAC** über Payload mit Geräteschlüssel — Spec) **oder** nur **Hash** + Verifikation an der Basis nach Entschlüsselung.  
- **Volle** IOTA-Transaktion baut weiterhin die **Basis** mit Wallet/Vault.

### 2.3 Duty Cycle (EU868 & Co.)

**Feste** Wiederholung alle 10–30 s kann **schnell** gegen **regionales Duty-Cycle** laufen und das Gerät **sperren** oder das Mesh **fluten**. **Pflicht:** exponentieller Backoff, **Jitter**, **max. Airtime-Budget** pro Stunde, **Stop** nach Ack oder Nutzerabbruch — in Spec/Implementierung **messbar** machen.

### 2.4 SOS Sprache

**Realistisch:** Kurzaufzeichnung → **Opus** → entweder (a) **nur Kryptohash** + Metadaten im **Emergency-Frame**, Audio **gesondert** mit niedrigerer Priorität / nachgelagert, oder (b) **sehr kurzer** Clip, der in **ein** Frame passt (selten praktikabel). **Kein** „voller Sprachclip = ein SOS-Paket“ ohne Chunk-Konzept.

---

## 3. Abgrenzung zu normalen Nachrichten

| Thema | Empfehlung |
|--------|------------|
| **Normaler Chat / GPS-Beacon** | Standard: **kein** automatischer **IOTA-Pflicht-Upload** nur wegen LoRa-Empfang — **Policy** „nur bei expliziter Nutzerwahl / Einsatzprofil“ **Zielbild** für Phase B; **Ist-Code** kann abweichen → vor Release **UI + Doku** angleichen. |
| **Nur Emergency** | **Automatisch** priorisierte **Basis-Verarbeitung** + **automatische** Verankerung **nur** für als **Emergency** markierte Vorgänge (konfigurierbar, **Rate-Limits**, **Audit**). |

So bleibt klar: **Nicht jede LoRa-Nachricht ist ein Hilferuf.**

---

## 3.1 Abgrenzung: normaler Chat vs. SOS

| | **Normaler Chat** | **SOS — Hilferuf** |
|---|-------------------|---------------------|
| **Verschlüsselung** | Optional (Online E2E mit Handshake) | **Immer Klartext** (Zivil-Default, **§9**) |
| **Ziel** | Vertrauliche Kommunikation | **Maximale Reichweite** — gehört werden |
| **UI** | Composer + Schloss / ⋮-Menü | **Eigener roter Button** + Bestätigungs-Dialog |
| **Wire** | Standard-Chat-Wires | **`MORG_EMERGENCY_V1`** + Klartext-Body |

Verschlüsseltes SOS ist **kein** Simple-Mode-Angebot. Optionaler **OPSEC-/Militär-Modus** (verschlüsselter Hilferuf) = **Backlog**, separates Einsatzprofil — **§9.4**.

---

## 4. UI-Varianten (sinnvoll)

**Kanon (2026-06-16):** Details und Produktregeln in **§9**. Kurz:

1. **SOS-Dialog/Sheet** (Ziel-UI): Text + automatisch **Lage-Bundle** (Name, Ort, IDs) — alles **Klartext**; Sendewege **alle erreichbaren** (Funk, Online, Telegram wenn konfiguriert); **kein** Verschlüsselungs-Schalter.
2. **SOS Text (Ist):** Freitext + Bestätigung → ein Sendepfad wie Composer — wird durch **§9**-Dialog ersetzt.
3. **SOS Sprache:** Kurzaufzeichnung → Opus → Notfall-Marker; Wire **§2.4**.
4. **Physische Taste:** Backlog Hardware; Software-API = **`MORG_EMERGENCY_V1`**.

---

## 5. Basis-Verhalten (kurz)

1. Parser erkennt **`MORG_EMERGENCY_V1`** / Emergency-v2 mit Notfall-Subtyp.  
2. Eintrag in **priorisierte** Outbox (**vor** normalem Delayed-Upload-Backlog).  
3. Bei Uplink: **PTB** bauen (Manifest/Ciphertext gemäß **`LORA-IOTA-DELAYED-UPLOAD-SPEC`**) + optional **Webhook**.  
4. **Ack** an den Sender (Mesh-Rückweg oder nächster Kontakt): **Wiederholung stoppen**.  
5. **Dedup / Idempotenz:** **`canonical_msg_ref`** bzw. **Emergency-Nonce** — **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**.

---

## 6. Umsetzungsphasen (ohne Parallel-Chaos)

| Phase | Inhalt |
|-------|--------|
| **B1** (**Ist, minimal**) | App: **SOS Text** + **SOS Sprache** mit Bestätigungs-Dialog; Klartext-Präfix **`[[MORG_EMERGENCY_V1:{…}]]`** (`src/shared/morg-emergency-v1-text.ts`, `MorgTextWireMarker.EMERGENCY_V1` in `opcodes.ts`); Mesh-v2-Burst mit **`priorityFlash`** (keine Inter-Packet-Pause = App-seitiges **`MacroPriorityClass.Flash`**-Äquivalent, Meshtastic priorisiert nicht von selbst). **Kein** automatisches IOTA-Mirror-Flag bei SOS (Delayed Upload wird unterdrückt). **Keine** automatische Wiederholung/Backoff. Basis: **Erkennung + `logger.warn`** beim verschlüsselten/ Klartext-Versand (`messenger-chain-wrap.ts`). **Noch keine** echte priorisierte Outbox-Queue auf dem Server. |
| **B2** (**Ist**) | **Text-Marker eingefroren** — siehe **§7**. App: **Mesh-SOS** bei Fehlschlag **automatische Wiederholungen** mit **Backoff + Jitter** (`src/shared/morg-sos-mesh-retry.ts`, Spiegel `frontend/frontend/lib/morg-sos-mesh-retry.ts`; max. 5 Versuche). **Ack-gestoppt:** Nach jedem fehlgeschlagenen Funk-Versuch wird **`/send`** (verschlüsselte Mailbox) versucht — **gelingt die Chain-Mailbox**, gilt die Nutzlast als **Basis erreicht** und **weitere Funk-Wiederholungen** für diesen Snap **entfallen** (Airtime). **Opt-out:** `localStorage` **`morgendrot.sosRetryStopOnServerAck`** = **`0`**. Bereits per Ack gesendete Snaps werden beim **B2-Spiegel** nicht erneut eingestellt. Nach **erfolgreichem** reinem Funk-SOS (ohne Ack-Abbruch): **automatischer IOTA-Mailbox-Spiegel** wie zuvor; **Opt-out:** **`morgendrot.sosIotaMirror`** = **`0`**. **Anzeige:** **`normalizeChatMessageContentForDisplay`** — konsistentes **`[SOS]`**; Vitest deckt u. a. **Kompakt-Bild-** und **MF1-**Wires ab (keine Zerstörung der Chunk-Anzeige). **`lora-bridge`:** unverändert. **Lücke vs. §9:** SOS kann noch über **verschlüsselten** Online-Pfad laufen, wenn Composer-Schloss aktiv — **Ziel:** SOS erzwingt **`encrypted=false`** + **`/send-plain`**. |
| **B2.5** (**Ziel, UI**) | **SOS-Sheet** (§9): Lage-Bundle, **Fan-out** über alle erreichbaren Wege, Klartext-only, ein Bestätigungsdialog mit Transparenz-Hinweis. Kein Wire-v2-Zwang in der ersten Scheibe. |
| **B3** | Basis: dedizierter Parser-Pfad + **priorisierte** Outbox + IOTA + optional Notify. |
| **B4** | Wiederholung + Ack + Duty-Cycle-Tests im **Feld**. |

**Nicht** parallel: komplette **H.1b**-Umstrukturierung und **B1** in derselben Woche ohne Absprache (**`ROADMAP-FAHRPLAN.md`** **§ C.0b**).

---

## 7. Eingefrorenes Textlayout `MORG_EMERGENCY_V1` (B2)

**Status:** eingefroren für **Klartext-in-UTF-8 vor AES-GCM** (Mesh v2 innerer Text / Mailbox-Plaintext-Hülle). Änderungen nur mit **Versionsfeld** `v` > 1 und Migrationspfad.

**Präfix (exakt):** `[[MORG_EMERGENCY_V1:`  
**Suffix der Kopfzeile:** `]]`  
**Dazwischen:** ein JSON-Objekt **ohne** eingebettete Zeilenumbrüche im Kopf (eine Zeile), UTF-8.

**Pflichtfelder (v = 1):**

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `v` | `1` | Schemaversion |
| `k` | `"t"` \| `"v"` | Hilferuf **Text** bzw. **Sprache** (Audio-Wire folgt nach `\n`) |
| `ts` | Zahl | Unix-Zeit in ms (Absendezeitpunkt laut Gerät; nicht vertrauenswürdig, nur Hinweis) |

**Beispiel-Kopf:** `[[MORG_EMERGENCY_V1:{"v":1,"k":"t","ts":1710000000000}]]`  
**Optionaler Body:** ein `\n`, danach beliebiger bestehender Chat-Wire (Klartext, z. B. `MORG_AUDIO_V1`).

**Parser:** `stripLeadingMorgEmergencyV1Marker` / `prependMorgEmergencyV1Marker` in **`src/shared/morg-emergency-v1-text.ts`** (Node) und **`frontend/frontend/lib/morg-emergency-v1-text.ts`** (Browser, identischer Präfix).

---

## 8. Optionale Acks (B2+): Basis-Gateway und Mesh-Peer

**Ziel:** Funk-Wiederholungen stoppen, sobald die Basis die Nutzlast **gesehen** hat (ohne vollen Mailbox-Write), und optional dem Sender ein **LoRa-Rücksignal** geben, dass ein Peer den Hilferuf **quittiert** hat.

### 8.1 Leichtes Gateway-ACK (`/sos-gateway-ack`)

- **API:** Messenger-Command **`/sos-gateway-ack`** mit einem Argument: **64 Zeichen** hex (klein), SHA-256 über **UTF-8** des **kompletten** SOS-Wire-Strings (derselbe String, der auch per Mesh v2 geburstet wird).
- **Server:** Prüft Connect/`canSend` analog **`/send`**, schreibt **nicht** in die Mailbox — nur **`logger.warn`** (Basis „hat gesehen“).
- **App:** Standard **aus**. Aktivierung: `localStorage` **`morgendrot.sosUseDedicatedGatewayAck`** = **`1`**. Wenn aktiv und **`morgendrot.sosRetryStopOnServerAck`** ≠ **`0`**, wird nach Funkfehlern **vor** dem verschlüsselten **`/send`** versucht, per Digest zu bestätigen; bei Erfolg entfallen weitere Funk-Wiederholungen für diesen Snap.

### 8.2 Mesh-Ack `MORG_SOS_ACK_V1`

- **Präfix:** `[[MORG_SOS_ACK_V1:` … `]]` — JSON-Hülle mit u. a. **`d`** = SHA-256-Hex (64) über den **Klartext** des empfangenen **`MORG_EMERGENCY_V1`**-Inhalts (wie beim Gateway-ACK: kanonischer UTF-8-String). Implementierung: **`src/shared/morg-sos-ack-wire.ts`** / **`frontend/frontend/lib/morg-sos-ack-wire.ts`**, Marker **`MorgTextWireMarker.SOS_ACK_V1`** in **`src/shared/opcodes.ts`**.
- **UI-Anzeige:** `normalizeChatMessageContentForDisplay` → **`[SOS-Bestätigung · …<letzte8>]`**.
- **Sender wartet auf Ack:** `localStorage` **`morgendrot.sosWaitMeshAckMs`** = Zahl in ms (**`0`** = aus; Wert wird in der App gecappt). Nach erfolgreichem Mesh-Burst kann die Erfolgsmeldung einen Zusatz **„Funk-Empfang per [SOS-Ack] bestätigt.“** enthalten.
- **Auto-Antwort (Empfänger):** `localStorage` **`morgendrot.sosAutoMeshAckReply`** = **`1`** — bei eingehendem entschlüsseltem **`MORG_EMERGENCY_V1`** wird optional ein **`MORG_SOS_ACK_V1`**-Burst zurückgesendet (Dedup pro Digest, begrenzte Fenster).

---

## 9. Produktentscheidung: Zivil-SOS (**Klartext-only**, Reichweite zuerst)

**Status:** **Entschieden** 2026-06-16 · **Fahrplan § H.3n** · **Backlog UI § B2.5**

### 9.1 Leitprinzip

Im **zivilen Notfall** (Simple Mode, Helfer, Berg, Unwetter, „brauche Hilfe“) gilt:

> **SOS sendet absichtlich offen und unverschlüsselt**, über **so viele Wege wie verfügbar**, mit den **wichtigsten Erreichbarkeits-Infos** — damit möglichst **schnell und weit** Hilfe ankommt.

Das widerspricht **nicht** dem normalen Chat: Verschlüsselung bleibt dort optional. SOS ist ein **eigener Modus**, kein Schloss im Composer.

**Kein** automatischer **112**-Ruf — organisatorische Brücke siehe **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**.

### 9.2 Was SOS standardmäßig enthält (Lage-Bundle)

Automatisch aus Session, Telefonbuch und Gerät — **Klartext**, vom Nutzer im Dialog bestätigt:

| Feld | Quelle | Hinweis |
|------|--------|---------|
| **Freitext / Schnelltext** | Nutzer | z. B. „Verletzt, brauche Hilfe“ |
| **Standort** | GPS (opt-in, Timeout ok) | Grob reicht; fehlend = Hinweis in Text |
| **Anzeigename / Callsign** | Telefonbuch / Profil | |
| **IOTA `0x`** | `MY_ADDRESS` | Auf Funk ggf. **gekürzt** (Airtime) |
| **Meshtastic Node `!…`** | Telefonbuch / verbundenes Gerät | Für Funk-Rückruf |
| **Telegram** | Telefonbuch / Notify-Konfig | Nur wenn Kanal aktiv |
| **Package-ID** | Session / Handoff | Optional, v. a. Online |

**Niemals** im SOS: Mnemonic, Tresor-Passwort, Private Keys, Handshake-Secrets.

### 9.3 Sendewege (Fan-out)

| Weg | SOS-Policy |
|-----|------------|
| **Funk (Meshtastic)** | **Klartext** + `MORG_EMERGENCY_V1`; **gekürztes** Lage-Bundle (Airtime §2.2); Priorität **Flash** |
| **Online (IOTA/Mailbox)** | **Klartext** (`/send-plain` / Klartext-Mailbox) — **kein** E2E für SOS |
| **Telegram** | **Klartext**-Hinweis (Notify-only); Kurzlage, kein Secret-Dump |

**Default-Button „SOS senden“:** alle **aktuell erreichbaren** Wege **parallel** (Fan-out). Fehler pro Weg anzeigen („Funk OK, Online wartet …“).

**Transparenz (Pflicht-UI):** Vor dem Senden kurzer Hinweis — *„Unverschlüsselt. Im Funk-Netz können Mitlausende den Inhalt lesen.“*

### 9.4 Was bewusst **nicht** angeboten wird (v1)

| Thema | Entscheidung |
|-------|--------------|
| **Verschlüsseltes SOS** im Simple Mode | **Nein** — würde Handshake/Keys blockieren |
| **OPSEC / Militär-SOS** | **Backlog** — separates Einsatzprofil, ggf. nur Funk Secondary+ isolierte Gruppe |
| **Voller Wallet-Dump auf Funk** | **Nein** — Trimmen nach §9.2 |
| **MTProto / Telegram-Vollchat** | **Nein** — nur Notify-Lane |

### 9.5 Risiken (akzeptiert vs. mitigiert)

| Risiko | Einordnung |
|--------|------------|
| **Mitlesen** auf offenem Mesh | **Akzeptiert** für Zivil-SOS — Hilfe > Diskretion; UI warnt |
| **Spoofing / False Alarm** | **Mitigiert:** Bestätigungsdialog, Rate-Limits (Backlog), kein stiller Send |
| **Persistenz Online** | Klartext on-chain/Mailbox **länger sichtbar** als Funk-Ping — **bewusst** für Einsatzleitung/Forensik |
| **Datenschutz Dritter** | Nutzer tippt keine fremden vertraulichen Daten in SOS — nicht technisch erzwingbar |

### 9.6 Implementierung (Reihenfolge)

1. **Doku** (diese §9) + Fahrplan **§ H.3n** — **erledigt 2026-06-16**
2. **UI:** `ChatViewSosEmergencySheet` — Text, Vorschau Lage-Bundle, Fan-out-Status
3. **Send-Pfad:** `isEmergencySend` → **`encrypted=false`**, Online **`/send-plain`**
4. **Wire optional:** `MORG_EMERGENCY_V2` mit `sub`/`loc` — erst wenn v1-Dialog stabil (kein Blocker für B2.5)

**Verwandt:** **`docs/MESSENGER-CHAT-HANDBUCH.md`** § SOS · **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`** §3.1 · **`docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md`** (SOS ≠ `initialProfile`).

---

*112 / Leitstelle: weiterhin **kein** automatisches „IOTA = Notruf“ — organisatorische Brücke siehe **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**.*
