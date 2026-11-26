# IOTA Messenger — Minimal-Spec (ohne Boss / Helfer / Handoff)

**Stand:** 2026-11-24  
**Status:** **Arbeitsmodell „Boss ohne Helfer“** (User 2026-11-24) — Detail-Schnitt erst beim **PC-Messenger-Durchgang**. Caps-Overlay (`hideFunk` etc.) kann noch von Freeze-Scheibe 1 abweichen → Abgleich im Durchgang.  
**Zielgruppe:** Peers / „Bosse unter Freunden“ — voller Messenger-Alltag **ohne** Helfer-Provisioning  
**Nicht-Ziel:** Helfer-Handoff, Einsatzleitung-Hub, Boss-provisioniert-Helfer; kein IOTA-Foundation-Produkt

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
| Seal / Key-Broker (P4b, Boss-Schlüsseldienst) | | ✓ (Merkliste Roadmap 2026-11-20) |

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

### 2.1 Arbeitsmodell — Boss ohne Helfer (2026-11-24, vorläufig)

**Kurz:** **Morgendrot = alles.** **IOTA-Messenger ⊂ Morgendrot:** derselbe Chat-Alltag (IOTA **und** Funk **und** Telegram, Gruppen, Freunde = andere „Bosse“), **ohne** Helfer-/Einsatz-Provisioning.

| | IOTA-Messenger | Morgendrot |
|--|----------------|------------|
| **Bild** | Boss **ohne** Helfer; Peers/Freunde | Boss **mit** Helfer + Einsatz-Org |
| **Transport** | IOTA + Funk + Telegram (Alltag) | dasselbe + Org-Extras |
| **Raus (I)** | Handoff-ZIP, Einsatzleitung-Hub, Helfer einrichten, H.36 Einsatz-Wizard, typische Boss-Admin-Move-UI | behalten |
| **Detail** | Zeile-für-Zeile erst beim **PC-Durchgang** | — |

**Konflikt merken:** Overlay Freeze-Scheibe 1 setzt noch `hideFunk`/`hideTelegram` — **nicht** still umbauen; Abgleich im Durchgang.

### 2.2 PC-Durchgang — „weg“-Liste (lebend, nur Edition)

Während Morgendrot-UI **bleiben** die Einträge sichtbar; für **IOTA-Messenger** merken / Caps später setzen. Konvention User: „**weg**“ = nur Liste, Code hier nicht streichen.

| # | Weg (IOTA) | Ist / Notiz | Stand |
|---|------------|-------------|-------|
| 1 | Header-Badge **Boss** (Role-Pill) | **Ist:** `hideBossRolePill` → Pill **„Messenger“** (Edition-Build) | 2026-11-26 |
| 2 | Home-Kachel **Einsatzleitung** | schon `hideEinsatzleitung`; Hub/Handoff ebenfalls | 2026-11-24 |
| 3 | SOS — Hilferuf | schon `hideSos` (v1); Morgendrot behält Button | 2026-11-24 |
| 4 | Handoff / Helfer / Erststart-Boss-Karten | Caps vorhanden | zuvor |
| … | *(weitere Zeilen im Durchgang)* | | |

**Home-Navig (beide Produkte, 2026-11-24):** Wallet + Aktivität nicht permanent auf dem Home — hinter Kachel **IOTA** (wie Nachrichten).

**Onboarding (2026-11-24):** Bei Edition (`hideEinsatzleitung` / `isIotaMessengerProduct`) Vault-Link → **Wanderer/Peer-Wizard** („Messenger einrichten (Freunde)“), nicht Einsatzleitung. Schritte: Wallet → Adresse → Postfach → optional Funk.

**Caps-Ist:** Overlay ↔ `product-identity.ts` aligned (Funk/TG an; Boss/Helfer/SOS/Einsatz aus; Role-Pill → Messenger). Weitere weg-Zeilen nur mit User-OK.

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

## 4. Env — was braucht IOTA Messenger?

**SSOT-Preset:** `tools/iota-messenger/overlays/.env.example` (Stand 2026-11-26).  
**Nicht** die Root-`.env.example` 1:1 kopieren — das ist **volles Morgendrot** (Boss/Lock/Shop/Monitor); viele Keys sind für die Edition überflüssig oder **falsch** (z. B. `ENABLE_AUTO_EXECUTE=true` dort vs. Edition-Freeze **`false`**).

### Pflichtliste

| Variable | Wofür |
|----------|--------|
| `MESSENGER_EDITION` / `PRODUCT_ID` = `iota-messenger` | UI-Gates, Produktclaim |
| `UI_VARIANT=messenger` · `ROLE=messenger` · `SIMPLE_MODE=true` | schlanke Rolle |
| `TRANSPORT_PROFILE=iota-anchored` | IOTA-Kern, kein Mesh-Default |
| `SIGNER=sdk` | Wallet lokal (Mnemonic) |
| `USE_MAILBOX=true` · `PACKAGE_ID` · `MAILBOX_ID` | Chat on-chain (echte `0x…64`, keine Nullen) |
| `RPC_URL` · `NEXT_PUBLIC_DIRECT_IOTA_RPC_URL` | Fullnode (Testnet-Default ok) |
| `ENABLE_AUTO_EXECUTE=false` | kein Coin-Fernsteuern aus dem Posteingang |
| `ENABLE_PLAINTEXT_CHANNEL=false` · `ENABLE_PURGE` · `ENABLE_REPLAY_PROTECTION` | Sicherheits-Defaults |

Lokal-Dev zusätzlich: `ENABLE_UI=true`, `API_PORT`/`UI_PORT`, `API_BIND_HOST=127.0.0.1`.

### Nicht in der `.env` (andere Stores)

| Inhalt | Wo |
|--------|-----|
| Messaging-Keys / Seed / Notizen | Tresor `.morgendrot-vault` |
| Telegram-Bot-Token (eigener) | Runtime `.morgendrot-runtime-config.json` |
| Kontakte | Telefonbuch (localStorage → Ziel: Vault) |

### Bewusst weglassen

`BOSS_ADDRESS`, `REMOTE_SIGNER_*`, `API_AUTH_TOKEN`, `LOCK_*`, `MONITOR_*`, Shop/Voucher, Streams-Open, Handoff-ZIP.

**Kritik Ist:** Overlay hatte lange `0x000…`-Platzhalter — App startet, Chat nicht. Root-`.env.example` „Stand: März 2026“ und Defaults mischen Boss+Messenger → verwirrend. **Verbesserung:** Overlay mit Pflicht/Optional/Weglassen + dieser Abschnitt; echte IDs weiter aus Deploy/UI.

**Server:** Kernnutzung ohne Pflicht-Node möglich; optional lokal für Komfort — `docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`.

### Caps / Pill sehen (Demo)

| Was | Wo |
|-----|-----|
| Pill **Messenger** statt Boss | Build mit `NEXT_PUBLIC_PRODUCT_ID=iota-messenger` **oder** `.env` `ROLE=messenger` (dann Pill „Messenger“) |
| Titel **IOTA Messenger** | nur mit `NEXT_PUBLIC_PRODUCT_ID=iota-messenger` (Frontend-Build) |
| Visitenkarte | **Nachrichten** → Sidebar **Ich** → Profil öffnen → Block **Visitenkarte teilen** |

Normales `npm run dm` mit `ROLE=boss` = **volles Morgendrot** → Boss-Pill bleibt. Edition bewusst starten (Overlay / `Desktop/iota-messenger` Bootstrap).

### Weg A — HTTPS-Web-Demo (Vercel / Cloudflare Pages)

**Ja, grundsätzlich** — gut für PC + Handy-Browser (PWA, Secure Context für BLE später).

| Braucht’s | Urteil |
|-----------|--------|
| **Statisches Next-Frontend** + `NEXT_PUBLIC_PRODUCT_ID=iota-messenger` + Testnet-RPC/IDs | **Kern-Demo** (Tresor, Direct-IOTA, Chat) machbar |
| **Eigener Morgendrot-API-Node** auf dem Hoster | Oft **nicht** trivial auf reinem Pages/Vercel (langer Node-Prozess, Secrets, Telegram-Poll). Demo dann **Direkt-RPC** / Standalone-Pfad |
| **„Geschützt“** | Edge-Basic-Auth / Cloudflare Access **oder** nur Tresor-PW in der App — nicht dasselbe |
| Custom Domain `app.…` | DNS → Hosting; **HTTPS** Pflicht |
| Funk USB/BLE | Browser braucht Secure Context; USB am Handy oft nicht |

**Nicht erwarten:** ein Upload von `frontend/` allein ersetzt nicht `.env`, Gas, Package/Mailbox-IDs und Live-Testnet. Seed nie ins Repo / Build-Log.

**Lokal zeigen jetzt:** Overlay-Env + `dm` mit Edition-Flags — oder Desktop-`iota-messenger` Bootstrap. Öffentliche URL = eigene Scheibe (Deploy-Skript + Secrets-Checkliste), nicht Big-Bang.

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
