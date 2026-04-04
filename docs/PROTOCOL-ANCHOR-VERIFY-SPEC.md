# Protokoll verankern & Nachweis – Architektur-Spec (Morgendrot)

**Status:** Entwurf für Umsetzung (kein fertiges Move-Modul / keine fertige UI in diesem Dokument).  
**Kontext:** Ergänzung zum Messenger **ohne** iziPublish-/CMS-Nachbau; ein Menübereich **„Protokoll & Nachweis“**, keine neue Haupt-Kachel.

Verwandte Doku: **`docs/MESSENGER-EXPORT-FIELDS.md`** (Stapel-Export), **`docs/MESSENGER-BUNDLE-SOURCE-OF-TRUTH.md`** (exports vs. `src/`), **`docs/DESIGN-PRINCIPLES.md`**, **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** (Delayed Upload, Custody MVP/Full, **`canonical_msg_ref`**), Messenger-Typ **`Message`** in `frontend/frontend/lib/types.ts` (`source`, `transports`).

---

## 1. Ziele

| Ziel | Kurzbeschreibung |
|------|------------------|
| **Manipulationssicherer Nachweis** | Ein dokumentierter Stand von Nachrichten (Auswahl oder Verlauf) ist **zeitlich und inhaltlich** an die Chain gebunden (Hash/Signatur). |
| **Wahlfreiheit Inhalt** | Pro Vorgang **explizite** Wahl: **Hash + Metadaten** oder **verschlüsselter Vollinhalt** on-chain (§4.1, §6); kontextsensitive **Vorauswahl**, kein stiller globaler Default. |
| **Transporttransparenz** | Der **primäre/erkannte Zustellweg** jeder Nachricht ist im Chat **dauerhaft sichtbar** (Badge/Label). |
| **Einfache Verifizierung** | Empfänger: **ein Tap** „Verifiziert“; optional Speicherung des **Transportpfads** in der Verifikation (Default: aus). |
| **Keine Echtzeit-Last** | Normaler Sende-/Empfangsflow bleibt unberührt; Verankerung nur **explizit** und **asynchron**. |

**Primärpfad:** Settlement über **IOTA** (Mailbox/Events). **LoRa, Bluetooth (z. B. Web-BT zum Heltec), Sneakernet (`.morg-pkg`)** bleiben **Fallback-/Ingress-Pfade** – in der Spec einheitlich modelliert (§5).

---

## 2. Kritische Prüfung – Korrekturen gegenüber einer naiven Formulierung

### 2.1 „Verschlüsselt on-chain“ ist nicht gleich „geheim“

- On-chain liegende **Ciphertext-Blobs** sind für Dritte weiterhin **sichtbar** (Größe, Zeitpunkt, Korrelation). „Verschlüsselt“ schützt **Inhalt**, nicht **Metadaten** und nicht **Traffic-Analyse**.
- **Kein fester Produkt-Default** für den Verankerungsmodus (siehe **§4.1**): Der Nutzer wählt **pro Vorgang** zwischen **Hash + Metadaten** und **vollständig verschlüsselt on-chain**; die UI gibt nur eine **sachliche Vorauswahl** (z. B. Hash-only bei großem Verlauf), ohne den anderen Modus zu verstecken.

### 2.2 Kosten und TX-Limits

- „Ganzen Chat-Verlauf“ mit **je einer TX pro Nachricht** skaliert schlecht (Gas, Zeit, RPC).
- **Pflicht:** Stapel-Verankerung über **einen Merkle-Root** (eine oder wenige TX) + **Manifest** (lokal oder in Paket/Anhang). Einzelnachrichten bleiben **Einzel-TX** möglich.

### 2.3 Transportpfad ist oft mehrstufig

- Beispiel: Nutzlast ging **Bluetooth → Telefon → LoRa-Mesh**; Settlement später **IOTA**.
- **Fehler:** Ein einzelnes Enum „LoRa **oder** IOTA“ unterschlägt die Realität.
- **Korrektur:** Modell **`primaryTransport`** (für UI-Badge: „wie bin ich hereingekommen / was war der kritische Pfad“) **plus** optional **`transportLegs[]`** oder bestehendes **`transports[]`** erweitern (§5).

### 2.4 Signatur der Verankerung

- Klarstellen: **Wer** signiert den Anker? Vorschlag: **Wallet des auslösenden Nutzers** (Koordinator/Boss/Einsatzleitung) als **„Protokollführer“**; Multi-Signatur später optional.
- Inhalt des signierten Materials: **kanonisches JSON** oder **Hash des Manifests** (§6.2).

### 2.5 Datenschutz

- Selbst **Hash + Metadaten** können **personenbezogen** sein (Adressen, Zeit, Orte). **Auswahl** durch Nutzer und Hinweis in UI sind Pflicht; „ganzer Verlauf“ nur mit **Bestätigungsdialog**.

---

## 3. Nicht-Ziele

- Kein **No-Code-Typ-Editor**, keine freien Container-Hierarchien (iziPublish-Niveau).
- Keine **Blockade** des Chats durch Hintergrund-Anker.
- Keine **Änderung** der Priorität: **Echtzeit zuerst**, Nachweis **danach**.

---

## 4. Menü & UX (bewusst unaufdringlich)

| Element | Festlegung |
|---------|------------|
| **Ort** | **Keine** prominente Hauptfunktion und **keine** neue Haupt-Kachel. **„Protokoll & Nachweis“** liegt im **Chat-Menü** (Overflow / „⋮“) als **Untermenü** oder gekoppelter Eintrag – gleiche Gewichtung wie andere sekundäre Chat-Aktionen. |
| **Unterpunkte** | **Verankern…**, ggf. **Kurzmeldung** (optional), Hinweis dass **Verifizierung** pro Nachricht im **Kontextmenü** der Bubble liegt (nicht dauernd im Kopf). |
| **Templates** | Max. **3–4** feste JSON-Vorlagen (z. B. Lagebericht, Verletztenmeldung, Materialstatus) – **hardcodierte Schemas**; Zugriff über **„+“** / Untermenü, **nicht** dauerhaft im Composer. |

### 4.1 Verankerungsmodus: keine automatische Default-Strategie

**Anforderung:** Weder **Hash-only** noch **Ciphertext-on-chain** ist global fest als Default gesetzt. Beides muss **explizit und gleichwertig** im Verankerungs-Dialog wählbar sein (z. B. zwei klare Optionen / Radio + kurze Erklärung).

| Aspekt | Festlegung |
|--------|------------|
| **Einsatzargument** | Manche Fälle brauchen **inhaltlich nachweisbaren** Stand (verschlüsselter Vollinhalt on-chain trotz sichtbarer Metadaten-Risiken); andere brauchen **nur Integrität** (Hash + Metadaten, Inhalt bleibt off-chain/verschlüsselt außerhalb der Chain). |
| **Vorauswahl (kein Default)** | Die UI darf **kontextsensitiv vorselektieren**, z. B. **Hash-only vorausgewählt** bei **großem Verlauf** / vielen Medien (Kosten, Größe); bei **wenigen Textnachrichten** kann **Ciphertext** vorausgewählt sein – der Nutzer **muss** vor Signatur noch einmal die aktive Option sehen und bestätigen. |
| **Pflicht** | Kein automatisches Absenden ohne sichtbare Wahl **Hash vs. vollständig verschlüsselt** (außer Ein-Klick-„Verankern“ nur, wenn der Nutzer eine **persistente Einstellung** „immer Hash für Stapel“ explizit gesetzt hat – dann als dokumentiertes Opt-in). |

**Kurztexte UI (Beispiele):**

- **Hash + Metadaten:** „Nur Fingerabdruck und Metadaten on-chain; Inhalt nicht in der Chain.“
- **Vollständig verschlüsselt:** „Verschlüsselter Inhalt on-chain (Metadaten wie Größe/Zeit für Beobachter sichtbar).“

### 4.2 Persistente Präferenz „Immer Hash für Stapel“

| Regel | Inhalt |
|-------|--------|
| **Zweck** | Nutzer kann **einmalig aktivieren**, dass bei **Stapel-/Verlaufs-Verankerung** standardmäßig **Hash + Metadaten** vorselektiert wird – **Zeit sparen**, nicht heimlich umgehen. |
| **Kein versteckter Default** | Ohne diese Einstellung gilt **§4.1**: **kein** globaler Produkt-Default; beide Modi bleiben **ohne** Opt-in gleich sichtbar. |
| **UI-Pflicht** | Einstellung unter z. B. **Einstellungen → Protokoll & Nachweis** mit **klarem Titel**, z. B.: **„Bei Stapel-Verankerung immer Hash + Metadaten vorschlagen (Opt-in)“** + Kurztext, dass **Ciphertext** jedes Mal **weiterhin wählbar** bleibt. |
| **Signatur/Confirm** | Erstes Aktivieren: **zusätzliche Bestätigung** (Checkbox), dass dies **kein** Ersatz für die **jeweilige** Moduswahl vor der Wallet-Signatur ist. |

---

## 5. Transportpfad – Begriffe und Abbildung auf den Code

### 5.1 Kanonische `TransportChannel`-Werte (Spec)

Vorschlag für **persistente** Werte (UI + Anker + Verifikation):

| Kanal | Bedeutung |
|-------|-----------|
| `iota` | Settlement / Abruf über IOTA-Mailbox oder Event-Pfad (Internet zum Node). |
| `lora` | Zustellung über Meshtastic/LoRa (Funkstrecke maßgeblich). |
| `bluetooth` | Letzte Meile: Web Bluetooth / GATT zum Heltec (vor LoRa oder statt direkter IOTA-Eingabe auf dem Gerät). |
| `sneakernet` | `.morg-pkg` / physischer Datenträger / manueller Import. |

**Hinweis:** Im aktuellen Frontend existiert `source?: 'mailbox' | 'mesh'` und `transports?: ('internet' | 'mesh' | 'adhoc')[]` (`types.ts`). Mapping bei Implementierung:

| Bestehend | Richtung Spec |
|-----------|----------------|
| `mailbox`, `internet` | → `iota` (ggf. `primaryTransport`) |
| `mesh` | → `lora` |
| `adhoc` | → `sneakernet` oder „lokal/ad-hoc“ – in Implementierung präzisieren |

**UI-Badge (Pflicht):** **Immer sichtbar** bei jeder Nachricht – **kleines Icon oder Kurzlabel** (nicht nur on Hover).  
- **Mehrstufige Kette** (z. B. LoRa → später IOTA): Badge zeigt den **ersten / ingress-maßgeblichen** Pfad (`primaryTransport` / erste Leg).  
- **Details:** vollständige Leg-Liste oder „auch über …“ im **Tooltip** oder Sekundärzeile bei genug Platz.

### 5.2 Erfassung zum Sendezeitpunkt

- Beim **Senden** muss die App den **tatsächlich gewählten Weg** setzen (z. B. „Für LoRa senden“ erfolgreich → `primaryTransport: 'lora'`; Online-IOTA → `iota`; Import aus Paket → `sneakernet`).
- **Fehler vermeiden:** Nicht nur „Internet da“ raten, sondern **welcher Codepfad** die Nachricht ausgeliefert hat.

---

## 6. Verankerung on-chain – technischer Entwurf

### 6.1 Auswahl-UI (Ablauf)

1. **Einstieg:** **Chat-Menü (Overflow)** → **„Protokoll & Nachweis“** → **„Auswahl verankern…“** (unaufdringlich, kein Wizard).
2. **Umfang:**
   - **Einzelne Nachricht:** Kontextmenü der Bubble **„Verankern“** / **„In Auswahl“**.
   - **Mehrere:** Mehrfachauswahl (Checkboxen), dann **„Ausgewählte verankern“**.
   - **Gesamter Verlauf:** Dialog **„Thread / sichtbarer Verlauf“** mit **Filter** (Text nur, ab Datum) und **zusätzlicher Pflicht-Warnung** (siehe unten).  
     Zusätzlich: **automatische Empfehlung** „**Hash + Metadaten**“ in **hervorgehobenem Info-Kasten** (Kosten, Datenschutz, Merkle-Standard) – der Nutzer kann **jederzeit** **„Vollständig verschlüsselt“** wählen; **keine** Sperre.
3. **Verankerungsmodus (obligatorisch sichtbar):** Nutzer wählt **explizit** (Radio o. ä.):
   - **`hash_only`:** Content-Hash + Metadaten (+ Transport wie spec).
   - **`ciphertext_on_chain`:** verschlüsselter Vollinhalt (AEAD) + minimale Metadaten.  
   **Vorauswahl** nur als UI-Hilfe (§4.1), keine stillen Produkt-Defaults.
4. **Größen- und Kostenwarnung (Pflicht bei großem Umfang):**  
   Anzeige von **Anzahl Nachrichten**, **geschätzter Payload-Größe**, **geschätzter TX-Anzahl** (bzw. „1 TX + Manifest“ bei Merkle). Bei Überschreitung von Schwellen **roter/klarer Hinweis** vor Fortfahren.
5. **Verlauf-Verankerung = Merkle + Manifest (Standard):**  
   Für **„ganzer Verlauf“** (und empfohlen auch für große Multi-Auswahlen) ist der **Standardpfad** **ein Merkle-Root** (eine oder wenige on-chain TX) **plus** **Manifest** (off-chain oder Paket-Anhang), **nicht** N einzelne Voll-TXs. Abweichung nur, wenn Nutzer explizit „Einzel-TX pro Nachricht“ wählt und Limits erlauben.
6. **Bestätigung:** Wallet-Signatur (oder Remote-Signer) **nach** sichtbarer Moduswahl und Warnungen.

**UX:** Eine kompakte Seite/Sheet; bei Vollverlauf zusätzlich Checkbox **Datenschutz / Umfang** bestätigt.

### 6.2 Was genau on-chain geht

**Variante Hash (`hash_only`):**

| Feld | Typ / Inhalt |
|------|----------------|
| `manifest_version` | u8 |
| `thread_id` / `conversation_id` | String oder Hash |
| `anchor_id` | UUID / Nonce |
| `created_at` | u64 ms |
| `merkle_root` | 32 Bytes (wenn Stapel) |
| `entries[]` (wenn Einzel-TX klein) oder **nur Root** | Pro Eintrag: `message_id`, `sender` (Adresse oder Hash), `timestamp`, `primary_transport` (enum), `content_hash` (32 B), `mime_type` optional, `template_id` optional |

**Variante verschlüsselter Inhalt:**

| Feld | Inhalt |
|------|--------|
| Wie oben **plus** | `ciphertext: vector<u8>`, `iv`, `tag`, optional `key_id` / Recipient-Set-Hash |

**Schlüssel:** Wiederverwendung der **Messenger-Verschlüsselung** (ECDH/AES-GCM) oder **separater Archiv-Schlüssel**, der nur **Verankerungs-Empfänger** (z. B. Einsatzleitung) entschlüsseln kann – **Move- und Vault-Design** im Implementierungs-Task festlegen.

### 6.3 Größen- und Policy-Limits

| Regel | Vorschlag |
|-------|-----------|
| Max. Blob pro TX | z. B. **64–256 KiB** (an Move/Gas anpassen); darüber kein stiller Vollblob – **Hash-Stapel** oder **Chunking** (später). |
| Stapel / Verlauf | **Standard:** **ein** `moveCall` mit **`merkle_root`** + Referenz auf **Manifest** (Hash des Manifests optional mit on-chain). |

### 6.4 Modularität im Messenger (Implementierungsleitplanken)

Dieses Feature soll **nicht** den Kern-Chat verklumpen:

| Leitplanke | Bedeutung |
|------------|-----------|
| **Optionaler Querschnitt** | API-Endpunkte (z. B. `/api/protocol-anchor*`) und Move-Calls **getrennt** vom LoRa-/Mesh-Codepfad; keine zyklischen Abhängigkeiten Chat ↔ Anker. |
| **UI** | Menüeinträge und Dialoge in **eigenem UI-Block** (eigene Komponenten/Hook), die nur über **Callbacks** auf generische Nachrichten-IDs/Manifeste zugreifen. |
| **LoRa / Heltec** | Transport-Badge und Verankerung lesen **nur** das **einheitliche Nachrichtenmodell** (`Message` / Metadaten), nicht interne LoRa-Encoder-Details. |
| **Ausbau** | Deaktivierung per **Feature-Flag** oder fehlendem Move-Modul: Chat bleibt nutzbar ohne Verankerung. |

*Hinweis:* Der **Ist-Zustand** des Repos (tote Imports, vollständige modulare Trennung) ist **nicht** Gegenstand dieser Spec; Ziel ist **architektonisch** schlanke Integration bei Implementierung.

---

## 7. Verifizierung („Verifiziert“)

### 7.1 Nutzerflow

- In der Nachrichtenzeile: Aktion **„Verifiziert“** (ein Tap).
- Optional vor dem Tap: Einstellung **„Transport in Verifikation speichern“** (global oder pro Aktion), **Default: aus**.

### 7.2 On-chain oder off-chain?

- **On-chain** (empfohlen für echten Nachweis): Eintrag in Move-Objekt oder Event, z. B. `verify_message( message_ref, content_hash, optional_transport )`.
- **message_ref:** kanonisch **`message_id` + `thread_id` + `content_hash`** (verhindert Verwechslung bei Edits – wenn Edits existieren, Ref-Versionierung nötig).

### 7.3 Signatur

- **Verifier** signiert mit Wallet: Bindung an `(message_ref, verifier_address, timestamp_ms [, primary_transport])`.
- **Idempotenz:** gleicher Verifier + gleiche `message_ref` → entweder **no-op** oder **Update Zeitstempel** (Policy wählen).

### 7.4 Option „Transport speichern“

- Wenn **an:** zusätzliches Feld `verified_with_transport: TransportChannel` im Event.
- Wenn **aus:** nur `message_ref` + Signatur (weniger Metadaten-Leck).

---

## 8. Chat-Darstellung (Transport-Badge)

- **Immer sichtbar** pro Nachricht: **diskretes Icon oder Kurzlabel** (nicht nur bei Hover).
- **Ketten:** primär **erster / ingress-Pfad**; **Tooltip** (oder expandierbar) für **vollständige Leg-Liste** (`transports` / `transportLegs`).
- Schmale Displays: **Icon-only** mit Tooltip = weiterhin „immer sichtbar“ (Icon bleibt sichtbar).
- **Kein** Ersatz für Nachrichtentext.

---

## 9. Move-Modul – grobe Schnittstelle (Entwurf)

Namen nur illustrativ; Package `messaging` oder neues `protocol_anchor`:

```text
// Stapel-Anker (bevorzugt)
anchor_manifest(
  merkle_root: vector<u8>,
  manifest_cid_or_hash: vector<u8>,  // optional Verweis auf off-chain JSON
  entry_count: u64,
  ctx: AnchorContext
) -> AnchorReceipt

// Einzel-Verifikation
verify_message(
  message_id: vector<u8>,
  thread_id_hash: vector<u8>,
  content_hash: vector<u8>,
  include_transport: bool,
  transport: u8  // optional, 255 = unset
)
```

**Events:** `Anchored`, `Verified` für Indexer/Explorer.

---

## 10. Implementierungsphasen (empfohlen)

1. **Datenmodell:** `Message` um `primaryTransport` / normalisierte `transports` erweitern; alle Sendepfade setzen Werte konsistent.
2. **UI-Badges** im Chat (ohne On-chain).
3. **Off-chain Manifest + Signatur** (lokal exportierbar) als Prototyp.
4. **Move `anchor_manifest` + `verify_message`** + API `/api/protocol-anchor` (Server baut TX).
5. **UI „Protokoll & Nachweis“** mit Auswahlmodi und Merkle-Batch.

---

## 11. Kurzfassung (Abnahme-Kriterien)

- Nutzer kann **wählen**: einzeln / multi / Verlauf.
- **Verlauf:** **Merkle-Root + Manifest** als **Standardpfad**; **klare Warnung** zu Größe / geschätzter TX-Last; **Empfehlung Hash-only** sichtbar, **freie Wahl** bleibt.
- **Verankerungsmodus:** **kein** globaler Produkt-Default; **explizite Wahl** Hash vs. verschlüsselter Vollinhalt, mit **sachlicher Vorauswahl** je Kontext; **Opt-in** „immer Hash für Stapel“ nur mit **klarer Bezeichnung** (**§4.2**).
- **Transport:** sendeseitig korrekt gesetzt; **dauerhaft sichtbares** Badge (erste Leg; Details im Tooltip).
- **Verifiziert:** ein Tap; **Transport in Verifikation** optional (Default aus).
- **Menü:** **„Protokoll & Nachweis“** **unaufdringlich** (Chat-Overflow / Untermenü), **keine** Haupt-Kachel; Chat-Flow bleibt schnell.
- **Kein** CMS.

---

## 12. Alt-Nachrichten & Randfälle

### 12.1 Transport `unknown`

| Aspekt | Festlegung |
|--------|------------|
| **Badge** | Einheitlich **`unknown`** (oder „?“) – **keine** erfundene Zuordnung zu LoRa/IOTA. |
| **Verankerung** | Nachrichten fließen **normal** in Auswahl / Merkle-Manifest ein. Im Manifest: `primary_transport: "unknown"` (oder Enum-Wert `255`). **Kein** automatischer Ausschluss. |
| **Risiko-Hinweis** | Wenn der Nutzer **nur** `unknown`-Einträge verankert: UI-Hinweis, dass der **Transportpfad** für den Nachweis **unvollständig** ist – trotzdem **Hash/Ciphertext** verankerbar. |
| **Empfehlung** | Wo möglich **Migration**: alte Logs mit Heuristik (`source: mailbox` → `iota`) **einmalig** beim Laden markieren; Heuristik in Release-Notes dokumentieren. |

### 12.2 Rechtliche Kurztexte

- Pro Jurisdiktion / Organisation: Kurztext für „**ganzer Verlauf verankern**“ und personenbezogene Metadaten.

---

*Dokument verfeinert die Produktidee „iziPublish light“ zu einer implementierbaren, risikoarmen Architektur.*
