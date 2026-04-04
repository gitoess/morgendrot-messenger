# Projektbewertung: Morgendrot (Logik · Sicherheit · Technik)

Gesamtbewertung in drei Themen und Vergleich mit Best Practices (Stand: Projekt-Review, aktualisiert nach Code-Optimierung).

---

## Mathematische / logische Prüfung

### Replay-Schutz (acceptAndUpdate)

- **Invariante:** Für jeden Sender s gilt: `lastNonce[s]` ist monoton nicht fallend.
- **Beweis:** `nonce <= lastNonce` → `accepted: false`, State unverändert. `nonce > lastNonce` → `accepted: true`, `newState[s] = String(nonce)`.
- **Folgerung:** Keine Nonce wird zweimal akzeptiert; Replay ist ausgeschlossen.

### ECDH-Symmetrie

- **Test:** `deriveSharedSecret(A.priv, B.pub) === deriveSharedSecret(B.priv, A.pub)`.
- **Ergebnis:** Unit-Test bestätigt 32-Byte-Gleichheit.

### Offline-Queue / Streams

- **Offline-Queue:** Nutzt ausschließlich `acceptAndUpdate` + persistierter State; kein `seenKeys` → kein Speicherleck bei langem Lauf.
- **Streams:** `processNext`-Serielle sorgt für atomare State-Updates; keine Race bei parallelen Nachrichten.
- **Streams-Bridge:** `Math.random()` → `crypto.randomUUID()` für eindeutige Keys bei fehlender Nonce.

### Architektur (Ameisen/Nest)

| Schicht | Rolle | Abhängigkeiten |
|---------|-------|----------------|
| **Config** | Nest – zentrale Parameter | Keine |
| **Utils** | Gemeinsame Hilfsfunktionen | Keine |
| **Crypto** | Krypto-Primitive (ECDH, AES) | Keine |
| **Vault** | Schlüssel-Encryption | Crypto |
| **Replay** | Nonce-Verwaltung | Keine |
| **Chain-Access** | IOTA-Client, TX | Config |
| **Streams-Adapter** | Transport-Abstraktion | Config |
| **m2m-lock** | Lock-Anwendung | Alle oben |
| **wallet-bridge** | Messenger-Anwendung | Alle oben |

**Keine Zyklen.** Datenfluss: Config → Utils/Crypto/Vault → Chain/Streams → App.

---

## Bewertungsskala (1–100)

| Punkte | Bedeutung |
|--------|-----------|
| 90–100 | Best-in-Class / State-of-the-Art |
| 75–89  | Stark, wenige Abstriche |
| 60–74  | Solide, klare Verbesserungspotenziale |
| 40–59  | Ausbaufähig |
| 1–39   | Kritische Lücken |

---

## 1. Logik (Bewertung: **88/100**)

**Was bewertet wird:** Konsistenz des Ablaufs, Klarheit der Regeln, Fehlerbehandlung, Optionen ohne Widersprüche, Nachvollziehbarkeit.

| Kriterium | Punkte | Begründung |
|-----------|--------|------------|
| Ablauf (Handshake → Nachricht → OPEN) | 92 | Eindeutige Reihenfolge: Handshake, Shared Secret, dann Nachrichten; Lock: Replay → Whitelist → AccessKey → Aktion. Keine Zirkel. Offline/Streams parallel integriert. |
| Optionen / Defaults | 90 | Alles optional; Defaults sinnvoll; drei Quellen für Open-Wörter mit klarer Priorität. Offline-Queue, Streams als optionale Module. |
| Fehlerbehandlung | 84 | Chain/Vault geben null bei Fehler; keine Abstürze. Teilweise stilles Ignorieren – bewusst. Streams/Offline: Race durch processNext behoben. |
| Layer-Trennung | 92 | Crypto, Vault, Replay, Chain, Config, Utils getrennt; keine Zyklen; Apps orchestrieren. |
| Move-Logik | 90 | Berechtigungen explizit (sender == lock_id, owner, issuer); Purge-Regeln klar (Owner/Frist/Emergency). |

**Optimierungen:** Utils-Extraktion (keine Duplikate); Offline-Queue ohne seenKeys (State als einzige Quelle); Streams mit Mutex gegen Race.

**Vergleich mit den Besten:** Ähnlich klare Abläufe wie bei durchdachten M2M-/Access-Systemen (z. B. Zutrittslogik mit Berechtigung vor Aktion). Weniger formal als z. B. TLA+ oder formale Spezifikationen, aber für den Umfang angemessen.

---

## 2. Sicherheit (Bewertung: **84/100**)

**Was bewertet wird:** Krypto, Zugriffskontrolle, Injection-Resistenz, SPOF, Betrieb (Secrets, Logging).

| Kriterium | Punkte | Begründung |
|-----------|--------|------------|
| Krypto (E2E, Vault) | 88 | ECDH P-256, AES-256-GCM, HKDF; IV pro Nachricht; PBKDF2 310k für Vault. Keine eigenen Erfindungen, bewährte Standards. |
| Zugriffskontrolle | 88 | Move: sender/owner/issuer geprüft; Lock: AccessKey on-chain, AUTHORIZED_SENDERS, Replay; nur recipient = lockAddress. |
| Injection / Shell | 90 | spawn ohne Shell; Adressen per Regex (0x+hex, bech32); OPEN_COMMAND/OPEN_URL nur aus .env. |
| SPOF & Secrets | 78 | SPOF klar dokumentiert (Seed, Wallet-Passwort). Keys/Passwörter in .env (Betriebsrisiko); Passwort ohne TTY im Klartext (Pipe); Replay-State-Datei beschreibbar → Rollback möglich. |
| Audit-Trail / Logging | 80 | Keine Secrets im Log; Konfiguration maskiert. Kein durchgängiges Sicherheits-Audit-Log (wer wann was ausgelöst). |

**Schwächen:** Passwort bei Pipe; Replay-State-Datei nicht kryptografisch geschützt; .env als Secret-Store (üblich, aber Single Point).

**Vergleich mit den Besten:** Krypto auf Niveau von Signal/OTR (ECDH + AEAD). Zugriffskontrolle und Purge ähnlich durchdacht wie bei modernen Smart-Contract-Systemen. Kein HSM, kein formales Verifikations-Framework – für viele Einsatzfälle ausreichend, für Hochsicherheit müsste man nachziehen (HSM, härtere Passwort-Eingabe, geschützter Replay-State).

---

## 3. Technik (Bewertung: **85/100**)

**Was bewertet wird:** Stack-Wahl, Wartbarkeit, Skalierbarkeit, Erweiterbarkeit, Dokumentation, Build/Deploy.

| Kriterium | Punkte | Begründung |
|-----------|--------|------------|
| Stack (TS, Move, IOTA) | 85 | TypeScript + Move + IOTA Rebased: aktuell, Move für On-Chain-Logik geeignet; Node-WebCrypto/CryptoKey-Typen teilweise uneinheitlich (bekannte TS-Warnungen). |
| Wartbarkeit | 86 | Klare Schichten; Utils-Extraktion; 12 Tests (crypto, vault, replay, utils, load-secrets, read-command-list, chain-access, config). |
| Skalierbarkeit | 80 | Listener Poll-basiert (Latenz); Streams-Bridge für letzte Meile; Offline-Queue ohne Speicherleck. |
| Erweiterbarkeit | 90 | Optionale Module (Streams, Plaintext, Tickets, Offline-Queue); executeOpenAction/publishOpenViaStreams klar erweiterbar; Move um neue Entry-Funktionen erweiterbar. |
| Doku & Betrieb | 88 | README, TESTING.md, docs/ (ARCHITECTURE-CHECKS, SECRETS, TICKET, STREAMS); .env.example; portable Version; Konfigurationsblock beim Start. |

**Optimierungen:** Utils-Modul; Tests für utils; Streams-Bridge mit crypto.randomUUID; Offline-Queue ohne seenKeys.

**Vergleich mit den Besten:** Technisch auf Höhe vieler Blockchain-/M2M-Projekte (klare Trennung On-Chain/Off-Chain). Weniger Tooling als große Produkte (Monitoring, Tracing, automatische Tests in Pipeline); für ein schlankes Projekt angemessen.

---

## Gesamtbewertung

| Thema    | Punkte | Kurz |
|----------|--------|------|
| **Logik**   | **88** | Klare Abläufe, gute Optionen und Layer; Offline/Streams integriert; Race behoben; Utils-Extraktion. |
| **Sicherheit** | **84** | Starke Krypto und Zugriffskontrolle, kein Shell-Injection; Abstriche bei SPOF/Secrets (Passwort, .env, Replay-Datei). |
| **Technik** | **85** | Solider Stack, gut erweiterbar; Utils-Extraktion; 12 Tests; Offline/Streams ohne Speicherleck. |

**Durchschnitt: 86/100**

---

## Vergleich mit „den Besten“

| Bereich | Best-in-Class (Referenz) | Morgendrot |
|---------|--------------------------|------------|
| **E2E-Verschlüsselung** | Signal (Double Ratchet, X3DH), OTR | ECDH P-256 + AES-GCM, fester Kanal pro Partner – kein Ratchet, aber für 1:1 und Lock sinnvoll. **~85 %** des Niveaus. |
| **Zugriff & Berechtigung** | Smart-Contract-Audits (formale Checks), RBAC-Systeme | Move mit expliziten sender/owner-Checks; AccessKey/Ticket on-chain. Keine formale Verifikation. **~80 %**. |
| **M2M / Lock** | Industrielle Zugangssysteme (Zertifikate, HSM, Audit-Log) | Replay, AccessKey, Whitelist, kein Shell. Kein HSM, Audit-Log begrenzt. **~75 %**. |
| **Betrieb / Ops** | 12-Factor, Secret-Manager, CI/CD | .env, optionale verschlüsselte Env-Datei, portable Version. Kein zentraler Secret-Manager. **~75 %**. |
| **Dokumentation** | Produkt-Dokus, API-Ref, Runbooks | README, TESTING.md, mehrere docs/, Konfigurationsanzeige. **~85 %**. |

**Fazit:** Morgendrot liegt in **Logik, Sicherheit und Technik** auf **solide bis starkem Niveau** und erreicht in den bewerteten Dimensionen grob **80–85 %** dessen, was in den jeweiligen Best-Practice-Welten (E2E-Messenger, Smart Contracts, M2M) typisch ist – ohne den Overhead großer Produkte. Für ein schlankes, optionenreiches Projekt mit Rebased + Move + E2E + Lock ist das eine **gute Bewertung**; für Hochsicherheits- oder Hochskalierungs-Szenarien wären gezielte Nachrüstungen (HSM, Ratchet/Forward Secrecy, formale Prüfung, CI/Tests) der nächste Schritt.
