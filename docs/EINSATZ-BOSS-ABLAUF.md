# Einsatz — Boss-Ablauf (Move vs. Handoff)

**Stand:** 2026-06-02  
**Zielgruppe:** Einsatzleitung (Boss) im Messenger  
**Verwandt:** `docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md`, `docs/MOVE-MESSENGER-KONFIGURATION.md`, `docs/EXPORT-ASSISTENT-REFERENZ.md`, `docs/HANDOFF-PERMISSIONS-MATRIX.md`, `docs/EINSATZ-HELFER-EINRICHTEN-ZIELBILD.md`

---

## Leitplanke: Zwei getrennte Wege

| Weg | Was ändert sich | Wann | Neues Handoff-ZIP? |
|-----|-----------------|------|-------------------|
| **1 — Move-Upgrade** | Move-**Code** on-chain (gleiche `PACKAGE_ID`) | Dev hat `messaging.move` geändert | **Nein** |
| **2 — Einsatz-Parameter** | TTL, Purge, Transport, Team-Postfächer, … | Boss passt Einsatz an | **Ja** (an Helfer verteilen) |

**Dynamic Fields / `store_*`** sind weder Upgrade noch Handoff — das sind **Nachrichten** in der Mailbox.

**Edition (Standard / Secure)** ist **kein** Schalter wie TTL: Secure = **anderes deploytes Package** (`PACKAGE_ID`).

---

## Phase 1 — Move-Code (selten)

### Upgrade (empfohlen bei Bugfixes)

- **Messenger:** Einsatzleitung → **Erweitert** → **Chain** → **Move upgraden**
- **Terminal:** `npm run upgrade:move-package`
- **Ergebnis:** Gleiche `PACKAGE_ID`, gleiche Team-Mailbox-IDs
- **Danach:** Backend neu starten; Move-Funktionen unter Erweitert prüfen
- **Handoff:** nicht nötig

**Voraussetzung:** `UPGRADE_CAP_ID` in `.env` + IOTA-CLI + Ordner `move-test`.

### Neu-Publish (selten)

- **Terminal:** `npm run deploy:move-package` — **nicht** der Upgrade-Button
- **Ergebnis:** **Neue** `PACKAGE_ID` → `create_globals`, neue Team-Mailboxen, **neues Handoff**

Details: `docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md`.

---

## Phase 2 — Einsatz-Parameter (häufig)

**Messenger:** Einsatzleitung → **Helfer einrichten** → Block **Bestehende Geräte**

| Parameter | In UI | Landet im Handoff-ZIP | Boss-Server `.env` |
|-----------|-------|------------------------|---------------------|
| **TTL** (`DEFAULT_TTL_DAYS`) | ✏️ | Ja (aus Boss-Server) | Optional **Boss-.env** |
| **ENABLE_PURGE** | ✏️ | Ja | Optional mit übernehmen |
| Profil, ROLE_ID, Capabilities | **Helfer einrichten** (oben) | Ja | — |
| Transport, Team-MB, Partner | **Helfer einrichten** | Ja | Teilweise |
| Move-Regeln (wer darf purgen) | **Erweitert → Chain** + Handbuch | Nein | — |

**Purge ≠ Rechte-Modell:** `ENABLE_PURGE` schaltet Purge-Befehle. Lesen/Schreiben → **Capabilities-Matrix** + `ROLE_ID` → `docs/HANDOFF-PERMISSIONS-MATRIX.md`.

### Boss-Routine (bestehende Helfer)

1. **Helfer einrichten** → unten **Bestehende Geräte**
2. TTL / Purge anpassen
3. Optional: **Boss-.env** übernehmen
4. **Handoff** — ZIP verteilen (USB, AirDrop, IOTA)

### Boss-Routine (neues Handy)

1. **Helfer einrichten** → Profil + **Rechte** (Matrix / Schnellprofile Medic, Reporter)
2. Team & Partner wählen → **ZIP** und/oder **IOTA**
3. Block **Neues Gerät** → **Seed + QR** (Wizard)
4. Optional: **WLAN-QR** (nur App installieren — kein Handoff)

---

## Wann neues Handoff?

| Änderung | Neues Handoff? |
|----------|----------------|
| Nur Move-Upgrade (gleiche Package-ID) | **Nein** |
| TTL, Purge, Transport, Team-MB, Partner, Capabilities | **Ja** |
| Neues Package (Publish) | **Ja** + neue Mailbox-IDs |
| Neuer einzelner Helfer | **Ja** (Wizard: ein ZIP + Seed) |

---

## Edition Standard / Secure

| Edition | Was der Boss wählt | Handoff |
|---------|-------------------|---------|
| **Standard** | Aktuelle `PACKAGE_ID` (Purge + Rebate) | Parameter wie TTL frei |
| **Secure / No-Purge** | **Andere** `PACKAGE_ID` (eigenes Deploy) | Feste Package-ID im ZIP |

---

## UI-Übersicht (Messenger)

```
Einsatzleitung
├── (Titel)
├── Helfer einrichten
│   ├── Profil · Rechte · Team · Partner
│   ├── [ZIP] [IOTA] [WLAN-QR]
│   ├── Neues Gerät (Seed + QR)
│   └── Bestehende Geräte (TTL · Purge · Handoff)
└── ▼ Erweitert — Chain / Move-Upgrade
```

Zielbild: `docs/EINSATZ-HELFER-EINRICHTEN-ZIELBILD.md`

---

## Rechte — wo was liegt

| Alltagsbegriff | Wo der Boss es stellt |
|----------------|------------------------|
| Senden / Empfangen (Chain) | Profil + **ROLE_ID** |
| Funk schreiben, Telegram nur lesen | Schnellprofil **Medic-Funker** oder Matrix |
| Nur lesen (Reporter) | Schnellprofil **Reporter** oder Matrix |
| Team anlegen | Profil **Führer** (`ROLE=kommandant`) |
| Purge erlauben | **Bestehende Geräte** (`ENABLE_PURGE`) |

---

## API (Boss-PC)

| Endpoint | Wirkung |
|----------|---------|
| `GET /api/lan-install-urls` | LAN-IPv4 für WLAN-QR |
| `POST /api/upgrade-package` | In-Place-Upgrade |
| `POST /api/einsatz-config-apply` | `DEFAULT_TTL_DAYS`, `ENABLE_PURGE` → Boss-`.env` |
| `POST /api/standalone-smartphone-handoff-zip` | Handoff-ZIP |

---

## Merksatz

> **Upgrade = Gesetz auf der Chain (selten, gleiche IDs, kein ZIP).**  
> **Parameter + Handoff = Dekret für Geräte (oft, neues ZIP).**  
> **Neues Handy = Seed + QR + Handoff in „Helfer einrichten“.**  
> **WLAN-QR = nur App — Handoff separat.**
