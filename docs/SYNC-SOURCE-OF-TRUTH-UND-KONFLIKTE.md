# Sync: Source of Truth, Konflikte, Offline/Online (Einordnung)

**Status:** **Architektur-Doku** — festhalten, **warum** „zwei Welten“ (Mesh vs. IOTA) **kein** automatisches **CRDT-Universalproblem** lösen und **wie** Morgendrot **trotzdem** konsistent bleiben kann. **Kein** vollständig implementierter Merge-Algorithmus in diesem Dokument.

**Verknüpft:** **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** (`canonical_msg_ref`, Queue, Dedup), **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`**, **`docs/MESSENGER-STRATEGIC-PRINCIPLES-LOCAL-FIRST-IDEMPOTENCY-PQ.md`** (Local-First-Idee, Idempotenz, PQ — **kritisch präzisiert**), **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`**, **`SECURITY-RATING.md`** (Replay, Mailbox), **`docs/ROADMAP-FAHRPLAN.md`** § **H.12** / **H.6c** (Geräte-Uhr), **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`**, Code **`src/shared/device-time-trust.ts`** (§6 unten).

---

## 1. Problemstellung (präzise)

| Welt | Rolle |
|------|--------|
| **IOTA (online)** | **Globale** Zustände: Mailbox-Events, Objekte (Credits, Tickets, Vault-Refs, …), sobald **bestätigte** Transaktionen vorliegen. |
| **Mesh / lokaler Puffer** | **Transport** und **Zwischenhalt** (z. B. Delayed Upload, lokale Anzeige, Client-Cache) — **nicht** automatisch dieselbe **Autorität** wie die Chain. |

**Risiko:** Gleiche oder widersprüchliche Aktionen von **mehreren Geräten** oder in **wechselnder Reihenfolge** (erst offline, parallel online) — **Doppelverbrauch**, **doppelte** Operationen, **veraltete** lokale Anzeige.

**Unpräzise Formulierung (vermeiden):** „Zwei Wahrheiten“ ohne Trennung **nach Vorgangstyp** — besser: **pro Operation** eine **definierte** Quelle der Wahrheit und **klare** Übergänge (Queue → Chain).

---

## 2. Source of Truth **pro Vorgangstyp**

| Vorgang | Autorität | Anmerkung |
|---------|-----------|-----------|
| **Mailbox-Nachricht / Purge (on-chain)** | **IOTA** nach bestätigter TX | Mesh liefert **Inhalt** oder **Verzögerung**; **Wahrheit** „existiert / gelöscht“ = Chain + lokaler Index der Events. |
| **Delayed LoRa → IOTA** | **Node-Queue** → **eine** Upload-TX pro `canonical_msg_ref` | Siehe **`LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** §8/9 — **Dedup** vor erneutem Anchor. |
| **Messenger-Credits / MIST / Gas** | **IOTA-Regeln** des Objekts | **Kein** CRDT-Ersatz: Doppelabbuchung muss **on-chain** oder durch **Policy** (ein Gerät, ein Signer) verhindert werden. |
| **Offline-Boss-Queue (generisch)** | **Noch zu modellieren** — **typisierte** Einträge, **kein** Missbrauch von `mintMessengerCreditsBatchForRecipients` | **`OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`** Teil A. |
| **Lokale UI (gelesen, Sortierung, Entwurf)** | **Gerät** | Darf von Chain abweichen, bis Sync; **kein** Anspruch auf globale Identität aller Clients. |

**„Löschen“:** Unterscheiden: **nur lokal** aus Cache vs. **Chain-Purge** — nur Letzteres ist **global** für alle Full-Nodes.

---

## 3. CRDTs und verwandte Ideen — **ohne** Mythos

**CRDTs** (und ähnliche **konvergente** Strukturen) garantieren **Zusammenführung** für **wohldefinierte** Datentypen unter **klaren Annahmen** — **nicht** für beliebige Geschäftslogik.

| Aussage | Einordnung |
|---------|------------|
| **„Mathematisch nie widersprüchlich“** | Nur für **spezifische** CRDT-Typen + kommutative Updates — **nicht** pauschal für **E2EE-Payloads**, die der Server **nicht** mergen darf. |
| **„Alle gleicher Chatverlauf + gleicher Kontostand“** | **Kontostand:** **Ledger**, nicht CRDT. **Chat:** bei E2EE oft **kein** zentraler Merge der **Inhalte** — höchstens **Metadaten** (z. B. Zustellstatus) oder **Client-seitiger** Merge nach Decrypt. |
| **Sinnvoller Einsatz bei Morgendrot** | Z. B. **nicht-sensible** Sets/Flags (gelesen, UI-State), **Dedup-Keys**, **Idempotenz** über `canonical_msg_ref` — **ergänzend**, nicht als **Ersatz** für Chain. |

---

## 4. Praktische Bausteine (bereits oder geplant im Projekt)

| Baustein | Funktion |
|----------|----------|
| **`canonical_msg_ref`** | **Eine** logische Nachricht = **eine** Referenz für Queue, Manifest, Dedup (**LORA-Spec**). |
| **Replay / Nonce** | Schutz vor **Wiedereinspielen** bekannter Nachrichten — siehe **`replay-state.ts`** / **`SECURITY-RATING.md`**. |
| **Mesh-Fragment-Dedup** | Client-seitig zusammengeführte MF1-Bursts — verhindert **doppelte Anzeige**, nicht automatisch **Chain-Doppel-TX**. |
| **Settlement-Queue-Muster** | **`settlement-queue.ts`** — Vorbild für **typisierte**, **idempotente** spätere On-Chain-Schritte. |
| **Delayed-Upload-Queue (Spec)** | Backend-Queue, Retry, Dedup gegen Mailbox — **LORA-Spec** §9.8. |

---

## 5. Mehrere Geräte — explizite Politik

Ohne Produktentscheidung drohen **Rennen** (zwei Geräte, gleiche Credits, gleicher Purge):

- **Option A:** **Ein** aktives **Signer-Gerät** pro Identität im Einsatz (organisatorisch).  
- **Option B:** **Chain** entscheidet; zweite TX **scheitert** oder wird **idempotent** erkannt — **UI** zeigt Fehlversuch.  
- **Option C:** **Benutzer** löst Konflikt (zwei angezeigte Zustände) — **nur** wenn unvermeidbar.

Diese Optionen **dokumentieren** und **nicht** durch „wir bauen später CRDT“ ersetzen.

---

## 6. Geräte-Uhr (Cold-Start, ohne Internet)

**Problem:** Nach längerem Aus oder **Funkloch** kann `Date` auf dem Handy **falsch** sein — **IOTA-Zeitstempel**, **GPS-Logs** und **Attestation-Metadaten** werden **fälschlich** eingeordnet (**Fahrplan § H.6c**).

| Signal (Beispiele) | Einordnung |
|--------------------|------------|
| **Explizite** Referenzzeit (Server-Date, Indexer/Chain im Toleranzfenster) | **Hoch** — UI darf ohne Zusatzwarnung stempeln (Policy trotzdem prüfen). |
| **GPS-UTC** aus gültigem Satelliten-Fix (nicht nur Koordinate) | **Hoch** — typisch im Gelände offline. |
| Nur `navigator.onLine === true` | **Mittel** — Uhr kann manuell falsch sein. |
| Offline **und** kein GPS-Zeit | **Niedrig** — vor **MSG_ATTESTATION** / Export **warnen** oder blockieren (Produktentscheid). |

**Implementierungsanker:** `inferDeviceTimeTrust` in **`src/shared/device-time-trust.ts`** (Spiegel **`frontend/frontend/lib/device-time-trust.ts`**). **Messenger:** `GET /api/status` via **`fetchStatus`** liefert bei Erfolg **`pollClockHint`**; `useChatViewApiStatusPoll` → **`hadRecentPlausibleServerTimeFromPoll`**; im **privaten** Chat einmaliger **Geolocation**-Probe für **`hasTrustedGpsUtcFix`** (Browser-Zustimmung).

**Payload auf dem Funkweg (privater Mesh-v2-Pfad, Ist):** Die App baut über **`/mesh-build-v2`** **verschlüsselte** Binärnutzlast — **kein** Klartext in den LoRa-Bytes für diesen Pfad (**App-Layer-Verschlüsselung vor dem Heltec**). **Meshtastic** kann dennoch **Metadaten** oder **interne** Puffer halten; das ersetzt **nicht** ein Threat Model und **nicht** die Diskussion **LittleFS** auf dem Radio (**Fahrplan § H.6c** / **§ H.6e**).

---

## 7. Fazit

- Die **Lücke** ist real: **Abgleich** zwischen **Transport/Offline** und **Chain** braucht **klare Regeln**, **Idempotenz** und **Dedup** — nicht **eine** magische **CRDT-Schicht** über alles.  
- **Delayed Upload** + **`canonical_msg_ref`** sind der **richtige Kern** für **Nachrichten-Pfad**; **Credits** und **andere Move-Calls** brauchen **eigene** Queues/Regeln (**Offline-Queue-Kritik**).  
- **ATAK, UI, Karten** bleiben **substantiell** — Sync ist **eine** kritische Schicht, **nicht** „der Rest ist Deko“.

---

## 8. PWA: Mailbox-Klartext-Outbox vs. andere Warteschlangen (**H.15 Stufe 3**)

**Ziel:** **Eine** kanonische Implementierung der **Messenger-Mailbox-Outbox** (fehlgeschlagene `/send` / `/send-plain`, Dedup, Drain) — keine zweite, parallele „Settlement“-Logik im Browser.

| Baustein | Rolle | Doppelbau vermeiden |
|---------|--------|---------------------|
| **`@morgendrot/core`** | **`createOfflineMailboxManager`**, Speicher-Ports, **`canonical_msg_ref`**, Drain-Scheduler-Semantik | **Kanonische** Queue- und Idempotenz-Regeln nur hier pflegen. |
| **`frontend/frontend/lib/api/offline-queue.ts`** | **Nur** Adapter: `localStorage`, Opt-in **`morgendrot.offlineMailboxQueue`**, Hybrid-**`OfflineMailboxTrySend`** (Direkt-RPC für Klartext, sonst HTTP über **`chat-commands`**) | Keine eigenen Dedup-/State-Maschinen neben dem Core — nur Konfiguration und Browser-APIs. |
| **`frontend/frontend/lib/attestation-queue.ts`** | Eigener Produktpfad (Manifeste / Attestation), Key **`morgendrot.attestation-queue.v1`** | **Nicht** mit **Mailbox-Outbox**-Einträgen oder **`canonical_msg_ref`** der Messenger-Nachricht vermischen. **Submit (MVP):** `browserAttestationSubmit` → **`sendPlaintextMailboxHybrid`** an die **eigene** Absenderadresse, Wire **`[[MORG_ATTESTATION_MANIFEST_V1]]`** — gleiche **Direct-zuerst**-Reihenfolge wie andere Klartext-Anker, aber **separate** Queue und kein Core-`OfflineMailboxManager`. |
| **Server / Phase B** | **`LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** — Delayed Upload, Node-Queue | Andere **Deployments-Grenze**; vor neuer Settlement-Queue **§ H.12** + **`OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`** lesen. |

**Klartext einmal senden:** Pro logischer Nachricht gilt **`clientOutSeq`** / **`canonical_msg_ref`** aus dem Core — weder Direkt-RPC noch späterer HTTP-Retry darf dieselbe Nutzlast **doppelt** als neue Chain-Nachricht ausgeben; bei Konflikt **Fehler anzeigen** und Eintrag **pending** lassen (siehe Core-Drain-Tests).

### 8.1 Retry / Backoff (**Stufe 3** — vertieft, Ist-Code)

| Mechanismus | Ort | Kurzbeschreibung |
|-------------|-----|------------------|
| **Exponentielles Backoff** | **`@morgendrot/core`** `backoffMsForDrainAttempt(attempts)` | `min(120_000, 1500 * 2^min(attempts, 8))` ms — **`packages/morgendrot-core/src/queue/offline-mailbox/state.ts`**. |
| **Defer** | **`shouldDeferDrainAttempt(item, now)`** | Eintrag wird im Drain-Durchlauf **übersprungen**, bis Wartezeit seit **`lastAttemptAt`** erreicht ist. |
| **Fehler-Bump** | **`bumpOfflineMailboxItemAfterFailedSend`** | **`attempts++`**, **`lastError`**, bleibt **`PENDING`** — **kein** zweites Queue-Objekt für dieselbe logische Nachricht. |
| **Tests** | **`state.test.ts`** | Deckt Backoff/Defer ab — bei Änderungen an der Retry-Politik **`npm run test:core`** ausführen. |

**Konflikt mit „Settlement“:** Diese Outbox ist **Transport-Wiederholung** bis erfolgreicher **eine** Submit-Operation (Direkt oder HTTP); sie ersetzt **nicht** die spätere **Paket-7-voll**-Relay-/Settlement-Semantik (**§ H.3g**, **`OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`**).

---

*Stand: 2026-03-30 — § 8 / § 8.1 ergänzt 2026-04-28 (H.15 Stufe 3).*
