# Klartext P1 — Plaintext-Policy (Pass 3 Nacharbeit)

**Status:** Spec + erste Fixes (2026-07)  
**Kontext:** Security-Review Pass 3 — P1-1 `ENABLE_PLAINTEXT_CHANNEL` + verschlüsselter Send

---

## Problem

Historisch spiegelte `storeEncryptedMessage` bei `ENABLE_PLAINTEXT_CHANNEL=true` **zusätzlich** Klartext on-chain, wenn der verschlüsselte Sendepfad (`/send`, Direct-IOTA verschlüsselt) einen `plaintext`-Parameter übergab. Handoff-Demos setzen oft `ENABLE_PLAINTEXT_CHANNEL=true` für `/send-plain` — dann wirkte „verschlüsselt senden“ irreführend (Ciphertext **und** Klartext in derselben TX).

## Zielbild (Policy)

| Pfad | On-chain Inhalt | Steuerung |
|------|-----------------|-----------|
| **Verschlüsselt** (`/send`, `/send-encrypted`, Direct E2EE) | Nur Ciphertext (+ iv/tag/nonce) | **Nie** Klartext-Spiegel |
| **Klartext** (`/send-plain`, Team-Klartext-Broadcast, SOS) | Klartext (bewusst) | `ENABLE_PLAINTEXT_CHANNEL`, Composer-Modus |
| **Empfang / Anzeige** Klartext-Events | Lesen + UI | `ENABLE_PLAINTEXT_CHANNEL` (Listener/Fetch) |
| **Mailbox Klartext persistent** | `store_plaintext_message*` | `MAILBOX_STORE_PLAINTEXT` + `/send-plain` |

**Regel:** `ENABLE_PLAINTEXT_CHANNEL` steuert **Klartext-Kanal** (senden/empfangen von Klartext), **nicht** einen Spiegel beim E2EE-Send.

## Implementiert (P1.1)

- `messenger-chain-wrap.sendEncryptedMessage` → `storeEncryptedMessage(..., plaintext: undefined)`
- `chain-access.storeEncryptedMessage` → ignoriert `plaintext`-Parameter (kein paralleler `send_plaintext_message` / `store_plaintext_message` mehr)
- `sendEncryptedWireOnly` war bereits ohne Klartext-Spiegel

## Offen (P1.2+)

| ID | Thema | Priorität |
|----|--------|-----------|
| P1.2 | `plain_send` Offline-Queue: UI-Warnung „Klartext in localStorage“ | Mittel |
| P1.3 | SOS / Path-4: UI-Kennzeichnung „nicht E2EE“ (bereits Spec SOS) | Mittel |
| P1.4 | Handoff-Default `ENABLE_PLAINTEXT_CHANNEL=false` für Produktion; Demo-Profil explizit | Niedrig |
| P1.5 | Status-API / UI: „Klartext-Kanal aktiv“ vs. „nur verschlüsselt“ klar trennen | Niedrig |

## Tests / Feldtest

1. `.env`: `ENABLE_PLAINTEXT_CHANNEL=true`
2. Verschlüsselt senden (`/send` oder Composer E2EE)
3. Explorer / RPC: **kein** paralleles Klartext-Event zur gleichen Nonce
4. `/send-plain` weiterhin funktionsfähig wenn Flag gesetzt

## Verweise

- Pass 3 Review (Sendepfad)
- `docs/DESIGN-PRINCIPLES.md` Regel 2 (Allow Cleartext)
- `docs/MOVE-MESSENGER-KONFIGURATION.md` Klartext vs. verschlüsselt
- `CHANGELOG.md` [Unreleased] → Sicherheit / Sendepfad
