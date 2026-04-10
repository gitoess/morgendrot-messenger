# Bewertung: Layer nach Sicherheit und Logik (1–100)

**Roadmap Vertrauen / Lieferkette / Abgrenzung Hochzulassung:** **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** (**Fahrplan § H.10**).

Kurzbewertung der einzelnen Schichten des Projekts. **Sicherheit** = Krypto, Zugriffskontrolle, Injection-Resistenz, SPOF. **Logik** = Korrektheit des Ablaufs, Lesbarkeit, Fehlerbehandlung.

---

## Übersicht (Punkte)

| Layer | Datei / Bereich | Sicherheit | Logik | Kurzbegründung |
|-------|------------------|------------|-------|----------------|
| **Crypto** | `crypto-layer.ts` | 88 | 90 | ECDH P-256, AES-256-GCM, HKDF; IV pro Nachricht; keine Chain-Abhängigkeit. |
| **Vault** | `vault-local.ts` | 88 | 90 | PBKDF2 310k, Salt/IV zufällig; ein Format für lokal/on-chain; Längenprüfung. |
| **Replay** | `replay-state.ts` | 80 | 92 | Monotone Nonce pro Sender korrekt; State-Datei schreibbar → Rollback-Risiko (dokumentiert). |
| **Passwort** | `read-password.ts` | 76 | 88 | Maskierung bei TTY; ohne TTY Klartext (Pipe) – bewusst, aber Risiko. |
| **Chain** | `chain-access.ts` | 85 | 88 | Adress-Whitelist (Regex), `spawn` ohne Shell; Remote-Signer optional; Fehler → null. |
| **Befehlsliste (AES)** | `read-command-list.ts` | 82 | 90 | AES-256-GCM korrekt; Key-Länge geprüft; Key aus .env (Betriebsrisiko). |
| **Lock** | `m2m-lock.ts` | 86 | 90 | Kein Shell bei OPEN_COMMAND; Replay → Auth → AccessKey; nur Nachrichten an lockAddress. |
| **Messenger** | `wallet-bridge.ts` | 82 | 85 | normalizeAddress; Befehle fest; Adressen vor TX validiert; große Angriffsfläche, aber kontrolliert. |
| **Move (Chain)** | `messaging.move` | 90 | 90 | sender == lock_id bei set_open_words; Vault/Mailbox/AccessKey Berechtigungen klar. |
| **Config** | `config.ts` | 82 | 88 | Wie §10: maskierte Anzeige, **setEnvKey-Blocklist** für kritische Keys. |

---

## Einzelbewertungen

### 1. Crypto Layer (`crypto-layer.ts`) — **88 / 90**

- **Sicherheit (88):** ECDH P-256 und AES-256-GCM sind Standard und passend. HKDF mit festem Info-String; Salt im HKDF ist fix (16 Nullen) – bei bereits eindeutigem Shared Secret pro Partner akzeptabel. IV pro Nachricht zufällig. Keine Abhängigkeit von Chain oder Umgebungsdaten.
- **Logik (90):** Klar getrennt, einheitliche API (exportKey/importKey, encrypt/decrypt). Keine überflüssigen Abhängigkeiten.

### 2. Vault (`vault-local.ts`) — **88 / 90**

- **Sicherheit (88):** PBKDF2 mit 310.000 Iterationen (OWASP 2023), Salt und IV pro Speichervorgang zufällig. AES-256-GCM mit 128-bit Tag. Minimale Längenprüfung vor Entschlüsselung. Payload ist JSON – manipuliertes File kann Parse-Fehler auslösen (DoS, kein Key-Leak).
- **Logik (90):** Ein Format für lokale Datei und On-Chain-Payload; klare Aufteilung load/save/encryptForChain.

### 3. Replay (`replay-state.ts`) — **80 / 92**

- **Sicherheit (80):** Monotone Nonce pro Sender korrekt umgesetzt; State nur in JSON-Datei. Wenn ein Angreifer die Datei überschreiben kann, ist Nonce-Rollback möglich (in Kommentaren erwähnt). Keine kryptografische Bindung der Nonce zur Nachricht (Nonce kommt aus der Chain).
- **Logik (92):** `acceptAndUpdate` rein und eindeutig; Laden/Speichern mit Fallback auf leeren State.

### 4. Passwort (`read-password.ts`) — **76 / 88**

- **Sicherheit (76):** Bei TTY: Maskierung, Backspace, kein Echo. Ohne TTY (z. B. Pipe): Klartext – bewusster Fallback, aber unsicher in geteilter/unsicherer Umgebung. Passwort bleibt im Prozessspeicher (unvermeidbar für Nutzung).
- **Logik (88):** Einfacher Ablauf, TTY vs. Nicht-TTY klar getrennt.

### 5. Chain Access (`chain-access.ts`) — **85 / 88**

- **Sicherheit (85):** `assertSafeAddress` mit Regex (0x+64 Hex oder Bech32) verhindert Shell-Metazeichen in CLI-Argumenten. `spawn` mit `shell: false`. Remote-Signer: URL/Token aus Konfiguration. Signatur wird nicht geloggt. `getVaultFromChain` / `getOpenWordsFromChain` geben bei Fehler `null` zurück (kein Leak). `hasValidAccessKey`: strikte Vergleiche (lock_id, expires_at_ms).
- **Logik (88):** Trennung CLI/Remote/SDK; defensive JSON-/String-Extraktion.

### 6. Befehlsliste AES (`read-command-list.ts`) — **82 / 90**

- **Sicherheit (82):** AES-256-GCM, IV 12 Byte, Tag 16 Byte; Key-Länge (32 Byte Hex) wird geprüft. Pfad und Key aus Konfiguration, kein Nutzerinput. Risiko: Key in .env (Betriebs-/Umgebungsrisiko, kein Codefehler).
- **Logik (90):** Eine Aufgabe, klare Ein-/Ausgabe.

### 7. Lock (`m2m-lock.ts`) — **86 / 90**

- **Sicherheit (86):** `OPEN_COMMAND`: `spawn(cmd, args, { shell: false })` – kein Command-Injection. `OPEN_URL` nur aus .env. Verarbeitung nur von Nachrichten mit `recipient === lockAddress`. Reihenfolge: Entschlüsseln → openWords → Replay → ENABLE_AUTO_EXECUTE → AUTHORIZED_SENDERS → hasValidAccessKey → Aktion. Replay-Check vor Ausführung.
- **Logik (90):** Öffnen-Wörter aus drei Quellen beim Start aufgelöst; Ablauf gut nachvollziehbar.

### 8. Messenger (`wallet-bridge.ts`) — **82 / 85**

- **Sicherheit (82):** `normalizeAddress` für Vergleiche; Handshake-Filter sender !== myAddress. Passwort/Mnemonic über `readPasswordMasked`. Chat-Befehle fest (/vault-save etc.); Nutzerinput geht nicht in spawn/exec. Adressen für TX über `assertSafeAddress`. `parseInt` für Anzahlen mit `Math.max(1, …)` begrenzt. Größere Angriffsfläche (viele Pfade), aber keine offensichtliche Injection.
- **Logik (85):** Viele Zweige; Listener-Filter (Partner, Nonce) konsistent.

### 9. Move Contract (`messaging.move`) — **90 / 90**

- **Sicherheit (90):** `set_open_words`: nur `tx_context::sender(ctx) == lock_id`. Vault: Owner für create/update; Purge nur Owner oder nach Frist bzw. Emergency. purge_handshake / purge_message: Sender oder Empfänger oder abgelaufen. AccessKey: create/enable_emergency_purge_key/purge_key mit nachvollziehbaren Berechtigungen.
- **Logik (90):** Klare Strukturen, konsistente Nutzung von dynamic_object_field.

### 10. Config (`config.ts`) — **82 / 88**

- **Sicherheit (82):** Reine Konfiguration; sensible Werte in `getConfigDisplay` maskiert. **setEnvKey-Blocklist:** OPEN_COMMAND, OPEN_URL, REMOTE_SIGNER_*, WALLET_PASSWORD etc. dürfen nicht per API gesetzt werden (Industrie-/Militärstandard).
- **Logik (88):** Zentrale Stelle, env mit Fallbacks und Typen (Bool/Int).

---

## Messenger: Inhaltsvertraulichkeit (Einordnung)

- **Technisch:** Verschlüsselte Nachrichten nutzen **ECDH (P-256)**, **HKDF** und **AES-GCM**; pro Nachricht **zufälliges IV**. Der **symmetrische Schlüssel** pro Partnerpaar leitet sich bei unveränderten Handshake-Keys aus dem **gleichen ECDH-Shared-Secret** ab (kein **Forward Secrecy** wie bei Signal/Double Ratchet).
- **Betrieb:** Entschlüsselung erfolgt im **Morgendrot-Backend**, sobald der Vault entsperrt ist (Keys im RAM). Das entspricht **nicht** dem strengen Modell „nur die beiden Chat-Endgeräte, Server garantiert blind“ – es sei denn, jeder Teilnehmer betreibt **einen eigenen Node** und vertraut nur sich selbst.
- **Konfiguration:** `ENABLE_PLAINTEXT_CHANNEL` und `MAILBOX_STORE_PLAINTEXT` können **Klartext** auf der Chain bzw. in der Mailbox erlauben; `/send-plain` ist bewusst unverschlüsselt.
- **Metadaten:** Absender-, Empfänger- und Objektbezug auf L1 bleiben typischerweise sichtbar; der Schutz betrifft primär den **Nachrichteninhalt** (wenn nicht im Klartext-Pfad).
- **UI:** Next-Chat und Lite-UI weisen bei aktivem Klartext-Kanal/Mailbox-Klartext hin; Server-Logs loggen entschlüsselte Inhalte der Inbox **nicht** mehr im Klartext (nur Debug mit Längen/Metadaten).

---

## Erweiterungen (Zielbild, kein Layer-Score)

- **Vault-Tarnung in Bilddateien (Steganographie):** Siehe **`docs/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md`**. Erhöht ggf. den Aufwand bei **oberflächlicher** Durchsuchung; ersetzt weder starkes Passwort noch professionelle Forensik; **Standard-PWA-Icons** aus dem Build sind **kein** sicherer Ort für einen **nutzerspezifischen** Vault ohne eigenes Träger-Asset (siehe `npm run build:pwa-icons`).

---

## Gesamteindruck

- **Stärken:** Krypto (ECDH, AES-GCM, PBKDF2), keine Shell bei kritischen Befehlen, Replay-Schutz, Zugriffskontrolle on-chain, klare Layer-Trennung.
- **Schwächen:** Passwort bei Nicht-TTY im Klartext; Replay-State in beschreibbarer Datei; Key/Passwort in .env (Betriebsrisiko).

**Durchschnitt (gemittelt über alle Layer):** Sicherheit ~84, Logik ~89.
