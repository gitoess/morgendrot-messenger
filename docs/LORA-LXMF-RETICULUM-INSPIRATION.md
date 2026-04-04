# Reticulum / LXMF – Inspiration für Morgendrot (kein Stack-Wechsel)

**Stand:** Einordnung; **keine** Implementierungspflicht.  
**Leitlinie:** `docs/MESHTASTIC-BUILDING-BLOCKS.md`, `docs/PROJECT-FOCUS-AND-PRIORITIES.md` – **Meshtastic-First**, IOTA-Pipeline bleibt.

---

## Was LXMF / Reticulum grob löst

**LXMF** (Lightweight Extensible Message Format) sitzt in der **Reticulum**-Welt auf einem **eigenen** Netzwerk-Stack (Reticulum über diverse Interfaces). Ziele: **speichern und weiterleiten**, **fragmentierte** große Nutzlasten, **Prioritäten**, robust bei **langsamen/unzuverlässigen** Links.

---

## Was ihr **schon** habt (Vergleich)

| Idee (LXMF-ähnlich) | Morgendrot heute |
|----------------------|-------------------|
| Große Inhalte in **viele kleine** Stücke | **Mesh v2:** `[[MF1:mid=…:i=…:t=…:]]` + UTF-8-sicheres Splitten (`mesh-v2-fragment.ts` ↔ Frontend-Reassembly). |
| **Progressive** Bildübertragung | **Luma zuerst, Chroma danach** (`lora-progressive-image.ts`, `MORG_LUMA_V1` / `MORG_CHROMA_V1`) – „wichtiges zuerst“ ohne LXMF. |
| Priorität SOS > Bild | **MacroPriorityClass** / Queue-Denken (`src/shared/opcodes.ts`); **Meshtastic** selbst priorisiert nicht eure Klassen → Policy in **App/Gateway** (siehe MESHTASTIC-BUILDING-BLOCKS §3). |
| Store-and-forward | **Meshtastic** + ggf. **Delayed Upload** (`LORA-IOTA-DELAYED-UPLOAD-SPEC.md`). |

**Ehrlich:** Ihr habt bereits **Chunking + Reassembly** und **zweiphasiges Bild**. LXMF ist **kein** magischer Ersatz dafür – es ist ein **anderes** Gesamtprotokoll.

---

## Konkrete **Vorteile**, die LXMF *als Ideengeber* bieten kann

1. **Explizite Metadaten pro Fragment** (Priorität, Typ, Ablauf): könnt ihr **teilweise** nachrüsten (z. B. erweiterter Header oder paralleles Byte-Feld), **ohne** Reticulum zu importieren.  
2. **Retry / „fehlendes Fragment nachfordern“:** LXMF-Doku kann als **Checkliste** dienen; Umsetzung wäre **eigene** App-Logik oder **kleines** Meshtastic-Modul – **mittlerer** Aufwand.  
3. **Audio in gleichartige Chunks** wie Text/Bild: bei euch bereits über **dieselbe** Mesh-v2-Kette möglich; „LXMF“ wäre nur **Vorbild** für Sequenzierung/TTL.

---

## Nachteile / Risiken, wenn man „zu viel“ übernimmt

- **Voller LXMF/Reticulum-Stack:** würde **Meshtastic-Transport** und eure **MORG\_*-Wires** verkomplizieren oder ersetzen – **nicht** Ziel.  
- **Doppelte Zuverlässigkeitsschichten:** Meshtastic fragmentiert/queued bereits; zusätzliche LXMF-Schicht ohne klare Grenze → **Debugging-Hölle**.  
- **Spezifikations-Drift:** Nur „Konzepte lesen“ ist billig; **kompatibel** mit einem externen Format zu werden ist **teuer**.

---

## Aufwand realistisch (nur **Konzepte** adaptieren)

| Maßnahme | Aufwand | Nutzen |
|----------|---------|--------|
| Diese Doku + Abgleich mit Mesh-v2/Luma-Chroma | **gering** | Klarheit im Team |
| Pro Fragment: **Prioritäts-Byte** + Queue in der **App** (senden: SOS vor Rest) | **niedrig–mittel** | Bessere Fairness auf **eurer** Seite; Funk bleibt Meshtastic |
| **Fehlende Fragmente erkennen** + gezielter **Retry** (nur zwischen zwei Morgendrot-Endpunkten) | **mittel** | Robustheit; braucht Protokoll-Zustand |
| **LXMF-kompatibel** werden oder Reticulum-Interface | **hoch** | Nur wenn strategisch gewollt – **nicht** empfohlen parallel zum aktuellen MVP |

---

## Empfehlung

- **Ja** zu: gezielt **Inspiration** (Priorität pro Chunk, klare Sequenz/TTL-Denke, Retry-Patterns aus der LXMF-/Reticulum-Literatur lesen).  
- **Nein** zu: Reticulum als **Transport** unter Meshtrot/Morgendrot ohne sehr starken Grund.  
- **Behalten:** Luma/Chroma + Mesh-v2 als **Kern**; punktuell **Header/Queue** verbessern, wenn Messungen im Feld „Lücken“ zeigen.

---

## Verwandte Dateien

- `src/mesh-v2-fragment.ts`, `frontend/frontend/lib/mesh-v2-fragment.ts`  
- `src/lora-progressive-image.ts`  
- `docs/MESHTASTIC-BUILDING-BLOCKS.md`  
- `docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`  
- `src/shared/opcodes.ts` (`MacroPriorityClass`)
