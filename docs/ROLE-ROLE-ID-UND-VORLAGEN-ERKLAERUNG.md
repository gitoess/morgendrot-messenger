# ROLE, ROLE_ID und Vorlagen — kurz erklärt

**Ziel:** Verwechslungen vermeiden zwischen **Tür/Schloss (Lock)**, **Messenger (Chat)**, **Arbeiter (Hierarchie)** und den Zahlen **0–63** / „64“.

---

## 0. Mythen — kurz **nein**

| Behauptung | Fakt |
|------------|------|
| „Das **6-Bit-`ROLE_ID`-System** wurde durch **drei Hierarchie-Rollen** ersetzt.“ | **Nein.** `ROLE` (boss/kommandant/arbeiter/…) und **`ROLE_ID` (0–63)** arbeiten **zusammen**; `ROLE_ID` ist weiterhin in `src/config.ts` und wird per `hasRoleBit` genutzt. |
| „Es gibt nur noch **Arbeiter, Kommandant, Boss**.“ | **Unvollständig.** Es gibt u. a. **`ROLE=messenger`**, **`lock`**, **`monitor`**, **`waerter`** — je nach Gerät. |
| „**getHierarchyPermissions** hat die 6 Bits abgelöst.“ | **Nein.** Das ist eine **andere** Schicht: feste Regeln nach **`ROLE`**-String + **`ENABLE_*`**-Flags (Befehle nach unten, Keys ausstellen, …) — **nicht** dieselben Bits wie D/LW/BW/L/S/P. Beide Konzepte existieren **parallel**. |
| „**8-Bit `DeviceRights`** (isBoss, canRelay, …) ist der neue Stand.“ | **Nein** — das war **kein** Repo-Code, höchstens ein **Diskussionsvorschlag**. Im Projekt gibt es **kein** solches `DeviceRights`-Objekt als Ersatz für `ROLE_ID`. |
| „**D** = Data/Disk, **BW** = Broadcast, **P** = Mesh-Priorität.“ | **Nein** — kanonisch: **D** = Delegation, **BW** = Boss zahlt Gas, **P** = Pinnwand (§ 6). |

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

### 1a Drei Schichten — so hängt es zusammen

| Schicht | Wo | Was |
|---------|-----|-----|
| **A) `ROLE`** (String) | `.env` `ROLE=` | **Grob:** Welche **Geräteklasse**? z. B. `boss`, `kommandant`, `arbeiter`, `messenger`, `lock`, … |
| **B) `ROLE_ID`** (0–63) | `.env` `ROLE_ID=` | **Fein:** Sechs Bits **D/LW/BW/L/S/P** — Senden, Delegation, Gas-Modell, Pinnwand (siehe § 6). `hasRoleBit` im Command-Handler. |
| **C) Hierarchie-Berechtigungen** | `getHierarchyPermissions(role)` in `config.ts` | **Separat:** Was darf diese **Rolle** bzgl. **Befehle nach unten**, **Key ausstellen**, **Status lesen** — abhängig von `ROLE` **und** `ENABLE_COMMAND_DOWN`, `ENABLE_KEY_ISSUE`, … **nicht** identisch mit den sechs Bits. |

**Messenger** (`ROLE=messenger`) bekommt in `getHierarchyPermissions` **alle** Hierarchie-Flags als `true` (Zeile 1020–1021) — die **feine** Steuerung läuft dort über **`ROLE_ID`** (z. B. S-Bit für Send).

**Zur Kritik an R/A/V/E-Bits** (Relay, Admin, Verification, Emergency): Das sind **keine** Morgendrot-Standard-Bits im Repo; wer mehr Flags will, soll **nicht** wahllos Bits erfinden, sondern erst **Anforderung + Bedrohungsmodell** — sonst entsteht „Bit-Salat“. Das bestehende Modell bewusst **klein** halten (§ 9) ist plausibler als ein **zweites** 8-Bit-Parallelsystem, solange nichts davon implementiert ist.

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

## 6. Kanonische Bit-Bedeutungen — **nicht** raten

Die Buchstaben **D, LW, BW, L, S, P** sind im Projekt **fest** mit **Gas-Modell, Hören/Senden, Pinnwand, Delegation** verknüpft (siehe `ROLE_BITS` in `src/config.ts`, Profilliste in `ui/index.html`).

### 6.1 Häufige **falsche** Deutungen (vermeiden)

| Falsch (Erfindung) | Richtig (Ist-Code / UI) |
|--------------------|-------------------------|
| **D** = Data/Disk, lokale Dateien | **D** = **Delegation** — z. B. `/set-role` / Rollenwechsel nur mit D-Bit (`messenger-command-handler.ts`). |
| **LW** = Low-Power / Long-Range-Funk | **LW** = **Local Wallet** — Gerät nutzt **eigenes Gas** (nicht Boss-Sponsor). |
| **BW** = Broadcast an alle / Pinnwand „global“ | **BW** = **Boss Wallet** — **Boss/Sponsor zahlt Gas** (Gegenpol zu LW). |
| **P** = Priorität im Mesh / medizinische Dringlichkeit | **P** = **Pinnwand** / **Shared Objects** (UI: „Arbeiter + Pinnwand“). **Keine** implementierte „QoS-Priorität“ für Nachrichten über ROLE_ID. |

**L** und **S** (Listen / Senden) sind in der Praxis nah an eurer Erzählung — aber **nur** für die **bereits implementierten** Checks (z. B. Send bei Hierarchie-Befehlen, Heartbeat mit S-Bit).

### 6.2 Kurzreferenz (kanonisch)

| Bit | Wert | Bedeutung |
|-----|------|------------|
| **D** | 32 | Delegation: Rollenänderung erlaubt (wenn Befehl greift) |
| **LW** | 16 | Eigenes Gas |
| **BW** | 8 | Boss/Sponsor-Gas |
| **L** | 4 | Empfangen / „hören“ (Listener-Nutzung im Profil) |
| **S** | 2 | Senden (z. B. `/send`, `/boss-command` bei Hierarchie) |
| **P** | 1 | Pinnwand / Shared Objects (Profil) |

**LW** und **BW** schließen sich **sachlich** oft aus (entweder selbst zahlen oder Boss zahlt); das **Hybrid**-Profil im UI kombiniert trotzdem Bits für Sonderfälle — Details siehe Profilbeschreibungen in der Lite-UI.

---

## 7. Beispiel-`ROLE_ID`s (Lite-UI `roleProfiles`) — zum Abgleich

Die **Zahlen** unten sind **exakt** die Summe der Bits (nicht frei erfunden):

| ID | Name (UI) | Bits | Summe |
|----|-----------|------|--------|
| 12 | Passiver Beobachter | BW, L | 8+4 = **12** |
| 14 | Standard-Arbeiter | BW, L, S | 8+4+2 = **14** |
| 15 | Arbeiter + Pinnwand | BW, L, S, P | 8+4+2+1 = **15** |
| 46 | Kommandant | D, BW, L, S | 32+8+4+2 = **46** |
| 63 | Boss (voll) | D, LW, BW, L, S, P | 32+16+8+4+2+1 = **63** |

**Fehler im Rechenbeispiel „ID 42 = Sanitäter mit P“:**  
`42 = 32 + 8 + 2` = **D + BW + S** — **ohne** **P** und **ohne** **L**. Wollt ihr „Sanitäter = L+S+P“, wäre z. B. `4+2+1 = 7` oder mit BW: `8+4+2+1 = 15` (wie „Arbeiter + Pinnwand“). **Eigene Einsatz-Namen** („Sanitäter“) sind **Organisations-Labels** in Vorlagen — die **technische** Maske muss **zur Summe passen**.

---

## 8. Narrative „Höhlenrettung“ vs. implementierte Logik

| Idee | Im Repo? |
|------|-----------|
| Gruppen 10–15 / 40–45 für Rettungsszenarien | Nur als **Konvention**, wenn ihr sie in **Einsatz-Templates** / **Profil-JSON** so festlegt — **kein** separater „Rettungsmodus“ im Move-Code. |
| **P** = medizinische Priorität in der Queue | **Nein** — **P** ist **Pinnwand** (siehe oben). Echte **Priorität** (Streams, Mesh, Mailbox) wäre **neues** Feature (Routing, TTL, Topic). |
| **ROLE_ID im Trägerbild** gespeichert → Finder sieht „Sanitäter 42“ | Nur wenn ihr **Metadaten** (z. B. in Vault-JSON oder Sidecar) **explizit** so speichert; **Trägerbild allein** enthält keinen automatischen Klartext „42“. |
| Relais nur **L** ohne **S** | Prinzipiell denkbar (nur hören); **muss** zur gewählten `ROLE_ID`-Summe und zu **`ROLE`** (messenger/arbeiter/…) passen und **getestet** werden. |

---

## 9. Was noch sinnvoll wäre (optional, Roadmap)

1. **Dokumentation** einer **offiziellen** Tabelle „Einsatzname → empfohlene ROLE_ID“ (nur Organisation, keine Code-Pflicht).
2. **Wenn** medizinische Priorität gewünscht: **eigenes** Konzept (Streams-Priority, separates Flag, **nicht** P umdefinieren).
3. **Tests:** für jede frei gewählte Maske prüfen, ob **Heartbeat**, **Send**, **Boss-Befehl** wie erwartet reagieren (`ROLE_ID` in Logs beachten).

---

## 10. Komplexität dreier Schichten — ehrliche Einordnung

### 10.1 Was stimmt an der Kritik?

- **Drei Stellen** (`ROLE`, `ROLE_ID`, `getHierarchyPermissions`) können **für neue Entwickler** schwer durchschaubar sein — **ja**.
- **Inkonsistente Konfiguration** ist möglich (z. B. `ROLE=boss`, aber `ROLE_ID` ohne **S**): Dann schlagen **bestimmte** Befehle fehl (`/send`, `/boss-command` bei Hierarchie), während **`/send-plain`** bewusst **ohne** `ROLE_ID`-Check läuft (`messenger-command-handler.ts`). Das ist weniger „Sicherheitslücke“ als **Konfigurations-Falle** und **unterschiedliche Produktregeln** (Klartext vs. Mailbox-Verschlüsselung).
- **Redundanz:** Teils **absichtlich** (Gas-Modell **LW/BW** ist nicht dasselbe wie „darf senden“), teils **historisch gewachsen**.

### 10.2 Was an der Kritik übertrieben ist?

- **„Angreifer hebelt Hierarchie aus“** — in der Regel **nein**: viele Pfade prüfen **beides** oder **Move/Wallet**; das reale Risiko ist eher **falsche `.env`** als ein Bit, das die Chain umgeht.
- **„6 Bits abschaffen“** — möglich, aber **großer** Refactor (UI, Provisioning, Tests, Migration). Ohne **Migrationsplan** riskanter als der Status quo.
- **„Nur MESSENGER / RELAY / BOSS“** — ignoriert **`lock`**, **`monitor`**, **`waerter`**, **`messenger`** als Chat-Rolle — **nicht** 1:1 ins bestehende Produkt übertragbar.

### 10.3 Sinnvolle Richtung (ohne Implementierungszwang)

1. **Dokumentation & Defaults:** Empfohlene **`ROLE`+`ROLE_ID`-Kombinationen** pro Szenario (Boss → id-63 o. Ä.); Warnungen in UI (gibt es teils schon).
2. **Langfristig:** Ein **einheitliches** Berechtigungsmodell **spezifizieren**, dann erst Code zusammenziehen — nicht umgekehrt.
3. **Nicht** beliebig neue Bits (**R/A/V/E**) ergänzen, solange die bestehende Matrix nicht verstanden ist.

### 10.4 Konkrete Spannungen im Ist-Code (kein Refactor nötig, aber gut zu wissen)

| Situation | Verhalten |
|-----------|-----------|
| **`ROLE=messenger`**, `ROLE_ID` **ohne S** | **`/send`** (verschlüsselt) ist **erlaubt** (`canSend` gilt nur für boss/kommandant/arbeiter). **`/heartbeat`** wird **übersprungen** (überall **S** nötig). |
| **`ROLE=boss/kommandant/arbeiter`**, **ohne S** | **`/send`** und einige andere Aktionen **blockiert**; **`/send-plain`** weiterhin **ohne** `ROLE_ID`-Check (bewusster Klartext-Pfad). |
| **`getHierarchyPermissions`** | Nur für **boss/kommandant/arbeiter** eingeschränkt; **`messenger`** bekommt dort volle `true` — das ist **kein Bug**, sondern: Hierarchie-Kette vs. „freier“ Messenger-Client. |

**Empfehlung:** System **so lassen**, solange kein Team-Ressourcen für einen **großen** Umbau hat. Verbesserungen **ohne** Architekturbruch: **empfohlene Profile** in Doku/UI (z. B. Messenger mit **S**, wenn Heartbeat gewünscht), ggf. **Warnung** bei untypischen Kombinationen.

---

## Verwandte Dokumente

- `docs/ARCHITECTURE-ROLES-AND-HUB.md` — Boss, Kommandant, Arbeiter  
- `docs/API-EINSATZ-ROLE-TEMPLATES.md` — Einsatz-Vorlagen-API  
- `src/config.ts` — `ROLE_BITS`, `ROLE_ID`, `hasRoleBit`  

---

*Stand: Abgleich mit `src/config.ts`, `src/messenger-nest/messenger-command-handler.ts`, `src/api-server.ts` (`/api/profiles`), `ui/index.html` (`roleProfiles`). §§ 6–9: kritische Korrektur gängiger Bit-Fehldeutungen. § 10: Komplexität/Diskussion.*
