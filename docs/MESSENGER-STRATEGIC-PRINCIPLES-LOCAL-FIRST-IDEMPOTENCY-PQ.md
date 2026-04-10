# Messenger: Local First, Idempotenz, kryptografische Agilität — Ideen, Kritik, präzisierte Fassung

**Status:** **Strategie-Einordnung** — übernimmt sinnvolle Ziele, korrigiert **Missverständnisse**, die zu **Doppelbuchungen** oder **Überversprechen** (Post-Quantum) führen würden.

**Verknüpft:** **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (§ **H.12**), **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`** (§ **H.13**), **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`**, **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`**, **`SECURITY-RATING.md`**, Ist-Krypto/README (ECDH P-256, AES-GCM).

---

## Codeumfang (Messengers, grob — nur Orientierung)

Gezählt: **Zeilen** in `.ts`/`.tsx` (PowerShell `Measure-Object -Line`), **ohne** `node_modules`/`.next`. **Stand:** Rechner-Stand beim Erstellen dieses Dokuments; nach Refactors neu messen.

| Bereich | Dateien (ca.) | Zeilen (ca.) | Hinweis |
|--------|----------------|--------------|---------|
| **`frontend/`** (Next-PWA „Kunden-Messenger“ gesamt) | ~172 | **~25 000** | Enthält Chat, Setup, Shop, UI-Bibliothek — nicht jede Zeile ist „nur Chat“. |
| **`frontend/frontend/`** (tieferliegender UI-/Chat-Kern) | ~93 | **~16 000** | Schwerpunkt Chat/Mesh/Transport-Helfer. |
| **`src/messenger-nest/`** (Terminal-/Nest-Messenger-Logik) | 12 | **~3 100** | Fetch, Connect, Listener, Befehle. |
| **Summe** `frontend` + `src/messenger-nest` | — | **~28 100** | Typischer „Messenger-Stack“ **ohne** gemeinsames Monolith-API. |
| **`src/api-server.ts`** (alle Rollen/APIs) | 1 | **~3 100** | Stark geteilt: Messenger nutzt `/api/*`, Boss, Locks, … |
| **`src/api/**/*.ts`** | viele | **~675** | Teilrouten; Gesamt-Backend >> nur Messenger. |

**Kurz:** Allein **~28k Zeilen** für PWA + Nest-Messenger; das **volle** Backend (Chain, Shop, Provisioning, …) kommt **zusätzlich** in `src/` dazu.

---

## 1. „Local First“ statt „Online First“ (Daten-Autarkie)

### Was an der Idee stimmt

- **Sofortige Reaktion:** Texteingabe, Entwürfe, **lokale** Kontakt-/UI-Daten sollten **nicht** von einem erreichbaren Server abhängen.
- **Hintergrund-Settlement:** Passt zum Muster **Queue → bestätigte Chain-TX** (siehe Delayed-Upload-Spec, Settlement-Queue als Vorbild).

### Kritische Korrekturen (Fehler in der naiven Fassung)

1. **„Alle Operationen … Credits virtuell abziehen“** — **gefährlich**, wenn es wie **endgültiger Verbrauch** wirkt. **Globale** Guthaben/Credits sind **Ledger-Sache**; lokal nur **Schatten** („reserviert / ausstehend / angezeigt“), bis die Chain **einmal** gebucht hat. Sonst: **Doppelverbrauch** bei zwei Geräten oder „offline zweimal senden“.
2. **„Kein Unterschied Online/Offline“** — für **UX-Latenz** strebenswert; für **Wahrheit** irreführend: **bestätigte** Wirkung (Mailbox-Event, Abbuchung) bleibt **Chain- oder Policy-abhängig**. Die UI soll **ehrlich** unterscheiden: *lokal gespeichert* vs. *global wirksam*.
3. **Blockchain nur „reiner Hintergrund“** — für **Nachrichten mit globaler Bedeutung** ist die Chain **kein** dekoratives Archiv, sondern **Autorität**, sobald man **Zustellung/Audit/Purge** braucht — siehe **`SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**.

### Präzisierte Zielformulierung

**Local First** bedeutet: **Optimistische lokale Ausführung** für alles, was **ohne Chain sinnvoll** ist (Eingabe, Queue, Cache, Status „ausstehend“), plus **Hintergrund-Sync**; **kein** behaupteter **sofortiger** globaler Credits-Abzug ohne **idempotente** On-Chain- oder Hub-Regeln. **Settlement** läuft unsichtbar weiter, sobald Netz da ist — **ohne** die Illusion, Offline und Online seien **dieselbe** ökonomische Wahrheit.

---

## 2. Formale Idempotenz-Garantie (Schutz vor Doppel-Events)

### Was an der Idee stimmt

- In **Mesh/LoRa** sind **Duplikate**, **Reordering** und **Mehrfachzustellung** normal — **Dedup** und **stabile IDs** sind richtig.
- **`canonical_msg_ref`** (Delayed-Upload-Spec) ist genau diese Richtung für den **Nachrichten-Pfad**.

### Kritische Korrekturen

1. **„Eindeutige ID auf dem Handy reicht“** — **nein.** Die **Garantie** kommt erst, wenn **Move/Backend** die ID **speichert** oder **ablehnt**, wenn schon verarbeitet (Replay-Tabelle, Objektversion, explizite Idempotenz-Map). Sonst kann dieselbe ID **zweimal** in zwei PTBs landen, wenn zwei Relays parallel senden.
2. **Nicht jede Aktion** ist gleich: **Nachricht** ≠ **Credit-Mint** ≠ **Purge** — jeweils **eigener** Idempotenz-Mechanismus (siehe Offline-Queue-Kritik: **kein** Missbrauch von `mintMessengerCreditsBatchForRecipients` als generischer Queue).

### Präzisierte Zielformulierung

**Ende-zu-Ende-Idempotenz:** Pro **Vorgangstyp** eine **stabile Referenz** (vom Client erzeugt), die **bis zur Chain** durchgereicht wird **und** dort (oder im vertrauenswürdigen Gateway) **erzwungen** wird: **höchstens eine** wirksame Buchung/Anchor pro Referenz. Client generiert die ID; **Vertrag + Infrastruktur** machen daraus eine **Garantie**.

---

## 3. Kryptografische Agilität / Post-Quantum

### Was an der Idee stimmt

- **Algorithm agility** (Versionierung von KEM/AEAD, schrittweise Migration) ist **langfristig** sinnvoll.
- **Harvest-now-decrypt-later** ist ein **reales** Risiko für **heute** aufgezeichnete **Ciphertexte**.

### Kritische Korrekturen (häufige Fehler)

1. **„PQK einbauen = Chain-Ciphertexte in 10 Jahren sicher“** — **zu kurz gedacht.** Was **heute** on-chain oder im Log liegt, kann **kopiert** werden; Schutz braucht **PQ-hybrid** schon **beim Speichern/Übertragen**, nicht erst „irgendwann eine App-Update-Option“.
2. **„Wechsel ohne Neuinstallation“** — **teilweise** möglich (Software-Update, neue Handshake-Runden, **Key-Rotation** im Vault), aber **kein** kostenloser Schalter: Partner müssen **kompatibel** bleiben oder **parallel** alte/new Keys; **Move/Vault**-Felder müssen **Versionen** tragen.
3. **Ist-Stand Morgendrot:** README nennt **ECDH P-256** + **AES-GCM** — ein **seriöser** PQ-Pfad wäre ein **eigenes Epik** (KEM-Agility, Testvectors, Interop), **nicht** ein Absatz in einer UX-Spec.

### Präzisierte Zielformulierung

**Agilität:** Spezifikation von **Versionsfeldern** und **mehrstufiger** Krypto (z. B. hybrid klassisch+PQ-KEM), **Rotation** und **Abwärtsstrategie** — **getrennt** von Messenger-Offline-UX. **Realistische Priorität:** oft **nach** belastbarem Mesh + Settlement; **parallel** nur, wenn Threat-Model **öffentliche Archive** / **lange Geheimhaltung** verlangt.

---

## Kurz-Fazit

| These (naiv) | Präzision |
|--------------|-----------|
| Alles sofort lokal wie online | **Ja** für Eingabe/Queue/UI; **Nein** für unbegründete globale Credits-Wahrheit. |
| Eine Handy-ID = Chain-Immunität | **Nein** ohne **durchgesetzte** On-Chain/Server-Idempotenz. |
| PQ später nachrüsten reicht für alte Daten | **Nein** für bereits exponierte Ciphertexte — **früh** hybrid denken, wenn PQ-Anforderung echt ist. |

---

*Stand: 2026-03-28*
