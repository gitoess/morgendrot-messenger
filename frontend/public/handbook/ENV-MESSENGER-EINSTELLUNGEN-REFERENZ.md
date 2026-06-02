# Messenger — alle `.env`-Einstellungen (Referenz)

**Stand:** 2026-06-02  
**Zweck:** Vollständige Liste der Keys, die in **Messenger → Einstellungen** unter **Erweiterte Konfiguration (.env)** erscheinen können — mit Erklärung.  
**Quelle im Code:** `frontend/frontend/lib/config-env-field-meta.ts` (`CONFIG_KEYS_MESSENGER`, `META`)

---

## Wo finde ich was?

| Bedarf | Dokument / Ort |
|--------|----------------|
| **Alle Keys in der Messenger-Einstellungs-UI** (dieses Dokument) | `docs/ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md` · PWA: `/handbook?file=ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md` |
| **In der App mit Kurztext pro Zeile** | **Einstellungen → System & Identität** → aufklappen **„Erweiterte Konfiguration (.env)“** — `RPC_URL` steht **darüber** extra, die übrigen Keys in der Liste |
| **Laientext, breiter (Lock, Shop, Zahlung, …)** | `docs/ENV-ERKLAERUNG.md` |
| **Technisch, gesamtes Projekt** | `docs/CONFIG-REFERENCE.md` · Vorlage: **`.env.example`** im Repo-Root |
| **Nur Handoff-ZIP** (Teilmenge für Helfer) | `docs/EXPORT-ASSISTENT-REFERENZ.md` §5 und §6 |

**Wichtig:** `EXPORT-ASSISTENT-REFERENZ.md` ist **nicht** die komplette `.env`-Liste — nur das, was in eine **Helfer-Handoff-ZIP** geschrieben wird.

---

## Oben in den Einstellungen (nicht in der Key-Liste)

| Key | Wo in UI | Bedeutung |
|-----|----------|-----------|
| **RPC_URL** | Eigene Zeile über der Liste | Primäre IOTA-Fullnode (HTTPS) |
| **PACKAGE_ID** | System & Identität (Package / Einsatz) | Move-Package des Einsatzes (`0x` + 64 Hex) |

---

## IOTA / Kette

| Key | Handoff-ZIP? | Bedeutung |
|-----|--------------|-----------|
| **RPC_URLS** | optional (`RPC_URL` im Handoff) | Zusätzliche Fullnode-URLs (kommagetrennt), Fallback/Rotation |
| **RPC_HTTP_PROXY** | nein | HTTP-Proxy für RPC |
| **RPC_SOCKS_PROXY** | nein | SOCKS-Proxy (z. B. Tor `socks5://127.0.0.1:9050`) |
| **NETWORK_TRUST_TIER** | nein | Vertrauensstufe RPC-Quelle (`1` öffentlich … `3` eigener Node) |
| **MAILBOX_ID** | ja | Shared Server-Postfach (Object-ID `0x…`) |
| **VAULT_REGISTRY_ID** | ja (wenn gesetzt) | On-Chain Vault-Registry aus `create_globals` |
| **DEFAULT_TTL_DAYS** | nein | Standard-TTL Nachrichten/Vault (Tage) |
| **DEFAULT_KEY_TTL_DAYS** | nein | Standard-TTL AccessKey-NFTs (Tage) |

---

## Rolle & Signer

| Key | Handoff-ZIP? | Bedeutung |
|-----|--------------|-----------|
| **ROLE** | ja | `boss`, `kommandant`, `arbeiter`, `messenger`, `lock`, `monitor`, `waerter` — UI & Rechte |
| **ROLE_ID** | ja | Bitmaske 0–63 (D·LW·BW·L·S·P) — siehe `HANDOFF-PERMISSIONS-MATRIX.md` |
| **SIGNER** | ja (`sdk` im Handoff) | `sdk` (Vault), `cli`, `remote` |
| **REMOTE_SIGNER_URL** | nein | URL Boss-Signer bei `SIGNER=remote` |
| **REMOTE_SIGNER_TOKEN** | nein | Bearer-Token Remote-Signer (**nie** ins Handoff) |
| **BOSS_SIGNER_PUBLIC_URL** | nein | Öffentliche URL des Boss-Signers |
| **WALLET_DERIVATION_PATH** | nein | HD-Ableitungspfad bei `SIGNER=sdk` |
| **ENABLE_HD_CONTACT_ADDRESSES** | nein | Kontakt-Adressen per HD ableiten |
| **MY_ADDRESS** | leer im Handoff | Eigene Wallet `0x…` — Helfer füllt auf dem Gerät |

---

## Mailbox / Chat / Vertraulichkeit

| Key | Handoff-ZIP? | Bedeutung |
|-----|--------------|-----------|
| **USE_MAILBOX** | ja (mit MAILBOX_ID) | Persistente Mailbox auf der Chain |
| **MAILBOX_STORE_PLAINTEXT** | nein | Klartext in Mailbox speichern |
| **ENABLE_PLAINTEXT_CHANNEL** | nein (Handoff: oft `false`) | `/send-plain` Klartext erlauben |
| **ENABLE_PURGE** | ja | On-chain Purge/Rebate erlauben |
| **USE_ENCRYPTED_DISCOVERY** | nein | Discovery verschlüsselt (geplant) |
| **ENABLE_PAIRWISE_GROUPS** | nein | Gruppen mit pairwise Handshake |
| **ENABLE_BROADCAST_PINNWAND** | nein | Pinnwand-Broadcast aktiv |
| **BROADCAST_PINNWAND_ADDRESS** | nein | Zieladresse Pinnwand |
| **BROADCAST_AUTHORIZED_SENDERS** | nein | Wer an Pinnwand senden darf |

**Nur Handoff / Import, nicht in dieser UI-Liste:** `TEAM_MAILBOX_IDS` (weitere Team-Postfächer, kommagetrennt).

---

## Einsatz-Hierarchie

| Key | Handoff-ZIP? | Bedeutung |
|-----|--------------|-----------|
| **BOSS_ADDRESS** | ja | Wallet Einsatzleitung (`0x` + 64 Hex) |
| **KOMMANDANT_ADDRESSES** | nein | Kommandanten (CSV) |
| **WORKER_ADDRESSES** | nein | Arbeiter (CSV) |
| **DEVICE_ROLES** | nein | Geräte-Rollen-Zuordnung (JSON) |
| **DEVICE_NAMES** | nein | Anzeigenamen Geräte |
| **ENABLE_COMMAND_DOWN** | nein | Befehl nach unten senden |
| **ENABLE_KEY_ISSUE** | nein | Schlüssel ausstellen (Boss) |
| **ENABLE_REVOKE_DOWN** | nein | Widerruf nach unten |
| **ENABLE_STATUS_READ_DOWN** | nein | Status von unten lesen |
| **ENABLE_STATUS_READ_UP** | nein | Status von oben lesen |
| **ENABLE_CONFIG_CHANGE** | nein | Konfig ändern (Boss) |
| **ENABLE_HIERARCHY_CHANGE** | nein | Hierarchie ändern (Boss) |

**Partner im Handoff:** `PARTNER_ADDRESS` oder `PARTNER_ADDRESSES` — gesetzt durch Export-Assistent, in Messenger-UI **ausgeblendet** (Telefonbuch statt Legacy `/connect`).

---

## Listener / Handshake

| Key | Handoff-ZIP? | Bedeutung |
|-----|--------------|-----------|
| **ENABLE_LISTENER** | nein | Events abhören / reagieren |
| **FETCH_LAST_ON_START** | nein | Beim Start letzte N Nachrichten holen |
| **ENABLE_FETCH_COMMAND** | nein | `/fetch N` erlauben |
| **LISTENER_POLL_MS** | nein | Poll-Intervall Listener (ms) |
| **HANDSHAKE_REFRESH_MS** | nein | Handshake-Refresh (ms) |
| **ENABLE_REPLAY_PROTECTION** | ja | Replay-Schutz (Nonce) |
| **REPLAY_STATE_FILE** | nein | Datei für Nonce-State |
| **ENABLE_AUTO_EXECUTE** | nein | Empfangene Befehle ausführen (**Sicherheitsrisiko** wenn an) |
| **AUTHORIZED_SENDERS** | nein | Zusätzliche erlaubte Sender |
| **MAX_SEND_AMOUNT_IOTA** | nein | Max. IOTA pro Sendung (optional) |

---

## Streams / Puls

| Key | Handoff-ZIP? | Bedeutung |
|-----|--------------|-----------|
| **OPEN_STREAMS_ENABLED** | nein | Streams bei Lock/Open |
| **STREAMS_ANCHOR_ID** | nein | Streams-Kanal-ID (`0x…`) — **nicht** Chat-Posteingang |
| **STREAMS_TOPIC** | nein | Streams-Topic |
| **STREAMS_LISTEN_ENABLED** | nein | Lock hört Streams |
| **STREAMS_BRIDGE_URL** | nein | HTTP-Bridge (Mock/LoRa-Gateway) |
| **ENABLE_HEARTBEAT** | nein | Heartbeat an STREAMS_ANCHOR_ID |

---

## Tresor

| Key | Handoff-ZIP? | Bedeutung |
|-----|--------------|-----------|
| **VAULT_FILE** | nein | Lokale Vault-Datei (z. B. `.morgendrot-vault`) |

---

## Gas / Credits / Messenger-Policy

| Key | Handoff-ZIP? | Bedeutung |
|-----|--------------|-----------|
| **GAS_BUDGET** | nein | Gas-Budget pro Transaktion |
| **SPONSOR_GAS_OWNER** | nein | Sponsor-Wallet für Gas |
| **SPONSORED_TRANSACTION_ENABLED** | nein | Gesponserte Transaktionen |
| **MESSENGER_AUTO_SPONSOR** | nein | Messenger sponsert Sends automatisch |
| **MESSENGER_LICENSE_NFT_OBJECT_ID** | nein | Lizenz-NFT Object-ID |
| **MESSENGER_CREDITS_OBJECT_ID** | nein | Credits-Object-ID |
| **PAIRING_GATE_NFT_OBJECT_ID** | nein | Pairing-Gate-NFT |
| **VERIFIED_IOTA_NAME_PACKAGE_IDS** | nein | Erlaubte Name-Service-Packages |
| **MESSENGER_GAS_STATE_FILE** | nein | Persistenter Gas-State |
| **IOTA_GAS_STATION_URL** | nein | Gas-Station-URL |
| **SHADOW_SWEEP_GAS_RESERVE_MIST** | nein | Reserve für Shadow-Sweep |
| **GAS_STATION_ENABLED** | nein | Gas-Station aktiv |
| **GAS_STATION_MIN_IOTA** | nein | Mindest-Guthaben Gas-Station |
| **GAS_STATION_TOPUP_IOTA** | nein | Top-up Betrag |

---

## Deployment / UI-Profil

| Key | Handoff-ZIP? | Bedeutung |
|-----|--------------|-----------|
| **UI_VARIANT** | ja | `messenger` (schlank) oder `full` |
| **MESSENGER_EDITION** | nein | Edition `standalone` / `sales` (Bundle) |
| **DEPLOYMENT_PROFILE** | ja | z. B. `einsatz` |
| **TRANSPORT_PROFILE** | ja | `mesh-first`, `iota-anchored`, `iota-full` |
| **SIMPLE_MODE** | ja | Vereinfachte UI (`true`/`false`) |
| **NEXT_PUBLIC_DIRECT_IOTA_RPC_URL** | ja (optional) | RPC für PWA Light-Client / Direkt-IOTA |

**Handoff-Zusatzdatei:** `.morgendrot-runtime-config.json` (Capabilities) — kein `.env`-Key, siehe Export-Assistent.

---

## IDs — Kurz-Glossar (alle relevanten Object-IDs)

| ID | Typ | Erklärung |
|----|-----|-----------|
| **PACKAGE_ID** | Move-Package | On-Chain-Vertrag des Einsatzes — **gemeinsam** für Boss und Helfer |
| **MAILBOX_ID** | IOTA-Object | Primäres (Shared/Team-)Postfach auf der Chain |
| **TEAM_MAILBOX_IDS** | CSV Object-IDs | Weitere Team-Postfächer (Handoff, nicht Settings-Liste) |
| **COMMAND_REGISTRY_ID** | IOTA-Object | Registry für On-Chain-„Öffnen“-Befehle (Lock) |
| **VAULT_REGISTRY_ID** | IOTA-Object | Registry für On-Chain-Vault-Blobs |
| **BOSS_ADDRESS** / **MY_ADDRESS** / Partner | Wallet `0x`+64 | Adressen, keine Move-Objects |
| **STREAMS_ANCHOR_ID** | Streams | Puls/Lock-Hinweis, nicht Mailbox-Chat |
| **BROADCAST_PINNWAND_ADDRESS** | Wallet/Object | Pinnwand-Ziel |

---

## Nur im Morgendrot **Projekt** (nicht Messenger-Einstellungen)

Shop, Stripe, Lock-Hardware (`OPEN_COMMAND`), Monitor-Extras, Voucher-API u. a. — siehe `CONFIG-REFERENCE.md` und `.env.example`. In der Messenger-PWA sind diese Keys **absichtlich ausgeblendet** (`CONFIG_KEYS_MESSENGER`).

---

*Pflege: Bei neuen Keys in `config-env-field-meta.ts` diese Tabelle nachziehen.*
