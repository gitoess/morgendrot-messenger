# Messenger: Kanäle & Mailbox — Meilensteine M1–M4

**Zweck:** Kanonische Produkt- und Engineering-Reihenfolge für **Shared Mailbox**, **drei Kommunikationskanäle** (1:1, Gruppe, Pinnwand) und optionale **Private Mailbox**.  
**Stand:** 2026-05-15  
**Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md`** **§ H.22**  
**Technik Mailbox (Ist):** **`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`**, **`docs/MAILBOX-BEGRIFFE-UND-NUTZUNG.md`** (Begriffe für Nutzer), Move `move-test/sources/messaging.move`, `MAILBOX_ID` = **ein** Shared Object pro Deployment (`create_globals`). **Später:** mehrere Package-Profile — **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** (§ **H.24b**).

---

## Leitplanken (kritisch)

| Thema | Regel |
|--------|--------|
| **Kontakt-ID** | Nutzer teilen **`MY_ADDRESS` (`0x` + 64 Hex)** — **nicht** `MAILBOX_ID`. |
| **MAILBOX_ID** | Betriebs-/Deploy-Konstante (Postamt-Gebäude); Admin/Config, nicht Empfängerfeld. |
| **Verschlüsselung** | ECDH über **`/handshake`** → Keys unter Shared Mailbox (`HsKey`); kein fester „Mailbox-Public-Key“. |
| **Gruppe vs. Pinnwand** | **Gruppenchat** = Dialog mehrerer Aktiver; **Pinnwand** = Brett (Klartext, moderiert) — **nicht** dasselbe Produkt. |
| **Private Mailbox** | **Optional (M4)** — neues Move + Fetch-Routing; **nicht** MVP-Blocker für M1. |

---

## Meilenstein-Übersicht

| ID | Fokus | Move | UI (Kurz) | Abhängigkeiten |
|----|--------|------|-----------|----------------|
| **M1** | Shared Mailbox **fertig** + klare Kanäle (1:1 + Pinnwand) | **Ist** (`Mailbox` + DF) | Adresse prominent; Kanal-Labels; Persistent Event/Mailbox | **`MESSAGING-MAILBOX-SSOT-SPEC`** Phase A; Vault „Signer-Import mit speichern“ bei lokalem Save |
| **M2** | **Gruppenchat** eigener Kanal | v1: kein neues Objekt; Multi-Partner-Fetch / Gruppen-State | Tab **„Gruppe“**; Mitgliederliste; gemeinsamer Thread | M1 stabil; **§ H.12** (eine Wahrheit Inbox) |
| **M3** | **Pinnwand** Einsatz | **Ist** (`PlainMsgKey`, `BROADCAST_*`) | Pinning; Moderation sichtbar; Boss-Admin | `ENABLE_BROADCAST_PINNWAND`, `BROADCAST_AUTHORIZED_SENDERS` |
| **M4** | **Private Mailbox** (Erweitert) | **Neu:** `PrivateMailbox` (M4d) | M4a Speicher → M4b Send → M4c QR → M4d eigene Mailbox | **nach M1**; M4a-Datenlage teils ✓ |

**Reihenfolge:** strikt **M1 → M2 → M3 → M4** (M3 kann teilweise parallel zu M2, wenn nur UI/Env; Move für M4d **nie** vor M1-Abschluss).

**Priorität (Engineering):** **M1 sauber abschließen** (SSOT Phase A + stabile Shared Mailbox) **bevor** Send-Routing/QR für private Mailboxes (**M4b–d**). **M4a** (Kontakt-Speicher) ist als Datengrundlage vorgezogen — **ohne** M4b wirkt Senden noch über die Shared Mailbox.

### UI-Empfehlungen (Kontakte & M4)

| Ort | Verhalten | Meilenstein |
|-----|-----------|-------------|
| **Telefonbuch** | Feld **„Alternative Mailbox (optional)“** + Hilfetext (leer = Einsatz-Mailbox) | **M4a** (Feld ✓) |
| **Kontakt hinzufügen** | **QR scannen** → Wallet + optionale Mailbox-ID | **M4c** |
| **Chat / Senden** | Kleiner Hinweis **„Sendet an private Mailbox“**, wenn Kontakt-Routing aktiv | **M4b** |
| **Standard** | Kontakt-ID = **`0x…`**; kein Mailbox-Feld im Normalmodus | **M1** |

---

## M1 — Shared Mailbox + Kanal-UX (jetzt — Priorität)

### Technik (Checkliste)

- [x] **`MESSAGING-MAILBOX-SSOT-SPEC`** Phase A: `messagingPersistenceMode` → `forceLegacyPlaintext` (`messaging-persistence-resolve.ts`, API/Handler); Klartext-Mailbox wirft bei fehlender Config; CLI `/send-plain` bleibt Event.
- [x] Tresor **„Lokal sichern“** mit **`includeIotaMnemonic`** (UI → `/vault-save`) — Signer-Import in `.morgendrot-vault`.
- [x] Unlock mit nur Vault-Passwort, wenn `iotaSdkSignerImport` in Datei ( **`POST /api/unlock`** ; Modultest `vault-signer-import`).
- [x] Hybrid-Send (`mailbox-send-hybrid.ts`) + Transport-Card reichen **`messagingPersistenceMode`** durch.
- [x] Fehlermeldungen / **`configHints`** bei fehlender/leerer **`MAILBOX_ID`** (≠ `PACKAGE_ID`); Setup zeigt maskierte Server-ID read-only.

### UI (Checkliste)

- [x] Kanal-Umschalter: **„1:1 Privat“** vs. **„Pinnwand (Brett)“** + Kurzbeschreibung.
- [x] **Meine IOTA-Adresse** im Chat (kopieren) — Kontakt teilen, nicht Mailbox-ID.
- [x] Einstellungen/Config: **`MAILBOX_ID`** nur read-only / Admin-Hinweis (Setup „Erweitert“, `mailboxIdMasked` in `/api/status`).
- [x] Handbuch-Verweis: Pinnwand + Gruppe einrichten (Links im Chat-Header).

### Abnahme M1

- Entsperren → senden (verschlüsselt) → sperren → nur Passwort → Send/Fetch ok.
- Persistent **Mailbox** speichert Klartext on-chain unter Shared Mailbox (wenn Move/Env aktiv).
- Nutzer versteht: Partner = **0x-Adresse**; Pinnwand = **Brett**, kein Gruppenchat.

---

## M2 — Gruppenchat (eigenständiger Kanal)

**Problem heute:** `ENABLE_PAIRWISE_GROUPS` + `PARTNER_ADDRESSES` = **N×1:1**, kein gemeinsamer Raum.

### Zielbild

- UI-Kanal **`group`** neben `private` | `pinnwand`.
- Gruppe = benannte **Mitgliederliste (`0x…`)** + **ein** Posteingangs-Thread (Union oder dedizierter Fetch).
- Verschlüsselung **Stufe v1:** weiter pairwise (teuer, ohne Move); **v2:** Gruppenschlüssel oder Streams-Anchor — **eigenes Paket**.

### Technik (Stufen)

| Stufe | Inhalt | Status |
|-------|--------|--------|
| **M2a** | `MessengerChatChannel` + `group`; lokale Gruppen-Definition; Inbox-Filter „alle Mitglieder“; Telefonbuch-Integration (**§ H.16**) | **in Arbeit** ✓ UI/Filter |
| **M2b** | Optional Streams-Anchor pro Gruppe (Live) + Mailbox für Archiv | **UI/API ✓** (2026-05-15) |
| **M2c** | Move/Wire für Gruppen-E2EE (nur bei klarem Threat-Model) | offen |

### M2a Checkliste

- [x] Kanal-Umschalter **Gruppe** im Chat-Header
- [x] `messenger-group-store.ts` (localStorage) + Gruppen-Panel
- [x] Posteingang: Union-Filter `groupMemberAddresses` (`inbox-partner-filter.ts`)
- [x] „Aus Telefonbuch“ für Mitgliederliste
- [ ] Batch-Senden an alle Mitglieder (optional, v1 weiter Einzel-Empfänger)

### Nicht-Ziele M2

- Kein Ersatz für **Pinnwand** (Brett bleibt Klartext/moderiert).
- Keine Pflicht **Private Mailbox** (M4).

---

## M3 — Pinnwand verbessern

**Ist:** `BROADCAST_PINNWAND_ADDRESS`, autorisierte Sender, Klartext, Kanal in `ChatView`.

### Ziel

| Feature | Hinweis | Status |
|---------|---------|--------|
| **Moderation** | UI zeigt, wer schreiben darf (`BROADCAST_AUTHORIZED_SENDERS` / Rolle) | **✓** via `broadcastPinnwand` in `/api/status` + Kontext-Karte |
| **Pinning** | Wichtige Posts oben (zuerst **lokal** / `sessionStorage`, optional Move später) | **✓** `pinnwand-pin-store.ts`, Menü im Posteingang |
| **Lesen für alle** | Filter Posteingang „Pinnwand“; Doku Einsatz | **✓** Kanal + Klartext-Filter; Empfänger aus Status |

**Bezug:** Kachel **`pinnwand-admin`** (Boss), `docs/BROADCAST-PINNWAND.md`.

---

## M4 — Private Mailbox (optional, Erweitert)

**Nur** für Mandanten / Dead Drop / hohe Isolation — **nicht** Standard.

### Problem (Discovery)

| Situation | Folge |
|-----------|--------|
| Alle nutzen **Shared Mailbox** | Jeder liest dieselbe Mailbox, filtert nach **eigener `0x`** als Empfänger — funktioniert. |
| User A erstellt **eigene Mailbox** | Neue **Mailbox-Object-ID** — User B kennt nur A’s **Wallet `0x…`**, nicht wo A’s Post liegt. |

**Lösung (Produkt):** Kontakt = **Wallet (Pflicht)** + **optionale Mailbox-ID**; Senden: „hat Kontakt eine Mailbox-ID? → dorthin, sonst Shared“. Normalnutzer: **QR** mit beiden Werten, kein Fachwissen.

### Unter-Meilensteine M4 (Reihenfolge)

| Stufe | Inhalt | Status |
|-------|--------|--------|
| **M4a** | Kontakt-Speicherung: `mailboxObjectId` optional (API + Telefonbuch-Feld) | **Datenlage ✓** — Send nutzt es erst ab M4b |
| **M4b** | Send-Routing: private Mailbox des Kontakts priorisieren; Chat-Hinweis „Sendet an private Mailbox“ | **✓ Send/UI** (2026-05-15) |
| **M4c** | QR beim Kontakt hinzufügen: Wallet + Mailbox-ID | **✓** (2026-05-15) |
| **M4d** | Eigene Private Mailbox erstellen (Move) + Profil-QR | **✓** Move + UI (2026-05-20); Redeploy Paket nötig |

### Move (Skizze, M4d)

```move
public struct PrivateMailbox has key, store {
    id: UID,
    owner: address,
}
// entry: create_private_mailbox → transfer to owner
// store_encrypted_message(&mut private_mb, recipient: owner, ...)
```

### UI (Zielbild)

| Bereich | Verhalten |
|---------|-----------|
| **Standard** | Shared Mailbox — Nutzer trägt nur **`0x…`** ein oder scannt QR. |
| **Telefonbuch** | **Alternative Mailbox (optional)** + Hilfetext (M4a). |
| **Senden** | Hinweis **„Sendet an private Mailbox“** wenn M4b aktiv (M4b). |
| **Erweitert** | „Eigene Private Mailbox erstellen“ + **Mein Kontakt-QR** (Wallet + Mailbox) (M4d). |
| **Setup Admin** | Package-ID / Server-`MAILBOX_ID` — **nicht** Partner-Feld (bleibt getrennt). |

### M4a Checkliste (Abnahme)

- [x] `ContactMeshEntry.mailboxObjectId` + `normalizeMailboxObjectId` (`src/contact-labels.ts`)
- [x] `POST /api/contact-label` akzeptiert `mailboxObjectId` (leer = löschen)
- [x] Telefonbuch: Feld „Alternative Mailbox-ID (optional)“
- [x] Modultest `contact-labels mailboxObjectId` in `scripts/run-tests.ts` (`npm test`)

### M4b–c Checkliste (2026-05-15)

- [x] **M4b** Send: `mailboxObjectId` in API + `mailbox-object-id-scope` (Server) + Hybrid/Direct-IOTA + Composer-Hinweis
- [x] **M4b** Telefonbuch speichert `mailboxObjectId` an API
- [x] **M4c** Kontakt-QR v2 (`contact-qr.ts`) + Import (Text/Kamera) im Telefonbuch
- [x] **M4d (interim)** Eigene Mailbox-ID lokal + Profil-QR (`my-private-mailbox-store`, Identity-Karte)
- [x] **M4d** Move `create_private_mailbox` + UI **„Eigene private Mailbox erstellen“** (`/create-private-mailbox`, Puls/Identität); Paket live (Testnet `0x014ef8…a1c7`, 2026-05-20)

### Abhängigkeiten (M4b+)

- Fetch: gezielt `mailboxObjectId` des Kontakts / eigenes Object scannen.
- **§ H.12:** Konflikt mit Shared-Inbox und Offline-Queue klären.

---

## Verwandte Dateien

| Bereich | Pfad |
|---------|------|
| Move Mailbox | `move-test/sources/messaging.move` |
| Fetch | `src/messenger-nest/messenger-fetch.ts` |
| Chat UI | `frontend/frontend/components/views/chat-view.tsx`, `chat-view-chat-header.tsx` |
| Kanal-Typ | `frontend/frontend/lib/messenger-chat-channel.ts` |
| Pinnwand Doku | `docs/BROADCAST-PINNWAND.md` |
| „Gruppe“ heute (Pairwise) | `docs/CHAT-GRUPPE-EINRICHTEN.md` |
| Inbox-Architektur | `docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md` |

---

*Bei Widerspruch zur Move-Ist-Architektur gilt der Code + `MESSAGING-MAILBOX-SSOT-SPEC.md`; dieses Dokument ist die **Produkt-Reihenfolge** M1–M4.*
