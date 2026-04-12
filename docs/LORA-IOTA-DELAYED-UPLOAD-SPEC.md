# LoRa → IOTA: Delayed Upload & Chain-of-Custody – Architektur-Spec

**Status:** Entwurf zur Priorisierung (kein implementierter Code in diesem Dokument).  
**Ziele:** Lückenloser **späterer Upload** von über LoRa empfangenen Nachrichten nach **IOTA**, sobald ein Knoten **Internet** hat; **E2E-Verschlüsselung unverändert**; **nachvollziehbare Hop-Kette**; UI: **Transportpfad + IOTA-Anchor-Status**.

**Verwandt:** **`docs/MESHTASTIC-BUILDING-BLOCKS.md`** (was 1:1 aus Meshtastic kommt), **`docs/LORA-EU-FUNK-HARDWARE-EINSATZPROFILE.md`** (Frequenz-/Hardware-Rahmen, Einsatzprofile), **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`** (**§ H.3m** — warum **keine** volle IOTA-TX über LoRa; Gateway-Brücke), **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** (**§ H.3n** — SOS / `MORG_EMERGENCY_V1`, priorisierte Basis-Queue), **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (Offline vs. Online, **kein** CRDT-Mythos; Dedup, Mehrgeräte), **`docs/PROTOCOL-ANCHOR-VERIFY-SPEC.md`**, **`docs/DRONE-RELAY-STRATEGY.md`**, **`docs/MESSENGER-BUNDLE-SOURCE-OF-TRUTH.md`**, **`meshtastic/PHASE-2-FIRMWARE-SPEC.md`** (nur bei Bedarf), Mesh v2 **`MESH_V2_MAX_BYTES = 240`**.

### Offline vs. Online: Abgleich (Kurz)

Mesh/Queue und IOTA sind **keine** gleichwertigen „Wahrheiten“ ohne Regeln: **pro Vorgang** gilt eine **Autorität** (typisch **Chain** für globale Wirkung, **Queue** nur bis zum erfolgreichen Upload). **`canonical_msg_ref`** und Queue-Dedup (§8–9) sind der **Kern** für **Nachrichten**; **Credits** und andere PTBs brauchen **eigene** idempotente Pfade — ausführlich **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**, Fahrplan **§ H.12**.

### Meshtastic-First (Bridge)

| Priorität | Vorgehen |
|-----------|----------|
| **1** | **MQTT-Gateway** (oder bestehender serieller Pfad) vom internetfähigen Meshtastic-Knoten zum **Morgendrot-Node**; dort **Queue + Manifest + IOTA** – **minimale** eigene Logik. |
| **2** | **Store-and-Forward** von Meshtastic für Zwischenspeicher nutzen, statt sofort eigenen Relais-Puffer zu spezifizieren. |
| **3** | **Pro-Hop-Custody in Firmware** nur, wenn **MVP** (Gateway-Signatur + Hop-Metadaten) rechtlich/operativ **nicht** genügt – siehe **PHASE-2-FIRMWARE-SPEC** als **Option**. |

### Definition: `canonical_msg_ref` (32 Byte, Version 1)

**Zweck:** Eine **kollisionsarme, messenger-weite** Referenz auf **eine logische Nachricht** für Custody, Dedup und IOTA-Manifeste. Sie ist **nicht** dasselbe wie eine reine **Meshtastic-`packetId`** (die nur den Funkframe beschreibt).

**Berechnung (empfohlen, zu freezen):**

```text
canonical_msg_ref = SHA-256(
  UTF8("morg_msg_ref_v1") || 0x00 ||
  sender_address_utf8 || 0x00 ||
  recipient_address_utf8 || 0x00 ||
  thread_id_utf8 || 0x00 ||
  nonce_u64_le (8 bytes) || 0x00 ||
  content_hash (32 bytes)
)
```

| Feld | Inhalt |
|------|--------|
| **sender / recipient** | Kanonische Wallet-Adressen (**0x + 64 Hex**, einheitliche Case-Regel). |
| **thread_id** | Stabiler Gesprächs-/Partner-Key (z. B. aus `{myAddress, partnerAddress}` sortiert gehasht oder UUID). |
| **nonce_u64** | Derselbe **Nonce** wie im **Mailbox-/E2E-Protokoll** für diese Nachricht (oder explizite message sequence). |
| **content_hash** | **SHA-256** über den **Klartext-Inhalt** (nach Entschlüsselung) **oder** – wenn ohne Klartext gearbeitet wird – über ein **festes Serialisat** des Ciphertext-Bundles `(ciphertext||iv||tag)`; **eine Variante** pro Codebase-Version wählen und in `cipher_suite` dokumentieren. |

**Zusatz:** `mesh_packet_id` / `loRaMessageId` (Meshtastic) **optional** im Manifest, **ergänzend** – nicht als Ersatz für `canonical_msg_ref`.

---

## 1. Kritische Prüfung der Anforderung (Verbesserungen)

| Thema | Problem | Präzisierung |
|-------|---------|--------------|
| **Hop-Signatur in jedem LoRa-Frame** | Mesh-Pakete sind auf **≤240 B** Rohwire begrenzt; volle **Ed25519-Signatur (64 B) + NodeId + Zeit** pro Hop **passt nicht** zu großer E2E-Nutzlast im gleichen Frame. | **Zwei Phasen:** (A) *Minimal:* Custody-Kette wird am **Internet-fähigen Rand** (Telefon/CM4 + Morgendrot-Node) aus **lokal bekannten** Mesh-Metadaten aufgebaut; (B) *Voll:* **Phase-2-Firmware** liefert pro Relais ein **kompaktes Custody-Record** in einem **eigenen Chunk-/Sidechannel-Protokoll**, das **nicht** die E2E-Nutzlast aufbricht. |
| **loRaMessageId** | Meshtastic-interne IDs ≠ Morgendrot-Referenz. | Immer **`canonical_msg_ref`** (siehe Definition oben); `mesh_packet_id` nur ergänzend. |
| **previousHopSignature** | Erster Hop: definiere **`GENESIS_HOP = 32×0x00`** oder leeres Feld mit Flag `hop_index=0`. | In Signatur-Payload **explizit** encodieren (§3.1). |
| **Schlüssel auf Heltec** | Relais braucht **signing key** (Device Identity), getrennt von **E2E** (ECDH Session). | **Device Key** nur für **Custody**; **nie** für Entschlüsselung der Nutzlast nutzen. |
| **E2E unverändert** | Custody ist **Zusatz-Metadaten**; **Ciphertext** (iv, tag, ciphertext) bleibt **bitgenau** wie beim direkten IOTA-Versand. | Validator verifiziert: `hash(ciphertext_bundle) == content_hash` aus Manifest. |

---

## 2. Funktionale Anforderungen (übernommen & geschärft)

1. **Delayed Upload:** Nachrichten, die **nur per LoRa** (ggf. BT an Heltec) ankamen, liegen in einer **lokalen Warteschlange** bis **Online + Wallet**. Dann **automatisch oder auf Knopfdruck** Upload nach IOTA (gleiche Mailbox-/Messaging-Semantik wie heute).
2. **E2E:** Weiterhin **ECDH/AES-GCM** (oder aktuelles Bundle); **kein** Klartext auf Relais für Custody nötig.
3. **Chain-of-Custody:** **Phase 2 (voll):** Jeder **Morgendrot-fähige** Relais-Hop fügt eine **Hop-Signatur** hinzu (**§3.1**, **§9**). **MVP:** Nur der **erste internetfähige Gateway-Knoten** signiert mit **Device-Identity**; zusätzlich **`hop_count`** und **`last_known_node_id`** aus Mesh-Metadaten (ohne Signatur jedes Zwischenrelays) – siehe **§9**.
4. **Upload-Modus (Nutzerwahl pro Upload- oder Batch-Vorgang):**
   - **Standard / empfohlen:** **Hash + Metadaten + komplette Hop-Signaturkette** (+ Referenz `canonical_msg_ref`).
   - **Explizit:** **Vollständiger Ciphertext-Bundle** + Metadaten + Hop-Kette (wie **`PROTOCOL-ANCHOR-VERIFY-SPEC`** – Metadaten-Leck bleibt möglich).
5. **UI:** Immer sichtbar: **ursprünglicher Transport** (LoRa/BT/…) **und** **IOTA-Anchor-Status** (`pending` | `uploading` | `anchored` | `failed` + optional Digest).

---

## 3. Hop-Signatur-Kette – technischer Entwurf

### 3.1 Kanonische Signatur-Payload (pro Hop)

Empfohlen: **CBOR** oder **festes Binary** (Version 1). Beispiel **binary (big-endian wo sinnvoll)**:

| Offset | Feld | Länge | Inhalt |
|--------|------|-------|--------|
| 0 | `custody_version` | 1 | `0x01` |
| 1 | `hop_index` | 1 | 0…255 |
| 2 | `prev_sig` | 64 | Signatur des **vorherigen** Hops oder `0…0` bei Hop 0 |
| 66 | `canonical_msg_ref` | 32 | SHA-256 über Morgendrot-Message-Referenz (sender+nonce+content_hash o. ä.) |
| 98 | `timestamp_unix_ms` | 8 | uint64 |
| 106 | `node_id` | 8 oder 16 | kompakte **Relais-Identität** (Meshtastic NodeNum + Salt oder Hash öffentlicher Device-Key) |

**Zu signierende Bytes:** `SHA-256( custody_version || hop_index || prev_sig || canonical_msg_ref || timestamp_unix_ms || node_id )` **oder** direkt der obige Blob ohne Hash-Präfix – **einmal festlegen und versionieren**.

**Signatur:** **Ed25519** über die zu signierenden Bytes (64 B) – auf ESP32/SX1262-Geräten CPU-budget beachten.

**Kette:** Hop *i* speichert `signature_i` und `public_key_i` (32 B) im **Custody-Record**. Verifikation: sequentiell von Hop 0 … *n*.

### 3.2 Transport der Kette

| Phase | Verhalten |
|-------|-----------|
| **MVP (jetzt)** | **Gateway** (Telefon/CM4 mit Morgendrot-Node): ein **Custody-Block** mit **Gateway-Ed25519-Signatur**, **`hop_count`**, **`last_known_node_id`** (aus Meshtastic/Mesh-API, soweit verfügbar), **`canonical_msg_ref`**, Zeitstempel – **ohne** echte Zwischenrelay-Signaturen. |
| **Erweitert (nur bei Bedarf)** | Pro-Relais-**Hop-Signatur** wie **§3.1** – **optional**, nur wenn Gateway-MVP nicht reicht; Umsetzung als **kleines Modul** / Patch nahe Meshtastic-Upstream (**PHASE-2-FIRMWARE-SPEC** = Referenz, kein Pflicht-Fork). |

---

## 4. Upload-Manifest (struktur für IOTA)

Das Manifest ist das, was **on-chain** (oder **Merkle-Root** + off-chain JSON) landet.

### 4.1 Felder (logisch)

```json
{
  "manifest_version": 1,
  "kind": "lora_delayed_upload",
  "canonical_msg_ref": "<32-byte-hex>",
  "original_transport": ["bluetooth", "lora"],
  "e2e": {
    "ciphertext_hash": "<sha256-hex>",
    "recipient": "<address>",
    "nonce": "<u64-string>",
    "cipher_suite": "ecdh-aes-gcm-v1"
  },
  "custody_mvp": {
    "gateway_pubkey_ed25519": "<32-byte-hex>",
    "gateway_signature": "<64-byte-hex>",
    "hop_count": 0,
    "last_known_node_id": "<hex-or-null>",
    "mesh_packet_id": "<optional>"
  },
  "custody_chain": [
    {
      "hop_index": 0,
      "node_id": "<hex>",
      "timestamp_ms": 0,
      "pubkey_ed25519": "<32-byte-hex>",
      "signature": "<64-byte-hex>",
      "signed_payload_hash": "<optional>"
    }
  ],
  "upload_mode": "hash_and_metadata" | "ciphertext_and_metadata",
  "ciphertext": null
}
```

- Bei **`hash_and_metadata`:** `ciphertext` fehlt on-chain; Nutzlast bleibt **lokal/vault** oder wird nur als Hash referenziert.
- Bei **`ciphertext_and_metadata`:** `ciphertext`, `iv`, `tag` gemäß bestehendem **store_encrypted_message**-Format (Move-Seite).

### 4.2 On-chain Abbildung

- **Einzelnachricht:** eine TX mit **serialisiertem Manifest** (unter Größenlimit) **oder** nur **`manifest_hash` + `custody_root`** + wenige Felder.
- **Stapel:** **Merkle-Root** über Manifest-Hashes (wie **`PROTOCOL-ANCHOR-VERIFY-SPEC`**); Delayed-Upload nutzt **dieselbe** Anker-Idee wo möglich, **eigenes** `kind: lora_delayed_upload` für Indexer.

### 4.3 Move (skizze)

- Wiederverwendung **`store_encrypted_message`** wenn `upload_mode = ciphertext_and_metadata`.
- Zusätzlich Event **`LoraCustodyAnchored(manifest_hash, custody_root, mode)`** oder dediziertes Modul `lora_custody::anchor_manifest(...)`.

---

## 5. UI – Transport + IOTA-Status & Moduswahl

### 5.1 Dauerhafte Anzeige (Chat-Bubble)

| Element | Inhalt |
|---------|--------|
| **Transport-Badge** | Wie **`PROTOCOL-ANCHOR-VERIFY-SPEC` §8**: z. B. **LoRa** (ingress) – bei späterem IOTA-Settlement **zusätzlich** kleines **Settlement-Icon** oder zweites Mini-Badge. |
| **IOTA-Status** | `pending` (nur LoRa lokal) → `queued` → `uploading` → `anchored` (mit Link/Digest) oder `failed` (Retry). |

**Textvorschlag:** eine Zeile: `LoRa · IOTA: ausstehend` → `LoRa · IOTA: verankert`.

### 5.2 Dialog „Delayed Upload“ / Auto-Upload-Einstellungen

Gleiche **explizite** Wahl wie Verankerung (**kein** stiller globaler Default):

| Option | Beschreibung |
|--------|----------------|
| **Nur Hash + Metadaten + Custody-Kette** (Vorauswahl bei großen/stapelbaren Mengen) | Empfohlen; E2E-Inhalt bleibt off-chain / im Vault. |
| **Ciphertext + Metadaten + Custody-Kette** | Explizit; Hinweis auf sichtbare Blob-Metadaten. |

Zusätzlich: **„Automatisch hochladen, sobald online“** (Toggle) – getrennt von Moduswahl.

---

## 6. Komponenten (modular)

| Komponente | Rolle |
|------------|--------|
| **`lora-bridge` / Heltec / Meshtastic** | Liefert **Rohpaket + Mesh-Meta** an Host. |
| **Node (`src/…`)** | **Outbound Queue** (persistent, z. B. LevelDB/Datei): Einträge = E2E-Bundle + `custody_chain` (partial/full) + `canonical_msg_ref`. |
| **`chain-access` / API** | Baut TX wie bestehende Messenger-Speicherung + optional Custody-Event. |
| **Frontend** | Badge + Queue-Status + Dialog; **kein** Blockieren des Sende-Flows. |

**Feature-Flag:** z. B. `ENABLE_LORA_DELAYED_IOTA_UPLOAD` – ohne Flag bleibt heutiges Verhalten.

---

## 7. Abgrenzung zu „Protokoll & Nachweis“

| Thema | Delayed Upload (dieses Dokument) | Protokoll & Nachweis |
|-------|----------------------------------|----------------------|
| **Trigger** | Automatisch/konfiguriert nach LoRa-Empfang | Meist **manuell** nach Einsatz |
| **Inhalt** | **Konkrete** noch nicht gesettlete Mesh-Nachrichten | Auswahl aus Chat-Verlauf |
| **Custody** | **Pflicht** als Kernidee | Optional erweiterbar |

Beide können **dieselbe** Manifest-/Merkle-Infrastruktur teilen.

---

## 8. Offene Punkte (technisch)

1. **Speicher-Limits** lokaler Queue (Anzahl, TTL, Verschlüsselung at rest).
2. **Konflikt:** gleiche Nachricht **doppelt** (LoRa + direkt IOTA) → **Dedup** über `canonical_msg_ref`.
3. **Rechtliches:** Custody-Metadaten (**Hop-Zahl**, **Node-IDs**) können **taktisch** sein – Kurztext in UI.

---

## 9. Delayed LoRa Anchor with Chain-of-Custody

Dieser Abschnitt bündelt **Bridge**, **IOTA-Upload** und **Nachweis** für dieselbe Feature-Linie.

### 9.1 Zielbild

- **Lückenlose Nachweisbarkeit der Weiterleitung** soweit technisch möglich: **voll** erst mit **Phase-2-Firmware** (jeder Relais signiert); **MVP** liefert bereits **brauchbaren** Nachweis durch **Gateway-Signatur** + **Hop-Metriken**.
- **E2E (ECDH/AES)** bleibt **unverändert**; Custody- und Manifestdaten sind **Zusatz**, **ohne** Klartext auf Relais.
- **IOTA-Upload** (Delayed): sobald **Internet**, wahlweise **Hash + Metadaten + Signatur(en)** oder **Ciphertext + Metadaten + Signatur(en)** (**explizite Nutzerwahl**, siehe **`PROTOCOL-ANCHOR-VERIFY-SPEC`**).

### 9.2 MVP (Priorität 1 – ohne volle Firmware-Kette)

| Element | Beschreibung |
|---------|----------------|
| **Gateway-Signatur** | Der **erste internetfähige Knoten** (App/Node auf CM4/Telefon) signiert mit **Device-Identity (Ed25519)** über ein Payload, das mindestens enthält: `canonical_msg_ref`, `content_hash` oder Ciphertext-Hash, `timestamp_ms`, `original_transport`, optional `mesh_packet_id`. |
| **Hop-Metadaten** | **`hop_count`**: `number \| null` aus Meshtastic/Mesh-API. **`hop_count_known`**: `false`, wenn `hop_count == null` **oder** API keine zuverlässige Hop-Zahl liefert (Manifest dokumentiert Unsicherheit). **`last_known_node_id`**: `string \| null`. **`last_node_id_known`**: `false`, wenn unbekannt – **niemals** einen Platzhalter als echte ID ausgeben. |
| **Manifest auf IOTA** | Wie **§4**, mit **`custody_mvp`** gefüllt; **`custody_chain`** leer oder ein synthetischer Eintrag nur für Gateway – **Versionierung** im `manifest_version`, damit Verifikatoren MVP vs. Full unterscheiden. |
| **Upload-Modus** | **Hash-only + Kette (MVP)** als **sachliche Vorauswahl** bei großen Mengen; **Ciphertext** weiterhin **explizit** wählbar. |

### 9.3 Phase 2 (Priorität 2 – volle Relais-Kette)

- Jeder **Heltec-/Morgendrot-Relais** beim Weiterleiten: **Hop-Signatur** über kanonische Bytes (**§3.1**), z. B.  
  `sign( loRaMessageId_mesh || previousHopSignature || timestamp || myNodeId )`  
  mit **fester Serialisierung** (empfohlen: **SHA-256** über dieses Tupel als **signierte_message**, dann Ed25519 darüber – vermeidet Parsing-Ambiguität).
- **`custody_chain[]`** im Manifest enthält **alle** Hops in Reihenfolge; Verifikation sequentiell ab **Genesis-`prev_sig`**.
- **Transport** der einzelnen Hop-Records: **nicht** im 240-B-E2E-Frame quetschen, sondern **Sidechannel/Chunking** (**PHASE-2-FIRMWARE-SPEC**).

### 9.4 UI (Ergänzung zu §5)

- **Immer sichtbar:** ursprünglicher **Transportpfad** (LoRa/BT/…) **und** **IOTA-Anchor-Status** (`pending` → `anchored` / `failed`).
- Bei **MVP**: Tooltip z. B. „Nachweis: Gateway + Hop-Info (keine vollständige Relais-Kette)“ bis Phase 2 aktiv ist.

### 9.5 Gateway **Device-Key** für Custody (Entscheidung)

| Option | Bewertung |
|--------|-----------|
| **Meshtastic-interner Key** | Eng an Firmware gekoppelt, für Node/App schwer portabel; Versionswechsel riskant. |
| **Empfohlen: eigener Morgendrot-Device-Key (Ed25519)** | Beim ersten Setup oder Factory-Step in **NVS/Vault-Datei** erzeugt; **nur** für **Custody-/Manifest-Signaturen**; **strikt getrennt** von E2E-ECDH und von optionalen Wallet-Keys. Rotation: neues Key-Paar + Manifest-Feld `custody_key_id`. |

### 9.6 Outbound-Queue (Schnittstelle, MVP)

| Feld / API | Zweck |
|------------|--------|
| **Persistenz** | Eintrag pro `canonical_msg_ref`: E2E-Ciphertext-Bundle, `custody_mvp`-Rohdaten, `created_at`, `retry_count`. |
| **`POST /api/lora-outbound-queue/push`** (skizze) | Vom Frontend nach Mesh-Empfang oder vom Node nach Bridge. |
| **`POST /api/lora-outbound-queue/flush`** | Bei Online: wählt Modus (Hash/Ciphertext), baut TX, markiert `anchored` / `failed`. |
| **Dedup** | Vor Push: gleiche `canonical_msg_ref` wie bereits in Mailbox → Eintrag verwerfen oder mergen. |

### 9.7 Airtime-Budget-Anzeige (UI, technische Leitplanken)

| Aspekt | Inhalt |
|--------|--------|
| **Grundlage** | EU868: typ. **1 %-Duty-Cycle** pro **Subband** auf **Rolling-Window** (oft 1 h) – **nicht** ein globales „1 % pro Sekunde“. Die UI zeigt eine **Schätzung** aus **SF, BW, Payload-Länge** (LoRa-Rechner) + **vom Stack gemeldeter** Sendezeit, falls verfügbar. |
| **Anzeige** | z. B. „**Geschätzte** Kanalauslastung ~**X %** im aktuellen Fenster“ + „**ca. Y s** bis nächstes Bild (gleiche SF)“ – immer mit Hinweis **„Schätzung“**. |
| **Warnung** | ab Schwellenwert: „Funkkanal stark belegt – Senden kann verzögert werden.“ |
| **Mathe** | Airtime \(T\) pro Paket aus Semtech-Formel (SF, BW, CR, Header, Payload); Duty: \(\sum T_{\text{send}} / T_{\text{window}} \le 0{,}01\) pro Subband – UI kann **obere Grenze** aus letzten *n* Sends **approximieren**. |
| **Dual-Radio** | Zwei Module auf **433 + 868** haben **getrennte** Duty-Budgets; Anzeige **pro Band** oder aggregiert mit Label **„868 MHz“** / **„433 MHz“**. |

### 9.8 MVP-Implementierung – Festlegungen (Persistenz, Retries, Meshtastic-Eingriff)

**Reihenfolge:** Zuerst **Code-Qualität** (Chat-View-Zerlegung etc.), dann **Delayed-Upload-MVP** auf dieser Basis bauen.

#### 9.8.1 Persistenz der Queue

| Aspekt | Festlegung MVP |
|--------|----------------|
| **Ort** | **Node-Backend** (gleicher Prozess wie API), **eine** konfigurierbare Datei (z. B. `LORA_OUTBOUND_QUEUE_PATH`, Default z. B. unter `data/` oder Repo-Datenverzeichnis). |
| **Format** | **SQLite** (eine Tabelle `outbound_queue`: `canonical_msg_ref` PRIMARY KEY, Payload/Metadaten als JSON-Spalte oder BLOB, `status`, `retry_count`, `last_error`, `created_at`, `updated_at`) **oder** bei minimalem Aufwand zuerst **JSONL** (append-only + Rewrite bei Statusänderung) – SQLite bevorzugt, sobald Konkurrenz/Rewrites relevant werden. |
| **Nicht** | Queue nur im **Browser** – ungeeignet für CM4-Gateway und Tab-Schließen. |
| **Verknüpfung Mesh** | **Pfad A (Browser):** Nach erfolgreichem Decrypt in `useMeshtasticBle` / Callback, der heute `appendMeshMessage` triggert → zusätzlich **`POST /api/lora-outbound-queue/push`** mit Wire + optionalen BLE/Mesh-Hinweisen. **Pfad B (Basis ohne UI):** Meshtastic **MQTT** oder **Serial** → kleines Skript/Service ruft dieselbe **push**-Logik auf dem Node auf. Beide Pfade schreiben in **dieselbe** Queue. |

#### 9.8.2 Fehlerbehandlung / Retries

| Aspekt | Festlegung MVP |
|--------|----------------|
| **Status** | `pending` → `uploading` → `anchored` (optional `tx_digest`) oder `failed`. |
| **Retry** | Bei **transienten** Fehlern (RPC-Timeout, 429, temporär kein Wallet): exponentielles Backoff (z. B. 1 min / 5 min / 15 min), max. **`retry_count`** (z. B. 10) danach `failed` mit `last_error` textuell speichern. |
| **Nicht retry** | Ungültiges Manifest, ungültige Signatur, dauerhaft gesperrter Vault → sofort `failed` oder `pending` mit klarem Grund (manuelles Eingreifen). |
| **Flush** | `flush` verarbeitet **einen** oder **batch** `pending`-Einträge; bei Abbruch mitten drin: Eintrag bleibt `pending` oder `uploading` mit Timeout-Recovery (kein doppeltes Anchor ohne Dedup-Check). |
| **Dedup** | Vor `push` oder in `flush`: wenn `canonical_msg_ref` **bereits in Mailbox** → Eintrag nicht erneut anlegen bzw. überspringen (siehe §8). |

#### 9.8.3 Meshtastic: wie viel Eingriff für den MVP?

| Ebene | MVP |
|-------|-----|
| **Ohne Firmware-Änderung** | **Ja, ausreichend für MVP:** Ingress über **MQTT-Gateway** / **Serial** / **Web-BT** (bestehende Pfade); Queue und Gateway-Signatur laufen auf dem **Morgendrot-Node**. Hop-Zahl/Node-ID nur, **wenn** die Quelle (Protobuf/MQTT/App) sie zuverlässig liefert – sonst `hop_count_known: false` (§9.2). |
| **Firmware (PortNum, Hooks)** | **Nicht zwingend** für „es funktioniert überhaupt“. **Später** sinnvoll für **Priorität**, **bessere Metadaten**, **volle Hop-Kette** (Phase 2) – siehe **`meshtastic/PHASE-2-FIRMWARE-SPEC.md`**, Meshtastic-First: nur **kleine**, gezielte Erweiterungen. |
| **Kurzfassung** | MVP = **Baukasten Meshtastic** + **eigener Node** (Queue + Device-Key + IOTA-Hash-Upload). **Kein** Pflicht-Fork nur für die erste lieferbare Delayed-Upload-Version. |

---

*Technischer Entwurf für Priorisierung; Umsetzung: MVP-Queue + Manifest, Morgendrot-Device-Key, danach Phase-2-Firmware für volle `custody_chain`.*

**Sync-Gesamtbild:** **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**Fahrplan § H.12**).
