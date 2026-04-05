# Industrie-Features (Siemens & Co.)

Überblick über Funktionen für Industrie- und Compliance-Anforderungen: Gas Station, Audit Blackbox, ZK-Identität (Roadmap), Multi-Sig Boss, Euro-Orakel.

---

## 1. Gas Station (Sponsoring / automatisches Nachladen)

**Problem:** Niemand will Ladesäulen oder Sensoren manuell mit IOTA „betanken“.

**Begriff:** Dieses Kapitel beschreibt **`src/gas-station.ts`** (Worker-**Top-Up**). Die **„Gas Station“** aus **IOTA-Netzwerk-/Sponsor-Doku** (Package-Filter, PTB-Limits, …) ist eine **andere** Schicht — siehe **`docs/SPONSORING-AND-CREDITS-DOUBLE-FLOOR.md`**.

**Stand Projekt:**
- **Sponsored Transactions:** `SPONSOR_GAS_OWNER`, `SPONSORED_TRANSACTION_ENABLED`; API `sponsorForSender` – der Boss (oder eine zentrale Adresse) kann Gas für eine TX übernehmen.
- **Manuell:** UI/API sendet bei Key-Ausstellung `sponsorForSender: "0x…"` → Sponsor zahlt.

**Erweiterung (Gas Station):**
- **Boss-Signer** oder ein Begleitdienst prüft periodisch die **Worker-/Sensor-Adressen** (z. B. aus `WORKER_ADDRESSES` oder Monitor-Liste).
- Wenn ein Worker **unter Schwellwert** (z. B. 0.1 IOTA): automatisch **1 IOTA** per `transfer-coins` schicken oder die nächste TX als **Sponsored Transaction** ausführen.
- Konfiguration: `GAS_STATION_ENABLED`, `GAS_STATION_MIN_IOTA`, `GAS_STATION_TOPUP_IOTA`, `GAS_STATION_CHECK_MS` (optional).

**Implementierung:** `src/gas-station.ts` – `runGasStationCheck(bossAddress, getPassword)` prüft `WORKER_ADDRESSES`, ruft bei Bedarf `transferCoins` auf. Im Boss-Modus mit Wallet startet ein periodischer Lauf (Interval `GAS_STATION_CHECK_MS`). API: **POST /api/gas-station-check** (nur Boss, Wallet entsperrt) für manuellen Lauf; Antwort: `{ ok, toppedUp, skipped, errors }`.

**Dokumentation:** Siehe auch `docs/BOSS-MODUS.md` und `.env.example` (SPONSOR_*, GAS_*).

---

## 2. Audit Blackbox (fälschungssicheres Logbuch)

**Problem:** Für Versicherungen/Compliance muss nachweisbar sein, wer wann was gemacht hat.

**Stand Projekt:**
- **Audit-Log:** `audit-log.ts` – strukturierte Events (alarm, sensor, offline, purge, heartbeat). Export als **CSV** und **PDF** (`/api/audit-export`). Datei: `AUDIT_LOG_FILE` (Default: `logs/audit.jsonl`).

**Erweiterung (Blackbox via Streams):**
- Jede relevante Aktion (OPEN, Alarm, Key erstellt, Purge, …) wird weiterhin lokal geschrieben **und** optional als **Hash (oder kompaktes Event)** in **IOTA Streams** (oder on-chain) geschrieben.
- Vorteil: **Unlöschbares Logbuch** – Dritte können die Reihenfolge und Integrität prüfen, ohne Klartext-Inhalte zu brauchen.
- Konfiguration: `AUDIT_STREAMS_ENABLED`, `STREAMS_ANCHOR_ID` (eigener Kanal für Audit). Bei `appendAuditEvent()` zusätzlich `streamsAdapter.publish(anchorId, hash(event))`.

**Implementierung:** In `src/audit-log.ts` wird nach dem Schreiben in die Datei bei `AUDIT_STREAMS_ENABLED` und gesetztem `STREAMS_ANCHOR_ID` asynchron der SHA-256-Hash des Events an den Streams-Adapter gepublisht (fire-and-forget). Kein Klartext in Streams, nur Hash zur Integritätsprüfung.

**Dokumentation:** Siehe `docs/STREAMS-INTEGRATION.md` und `src/audit-log.ts`.

---

## 3. Zero-Knowledge-Identität (Roadmap)

**Problem:** Siemens darf keine Mitarbeiter-Daten (Namen) auf die Chain schreiben; trotzdem soll gelten: „Ich bin ein berechtigter Mitarbeiter“.

**Lösung (Zielbild):**
- **zkLogin** oder **Zero-Knowledge-Proofs (ZKP):** Der Nutzer beweist „Ich bin berechtigt“, ohne dass Adresse `0x…` mit einem Namen verknüpft wird. Das IOTA-Netzwerk (oder ein Verifier) bestätigt nur die **Gültigkeit** des Beweises.
- **Integration:** KI in Säule 2 könnte den Beweis vorbereiten; Backend reicht den Beweis an einen Verifier weiter. Keine Speicherung von Personendaten on-chain.

**Status:** **Nicht implementiert.** Abhängig von verfügbaren ZKP-/zkLogin-Schnitten im IOTA-Ökosystem. Als **Roadmap** eingeplant; wenn IOTA/Rebased zkLogin oder kompatible ZKP-APIs anbietet, kann das Modul ergänzt werden.

**Dokumentation:** Dieses Dokument; bei Implementierung eigenes `docs/ZK-IDENTITY.md`.

---

## 4. Multi-Sig & Notfall-Schlüssel (Governance)

**Problem:** Wenn der Boss-Signer physisch zerstört wird oder der Laptop mit Ollama abbrennt, darf nicht ein einzelner Punkt das ganze System lahmlegen.

**Lösung (Design):**
- **Multi-Signatur für kritische Aktionen:** z. B. „Purge All“, „Global Reset“, „Emergency Purge“ erfordern **2 von 3** Boss-Adressen (oder konfigurierbar).
- Ablauf: Erste Signatur erzeugt „Pending Action“; zweite Signatur führt aus. Keys auf getrennten Rechnern/Standorten.

**Stand Projekt:**
- Aktuell **ein** Boss (`REMOTE_SIGNER_URL` bzw. eine Boss-Instanz). Kein Multi-Sig.

**Erweiterung (Schritte):**
- Konfiguration: `BOSS_MULTISIG_ADDRESSES` (kommagetrennt), `BOSS_MULTISIG_THRESHOLD` (z. B. 2). Welche Befehle „kritisch“ sind, wird in der API/Config definiert.
- Implementierung: Signatur-Sammlung (2-of-3) und Ausführung erst bei Schwellwert – eigener Baustein (Backend + ggf. UI „Pending Multisig“).

**Dokumentation:** Dieses Dokument; bei Implementierung `docs/MULTISIG-BOSS.md`.

---

## 5. Wirtschafts-Orakel (Euro → IOTA)

**Problem:** Industrie-Kunden rechnen in Euro/Dollar; Ladesäule soll „10 € pro Ladung“ verlangen, nicht manuell IOTA-Beträge eintippen.

**Lösung:**
- **Oracle** liefert den aktuellen **IOTA/Euro-Kurs** (z. B. Fetch-Agent oder öffentliche API).
- **Zahlungs-Trigger** oder UI: Nutzer gibt „10 €“ ein → App berechnet benötigte IOTA für den PTB und zeigt „Aktuell 10 € ≈ X IOTA“.
- Optional: Ladesäule akzeptiert Zahlung in IOTA; Mindestbetrag wird aus Euro + Kurs berechnet.

**Stand Projekt:**
- `PAYMENT_TRIGGER_MIN_IOTA` – Mindestbetrag in **IOTA**. Keine Euro-Umrechnung.

**Erweiterung:**
- Konfiguration: `IOTA_EUR_ORACLE_URL` (oder `PAYMENT_TRIGGER_EUR_RATE_URL`) – Endpunkt, der z. B. `{ "rate": 0.25 }` (IOTA pro 1 EUR) liefert.
- Helper: `getIotaEurRate()` → Kurs; `eurToIota(eur)` für Anzeige und ggf. dynamischen `PAYMENT_TRIGGER_MIN_IOTA`-Wert.
- Optional: Anzeige in Säule 3 (Zahlung) „10 € ≈ X IOTA (Stand: …)“.

**Implementierung:** `src/iota-eur-oracle.ts` – `getIotaEurRate()` holt von `IOTA_EUR_ORACLE_URL` den Kurs (erwartet JSON `{ "rate": number }` oder `{ "iotaPerEur": number }`), Cache 1 Min. `eurToIota(eur)` und `getCachedIotaEurRate()` für UI/Trigger. Anbindung an Payment-Trigger/UI optional.

**Dokumentation:** Siehe `.env.example` und ggf. `docs/STREAMS-INTEGRATION.md` (§ Zahlungs-Trigger).
