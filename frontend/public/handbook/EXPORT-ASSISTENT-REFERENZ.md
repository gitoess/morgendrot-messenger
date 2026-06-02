# Export-Assistent — vollständige Referenz

**Stand:** 2026-06-02  
**Zweck:** Alle Einstellungen, IDs und `.env`-Keys des Boss-Handoffs — **implementiert** vs. **geplant** — an einem Ort.  
**UI:** Einsatzleitung → **Export-Assistent** · API: `POST /api/standalone-smartphone-handoff-zip`  
**Verwandt:** `docs/HANDOFF-EXPORT-HYBRID.md`, `docs/HANDOFF-IMPORT-UX.md`, `docs/MESSENGER-CHAT-HANDBUCH.md` (Orientierung, .env vs. Move)

> **Nicht verwechseln:** Die **komplette** Liste aller `.env`-Keys in **Messenger → Einstellungen** (Erweiterte Konfiguration) steht in **`docs/ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md`**. Dieses Dokument hier ist nur **Handoff-Export** + ZIP-Inhalt.

---

## 1. Kurz: Was passiert beim Export?

| Artefakt | Pro Helfer? | Inhalt |
|----------|-------------|--------|
| **`morgendrot-standalone-handoff.env`** | **Ja** (pro ZIP) | Öffentliche Geräte-Konfiguration — **kein** Seed/Passwort |
| **`.morgendrot-runtime-config.json`** | **Ja** | Capabilities-Matrix (Transport LoRa/Telegram/IOTA) |
| **`README-HANDOFF.txt`** | **Ja** | Ablauf, Kurzparameter, optional LoRa-PSK / IOTA-Archiv |
| **`handoff.morg.enc`** | Optional | Verschlüsselte `.env` statt Klartext (Passwort-Schutz) |
| **Move-Deploy / neues Package** | **Nein** | `PACKAGE_ID` wird **referenziert**, nicht neu deployed |
| **Smartphone-Bundle** | **Nein** | Separat: `npm run bundle:standalone-smartphone` auf dem Boss-PC |

**Zielzeit Boss:** Profil + Bezeichnung + Haken → Download (~20 s). Technik nur bei Bedarf.

---

## 2. UI — alle Felder des Export-Assistenten

### 2.1 Schritt 1 (schnell) — **Ist**

| UI-Element | API / Wirkung | Status |
|------------|---------------|--------|
| **Zusammenfassung** (grüne Box) | Nur Anzeige aus Preset + Auswahl | Ist |
| **Bezeichnung** | `handoffLabel` → `HANDOFF_LABEL` + README | Ist |
| **Profil Helfer** | Preset `helfer` → ROLE, ROLE_ID, TRANSPORT, SIMPLE_MODE, UI | Ist (Standard) |
| **Profil Führer** | Preset `fuehrer` | Ist |
| **Profil Spezial** | Preset `spezial` (z. B. ROLE_ID=4) | Ist |
| **Vorlage laden** (Dropdown) | Lädt `.morgendrot-einsatz-templates.json` → Preset + ROLE_ID | Ist |
| **Weiter** | Wechsel zu Schritt 2 | Ist |

### 2.2 Schritt 2 — Team, Partner, Download — **Ist**

| UI-Element | API / Wirkung | Status |
|------------|---------------|--------|
| **Team-Postfächer** (Checkboxen) | `mailboxId` (primär), `teamMailboxIds` | Ist |
| **Partner im Einsatz** (Checkboxen) | `partnerAddresses` → PARTNER_ADDRESS(S) | Ist |
| **IOTA-Archiv im README** | `includeIotaArchivReadme`, `readmeExtra` | Ist (nur mesh-first, ohne Passwort) |
| **Mit Passwort schützen** | Client: `handoff.morg.enc` | Ist |
| **ZIP-Paket herunterladen (Profil)** | `format=zip` | Ist |
| **Nochmal: letztes Preset** | Gleicher Download, anderes Preset in UI | Ist |
| **Per IOTA an Partner** | `sendHandoffZipViaIota` | Ist |
| **Zurück** | Schritt 1 | Ist |

### 2.3 Experte (ausklappbar) — **Ist**

| UI-Element | API / Wirkung | Status |
|------------|---------------|--------|
| **Feineinstellung → ROLE_ID-Bits** | `roleId` | Ist |
| **Capabilities-Matrix** | `capabilitiesOverride` → runtime JSON | Ist |
| **ROLE** (messenger/arbeiter/kommandant) | `helperRole` | Ist |
| **Simple Mode** | `simpleMode` | Ist |
| **Keine Team-Mailboxen im ZIP** | `mailboxId=''`, kein `teamMailboxIds` | Ist |
| **Als Vorlage speichern** | POST `/api/einsatz-role-templates` | Ist |
| **Erweiterte Technik → RPC_URL** | `rpcUrl` | Ist |
| **PACKAGE_ID** Boss vs. custom | `packageSource`, `customPackageId` | Ist |
| **BOSS_ADDRESS, MAILBOX_ID, COMMAND_REGISTRY_ID, VAULT_REGISTRY_ID** | jeweilige Felder | Ist |
| **NEXT_PUBLIC_DIRECT_IOTA_RPC_URL** | `nextPublicDirectIotaRpcUrl` | Ist |
| **Partner manuell (Textarea)** | `partnerAddresses` | Ist |
| **LoRa / .env-Erklärung** | Nur Text | Ist (Doku) |

### 2.4 UI — geplant / Backlog (noch nicht oder nur Doku)

| Idee | Status |
|------|--------|
| Preset **Arbeiter** als eigene Karte (4.) | **Nein** — `ROLE=arbeiter` über Feineinstellung oder Vorlage |
| Preset **Wanderer/Prepper** im Export-Assistenten | **Nein** — eigenes Produkt (`WANDERER-STANDALONE-BUNDLE.md`) |
| Vorlagen mit gespeicherten Partnern/Team-IDs | **Backlog** (`HANDOFF-EXPORT-HYBRID.md` § C) |
| `historyFromNewest` / Package-History in UI | API-Feld **ja**, UI **nein** |
| `initialProfile` / Kontakte **im** ZIP | **Nein** — Telefonbuch-Export separat; Handoff nur `.env` |
| Ein-Klick „alle Team-Postfächer“ | **Nein** — manuell anhaken |
| Wizard Schritt 3 „Vorschau .env“ | **Backlog** |
| Helfer-Bundle **im** ZIP mitliefern | **Nein** — Medium getrennt (Bundle + Handoff-ZIP) |

### 2.5 Entfernte / nicht mehr in Einsatzleitung

| Element | Ort heute |
|---------|-----------|
| Kontakte importieren/exportieren | **Telefonbuch** |
| Forensik-Export | **Posteingang** |
| Messenger `npm run bundle:messenger` | Handbuch / Erweiterte Technik (Hinweis) |

---

## 3. API-Body `StandaloneSmartphoneHandoffZipBody`

| Feld | Typ | Default / Quelle | In `.env`? |
|------|-----|------------------|------------|
| `handoffLabel` | string? | Bezeichnung | `HANDOFF_LABEL` + Kommentar |
| `rpcUrl` | string? | Boss `RPC_URL` | `RPC_URL` |
| `packageSource` | `boss` \| `custom` \| `history` | Boss-.env | steuert `PACKAGE_ID` |
| `customPackageId` | string? | — | `PACKAGE_ID` wenn custom |
| `historyFromNewest` | number | 0 | nur bei `history` (UI fehlt) |
| `bossAddress` | string? | Boss `MY_ADDRESS` | `BOSS_ADDRESS` |
| `partnerAddresses` | string? | CSV 0x… | `PARTNER_ADDRESS` / `PARTNER_ADDRESSES` |
| `mailboxId` | string? | Erste Team-ID oder Boss | `MAILBOX_ID` |
| `teamMailboxIds` | string? | Komma-Liste | `TEAM_MAILBOX_IDS` |
| `commandRegistryId` | string? | Boss-.env | `COMMAND_REGISTRY_ID` |
| `vaultRegistryId` | string? | Boss-.env | `VAULT_REGISTRY_ID` |
| `nextPublicDirectIotaRpcUrl` | string? | optional | `NEXT_PUBLIC_DIRECT_IOTA_RPC_URL` |
| `helperRole` | messenger \| arbeiter \| kommandant | Preset | `ROLE` |
| `roleId` | number 0–63 | Preset/Feineinstellung | `ROLE_ID` |
| `deploymentProfile` | string | `einsatz` | `DEPLOYMENT_PROFILE` |
| `uiVariant` | full \| messenger | Preset | `UI_VARIANT` |
| `transportProfile` | mesh-first \| iota-anchored \| iota-full | Preset | `TRANSPORT_PROFILE` |
| `simpleMode` | boolean | Preset | `SIMPLE_MODE` |
| `capabilitiesOverride` | object? | Matrix-UI | `.morgendrot-runtime-config.json` |
| `includeIotaArchivReadme` | boolean | Checkbox | README-Block |
| `readmeExtra` | string? | IOTA-Archiv-Text | README |
| `format` | zip \| parts | Client setzt | — |

**Berechtigung API:** `ROLE=boss` oder `kommandant`.

---

## 4. ZIP-Inhalt (Dateien)

| Datei | Immer? | Beschreibung |
|-------|--------|--------------|
| `morgendrot-standalone-handoff.env` | Ja (oder ersetzt durch Enc) | Handoff-Konfiguration |
| `.morgendrot-runtime-config.json` | Ja | `messengerCapabilities` |
| `README-HANDOFF.txt` | Ja | Anleitung + Kurzparameter |
| `handoff.morg.enc` | Bei Passwort-Export | Verschlüsselte Env |

---

## 5. Handoff-`.env` — alle Keys (Export)

Quelle: `buildStandaloneSmartphoneHandoffEnv` in `src/config.ts`. Import-Allowlist: `src/handoff-env-import.ts`.

| Key | Im ZIP typisch | Bedeutung |
|-----|----------------|-----------|
| **RPC_URL** | Ja | IOTA-Fullnode für Helfer-Node/PWA |
| **PACKAGE_ID** | Ja | Move-Package des **Einsatzes** (gemeinsam mit Boss) |
| **MAILBOX_ID** | Oft | Primäres Shared/Team-Postfach (Object-ID 0x…) |
| **USE_MAILBOX** | Mit MAILBOX_ID | Persistente Mailbox auf Chain |
| **TEAM_MAILBOX_IDS** | Optional | Weitere Team-Postfächer (Komma) |
| **COMMAND_REGISTRY_ID** | Wenn gesetzt | On-Chain Command-Registry des Packages |
| **VAULT_REGISTRY_ID** | Wenn gesetzt | On-Chain Vault-Registry |
| **HANDOFF_LABEL** | Optional | Anzeigename des Pakets |
| **MY_ADDRESS** | **Leer** | Helfer trägt Wallet **auf dem Gerät** ein |
| **ROLE** | Ja | `messenger` \| `arbeiter` \| `kommandant` |
| **ROLE_ID** | Ja | Bitmaske Berechtigungen (0–63) |
| **BOSS_ADDRESS** | Ja | Wallet des Einsatzleiters (0x+64) |
| **PARTNER_ADDRESS** | 1 Partner | Ein Partner |
| **PARTNER_ADDRESSES** | >1 Partner | Komma-getrennt |
| **ENABLE_UI** | Ja | UI an |
| **UI_VARIANT** | Ja | `messenger` (schlank) oder `full` |
| **DEPLOYMENT_PROFILE** | Ja | `einsatz` |
| **TRANSPORT_PROFILE** | Ja | `mesh-first` / `iota-anchored` / `iota-full` |
| **SIMPLE_MODE** | Ja | Vereinfachte Oberfläche |
| **API_PORT** | Ja | 3342 |
| **API_KILL_PREVIOUS_INSTANCE** | Ja | true |
| **SIGNER** | Ja | `sdk` (Vault auf Gerät) |
| **NETWORK_TRUST_TIER** | Ja | 1 |
| **ENABLE_PURGE** | Ja | true |
| **ENABLE_REPLAY_PROTECTION** | Ja | true |
| **ENABLE_PLAINTEXT_CHANNEL** | Ja | false (Handoff-Default) |
| **NEXT_PUBLIC_DIRECT_IOTA_RPC_URL** | Optional | PWA Light-Client RPC |

**Niemals im Handoff:** Mnemonic, Vault-Passwort, Private Keys, `.morgendrot-vault` Dateien.

### Feste Defaults im Generator (nicht im UI)

Diese Werte schreibt der Server **immer** so — kein separates UI-Feld:

- `ENABLE_UI=true`, `API_PORT=3342`, `API_KILL_PREVIOUS_INSTANCE=true`
- `SIGNER=sdk`, `NETWORK_TRUST_TIER=1`
- `ENABLE_PURGE=true`, `ENABLE_REPLAY_PROTECTION=true`, `ENABLE_PLAINTEXT_CHANNEL=false`

---

## 6. IDs und Adressen — Glossar

| ID / Adresse | Format | Wer legt an? | Im Handoff |
|--------------|--------|-------------|------------|
| **PACKAGE_ID** | `0x` + 64 Hex | Boss (Move-Deploy einmal pro Einsatz) | Referenz in jeder Helfer-.env |
| **MAILBOX_ID** | `0x` + 64 Hex (Object-ID) | Boss/Betrieb (`create_globals`, Team-UI) | Primäres Postfach des Helfers |
| **TEAM_MAILBOX_IDS** | Komma-Liste 0x… | Boss unter Einstellungen → Meine Mailboxen | Zusätzliche Team-Postfächer |
| **BOSS_ADDRESS** | `0x` + 64 Hex | Boss-Wallet | Verbindung zur Leitung |
| **PARTNER_ADDRESS(ES)** | `0x` + 64 Hex | Telefonbuch / Auswahl | Chat-Partner |
| **MY_ADDRESS** | `0x` + 64 Hex | **Helfer** nach Vault-Unlock | Im Export **leer** |
| **COMMAND_REGISTRY_ID** | `0x` + 64 Hex | Deploy / Boss-.env | Chain-Registry Befehle |
| **VAULT_REGISTRY_ID** | `0x` + 64 Hex | Deploy / Boss-.env | Chain-Registry Tresor |
| **STREAMS_ANCHOR_ID** | `0x` + 64 Hex | Optional Puls | **Nicht** im Standard-Handoff |
| **BROADCAST_PINNWAND_ADDRESS** | `0x` + 64 Hex | Boss-.env Pinnwand | **Nicht** im Standard-Handoff |
| **Meshtastic Node-ID** | `!…` | Gerät / Telefonbuch | **Nicht** in .env — Kanal-PSK mündlich/README |

### Move vs. .env (Merksatz)

- **Move** = Vertrag + Struktur auf IOTA (**einmal** pro Einsatz).
- **.env** = „Welches Gerät darf was sehen/tun“ (**pro Helfer-ZIP**).
- **Mailbox-Objekte** existieren auf der Chain; Handoff trägt nur **IDs** + Rechte.

---

## 7. Profil-Presets (Basis-Karten)

| Karte | ROLE | ROLE_ID (Start) | TRANSPORT | SIMPLE | UI | Team-MB |
|-------|------|-----------------|-----------|--------|-----|---------|
| **Helfer** | messenger | 14 | mesh-first | true | messenger | ja |
| **Führer** | kommandant | 14 | iota-anchored | false | full | ja |
| **Spezial** | messenger | 4 (nur L) | mesh-first | true | messenger | ja |

**ROLE_ID-Bits:** D · LW · BW · L · S · P — siehe `docs/HANDOFF-PERMISSIONS-MATRIX.md`, `docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md`.

---

## 8. Einsatz-Vorlagen (`.morgendrot-einsatz-templates.json`)

| Feld Vorlage | In Handoff-ZIP? |
|--------------|-----------------|
| `id`, `label` | Nur Auswahl-UI |
| `chainRole` | → Preset-Karte |
| `roleId` | → `ROLE_ID` |
| `defaultDeploymentChannelTag` | **Nein** (nur Doku/Hinweis) |
| `iconHint` | **Nein** |
| Partner / Team-IDs | **Nein** — pro Export in Schritt 2 |

---

## 9. Import auf dem Helfer-Gerät

Allowlist beim Apply (`HANDOFF_IMPORT_ALLOWLIST`) — Keys **nicht** in der Liste werden ignoriert.

Zusätzlich: Runtime-JSON Apply über `handoff-runtime-import.ts` (Capabilities).

UI: **Einstellungen → Handoff importieren** oder Posteingang (IOTA-Zustellung).

---

## 10. FAQ

**Braucht jeder Helfer eine eigene `.env`?**  
Ja — gewollt. Unterschiedliche Rolle/Partner/Postfächer = unterschiedliche ZIP.

**Neues Move-Package pro Helfer?**  
Nein. Gleiche `PACKAGE_ID` für den Einsatz.

**Muss der Boss `COMMAND_REGISTRY_ID` / `VAULT_REGISTRY_ID` kennen?**  
Normalerweise schon in der Boss-.env — Export übernimmt sie, wenn in „Erweiterte Technik“ nicht leer.

**Wo Kontakte ins ZIP?**  
Nicht im Standard-Handoff. Kontakte: Telefonbuch → initialProfile oder Handoff-ZIP enthält nur Partner-**Adressen**, die der Boss anhakt.

---

*Pflege: Bei neuen API-Feldern oder UI-Feldern diese Datei und `buildStandaloneSmartphoneHandoffEnv` / `HANDOFF_IMPORT_ALLOWLIST` synchron halten.*
