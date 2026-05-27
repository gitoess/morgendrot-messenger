# Handoff Export — Hybrid (Basis + Feineinstellung + Vorlagen)

**Stand:** 2026-05-20  
**Status:** Basis-UI **Ist**; erweiterte Vorlagen-Felder **Backlog**  
**Verwandt:** **`docs/HANDOFF-PERMISSIONS-MATRIX.md`** (vollständiger Messenger-Abgleich), **`docs/HANDOFF-UND-MODUS-ZIELBILD.md`**, **`docs/API-EINSATZ-ROLE-TEMPLATES.md`**, **`docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md`**

---

## 1. Problem (vorher)

- Zu viele gleichwertige Preset-Namen (Wanderer, Feldtest, …) — **falsches Produkt** (Privat) oder **duplikat**.
- Zu wenig Unterschied — vor allem nur Labels, gleiche `ROLE_ID=14`.
- Kein Sweet Spot zwischen „6 Typen“ und „alles in Technik-Akkordeon“.

---

## 2. Hybrid-Ansatz (Zielbild — verbindlich)

```
┌─────────────────────────────────────────────────────────┐
│  A) Drei Basis-Karten (schnell)                          │
│     Helfer · Führer · Spezial                            │
├─────────────────────────────────────────────────────────┤
│  B) Feineinstellung (optional, nach Klick)               │
│     ROLE_ID, ROLE, Simple, Transport, Team-Mailboxen aus │
├─────────────────────────────────────────────────────────┤
│  C) Gespeicherte Vorlagen (Boss-PC)                      │
│     Reporter, Medic, … — laden, dann Partner/MB anpassen │
└─────────────────────────────────────────────────────────┘
         ↓
    Handoff-ZIP (~3 KB) = Parameter in .env
```

### 2.1 Basis-Karten (Parameter-Bündel)

| Karte | Typische `.env` | Zweck |
|-------|-----------------|--------|
| **Helfer** | `ROLE=messenger`, `SIMPLE_MODE=true`, `mesh-first`, `ROLE_ID=14` | Normaler Untergebener |
| **Führer** | `ROLE=kommandant`, `SIMPLE_MODE=false`, `full`, `iota-anchored` | Truppführer |
| **Spezial** | `ROLE=messenger`, `ROLE_ID=4` (nur **L** = empfangen), Simple | Reporter / Nur-Lesen **Startpunkt** |

**Wichtig:** Die Karten sind **keine** eigenen Produktmodi — nur **Shortcuts** für Parameter.

### 2.2 Feineinstellung (nach Auswahl)

Boss kann **ohne** alles neu zu erfinden anpassen:

| Parameter | Beispiel |
|-----------|----------|
| `ROLE_ID` (0–63) | Bits **D,LW,BW,L,S,P** — z. B. `4` = nur L, `12` = BW+L, `14` = BW+L+S — siehe **`HANDOFF-PERMISSIONS-MATRIX.md`** |
| `ROLE` | `messenger` / `arbeiter` / `kommandant` |
| `SIMPLE_MODE` | an/aus |
| `TRANSPORT_PROFILE` | mesh-first / iota-anchored |
| Team-Postfächer | Partner-Checkboxen bleiben; optional „ohne Team-Mailbox“ |

**Ist (Code):** Abschnitt „Feineinstellung“ im Export-Assistenten — **ROLE_ID-Checkboxen** `D,LW,BW,L,S,P` (`handoff-role-id-bit-picker.tsx`), plus `ROLE`, Simple, Team-Mailboxen (`boss-handoff-export-panel.tsx`).

### 2.3 Gespeicherte Vorlagen (Boss legt an)

**Bereits im Repo:** `GET/POST /api/einsatz-role-templates` → `.morgendrot-einsatz-templates.json`  
**UI heute:** Einstellungen → **Einsatz-Rollen-Vorlagen** (JSON speichern)  
**Export-Assistent (Ist):** Dropdown **Gespeicherte Vorlage** lädt `chainRole` + `roleId` in Basis + Feineinstellung

**Workflow Reporter (Ziel):**

1. Boss legt einmal Vorlage **Reporter** an (`roleId: 4`, `chainRole: user`).
2. Beim Export: Vorlage **Reporter** wählen → Basis **Spezial** + `ROLE_ID=4`.
3. **Dann:** Partner-Adressen / Team-Mailboxen für **diesen** Einsatz anhaken (wer darf lesen / mit wem).
4. ZIP exportieren oder per IOTA senden.

**Backlog (sinnvoll):** Vorlage um Handoff-Felder erweitern (`defaultPartnerFilter`, `omitTeamMailboxes`, `transportProfile`) — heute nur `chainRole` + `roleId` + Label.

---

## 3. Kritische Verbesserungen zum Vorschlag

| Punkt | Bewertung | Entscheidung |
|-------|-----------|--------------|
| Nur 3 Buttons | **Ja** | Helfer / Führer / Spezial — **Arbeiter** nicht eigene Karte, sondern Feineinstellung `ROLE=arbeiter` oder Vorlage |
| „Leitung“ als vierte Karte | **Nein** | Boss konfiguriert lokal, exportiert Untergebene |
| Vorlagen speichern | **Ja, API existiert** | Export angebunden; Pflege weiter in Einstellungen |
| Reporter = Adressen in Vorlage | **Teilweise** | Adressen = **Partner-Auswahl pro Export** (flexibel); Vorlage = Rechte (`ROLE_ID`) |
| Alles stufenlos von Null | **Nein** | Hybrid, nicht Experten-Formular als Default |

---

## 4. Code-Referenz

| Teil | Pfad |
|------|------|
| Basis-Presets | `frontend/frontend/lib/handoff-export-presets.ts` |
| Preset + Tuning → Export | `frontend/frontend/lib/handoff-export-params.ts` |
| UI | `frontend/frontend/components/boss-handoff-export-panel.tsx` |
| Vorlagen API | `frontend/frontend/lib/api/einsatz-role-templates.ts` |
| ZIP-Inhalt | `buildStandaloneSmartphoneHandoffEnv` in `src/config.ts` |

---

## 5. Roadmap

| Phase | Inhalt |
|-------|--------|
| **A (Ist)** | 3 Karten + ROLE_ID-Bit-Checkboxen + Feineinstellung ROLE/Simple + Vorlagen-Dropdown |
| **B (Ist)** | „Als Vorlage speichern“ im Export-Assistenten (`handoff-export-to-template.ts`) |
| **B2 (Ist)** | Capabilities-Matrix + Medic-Funker (`handoff-capabilities-matrix-picker.tsx`) |
| **C** | Vorlagen-Felder inkl. gespeicherte `capabilitiesOverride` |
| **D** | Solo-Wizard getrennt (Privat) — **`HANDOFF-UND-MODUS-ZIELBILD.md`** |
