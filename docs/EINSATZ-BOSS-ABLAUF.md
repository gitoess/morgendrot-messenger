# Einsatz — Boss-Ablauf (Move vs. Handoff)

**Stand:** 2026-06-02  
**Zielgruppe:** Einsatzleitung (Boss) im Messenger  
**Verwandt:** `docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md`, `docs/MOVE-MESSENGER-KONFIGURATION.md`, `docs/EXPORT-ASSISTENT-REFERENZ.md`

---

## Leitplanke: Zwei getrennte Wege

| Weg | Was ändert sich | Wann | Neues Handoff-ZIP? |
|-----|-----------------|------|-------------------|
| **1 — Move-Upgrade** | Move-**Code** on-chain (gleiche `PACKAGE_ID`) | Dev hat `messaging.move` geändert | **Nein** |
| **2 — Einsatz-Parameter** | TTL, Purge, Transport, Team-Postfächer, … | Boss passt Einsatz an | **Ja** (an Helfer verteilen) |

**Dynamic Fields / `store_*`** sind weder Upgrade noch Handoff — das sind **Nachrichten** in der Mailbox.

**Edition (Standard / Secure)** ist **kein** Schalter wie TTL: Secure = **anderes deploytes Package** (`PACKAGE_ID`). Siehe § Edition unten.

---

## Phase 1 — Move-Code (selten)

### Upgrade (empfohlen bei Bugfixes)

- **Messenger:** Einsatzleitung → **Einsatz-Konfiguration** → **Move-Package upgraden**
- **Terminal:** `npm run upgrade:move-package`
- **Ergebnis:** Gleiche `PACKAGE_ID`, gleiche Team-Mailbox-IDs
- **Danach:** Backend neu starten; Move-Funktionen in Einsatz-Konfiguration prüfen
- **Handoff:** nicht nötig

**Voraussetzung:** `UPGRADE_CAP_ID` in `.env` (wird beim Erst-Publish gesetzt) + IOTA-CLI + Ordner `move-test` auf dem Boss-/Dev-PC.

### Neu-Publish (selten)

- **Terminal:** `npm run deploy:move-package` — **nicht** der Upgrade-Button
- **Ergebnis:** **Neue** `PACKAGE_ID` → `create_globals`, neue Team-Mailboxen, **neues Handoff**

Details: `docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md`.

---

## Phase 2 — Einsatz-Parameter (häufig)

**Messenger:** Einsatzleitung → **Einsatz-Konfiguration**

| Parameter | In Einsatz-Konfiguration | Landet im Handoff-ZIP | Boss-Server `.env` |
|-----------|--------------------------|------------------------|---------------------|
| **TTL** (`DEFAULT_TTL_DAYS`) | ✏️ einstellbar | Ja | Optional „Auch Boss-Server übernehmen“ |
| **ENABLE_PURGE** | ✏️ einstellbar | Ja | Optional mit übernehmen |
| Transport, Team-MB, Partner | Export-Assistent (Feineinstellung) | Ja | Teilweise |
| Pinnwand-Adresse | Boss-.env / Handoff wenn Pinnwand an | Ja (Adresse) | Ja |
| Pinnwand Authorized Senders | **Backlog** — heute nur Boss-.env | Nein | Ja |
| Move-Regeln (wer darf purgen) | Nur **Anzeige** + Handbuch | Nein | — |

### Boss-Routine

1. Einsatz-Konfiguration öffnen  
2. TTL / Purge anpassen  
3. Optional: **Auf Boss-Server übernehmen** (schreibt `.env` des laufenden Backends)  
4. **Neues Handoff-ZIP** (Profil Helfer, Standard-Partner/Team aus Telefonbuch)  
5. ZIP verteilen (USB, AirDrop, IOTA — Export-Assistent für Feintuning)

**Feintuning** (ROLE_ID, Capabilities, Passwort-ZIP): weiter **Export-Assistent** darunter.

---

## Wann neues Handoff?

| Änderung | Neues Handoff? |
|----------|----------------|
| Nur Move-Upgrade (gleiche Package-ID) | **Nein** |
| TTL, Purge, Transport, Team-MB, Partner | **Ja** |
| Neues Package (Publish) | **Ja** + neue Mailbox-IDs |
| Neuer einzelner Helfer | **Ja** (ein ZIP) |

---

## Edition Standard / Secure

| Edition | Was der Boss wählt | Handoff |
|---------|-------------------|---------|
| **Standard** | Aktuelle `PACKAGE_ID` (Purge + Rebate) | Parameter wie TTL frei |
| **Secure / No-Purge** | **Andere** `PACKAGE_ID` (eigenes Deploy) | Feste Package-ID im ZIP |

Kein Laufzeit-Umschalter „Secure an“ — das wäre ein anderes Move-Package.

---

## UI-Übersicht (Messenger)

```
Einsatzleitung
├── Einsatz-Konfiguration     ← Status + TTL/Purge + Upgrade + Schnell-Handoff
├── Gerät provisionieren      ← Seed + erstes ZIP
├── Export-Assistent          ← Feintuning, Vorlagen, Experte
└── WLAN-QR
```

---

## API (Boss-PC)

| Endpoint | Wirkung |
|----------|---------|
| `POST /api/upgrade-package` | In-Place-Upgrade (`upgrade:move-package`) |
| `POST /api/einsatz-config-apply` | `DEFAULT_TTL_DAYS`, `ENABLE_PURGE` → Boss-`.env` |
| `POST /api/standalone-smartphone-handoff-zip` | Handoff-ZIP (Export-Assistent / Schnell-Handoff) |

`POST /api/deploy-package` = **Neu-Publish** (neue Package-ID) — nicht für Routine-Upgrades.

---

## Merksatz

> **Upgrade = Gesetz auf der Chain (selten, gleiche IDs, kein ZIP).**  
> **Einsatz-Konfiguration = Dekret für Geräte (oft, neues Handoff).**
