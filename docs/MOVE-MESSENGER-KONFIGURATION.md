# Move — Messenger-Konfiguration (on-chain vs. Handoff)

**Stand:** 2026-06-02  
**Quelle:** `move-test/sources/messaging.move`  
**Zweck:** Alle **Messenger-relevanten** Move-Regeln an einem Ort — ohne Projekt-Module (AccessKey, Ticket, PhysicalAsset, Lock/CommandRegistry).

**Verwandt:** `docs/EXPORT-ASSISTENT-REFERENZ.md` (Handoff-Keys), `docs/ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md` (`.env`), `docs/EINSATZ-BOSS-ABLAUF.md` (Boss UI-Ablauf), `docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md`, `docs/BEGRIFFE-MOVE-REBASED.md` (gesamtes Package inkl. Nicht-Messenger), `docs/DEPLOY-CHECKLIST.md`, `docs/DEPLOY-MOVE-M2c-TEAM-BROADCAST.md`.

---

## 1. Grundmodell

| Ebene | Was | Beispiel |
|-------|-----|----------|
| **Move (on-chain)** | Harte, unveränderliche Sicherheitsregeln | Wer purgen darf; Owner-Check; TTL-Ablauf pro Eintrag |
| **Off-chain (Handoff, `.env`, App)** | Einsatz-Parameter | `DEFAULT_TTL_DAYS`, `ENABLE_PURGE`, aktive Team-Mailbox-ID |
| **Edition (Package-Variante)** | Anderes Deploy → neue `PACKAGE_ID` | Standard (Purge an) vs. Secure (Purge aus) |

**Wichtig:**

- **`ENABLE_PURGE`** schützt nur Backend/API/UI — **Direkt-RPC** umgeht das, wenn Move es erlaubt.
- **Neues Move-Deploy** → neue `PACKAGE_ID`; alte Mailbox-Objects haben Typ `0xALT::messaging::Mailbox` — mit neuer ID **nicht beschreibbar** (`validateMessagingMailboxObjectForPackage`). → **Neue Team-Mailbox + neues Handoff**.

---

## 2. Nicht-Messenger (im gleichen Package, hier ausgeschlossen)

Diese Move-Module gehören zum **Morgendrot Projekt**, nicht zur Messenger-App (vgl. `docs/MESSENGER-CHAT-HANDBUCH.md`: Messenger-`.env` ohne Shop/Tickets/Lock).

| Modul | Move-Funktionen (Auszug) | Produkt |
|-------|--------------------------|---------|
| **AccessKey** | `create_access_key`, `purge_key`, … | Zugang Gast/Tür/Spind |
| **Ticket** | `create_ticket`, `use_ticket*`, `purge_ticket`, `EventTicketRegistry`, … | Events/Einlass |
| **PhysicalAsset** | `create_physical_asset`, `link_nfc_uid`, … | NFC/Asset-Tracking |
| **CommandRegistry / Lock** | `set_open_words`, `LockId`, `OpenWords` | Schloss-Sprachbefehle |

`create_globals` erzeugt neben der Server-Mailbox auch `VaultRegistry` und `CommandRegistry` — Messenger nutzt **Vault** und **Server-Mailbox**; **`set_open_words` nicht**.

---

## 3. Legende (Tabellen unten)

| Spalte | Bedeutung |
|--------|-----------|
| **On-chain (Move)** | Regel im Contract — ändern nur mit neuem Package |
| **Off-chain (Boss)** | Handoff / Wizard / `.env` — ohne Deploy |
| **Edition** | Andere Package-Variante (Standard / Secure / …) |

---

## 4. Deploy & globale Objekte

| Bereich | Move-Funktion | On-chain (Move) | Off-chain (Boss) | Edition |
|---------|---------------|-----------------|------------------|---------|
| Erst-Deploy Einsatz | `create_globals` | Shared: **Server-Mailbox**, **VaultRegistry**, CommandRegistry | `PACKAGE_ID`, `MAILBOX_ID`, `VAULT_REGISTRY_ID` | Ja |
| Team-Postfach | `create_team_mailbox` | Shared `Mailbox`; Event `TeamMailboxCreated.by` | Team-Object-ID → Handoff / Gruppe | Ja |
| Private Mailbox | `create_private_mailbox` | `owner = sender`, shared | Nutzer legt selbst an | Ja |

---

## 5. Peering & Handshake

| Bereich | Move-Funktion | On-chain (Move) | Off-chain (Boss) | Edition |
|---------|---------------|-----------------|------------------|---------|
| Handshake (Mailbox) | `store_ecdh_init` (+ `_private`, `_with_credits`) | Sender = TX-Signer; Key `{recipient, sender}`; überschreibt alten HS | Ziel-Wallet, Mailbox-Modus | Ja |
| Handshake (Legacy) | `emit_ecdh_init` | Jeder; **nicht purgebar** | `USE_MAILBOX` | Ja (weglassen) |
| Peering | `emit_pairing_offer` | Event mit `expires_at_ms` | Peering/QR | Ja |
| Purge HS | `purge_handshake` (+ `_private`) | Sender **oder** Empfänger **oder** nach TTL **jeder** | `ENABLE_PURGE` | Ja |

---

## 6. Nachrichten 1:1 (pairwise)

| Bereich | Move-Funktion | On-chain (Move) | Off-chain (Boss) | Edition |
|---------|---------------|-----------------|------------------|---------|
| Verschlüsselt (Mailbox) | `store_encrypted_message` (+ `_private`, `_with_credits`) | Key `{recipient, sender, nonce}` | `DEFAULT_TTL_DAYS` → `ttl_days` | Ja |
| Verschlüsselt (Legacy) | `send_encrypted_message` | Jeder; **nicht purgebar** | Mailbox vs. Event | Ja |
| Klartext persistent | `store_plaintext_message_stored` (+ `_private`, `_with_credits*`) | wie oben | `MAILBOX_STORE_PLAINTEXT`, TTL | Ja |
| Klartext (Legacy) | `send_plaintext_message` / `store_plaintext_message` | Event / alt | `ENABLE_PLAINTEXT_CHANNEL` | Ja |
| Purge verschlüsselt | `purge_message` (+ `_private`) | Sender, Empfänger; nach TTL jeder | `ENABLE_PURGE` | Ja |
| Purge Klartext | `purge_plaintext_mail_entry` (+ `_private`) | **Gleiche Rechte** wie `purge_message` | `ENABLE_PURGE` | Ja |

---

## 7. Gruppe — Team-Broadcast

| Bereich | Move-Funktion | On-chain (Move) | Off-chain (Boss) | Edition |
|---------|---------------|-----------------|------------------|---------|
| Senden | `store_team_plaintext_broadcast` | **Jeder mit Team-Mailbox-Ref + Gas**; Key `{sender, nonce}` | Team-Mailbox-ID in Gruppe/Handoff | Ja (Allowlist möglich) |
| Purge | `purge_team_plaintext_broadcast` | **Original-Sender jederzeit**; **nach TTL jeder** | `ENABLE_PURGE` | Ja |
| Ganzes Team-Postfach | — | **Nicht in Move** | UI: „Aus Liste“ (nur lokal) | Backlog |

**UI:** Posteingang → ⋯ → **Auf Chain löschen (Rebate)** (Badge **Team-Broadcast**). **Deploy:** `purge_team_plaintext_broadcast` muss im Package sein (`docs/DEPLOY-MOVE-M2c-TEAM-BROADCAST.md`).

---

## 8. Postfach-Typen

| Typ | Owner on-chain? | Schreiben | Purge Ganzes Object |
|-----|-----------------|-----------|---------------------|
| **Server-Mailbox** (`create_globals`) | Shared, kein Owner | Pairwise HS/Msg (wie unten) | ❌ |
| **Team-Mailbox** | Shared, kein Owner | **Wer Object-ID kennt** (+ Team-Broadcast) | ❌ |
| **Private Mailbox** | `owner` | Nur an `owner` (`E_PRIVATE_MB_RECIPIENT`) | ✅ Owner (`purge_private_mailbox`) |

---

## 9. Vault (On-Chain-Tresor)

| Bereich | Move-Funktion | On-chain (Move) | Off-chain (Boss) | Edition |
|---------|---------------|-----------------|------------------|---------|
| Anlegen/Update | `create_vault`, `update_vault` | Nur `owner == sender` | Vault-Passwort | Ja |
| Notfall | `enable_emergency_purge` | Owner setzt `purge_allowed` | Boss/Kommandant | Ja |
| Purge | `purge_vault` | Normal: Owner nach `auto_purge_after_ms`; **Notfall: jeder** | TTL-Tage bei Create | Ja (No-Purge) |

---

## 10. TTL & Zeit

| Regel | On-chain | Off-chain |
|-------|----------|-----------|
| Ablauf pro Eintrag | `expires_at_ms = now + ttl_days × 86400000` beim Store | **`DEFAULT_TTL_DAYS`** (Wert pro TX; im Handoff-ZIP via `exportTtlDays`) |
| Purge nach Ablauf | **Jeder** darf purgen (Storage-Rebate) | — |

---

## 11. Messenger Credits (optional)

| Bereich | Move-Funktion | On-chain (Move) | Off-chain (Boss) | Edition |
|---------|---------------|-----------------|------------------|---------|
| Mint | `mint_messenger_credits` / `_batch` | **Nur `sender == boss`** | Boss-Adresse, Limits | Pro-Edition |
| Verbrauch | `store_*_with_credits` | Debit; `E_CREDITS_INSUFFICIENT` | Credits-Object-ID | Ja |

---

## 12. Nur off-chain (Messenger, nicht in Move)

| Parameter | Typisch im Handoff? | Hinweis |
|-----------|---------------------|---------|
| `ENABLE_PURGE` | ✅ fix `true` | Kein Chain-Enforcement |
| `USE_MAILBOX`, `MAILBOX_STORE_PLAINTEXT` | ✅ | Pfad Mailbox vs. Event |
| `AUTHORIZED_SENDERS` / Pinnwand | ✅ teilweise | **Nicht** Team-Chain-Write |
| `PACKAGE_ID`, `TEAM_MAILBOX_IDS`, Transport, `ROLE_ID` | ✅ | Siehe `EXPORT-ASSISTENT-REFERENZ.md` |
| Verschlüsselung (AES-GCM) | App | Privatsphäre off-chain |

---

## 13. Objekt-Übersicht (Messenger)

| Objekt / Eintrag | Owner? | Purge einzeln? | Wer purgt? | Ganzes Object löschen? |
|------------------|--------|----------------|------------|-------------------------|
| Server-Mailbox (DF) | Shared | HS, Msg, Plain | Parteien + nach TTL jeder | ❌ |
| Team-Broadcast (DF) | — | ✅ | Sender; nach TTL jeder | — |
| Team-Mailbox (Object) | Shared | nur Broadcasts | s.o. | ❌ |
| Private Mailbox | `owner` | HS, Msg, Plain | Parteien + nach TTL; MB: Owner | ✅ Owner |
| Vault | `owner` | ✅ | s. §9 | ✅ |
| Legacy-Events | — | ❌ | — | — |
| MessengerCredits | Holder | ❌ | — | — |

---

## 14. Kunden-Editionen (Angebot)

| Edition | Move-Inhalt | Handoff |
|---------|-------------|---------|
| **Standard** | Heutiges Package (Purge + TTL + Rebate) | Flexibel |
| **Secure / No-Purge** | `purge_*` deaktiviert | Feste `PACKAGE_ID` |
| **Archive** | Nur Store | Fest |
| **Credits-Pro** | Credits + Limits | Boss mintet |

Capability/NFT-Lizenzen: erst sinnvoll, wenn Move **Capabilities bei Store/Purge prüft** — heute: **Handoff + `PACKAGE_ID`**.

---

## 15. Move-Funktionen — Messenger (Vollliste)

**Deploy:** `create_globals`, `create_team_mailbox`, `create_private_mailbox`

**Vault:** `create_vault`, `update_vault`, `enable_emergency_purge`, `purge_vault`

**Handshake:** `store_ecdh_init`, `store_ecdh_init_private`, `store_ecdh_init_with_credits`, `purge_handshake`, `purge_handshake_private`, `emit_ecdh_init`

**Nachrichten:** `store_encrypted_message`, `store_encrypted_message_private`, `store_encrypted_message_with_credits`, `purge_message`, `purge_message_private`, `store_plaintext_message_stored`, `store_plaintext_message_stored_private`, `store_plaintext_message_with_credits`, `store_plaintext_message_with_credits_stored`, `purge_plaintext_mail_entry`, `purge_plaintext_mail_entry_private`, `send_encrypted_message`, `send_plaintext_message`, `store_plaintext_message`

**Team:** `store_team_plaintext_broadcast`, `purge_team_plaintext_broadcast`

**Private Mailbox:** `purge_private_mailbox`

**Peering:** `emit_pairing_offer`

**Credits (optional):** `mint_messenger_credits`, `mint_messenger_credits_batch`, `store_*_with_credits`

---

## 16. Fehlercodes (Messenger-relevant)

| Code | Bedeutung |
|------|-----------|
| `E_NOT_OWNER` (1) | Keine Berechtigung |
| `E_VAULT_MISSING` (2) | Vault nicht gefunden |
| `E_PURGE_NOT_ALLOWED_YET` (3) | Vault: TTL noch nicht erreicht |
| `E_MSG_MISSING` (10) | Verschlüsselte Nachricht fehlt |
| `E_HS_MISSING` (11) | Handshake fehlt |
| `E_PLAIN_MSG_MISSING` (43) | Klartext-Eintrag fehlt |
| `E_TEAM_BROADCAST_MISSING` (44) | Team-Broadcast fehlt |
| `E_PRIVATE_MB_RECIPIENT` (44) | Private: falscher Empfänger |
| `E_CREDITS_*` (40–42) | Credits |

---

## 17. Package-Upgrade (Boss-Ritual)

### A — In-Place (empfohlen für Bugfixes)

1. Dev: `npm run upgrade:move-package` (UpgradeCap in `.env`)
2. Boss: Backend neu starten — **kein** neues Handoff
3. Einsatzleitung → **Erweitert** → Chain-Status: Move-Funktionen prüfen

Details: **`docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md`**.

### B — Neu-Publish (neue PACKAGE_ID)

1. Dev: `npm run deploy:move-package` → neue `PACKAGE_ID` + `UPGRADE_CAP_ID`
2. Boss: **neue Team-Mailbox** (`create_team_mailbox`) + ggf. `create_globals` für Server-Mailbox
3. Neues Handoff-ZIP an alle Helfer
4. Alte Mailbox: **Archiv** (Posteingang kann alte Package-IDs aus History lesen); **kein Send** mit neuer Package-ID auf alte Objects

Siehe `docs/DEPLOY-CHECKLIST.md`, `docs/DEPLOY-MOVE-M2c-TEAM-BROADCAST.md`.
