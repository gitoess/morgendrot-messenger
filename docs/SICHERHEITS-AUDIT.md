# Sicherheits-Audit: Modularität, SPOF, kritische Fehler, Logik

Stand: Nach vollständiger Prüfung von Struktur, Seed/Keys, Ordnern und Krypto.

---

## 1. Modularer Aufbau

| Modul | Verantwortung | Abhängigkeiten |
|-------|----------------|----------------|
| **config.ts** | Konfiguration (CFG), .env lesen/schreiben, setEnvKey, Blocklist, getConnectAddresses | fs, path, dotenv |
| **load-secrets.ts** | Optionale verschlüsselte Env-Datei (ENCRYPTED_ENV_FILE) | vault-local, read-password |
| **start-with-secrets.ts** | Einstieg: dotenv → loadEncryptedEnvIfConfigured → wallet-bridge | load-secrets, wallet-bridge |
| **wallet-bridge.ts** | Messenger-Einstieg, Terminal-Loop, Orchestrierung | config, messenger-nest/*, api-server |
| **messenger-nest/** | Befehls-Dispatcher (API+Terminal), Fetch, Connect, Listener, Preflight, Chain-Hüllen | config, chain-access, vault-local, crypto-layer |
| **chain-access.ts** | IOTA SDK + CLI (signAndExecute, runIotaCli), keine Secrets im Code | config, crypto-layer (nur Typen/Utils) |
| **crypto-layer.ts** | ECDH P-256, HKDF, AES-GCM (nachrichtenbasiert) | nur crypto (webcrypto) |
| **vault-local.ts** | Vault-Datei: PBKDF2 + AES-GCM, Keys speichern/laden | crypto, fs |
| **m2m-lock.ts** | Lock-Modus: OPEN ausführen, Zahlungs-Trigger, Pinnwand-Listener | config, chain-access, vault-local, streams-adapter |
| **api-server.ts** | HTTP-API, /api/command an wallet-bridge, Config, Unlock | config, wallet-bridge |
| **read-password.ts** | Passwort-Eingabe maskiert (TTY/Windows) | readline, readline-sync |
| **replay-state.ts** | Replay-Schutz (Nonce pro Sender), chmod 0o600 | fs/promises |
| **read-command-list.ts** | Verschlüsselte OPEN_COMMAND_LIST (AES-GCM) | crypto, fs |
| **streams-adapter.ts** | Streams-Stub / HTTP-Bridge | config |
| **monitoring.ts** | Monitor-Status, Heartbeat | config, chain-access, streams-adapter |
| **audit-log.ts** | Audit-Events, CSV/PDF-Export | config |

**Fazit:** Klar getrennte Module; Signing-Material nur in IOTA-CLI-Keystore oder verschlüsselt im Tresor; Messenger-ECDH separat generiert — nicht im App-Quellcode. So schlank wie möglich ohne Sicherheitsverzicht.

---

## 2. SPOF, Schlüssel-Trennung

### 2.1 Zwei Domänen (nicht „ein Seed für alles“)

| Domäne | Schlüssel | Herkunft im Code | SPOF |
|--------|-----------|------------------|------|
| **On-Chain-Signing** | Ed25519 (IOTA) | Mnemonic / Bech32 / CLI-Keystore; optional `WALLET_DERIVATION_PATH` (BIP44-Style) | **Seed bzw. CLI-Wallet** |
| **Messenger E2E** | P-256 ECDH | `generateKeyPair()` in `wallet-bridge.ts` — **nicht** aus dem IOTA-Seed abgeleitet | **Tresor-Passwort** + Vault-Datei (optional on-chain) |

**Krypto-Pfad Messenger:** ECDH → HKDF (`morgendrot-aes-gcm`) → AES-GCM pro Nachricht (`crypto-layer.ts`). Statisches Shared Secret pro Partner — **kein** Signal-artiges Forward Secrecy (siehe `SECURITY-RATING.md`, Roadmap **§ H.23**).

### 2.2 Seed/Mnemonic

- Erscheint **nicht** im Quellcode.
- **SIGNER=cli:** Seed im IOTA-Rebased-CLI-Keystore des Nutzers.
- **SIGNER=sdk:** Mnemonic/Bech32 zur Laufzeit oder optional im Tresor (`iotaSdkSignerImport`, UI: „Signer mit speichern“).

### 2.3 Tresor (`VAULT_FILE`)

- Speichert das **eigenständig generierte** ECDH-Messaging-Keypair passwortverschlüsselt (PBKDF2 310k + AES-GCM, `vault-local.ts`).
- **Tresor-Passwort ≠ Wallet-Mnemonic** — die Mnemonic signiert Transaktionen, entschlüsselt den Tresor **nicht** (`docs/VAULT-TRESOR-MARKTREIFE.md`).
- Optionaler Signer-Import im gleichen Blob koppelt Signing an den Tresor — nur bei bewusster Wahl (`includeIotaMnemonic`).

### 2.4 SPOF-Einordnung

- **Signing:** Seed/Mnemonic bewusster SPOF für On-Chain-Identität und Recovery (akzeptiertes Trade-off).
- **Messenger:** eigener SPOF (Tresor + Passwort). Seed-Kompromittierung **allein** liefert **keine** Messenger-Keys ohne entsperrten Tresor.
- **Beide verloren** (Seed + Tresor-Passwort ohne Backup) = kein Signing und keine Messenger-Keys wiederherstellbar.

### 2.5 Passwort zur Laufzeit

- Wallet-/Tresor-Passwort nur im Prozess (`getWalletPassword()`), nicht als Klartext auf Disk; optional `ENCRYPTED_ENV_FILE`.

**Architektur-Einordnung:** `docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md` § **6b**.

---

## 3. Kritische Fehler / Gefahren (geprüft und behoben)

### 3.1 Behoben in diesem Audit

| Risiko | Ort | Maßnahme |
|--------|-----|----------|
| **Path-Traversal** | api-server: `/api/deploy-package` nutzte `data.path` direkt für `publishPackageCli`. | Nur noch ein einzelner Ordner-Name erlaubt (`path.basename`), keine `../` oder Pfadtrenner. |
| **Env-Injection** | config: `setEnvKey` schrieb beliebigen `value` in .env; Zeilenumbrüche könnten neue KEY=Value-Zeilen erzeugen. | Zeilenumbrüche (`\r`, `\n`) im Wert verboten, Rückgabe Fehler. |

### 3.2 Bereits abgesichert

| Thema | Umsetzung |
|-------|-----------|
| **Shell-Injection** | Alle `spawn` mit `shell: false` (chain-access, m2m-lock, api-server). Kein User-Input als Shell-Befehl. |
| **Config-Blocklist** | OPEN_COMMAND, OPEN_URL, OPEN_COMMAND_LIST_*, REMOTE_SIGNER_*, WALLET_PASSWORD, ENCRYPTED_ENV_FILE, MONITOR_ALARM_WEBHOOK_URL, BOSS_SIGNER_TOKEN nicht per API setzbar. |
| **Doc-Pfad** | `/api/doc?name=…` nutzt `path.basename(name)` und `path.relative`; kein Escaping aus docs/. |
| **OPEN_COMMAND** | Kommando aus .env (blocklist), als Array an `spawn(cmd, args, { shell: false })` – keine Konkatenation mit User-Input. |
| **Adress-Validierung** | chain-access: Adressen nur `0x`+64 Hex oder Bech32, keine Sonderzeichen. |
| **Replay-Schutz** | replay-state: monotone Nonce pro Sender, Persistenz mit chmod 0o600. |

---

## 4. Krypto und Mathematik

| Komponente | Prüfung |
|------------|--------|
| **vault-local** | PBKDF2 310.000 Iterationen (OWASP 2023), Salt 16 Byte zufällig, IV 12 Byte zufällig, AES-GCM, chmod 0o600. |
| **crypto-layer** | ECDH P-256, HKDF-SHA-256 mit fester Info, IV 12 Byte zufällig pro Nachricht. |
| **read-command-list** | AES-256-GCM, IV 12 Byte aus Datei, Key 32 Byte aus OPEN_COMMAND_LIST_KEY. |
| **Replay** | `acceptAndUpdate`: Vergleich `nonce <= lastNonce` (BigInt), keine Ganzzahlüberläufe. |
| **Passwort** | Kein Logging, nur in Prozess; read-password mit Maskierung. |

---

## 5. Logik und Abhängigkeiten

- **Hierarchie (Boss/Kommandant/Arbeiter):** Rechte in api-server über `getRequiredPermissionForCommand` und `getHierarchyPermissions`; Config-Änderungen nur für erlaubte Keys.
- **Befehle:** `/api/command` leitet an wallet-bridge weiter; Befehlsnamen und Argumente werden dort geparst, nicht an externe Prozesse durchgereicht (außer feste CLI-Aufrufe).
- **Lock:** OPEN nur bei gültigem AccessKey (hasValidAccessKeyOrCached), AUTHORIZED_SENDERS/BROADCAST_AUTHORIZED_SENDERS, Replay-Check, optional ENABLE_AUTO_EXECUTE.

---

## 6. Empfehlungen (ohne Code-Änderung)

- **API nur lokal:** Server lauscht auf `127.0.0.1` – beibehalten.
- **Vault/Env:** Kein Passwort in .env oder in Repo; ENCRYPTED_ENV_FILE für optionale Secrets.
- **OPEN_COMMAND:** Nur vertrauenswürdige Befehle in .env; nicht per API setzbar (Blocklist).
- **Regelmäßig:** Abhängigkeiten aktualisieren, keine unnötigen Rechte für Dateien (chmod 0o600 wo vorgesehen).

---

## 7. Kurz-Checkliste

- [x] Modular: klare Module, keine Zirkelimporte.
- [x] SPOF: Signing-Seed und Tresor+Passwort getrennt dokumentiert; Keys nicht im Code.
- [x] Kein spawn mit shell: true, kein User-Input als Shell.
- [x] setEnvKey: keine Zeilenumbrüche im Wert.
- [x] deploy-package: kein Path-Traversal (nur ein Ordner-Name).
- [x] Blocklist für kritische Config-Keys.
- [x] Replay-Schutz, Adress-Validierung, Vault-Krypto (PBKDF2, AES-GCM, zufällige Salt/IV).
