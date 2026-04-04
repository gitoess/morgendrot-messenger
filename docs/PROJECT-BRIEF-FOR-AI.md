# Morgendrot – Kurzbriefing für KI-Assistenten

Dieses Dokument beschreibt **Zweck, Architektur und Technik** des Repos, damit ein LLM schnell den Kontext hat. Sprache im Projekt: überwiegend **Deutsch** (Doku, UI-Texte); Code und APIs **Englisch**.

---

## 1. Was ist das Projekt?

**Morgendrot** ist eine **Node.js/TypeScript-Anwendung** plus **Move-Smart-Contract-Package** für **IOTA Rebased**. Kernfunktionen:

- **Verschlüsselter Messenger** zwischen Adressen: **ECDH P-256**, **AES-GCM**; Handshake (`/handshake`) und Session (`/connect`); Nachrichten on-chain als Events (teilweise **purgebar** über Mailbox).
- **Klartext-Kanal** optional (`/send-plain`) – sichtbar on-chain, kein Handshake nötig.
- **Vault**: Messaging-Keys **lokal** (Datei, PBKDF2 + AES-GCM) und/oder **on-chain** (VaultRegistry).
- **M2M-Lock-Modus** (`ROLE=lock`): „Schloss“-Adresse empfängt verschlüsselte **OPEN-Befehle**; **AccessKey-NFTs** berechtigen; Replay-Schutz, optional Whitelist, Hardware-Trigger (`OPEN_COMMAND`/`OPEN_URL` ohne Shell), Streams-Integration.
- **Tickets / Events** (Move): NFT-Tickets, Einlass, Purge; viele Features über **`.env`** optional.

**Sicherheitsmodell:** **SPOF = IOTA-Seed** (Signatur) und **Wallet-Passwort** (Keystore/Vault). Keine Secrets aus Nutzerinput in Shell-Befehlen; validierte Adressen; Architektur-Doku: `docs/ARCHITECTURE-CHECKS.md`, `docs/SICHERHEITS-AUDIT.md`.

---

## 2. Tech-Stack

| Bereich | Technologie |
|--------|-------------|
| Runtime | **Node** (ESM: `"type": "module"`) |
| Sprache | **TypeScript** (`src/`, `tsx` für CLI) |
| Chain | **@iota/iota-sdk**, IOTA **Rebased** RPC |
| Contracts | **Move** unter `move-test/` (`messaging.move` u. a.) |
| UI | **Next.js** in `frontend/`; ältere/static UI in `ui/` |
| API | HTTP-Server in `src/api-server.ts` (Befehle, Status, Docs) |
| Krypto | Node **`crypto.webcrypto`**; eigene Module **`crypto-layer`**, **`vault-local`** |
| Logging | **winston** |
| Optional KI | **Ollama** + Intent-Matcher (`ai-intent-matcher.ts`), RAG (`rag-retrieval.ts`), Wizard-Kacheln |
| Streams | Externe **HTTP-Bridge** (Mock: `scripts/streams-bridge-mock.ts`); Client `streams-adapter.ts`, `messenger-nest/streams-bridge-client.ts` |

**TypeScript:** `tsconfig` nutzt **`lib: ["ES2022"]`** (bewusst **ohne DOM-lib**), um **Node-WebCrypto-Typen** nicht mit DOM-`CryptoKey` zu vermischen; `fetch` kommt über **@types/node**.

---

## 3. Verzeichnis- und Modul-Logik

- **`src/config.ts`** – Zentrale Konfiguration **`CFG`**, `.env` / Dateien (`PACKAGE_ID`, `RPC_URL`, Feature-Flags, …).
- **`src/chain-access.ts`** – **Einzige** umfassende Schicht für **IOTA-Client, TX bauen/signieren/ausführen**, Mailbox, Vault, Keys, Tickets, Balances, Discovery. **Nicht** umgehen.
- **`src/crypto-layer.ts`** – Reine Krypto (ECDH, AES-GCM), **keine** Chain, **kein** `config`.
- **`src/vault-local.ts`** – Vault-Datei + Payload-Verschlüsselung; On-Chain-Payload entschlüsseln.
- **`src/wallet-bridge.ts`** – Einstieg: Messenger-Terminal-Loop, Rollen; orchestriert Nest + Chain.
- **`src/messenger-nest/`** – Messenger-**Orchestrierung**: Session-Passwort, Preflight, Fetch, Connect, Listener, **ein** Befehls-Dispatcher (`createMessengerCommandHandler`) für **Terminal und API** (siehe `messenger-nest/README.md`).
- **`src/m2m-lock.ts`** – Lock-Modus (Handshakes sammeln, OPEN-Befehle, AccessKey-Checks, …).
- **`src/start-with-secrets.ts`** – Start mit optional verschlüsselter Env (`ENCRYPTED_ENV_FILE`).
- **`scripts/`** – Viele Test- und Demo-Skripte (realworld, AI, Stress, …).
- **`docs/`** – Ausführliche Anleitungen; **`README.md`** – Funktionsmatrix und Befehlstabellen.

---

## 4. Typische Workflows (kurz)

1. **Säule 1 (Fundament):** `MY_ADDRESS`, `PACKAGE_ID`, `RPC_URL`, Wallet entsperrt.
2. **Säule 2 (Messenger):** `/handshake` → Partner `/connect` → `/send` (verschlüsselt) oder `/send-plain`.
3. **Vault:** `/vault-save`, `/vault-onchain`.
4. **Purge (wenn Move/Env erlaubt):** `/purge-handshake`, `/purge-msg`, Key/Ticket-Purge, Emergency-Purge.
5. **Lock:** Env `ROLE=lock`, `LOCK_ID`, Vault/OPEN-Wörter/Registry je nach Setup.

---

## 5. Tests & Qualität

- **`npm run test`** – Modultests ohne Chain (crypto, vault, replay, config, …).
- **`npm run validate:ui`** – Konsistenz UI-Daten.
- **`npx tsc --noEmit`** – Typecheck.
- Viele **`npm run test:*`** für Integration/Realworld/AI – siehe `package.json`.

---

## 6. Was eine KI beim Arbeiten beachten soll

- **Keine zweite Chain-Schicht** neben `chain-access` bauen; Messenger-Logik in **`messenger-nest`** erweitern, Dispatcher nutzen.
- **Secrets** nicht in Code committen; `.env.example` als Referenz.
- **Krypto** nicht duplizieren – `crypto-layer` / `vault-local` wiederverwenden.
- Bei **TS/WebCrypto**: `Buffer.from(uint8)` für `subtle`-Aufrufe, wenn der Compiler über `BufferSource` meckert.
- **Deutsch** in Nutzerantworten erwünscht, wenn der Nutzer auf Deutsch schreibt.

---

## 7. Schnellstart (für Menschen/KI-Kontext)

- `npm install` im Root; Move-Toolchain für `move-test/` separat.
- `npm start` – Backend + Streams-Mock; `npm run dev` – Backend + Next-Frontend.
- Details: `docs/START-ANLEITUNG.md`, `docs/DEV-START.md`.

---

*Stand: internes Briefing; bei Abweichungen gewinnt der aktuelle Code und `README.md`.*
