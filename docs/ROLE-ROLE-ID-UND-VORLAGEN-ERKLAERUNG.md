# ROLE, ROLE_ID und Vorlagen — kurz erklärt

**Ziel:** Verwechslungen vermeiden zwischen **Tür/Schloss (Lock)**, **Messenger (Chat)**, **Arbeiter (Hierarchie)** und den Zahlen **0–63** / „64“.

---

## 1. Es ist **kein** „64-Bit-Arbeiter“ im CPU-Sinn

Im Code gibt es:

- **`ROLE_ID`:** eine Zahl **0–63** (also **64 mögliche Werte**).
- **`ROLE_BITS`:** **6 einzelne Schalter** (Bits), die in dieser Zahl **kombiniert** sind:

| Bit | Buchstabe | Bedeutung (Kurz) |
|-----|------------|------------------|
| 32 | **D** | Delegation (z. B. Rollenwechsel) |
| 16 | **LW** | eigenes Gas („Local Wallet“) |
| 8 | **BW** | Boss zahlt Gas („Boss Wallet“) |
| 4 | **L** | **L**isten / empfangen |
| 2 | **S** | **S**enden |
| 1 | **P** | **P**innwand / Shared Objects |

`hasRoleBit` prüft: Ist dieses Bit in `ROLE_ID` gesetzt?  
Beispiel: `ROLE_ID=14` = 8+4+2 = BW+L+S (Boss-Gas, hören, senden) — typisches „Standard-Arbeiter“-Profil in der UI-Liste.

**Fazit:** Es sind **6 Bits Rechte** in einer Zahl 0–63 — **nicht** 64 Bit wie bei einem Prozessorregister.

---

## 2. `ROLE` und `ROLE_ID` sind **zwei Ebenen**

| `ROLE` (grob) | Typische Aufgabe |
|-----------------|------------------|
| **`messenger`** | Chat, Tresor, Einsatz wie „Helfer mit App“ — **kein** Schloss |
| **`arbeiter`** | Gerät in der **Ameisen-Hierarchie** (Boss / Kommandant / …) |
| **`kommandant`** | Zwischenebene, viele Endpunkte |
| **`boss`** | Werkstatt, Export, Orchestrierung |
| **`lock`** | **Tür / Schloss / M2M** — „aktive oder passive Station“ im Sinne von **öffnen/hören auf Befehle**, **nicht** Chat-Helfer |
| **`monitor`** | Überwachung / Heartbeat |
| **`waerter`** | Wächter-Rolle (speziell) |

**Wichtig:** Wer eine **physische Tür** steuert, braucht **`ROLE=lock`** (plus `LOCK_ID` usw.) — das ist **etwas anderes** als „Arbeiter D1“ im Sinne von **Chat + Rechten**.

**`ROLE_ID` (0–63)** schaltet **innerhalb** der Hierarchie-Rollen (`arbeiter`, `boss`, …) und für **`messenger`** feinere Rechte frei (z. B. ob **Senden** erlaubt ist bei `/send`, `/boss-command` — siehe `messenger-command-handler.ts`).  
`ROLE=messenger` **ohne** passendes **S-Bit** kann bestimmte Befehle blockieren.

---

## 3. Woher kommen „Vorlagen“?

Es gibt **zwei** verwandte Mechanismen:

### A) **`profiles/id-00` … `id-63`** (Ordner `profiles/`)

- Pro Slot optional eine **`template.json`** (Beschreibung, `ROLE_ID`, `role`, UI-Hinweise).
- API: **`GET /api/profiles`**, **`GET /api/profiles/id-14`** — Bibliothek der **64 Profil-Slots**.
- Dient **Export / Provisioning** (ZIP), nicht der Chain.

### B) **Einsatz-Rollen-Templates** (Boss-PC)

- Datei z. B. **`.morgendrot-einsatz-templates.json`** (siehe **`docs/API-EINSATZ-ROLE-TEMPLATES.md`**).
- Felder: `label`, **`chainRole`** (`arbeiter`, `kommandant`, `lock`, …), **`roleId`** (0–63), optional Kanal-Tag.
- Die **Lite-UI** lädt das im **Provisioning-Wizard** — **keine Chain**, nur gespeicherte **Vorgaben**, welche Rolle + welche `roleId` ein „Helfer“-Gerät bekommen soll.

**Helfer** im Einsatz sind in der Software meist **`ROLE=messenger`** oder **`ROLE=arbeiter`**, je nach Template — **nicht** automatisch `lock`, es sei denn, ihr wählt explizit eine **Tür-/Schloss-Vorlage** (`chainRole: lock`).

---

## 4. Dein altes Modell vs. heute

| Früher (vereinfacht) | Im Code |
|---------------------|---------|
| „Arbeiter D1 = Tür oder Station“ | **Tür** = **`ROLE=lock`**. **Station/Helfer** = eher **`messenger`** oder **`arbeiter`** mit gewähltem **`ROLE_ID`**. |
| „Alle Parameter vorgegeben“ | **`ROLE`** + **`ROLE_ID`** + `.env` (Adressen, Package, …). Vorlagen **übernehmen** nur Standardwerte — das **laufende** Verhalten kommt aus **Konfiguration + Move-Regeln**. |

---

## 5. Praktisch: „Helfer“ einrichten

1. Im **Boss-Werkstatt**-Flow: Einsatz-Template wählen (Name sichtbar, **`chainRole`**, **`roleId`**).
2. Oder **`ROLE_ID`** manuell in `.env` setzen (0–63) und **`ROLE=messenger`** / **`arbeiter`** wählen.
3. **Tür-Gerät** separat: **`ROLE=lock`**, nicht mit dem Chat-Helfer vermischen.

---

## Verwandte Dokumente

- `docs/ARCHITECTURE-ROLES-AND-HUB.md` — Boss, Kommandant, Arbeiter  
- `docs/API-EINSATZ-ROLE-TEMPLATES.md` — Einsatz-Vorlagen-API  
- `src/config.ts` — `ROLE_BITS`, `ROLE_ID`, `hasRoleBit`  

---

*Stand: Abgleich mit `src/config.ts`, `src/messenger-nest/messenger-command-handler.ts`, `src/api-server.ts` (`/api/profiles`).*
