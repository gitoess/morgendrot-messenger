# Architektur-Checks: Optional, schlank, Layer, SPOF

Kurze Bestätigung zu vier Punkten.

---

## 1. Ist alles im Code / .env optional und so automatisiert wie möglich (Sicherheit hat Priorität)?

**Optional:**

- **Vault:** `VAULT_FILE` leer → Keys nur im Speicher oder aus On-Chain; `VAULT_REGISTRY_ID` optional.
- **Mailbox:** `MAILBOX_ID` leer → nur Events, kein Purge von Nachrichten/Handshakes; `USE_MAILBOX` default abhängig von `MAILBOX_ID`.
- **Öffnen-Wörter:** Drei Quellen (On-Chain, AES-Datei, .env); keine gesetzt → Fallback `open,öffnen`. `COMMAND_REGISTRY_ID`, `OPEN_COMMAND_LIST_FILE/KEY` alle optional.
- **Secrets:** `ENCRYPTED_ENV_FILE` nur bei Nutzung von `start-with-secrets`; sonst normale .env.
- **Tickets:** Reine Zusatzfunktion; kein Eintrag in .env nötig.
- **Replay:** `REPLAY_STATE_FILE` leer → nur in-memory (kein persistenter Schutz).
- **Listener/Auto-Execute:** `ENABLE_LISTENER`, `ENABLE_AUTO_EXECUTE` abschaltbar; Lock ohne OPEN_COMMAND/OPEN_URL führt nur Log aus.

**Automatisiert (mit sicheren Defaults):**

- `USE_MAILBOX` = true, wenn `MAILBOX_ID` gesetzt (kein Extra-Flag nötig).
- `ENABLE_REPLAY_PROTECTION` = true, wenn `REPLAY_STATE_FILE` gesetzt.
- `ENABLE_HARDWARE_OPEN` = true, wenn `OPEN_COMMAND` oder `OPEN_URL` gesetzt.
- PACKAGE_ID aus Datei, PARTNER_ADDRESS aus Datei (nach /connect/Handshake); `/set-package-id` speichert in Datei.

**Sicherheit priorisiert:** Keine Secrets aus Nutzerinput in Shell/OPEN_COMMAND; Adressen validiert; spawn ohne Shell; Replay + AccessKey vor OPEN; ENABLE_* als Kill-Switch.

---

## 2. Ist der Code so logisch und schlank wie möglich?

- **Eine Krypto-Quelle:** Messenger nutzt jetzt **crypto-layer** (generateKeyPair, deriveSharedSecret, deriveAesGcmKey, encryptMessage, decryptMessage); keine Duplikate mehr in wallet-bridge.
- **Klare Schichten:** Config → Chain / Vault / Crypto / Replay / read-password / read-command-list / load-secrets; App (wallet-bridge, m2m-lock) orchestriert.
- **Optionale Pfade:** Loader (z. B. loadEncryptedEnvIfConfigured, getOpenWordsFromChain) brechen mit return null/false ab, wenn nicht konfiguriert; keine unnötigen Verzweigungen im Hauptfluss.

Weitere Schlankheit: Kein toter Code in den geprüften Layern; Move-Funktionen einzeln aufrufbar, keine überflüssigen Parameter.

---

## 3. Sind alle Layer kompatibel und weitestgehend autark?

| Layer | Abhängigkeiten | Autark? |
|-------|----------------|---------|
| **crypto-layer** | Nur Node `crypto` | Ja (kein IOTA, kein config, kein fs) |
| **vault-local** | Node `crypto`, `fs`, `path` | Ja (kein Chain, kein config) |
| **read-command-list** | Node `crypto`, `fs` | Ja |
| **read-password** | Node `readline`, `process` | Ja |
| **replay-state** | Node `fs/promises`, `path`, **logger** | Logger zieht config (nur für ENABLE_FILE_LOGGING); inhaltlich nur Nonce-Logik, keine Config-Logik. |
| **chain-access** | **config** (CFG), IOTA-SDK, `child_process` | Nein (RPC-URL, PACKAGE_ID, SIGNER, etc.); gewollt, da Chain-Zugriff konfigurationsgesteuert. **Einzige Stelle für alle IOTA-TXs** (TX bauen, signieren, ausführen, Discovery). |
| **config** | dotenv, fs, path | Ja (nur Umgebung/Dateien). |
| **logger** | winston, fs, **config** | Nein (ENABLE_FILE_LOGGING aus CFG); minimale Kopplung. |
| **load-secrets** | fs, path, vault-local, read-password | Ja (kein Chain, kein config außer process.env beim Aufruf). |
| **m2m-lock** / **wallet-bridge** | Alle Layer | App-Schicht; orchestriert bewusst. **wallet-bridge** nutzt ausschließlich chain-access für alle Chain-Operationen (kein eigener IotaClient, keine TX-Bau-Logik). Messenger-Teillogik liegt in **`src/messenger-nest/`** (Kammern: Session-Passwort, Streams-Client, Preflight, Fetch, Connect, Listener, Befehls-Dispatcher) – `wallet-bridge.ts` bleibt Einstieg + Terminal-Loop. |

**Layer-Trennung (Ameisenhaufen mit Kammern):** Crypto, Vault, read-password, read-command-list sind autark. Chain-Access ist die einzige Kammer für IOTA; wallet-bridge und m2m-lock rufen nur chain-access-Funktionen auf (sendEcdhInit, storeEncryptedMessage, getHandshakeFromMailbox, etc.). Kein Bypass mehr. **Messenger-Nest:** Befehle laufen über **einen** Dispatcher (`createMessengerCommandHandler`) für API und Terminal – kein paralleler if/else-Zweig für dieselben Slash-Commands.

**Kompatibilität:** Einheitliche Typen (CryptoKey, Uint8Array, CFG); chain-access liefert null bei Fehler, Vault/Crypto werfen bei ungültigen Daten; Aufrufer können optional reagieren. Krypto-API (crypto-layer) wird von vault-local (nur PBKDF2/AES für Vault-Payload), wallet-bridge und m2m-lock genutzt – eine Implementierung, gleiche Semantik.

---

## 4. Ist SPOF = IOTA-Seed / IOTA-Wallet-Passwort?

**Ja.**

- **SPOF 1 – IOTA-Seed (Mnemonic):** Ohne Seed keine Signatur für Transaktionen; wer den Seed hat, kontrolliert die Adresse(n). Seed wird nicht in .env oder Code gespeichert; bei SIGNER=sdk wird er nur zur Laufzeit eingegeben.
- **SPOF 2 – IOTA-Wallet-Passwort:** Schützt den Keystore (CLI) und wird für Vault-Entschlüsselung (lokal/on-chain) genutzt. Verlust = kein Zugriff auf Vault ohne Backup; Kompromittierung = Risiko, wenn Angreifer auch Keystore/Rechner hat.

README Abschnitt 8 bestätigt: *„Der einzige echte SPOF ist der Seed (bzw. der Zugang zum IOTA Rebased Wallet). Das Wallet-Passwort ist der zweite kritische Faktor.“*

Zusätzliche Sicherheitsfaktoren (ENABLE_LISTENER, ENABLE_AUTO_EXECUTE, AUTHORIZED_SENDERS, Replay-Datei) sind keine SPOF, sondern Abschalt- bzw. Einschränkungsoptionen.
