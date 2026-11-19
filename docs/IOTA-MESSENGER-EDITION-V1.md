# IOTA Messenger — Minimal-Spec (ohne Boss / Helfer / Handoff)

**Stand:** 2026-07-10  
**Status:** Phase 1 — **eigenständiges Projekt** auf dem Desktop (`iota-messenger/`), strikt getrennt von Morgendrot  
**Zielgruppe:** Nutzer, die **nur** über IOTA chatten und Token senden wollen — **ohne** Einsatz-Organisation  
**Nicht-Ziel:** Offizieller IOTA-Foundation-Messenger, Signal-Ersatz, Behörden-Zertifizierung, Boss-Werkstatt, Handoff-ZIP-Provisioning

---

## 1. Produktversprechen (ehrlich)

| Was | Ja | Nein |
|-----|----|------|
| **Nachrichten** on-chain (Shared-Mailbox, optional E2EE nach Peering) | ✓ | |
| **Gruppenchat** (lokal verwaltet; on-chain = N× pairwise an alle Mitglieder) | ✓ | |
| **IOTA senden/empfangen** (Wallet-Transfer) | ✓ | |
| **Testnet** und **Mainnet** (RPC-Umschaltung) | ✓ | |
| **Eigenes Gerät, eigene Wallet** (`SIGNER=sdk`, Mnemonic lokal) | ✓ | |
| **Direkt-RPC** vom Handy (kein Pflicht-Server) | ✓ | |
| Boss / Helfer / Handoff / Remote-Signer / API_AUTH_TOKEN-Provisioning | | ✓ |
| LoRa / SOS-Funk / Telegram / Lock / Shop / Einsatzleitung | | ✓ |
| On-chain-Gruppenraum (ein TX für alle) | | ✓ (Backlog: `TEAM-MAILBOX-BROADCAST-1TX`) |
| Auto-Execute empfangener Chat-Befehle / Coin-Fernsteuerung | | ✓ (siehe §1.1) |

**Kern:** „**IOTA Messenger**“ = **Wallet + Mailbox-Chat + Gruppen + IOTA-Transfer** — wie eine schlanke Messenger-App, nur dass Transport und Speicher **IOTA/Move** sind. **Kein** Organisationsmodell.

### 1.1 Sicherheit — Auto-Execute / Coins (Entscheidung 2026-11-17, verbindlich)

**Merken / bei Edition-Umsetzung:**

- Chat-Produkt = **Nachrichten**. Fernsteuerungs-Coins und Auto-Befehle aus dem Posteingang sind **kein** Kern.
- `ENABLE_AUTO_EXECUTE=false` als **Default** der Edition (besser aus als Lock-/Morgendrot-Default).
- **Kein** Auto-Execute empfangener Chat-Befehle („sende X coins“ o. Ä.).
- **Lock-Fernsteuerung** weglassen oder nur separates Boss/Lock-Produkt — nicht im schlanken IOTA-Messenger.
- Optional später nur als **explizites** Spezialfeature (Whitelist/Limits) — nie stiller Default.

Cursor-Regel: `.cursor/rules/iota-messenger-no-auto-execute.mdc`.

---

## 2. Abgrenzung

| Volles Morgendrot | IOTA Messenger (diese Spec) |
|-------------------|----------------------------|
| Boss provisioniert Helfer (Handoff-ZIP, Remote-Signer) | Jeder Nutzer **selbst** (Seed, Peering-QR) |
| Morgendrot-Node als Relay/Boss-Werkstatt | **Optional** Relay; Default **Direkt-RPC** |
| Multi-Transport (LoRa, Telegram, BLE, …) | Nur **IOTA** (Internet + Mailbox) |
| 50+ Env-Flags, Expert-Tabs, Einsatz-Panels | **~10 Keys** oder ins Bundle eingebacken |
| `ROLE=boss` / `messenger` / Handoff-Flows | Ein Modus: **`ROLE=messenger`**, `SIMPLE_MODE=true` |

**Technik:** Derselbe Move-Messenger und dieselbe PWA/APK — nur **Capabilities + UI-Gates** schneiden alles andere weg. Kein Protokoll-Neubau.

---

## 3. Nutzer-Flow (Zielbild)

```
App installieren → Wallet anlegen/importieren (Mnemonic)
       → RPC + PACKAGE_ID + MAILBOX_ID (vorinstalliert oder einmalig eintragen)
       → Kontakt per Peering-QR / Adresse
       → Handshake (für E2EE) oder Klartext-Mailbox
       → 1:1-Chat · Gruppe anlegen · IOTA senden
```

| Schritt | Wie | Boss nötig? |
|---------|-----|-------------|
| Wallet | Mnemonic auf Gerät, `SIGNER=sdk` | Nein |
| Chain-IDs | Fest im **Testnet-Bundle** oder vom Betreiber eines Deployments | Nur wer das Move-Package deployed (einmalig, nicht „Boss pro Team“) |
| Kontakt kennenlernen | **Peering-QR** oder Adresse einfügen (`peering-qr.ts`) | Nein |
| Verschlüsselt chatten | ECDH-Handshake zwischen zwei Wallets | Nein (peer-to-peer) |
| Gruppe | Lokal in `messenger-group-store`; Senden = pairwise an alle (`group-mailbox-pairwise-send.ts`) | Nein |
| IOTA-Transfer | `/transfer-coins` / Direkt-RPC | Nein |

**Wichtig:** Peering/Handshake ist **Kontakt-Austausch**, nicht „Handoff“. Kein ZIP, kein Server-Apply, kein Remote-Signer.

---

## 4. Env-Preset (ein Gerät, kein Handoff)

```env
MESSENGER_EDITION=iota-messenger
UI_VARIANT=messenger
ROLE=messenger
SIMPLE_MODE=true
TRANSPORT_PROFILE=iota-anchored

SIGNER=sdk
USE_MAILBOX=true
MAILBOX_ID=0x…          # Shared-Mailbox des Deployments
PACKAGE_ID=0x…
RPC_URL=https://api.testnet.iota.cafe
NEXT_PUBLIC_DIRECT_IOTA_RPC_URL=https://api.testnet.iota.cafe

ENABLE_PLAINTEXT_CHANNEL=false
ENABLE_PURGE=true
ENABLE_REPLAY_PROTECTION=true
```

**Bewusst weggelassen:** `BOSS_ADDRESS`, `REMOTE_SIGNER_URL`, `API_AUTH_TOKEN`, Handoff-Keys, LoRa/Telegram-Flags.

**Server:** Nicht nötig für Kernnutzung. Optionaler lokaler Node nur für Komfort (Archiv, schwere Befehle) — siehe `docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`.

---

## 5. Capabilities-Override (Runtime)

```json
{
  "messengerCapabilities": {
    "simpleMode": true,
    "transport": {
      "iota": { "read": true, "write": true },
      "lora": { "read": false, "write": false },
      "telegram": { "read": false, "write": false },
      "ble": { "read": false, "write": false },
      "streams": { "read": false, "write": false }
    },
    "security": {
      "forceEncryptionOnly": true,
      "allowPlaintextFallback": false
    },
    "product": {
      "canCreateGroup": true,
      "canInviteMembers": true,
      "canExportData": true,
      "canManageEinsatzTemplates": false
    }
  }
}
```

**UI sichtbar:** Chats · Posteingang · Kontakte · Gruppen · **IOTA senden** · Status (Wallet, RPC, Queue).  
**UI versteckt:** Handoff-Import, Boss-Bootstrap, LoRa, Telegram, SOS (v1), Expert-Config, Lock, Shop, Einsatzleitung.

### Nicht brauchen (Checkliste Edition / Solo-Test)

| Weglassen | Warum |
|-----------|--------|
| Erststart-Karte **Einsatzleitung / Boss** | Boss-Werkstatt, nicht Messenger-Kern |
| Erststart-Karte **Einsatz / Helfer** | Boss-Handoff-ZIP |
| Handoff-Import / „Lokal vormerken“ als Pflicht | Provisionierung Einsatz; Solo = Seed + Chain-IDs |
| Einsatzleitung-Kachel, Remote-Signer, API_AUTH-Provisioning | Boss-LAN |
| LoRa / Meshtastic als Pflicht für v1-Chat | Optional später; Kern = IOTA (+ optional Telegram-Hinweis) |
| Tresor-Badge nur bei `backendReachable` | Solo braucht Badge auch ohne Node |
| Saldo nur `/api/wallet-balances` | Solo: Direkt-RPC-Saldo |
| Faucet nur `window.open` | APK oft tot → externes Öffnen / URL kopieren |
| OFFLINE-Badge = Basis tot | Verwechslungsgefahr mit „kein Internet“; Autark/Direkt-RPC parallel zeigen |
| SOS / Einsatzleitung / Handoff-UI | Morgendrot-Reste; Edition blendet aus |

**Feldnotiz 2026-11-17 (Morgendrot-APK):** Drei-Karten-Erststart (`StandaloneFirstStartCard`) wirkte **ausgegraut / unbenutzbar**; **Neues Profil anlegen** im Tresor-Dialog (inkl. Solo) ging. → Nach 4b: Erststart UX härten oder für `iota-messenger` ganz weglassen (nur Solo-Create).

**Feldnotiz 2026-11-17:** Einstellungen → IOTA: „Wo senden?“ / „Gas für Testnet“ waren an **Boss/Kommandant** gekoppelt — Solo (`role=messenger`) sah sie nicht. Fix: auch Solo/Standalone ohne Basis.

**Feldnotiz 2026-11-17 (Gerät):** Chain-Saldo für Solo-Adresse bereits **10 IOTA** (Testnet); UI zeigte „Saldo wird geladen…“ weil nur API-Saldo. Faucet-Captcha muss im System-Browser laufen.

---

## 6. Was schon im Code ist (Ist)

| Feature | Code / Doku |
|---------|-------------|
| Direkt-RPC Send (Mailbox) | `mailbox-send-hybrid.ts`, `@morgendrot/core` |
| Peering ohne Server | `peering-qr.ts`, `direct-iota-handshake-submit.ts` |
| Gruppen pairwise | `group-mailbox-pairwise-send.ts`, `messenger-group-store` |
| APK ohne Pflicht-Node | `docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`, Variante B in `WANDERER-STANDALONE-BUNDLE.md` |
| IOTA-Transfer | `boss-transfer.ts` / `/transfer-coins` (auch im Messenger-UI) |

**Lücke:** Onboarding und UI sind noch auf **Boss/Handoff** ausgelegt; Edition-Flag `iota-messenger` fehlt; Testnet-`PACKAGE_ID`/`MAILBOX_ID` nicht als App-Default gebündelt.

---

## 7. Umsetzung (Phasen)

| Phase | Inhalt | Aufwand (grob) |
|-------|--------|----------------|
| **0** | Diese Spec + **2-Seiten-Nutzeranleitung** (Wallet, QR, Gruppe) — **ohne** Boss-Kapitel | 1 Tag |
| **1** | `MESSENGER_EDITION=iota-messenger`: UI-Gates (Handoff/Boss ausblenden), Capabilities-Preset | 3–5 Tage |
| **2** | **Testnet-Starter-Bundle/APK** mit festen Chain-IDs + Minimal-Onboarding (kein Handoff-Wizard) | 1 Woche |
| **3** | 2-Geräte-Smoke: Peering-QR → Handshake → Chat → Gruppe → IOTA-Transfer | 2–3 Tage |
| **4** | Optional Mainnet-Profil, App-Name/Icon | später |

**Nicht in v1:** Separates GitHub-Repo, LoRa-Code löschen, on-chain-Gruppen-Broadcast, Wallet-only ohne Mailbox.

---

## 8. Ehrliche Grenzen

1. **Move-Deploy bleibt:** Ohne `PACKAGE_ID` + `MAILBOX_ID` (nach `create_globals`) kein Mailbox-Chat — kann aber **einmal** für alle Testnutzer ins Bundle, nicht pro Team.
2. **Gas:** Jede Mailbox-Nachricht kostet Gas; Gruppen = **N Transaktionen** (ein Mitglied mehr → mehr Kosten).
3. **Kein Signal-Niveau:** Metadaten on-chain, kein Push ohne eigene Infrastruktur, Browser-Key-Risiko.
4. **E2EE:** Braucht **Peering/Handshake** zwischen zwei Adressen — simpel per QR, aber kein „einfach Nummer eingeben wie WhatsApp“ ohne diesen Schritt (Klartext-Mailbox wäre möglich, Spec sagt v1: **verschlüsselt**).

---

## 9. Marke & Lizenz

- Arbeitstitel **„IOTA Messenger“** — vor öffentlicher Marke Verwechslung mit IOTA Foundation prüfen.
- Code bleibt **AGPL-3.0**; Fork/Netz-Service → Quellpflicht.
- **`DISCLAIMER.md`** gilt unverändert.

---

## 10. Verweise

| Thema | Doku |
|-------|------|
| Handy-first / Direkt-RPC | `docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md` |
| Mailbox-Begriffe | `docs/MAILBOX-BEGRIFFE-UND-NUTZUNG.md` |
| Gruppen-Senden | `frontend/frontend/lib/group-mailbox-pairwise-send.ts` |
| Peering-QR | `frontend/frontend/lib/peering-qr.ts` |
| Capabilities | `docs/CAPABILITIES-MATRIX-ZIELBILD.md` |
| APK Smoke | `docs/STANDALONE-SMOKE-CHECKLIST.md` |

---

*Entscheidung:* **Eigenständiger Ordner** `Desktop/iota-messenger` (Bootstrap: `node tools/iota-messenger/bootstrap-desktop.mjs` im Morgendrot-Repo). Nächster Schritt: **Phase 2** Testnet-Starter mit festen Chain-IDs.*
