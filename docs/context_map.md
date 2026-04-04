# Context Map (Der Index)

Vor jeder KI-Anfrage als Gedächtnis mitgeschickt. Die KI „sieht“ dieses Inhaltsverzeichnis zuerst.

---

## messaging.move – Funktionsnamen (Move-Contract)

| Funktion | Beschreibung |
|----------|--------------|
| `emit_ecdh_init` | ECDH-Handshake an Empfänger emittieren |
| `send_encrypted_message` | Verschlüsselte Nachricht senden (Event) |
| `send_plaintext_message` | Klartext-Nachricht senden (Event, optional) |
| `create_globals` | Globale Objekte (VaultRegistry, Mailbox) anlegen |
| `set_open_words` | Öffnen-Wörter pro Lock setzen |
| `create_command_registry` | CommandRegistry anlegen |
| `create_vault` | Vault-Objekt erstellen |
| `update_vault` | Vault aktualisieren |
| `enable_emergency_purge` | Notfall-Purge für Vault aktivieren |
| `purge_vault` | Vault löschen (Rebate) |
| `store_ecdh_init` | ECDH-Init in Mailbox speichern (Handshake) |
| `purge_handshake` | Handshake aus Mailbox löschen (Rebate) |
| `store_encrypted_message` | Verschlüsselte Nachricht in Mailbox speichern |
| `store_plaintext_message` | Klartext in Mailbox speichern |
| `purge_message` | Nachricht aus Mailbox löschen (Rebate) |
| `create_access_key` | AccessKey erstellen (Säule 3) |
| `enable_emergency_purge_key` | Notfall-Purge für Key aktivieren |
| `transfer_access_key` | AccessKey übertragen |
| `purge_key` | AccessKey löschen (Rebate, Säule 4) |
| `create_ticket` | Ticket-NFT erstellen |
| `use_ticket` | Ticket einlösen |
| `enable_emergency_purge_ticket` | Notfall-Purge für Ticket aktivieren |
| `transfer_ticket` | Ticket übertragen |
| `purge_ticket` | Ticket löschen (Rebate) |
| `create_event_registry` | Event-Registry anlegen |
| `create_ticket_to_registry` | Ticket in Registry erstellen |
| `use_ticket_from_registry` | Ticket aus Registry einlösen |
| `purge_expired_tickets` | Abgelaufene Tickets löschen |

---

## ai-copilot.ts – Variablen & Funktionen (Kernel)

| Symbol | Typ | Bedeutung |
|--------|-----|------------|
| `AI_MAX_CONTEXT_MESSAGES` | const | Max. Nachrichten im Kontext (Rolling Window) |
| `root` | const | Projektroot (für Pfade) |
| `FEW_SHOT_INDICES` | const | Indizes für Few-Shot-Beispiele aus Dataset |
| `loadFewShotExamples` | function | Lädt Beispiele aus morgendrot-dataset.jsonl |
| `loadLogicChains` | function | Lädt Wenn-Dann-Regeln aus logic-chains.json |
| `loadMorgendrotRules` | function | Lädt .morgendrot-rules (Verfassung) |
| `loadHiddenContext` | function | Lädt PROJECT_LOGIC.md + letzte 5 Zeilen wallet-bridge |
| `buildSystemPrompt` | function | Baut System-Prompt für Ollama |
| `buildPlannerSystemPrompt` | function | System-Prompt für Planer-Modus |
| `parsePlanResponse` | function | Parst SCHRITT: AKTION aus Planer-Antwort |
| `extractAddr` | function | Adresse 0x+64 Hex aus Text |
| `extractNumber` | function | Zahl (Tage, IOTA) aus Text |
| `planStepsToCommands` | function | Mappt Plan-Schritte auf cmd+args |
| `PlanStep` | type | action, description, suggestedCommand |
| `AiCopilotResult` | type | ok, text, suggestedAction, thought, confidence, autoExecute |
| `AiCopilotContext` | type | myAddressSet, packageIdSet, connected, lastError, … |
| `AiCopilotOptions` | type | useIntentMatcher, useOllama, planOnly |
| `COMMAND_PATTERN` | const | Regex für direkte /befehl-Eingabe |
| `tryDirectCommand` | function | Erkennt bereits getippten /befehl |
| `normalizeUserInstruction` | function | Strip „sag der ki …“, „mache …“ |
| `askAiCopilot` | function | Haupt-Einstieg: Intent → Ollama → suggestedAction |
| `parseStrictJson` | function | Extrahiert JSON { thought, action, confidence } |
| `stripContentBeforeAction` | function | Entfernt Plappern vor ACTION: oder /befehl |
| `parseActionLine` | function | Parst ACTION: /cmd arg1 arg2 |

---

## Dashboard-Befehle (Übersetzung Move ↔ UI)

- `/handshake` → store_ecdh_init (Säule 2)
- `/connect` → wartet auf Handshake, dann peerMap befüllt
- `/send` → store_encrypted_message
- `/send-plain` → store_plaintext_message
- `/create-key` → create_access_key
- `/purge-key` → purge_key (Rebate)
- `/create-ticket` → create_ticket
- `/purge-ticket` → purge_ticket
- `/purge-handshake` → purge_handshake
