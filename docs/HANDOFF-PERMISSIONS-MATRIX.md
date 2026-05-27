# Messenger-Rechte — Abgleich Handoff, ROLE_ID, UI (kanonisch)

**Stand:** 2026-05-20  
**Zweck:** Alle relevanten Messenger-Funktionen **einem Steuerungsmechanismus** zuordnen — keine erfundenen Bit-Nummern.  
**Verwandt:** **`docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md`**, **`docs/ROLLEN-MODELL-CONSUMER-EINSATZ.md` § 5.2**, **`docs/HANDOFF-EXPORT-HYBRID.md`**

---

## 1. Kurzantwort: Nicht alles über neue ROLE_ID-Bits 0–5

Im Repo sind **`ROLE_ID` (0–63)** bereits **fest belegt** mit **6 Bits**:

| Bit | Wert | **Kanonische** Bedeutung (Code) |
|-----|------|----------------------------------|
| **D** | 32 | Delegation / Rollenwechsel (`/set-role`, …) |
| **LW** | 16 | Eigenes Gas (Local Wallet) |
| **BW** | 8 | Boss/Sponsor zahlt Gas |
| **L** | 4 | Empfangen / „hören“ (Profil, passive Nutzung) |
| **S** | 2 | **Senden** (`/send`, Mesh, `.morg-pkg-export`, Heartbeat) |
| **P** | 1 | Pinnwand / Shared Objects |

**Falsch wäre:** Bit 0 = Lesen, Bit 1 = Schreiben, Bit 2 = Gruppe — das **widerspricht** `src/config.ts` und allen Tests/Profilen (z. B. ID **14** = BW+L+S, ID **12** = BW+L „Passiver Beobachter“).

**Richtig:** Alltagsbegriffe (**Lesen, Schreiben, Gruppe, Export, IOTA**) auf **bestehende** Hebel mappen — oft **mehrere** gleichzeitig.

---

## 2. Drei Ebenen der Steuerung (alles wirkt zusammen)

```
┌─────────────────────────────────────────────────────────────┐
│ Ebene 1: ROLE (String) + permissions (Hierarchie)          │
│   boss | kommandant | arbeiter | messenger                  │
│   → teamManage, configChange, commandDown, …                 │
├─────────────────────────────────────────────────────────────┤
│ Ebene 2: ROLE_ID Bits (D,LW,BW,L,S,P) — Backend-Checks     │
│   hasRoleBit in send-commands, command-handler               │
├─────────────────────────────────────────────────────────────┤
│ Ebene 3: UI / Deploy-Achsen (Handoff setzt viele davon)      │
│   SIMPLE_MODE, TRANSPORT_PROFILE, UI_VARIANT,               │
│   DEPLOYMENT_PROFILE, Partner/Mailbox-IDs                   │
└─────────────────────────────────────────────────────────────┘
```

**Handoff-ZIP** schreibt vor allem **Ebene 1 + 3** und **`ROLE_ID`** — nicht jede UI-Funktion hat ein eigenes Bit.

---

## 3. Funktions-Matrix (Messenger ↔ Steuerung)

Legende: **H** = Hierarchie `ROLE`/`permissions` · **ID** = `ROLE_ID`-Bit · **UI** = `SIMPLE_MODE`/`TRANSPORT_PROFILE`/… · **Boss** = nur Boss · **—** = nicht per Handoff sinnvoll

### 3.1 Chat & Senden

| Funktion | Primär gesteuert durch | Handoff heute | Boss-exklusiv |
|----------|------------------------|---------------|---------------|
| Nachricht **senden** (1:1, verschl.) | **ID:S**, Handshake | `ROLE` + `ROLE_ID` (Preset) | — |
| Nachricht **empfangen** / Posteingang | Wallet + Mailbox-IDs | Partner + `MAILBOX_ID` | — |
| **Nur Lesen** (Reporter) | **ID:** L an, **S** aus → z. B. `ROLE_ID=12` (BW+L) | Spezial + `ROLE_ID=4` oder 12 | — |
| Transport **LoRa/Mesh** | Meshtastic-Config, Composer | `TRANSPORT_PROFILE=mesh-first` | — |
| Transport **IOTA** sichtbar | **UI:** `TRANSPORT_PROFILE` iota-* | Führer-Preset | — |
| **IOTA senden** (Chain-TX) | Netz + Tresor + ggf. Direct-IOTA | indirekt (nicht Simple, iota-anchored) | — |
| Offline-**Queue** | UI Simple + User-Opt-in | Simple Mode | — |
| **Gruppenchat** (Kanal) | UI (meist offen) | nicht explizit | — |
| **Mailbox an alle** (Gruppe, N× pairwise) | UI + Partner-Liste | Partner-CSV im Handoff | — |
| Voice / SOS / Anhänge | **ID:S** + Medien-Pipeline | wie Senden | — |
| `.morg-pkg` **erstellen/export** | **ID:S** (`send-commands`) | S-Bit in `ROLE_ID` | — |

### 3.2 Mailboxen & Team

| Funktion | Primär gesteuert durch | Handoff heute | Boss-exklusiv |
|----------|------------------------|---------------|---------------|
| Private Mailbox **erstellen** | UI + Tresor | nicht verboten | — |
| Team-Mailbox **beitreten** | Object-ID kennen | `TEAM_MAILBOX_IDS` / `MAILBOX_ID` | — |
| Team-Mailbox **erstellen** | **H:** `permissions.teamManage` (`kommandant`/`boss`) | `ROLE=kommandant` (Führer) | — |
| Team **einladen** (QR/ID) | Kein ACL on-chain — ID teilen | indirekt (Mailbox-IDs) | — |
| Mailbox **aktiv setzen** | UI | — | — |
| On-chain **löschen** (Rebate) | UI + Rolle | — | oft Boss |

### 3.3 Kontakte, Profile, Provisioning

| Funktion | Primär gesteuert durch | Handoff heute | Boss-exklusiv |
|----------|------------------------|---------------|---------------|
| **Telefonbuch** / Kontakte | UI | **Partner-Adressen** im Handoff | — |
| **initialProfile** importieren | API / Einsatzleitung | **Separater Flow** (nicht im ZIP) | Boss provisioniert |
| **Einsatz-Rollen-Vorlagen** lesen | **H:** boss/kommandant + `deploymentProfile=einsatz` | — | — |
| Vorlagen **speichern** | **H:** `configChange` (Boss) | — | **Ja** |
| **Handoff-ZIP** exportieren | **H:** Boss/Kommandant-UI | — | **Ja** (Assistent) |
| **Geräte provisionieren** | API Boss | — | **Ja** |
| Package/Runtime **.env** ändern | **H:** `configChange` | — | **Ja** |

### 3.4 Export, Forensik, Chain

| Funktion | Primär gesteuert durch | Handoff heute | Boss-exklusiv |
|----------|------------------------|---------------|---------------|
| Posteingang **Export** (JSON/TXT/ZIP) | UI (wenig ROLE_ID-Gate) | nicht gesperrt | — |
| **Einsatzbericht** / Protokoll | UI + Senden | — | — |
| **Tangle-Inventar** / verankern | **UI:** Expert + IOTA | `SIMPLE_MODE=false`, iota | — |
| **Nachrichtenverlauf** on-chain löschen | UI + Rolle | — | oft Boss |
| ECDH **.morg-pkg** aus Nachricht | **ID:S** | — | — |
| **Forensik** global | **H:** Boss | — | **Ja** |

### 3.5 Pinnwand, Einsatzleitung, Dashboard

| Funktion | Primär gesteuert durch | Handoff heute | Boss-exklusiv |
|----------|------------------------|---------------|---------------|
| **Pinnwand lesen** | UI | meist an | — |
| **Pinnwand schreiben** | **ID:P** + Server-Whitelist (`BROADCAST_AUTHORIZED_SENDERS`) | `ROLE_ID` Bit P | Boss pflegt Whitelist |
| **Einsatzleitung**-Tab | **H:** `ROLE` boss/kommandant | `ROLE=kommandant` (Führer) | — |
| **Geräte-Radar** | **H:** boss (+ full UI) | Führer: `UI_VARIANT=full` | — |
| Dashboard **Boss-Modus** | **H:** boss | — | **Ja** |
| **Steuerung** / Admin-Kacheln | **H:** boss | — | **Ja** |
| Action Center **Arbeiter** | **H:** `ROLE=arbeiter` | optional `ROLE=arbeiter` | — |

### 3.6 Was Handoff **nicht** steuern soll (bewusst Boss-exklusiv)

| Funktion | Warum nicht im Untergebenen-Handoff |
|----------|-------------------------------------|
| Handoff / Export-Assistent nutzen | Untergebener empfängt nur ZIP |
| Einsatz-Vorlagen **speichern** | Boss-PC-Datei |
| `configChange` / globale `.env` | Leitstelle |
| Move-Deploy / Rebate / Package publish | Infrastruktur |
| Pinnwand-**Whitelist** serverweit | Boss-Policy |

---

## 4. Empfohlene Strategie (Hybrid + ehrlich)

### 4.1 Basis-Karten → Standard-**Kombinationen** (Handoff)

| Karte | `ROLE` | `ROLE_ID` (Beispiel) | `SIMPLE_MODE` | `TRANSPORT` | Typische Wirkung |
|-------|--------|----------------------|---------------|-------------|------------------|
| **Helfer** | `messenger` | **14** (BW+L+S) | true | mesh-first | Senden + empfangen, einfache UI |
| **Führer** | `kommandant` | **46** (D+BW+L+S) oder 14 | false | iota-anchored | + Team erstellen, Einsatzleitung |
| **Spezial** | `messenger` | **12** (BW+L) oder **4** (nur L) | true | mesh-first | Reporter: **S aus** manuell |

**Arbeiter** = Feineinstellung `ROLE=arbeiter` (Hierarchie), nicht eigene Marketing-Karte.

### 4.2 Feineinstellung im Export — **was sinnvoll ist**

| Parameter | Nutzen | Umsetzung |
|-----------|--------|-----------|
| **ROLE_ID** (0–63) | Reporter, Gas-Modell, Senden aus | **Ist** — Bit-Summe oder Checkboxen **D,LW,BW,L,S,P** (nicht neu erfinden) |
| **ROLE** | Hierarchie Arbeiter vs. Messenger | **Ist** |
| **SIMPLE_MODE** | Expert-UI aus | **Ist** |
| **TRANSPORT_PROFILE** | Funk vs. IOTA-UI | **Ist** |
| Partner / Team-Mailboxen | **Mit wem** / welches Team | **Ist** (pro Einsatz) |
| `omitTeamMailboxes` | Solo im Team-Kontext | **Ist** |

| Parameter | Backlog | Grund |
|-----------|---------|--------|
| „Gruppe erstellen“ | UI-Gate fehlt | Gruppen sind lokal/UI — kein Bit |
| „Einladen“ | = Mailbox-ID teilen | Kein separates Recht |
| „Export verbieten“ | kein ROLE_ID-Check | braucht UI-Gate oder Server-Flag |
| „morg-pkg verbieten“ | nur **S-Bit** | bereits `ROLE_ID` |

### 4.3 Gespeicherte Vorlagen (Boss-PC)

**Heute:** `chainRole` + `roleId` + `label` (`/api/einsatz-role-templates`).

**Ziel (Phase B):** Vorlage = **Snapshot** der Handoff-Parameter:

```json
{
  "id": "reporter",
  "label": "Reporter Nur-Lesen",
  "basePreset": "spezial",
  "roleId": 12,
  "helperRole": "messenger",
  "simpleMode": true,
  "transportProfile": "mesh-first",
  "omitTeamMailboxes": false
}
```

**Nicht** in Vorlage: Partner-Liste (immer pro Einsatz im Assistenten).

### 4.4 UI im Assistenten: Bit-Checkboxen (**Ist**)

Export-Assistent → **Feineinstellung** → `HandoffRoleIdBitPicker` (`handoff-role-id-bit-picker.tsx`):

- Checkboxen **D, LW, BW, L, S, P** (kanonisch, `handoff-role-id-bits.ts`)
- Live **ROLE_ID** + Kurzform (`BW+L+S`, …)
- Schnellwahl: 4, 12, 14, 15, 46 (Lite-UI-Profile)
- Hinweis wenn **S** aus (Senden deaktiviert)
- „Zurück auf Basis“ setzt Override zurück (Preset der Karte)

Keine Rohzahl-Eingabe — vermeidet Tippfehler und falsche Bit-Semantik.

---

## 5. Mapping: Alltagsbegriff → technisch

| Du meinst | Technisch im Morgendrot-Repo |
|---------|------------------------------|
| **Leserechte** | `ROLE_ID` mit **L**, ohne **S** (z. B. 8+4=12 oder nur 4) |
| **Schreibrechte** | **S-Bit** (+ meist L, BW) |
| **Gruppe erstellen** | Gruppen-Panel (UI); **kein** ROLE_ID-Bit — optional Backlog |
| **Leute einladen** | Team-Mailbox-ID / Partner 0x im Handoff; QR manuell |
| **Nachrichten exportieren** | UI Posteingang — **nicht** per ROLE_ID gesperrt heute |
| **IOTA senden** | Tresor + Netz + `TRANSPORT_PROFILE` + nicht `SIMPLE_MODE` |
| **Verlauf exportieren** | wie Export |
| **morg-pkg erstellen** | **S-Bit** + Handshake |
| **Team-Mailbox anlegen** | `ROLE=kommandant` oder `boss` + **teamManage** |
| **Handoff erstellen** | **Boss-exklusiv** — nicht in Untergebenen-ZIP |

---

## 6. Fazit

| Frage | Antwort |
|-------|---------|
| Alles im Messenger über Handoff? | **Nein** — nur was in `.env`/Status-Achsen abbildbar ist |
| Neue Bit 0–5? | **Nein** — **D/LW/BW/L/S/P** beibehalten |
| Hybrid-Strategie? | **Ja** — 3 Karten + **echte** Bit-Tuning + Vorlagen + Partner/MB pro Einsatz |
| Was fehlt im Code? | UI-Gates für Export/Gruppe; Vorlagen mit vollem Handoff-Snapshot |

**Bit-Checkboxen (Ist):** Export-Assistent → Feineinstellung → `HandoffRoleIdBitPicker` — kanonische Bits wie Lite-UI, keine Rohzahl.

---

## 7. Evolution: Capabilities-Matrix (Phase 1)

Das **S-Bit-Problem** (ein Schalter für LoRa + Telegram + IOTA) lösen wir mit **`messengerCapabilities`** in `.morgendrot-runtime-config.json` — **ohne** ROLE_ID-Semantik zu ändern.

Siehe **`docs/CAPABILITIES-MATRIX-ZIELBILD.md`** · Code: `src/shared/messenger-capabilities-matrix.ts` · Status-API: `capabilities` in `GET /api/status`.
