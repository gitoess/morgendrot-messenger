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

**Implementierungsanker:** `inferDeviceTimeTrust` in **`src/shared/device-time-trust.ts`** (Spiegel **`frontend/frontend/lib/device-time-trust.ts`**). **Messenger:** `GET /api/status` via **`fetchStatus`** liefert bei Erfolg **`pollClockHint`** (`okAtMs`, HTTP-`Date` → `httpDateUtcMs`); `useChatViewApiStatusPoll` setzt daraus **`hadRecentPlausibleServerTimeFromPoll`**; optional später **Geolocation** für `hasTrustedGpsUtcFix`.

---

## 7. Fazit

- Die **Lücke** ist real: **Abgleich** zwischen **Transport/Offline** und **Chain** braucht **klare Regeln**, **Idempotenz** und **Dedup** — nicht **eine** magische **CRDT-Schicht** über alles.  
- **Delayed Upload** + **`canonical_msg_ref`** sind der **richtige Kern** für **Nachrichten-Pfad**; **Credits** und **andere Move-Calls** brauchen **eigene** Queues/Regeln (**Offline-Queue-Kritik**).  
- **ATAK, UI, Karten** bleiben **substantiell** — Sync ist **eine** kritische Schicht, **nicht** „der Rest ist Deko“.

---

*Stand: 2026-03-30*
