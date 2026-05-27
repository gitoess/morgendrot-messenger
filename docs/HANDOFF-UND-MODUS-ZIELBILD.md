# Handoff & Produktmodus — Zielbild (Einsatz vs. Privat)

**Stand:** 2026-05-20  
**Status:** **Zielbild verbindlich** — Export-Assistent und Presets werden daran ausgerichtet.  
**Verwandt:** **`docs/ROLLEN-MODELL-CONSUMER-EINSATZ.md`**, **`docs/HANDOFF-IMPORT-UX.md`**, **`docs/WANDERER-STANDALONE-BUNDLE.md`**, **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**

---

## 1. Zwei grundlegend verschiedene Nutzungsweisen

| Bereich | Zielgruppe | Wer ist „Boss“? | Charakter | Handoff durch Einsatzleitung? |
|---------|------------|-----------------|-----------|-------------------------------|
| **Einsatz-Modus** | Rettungskräfte, THW, Feuerwehr, organisierte Teams | **Zentraler Boss / Einsatzleitung** — provisioniert nur **Untergebene** | Hierarchisch, vorbereitet, diszipliniert | **Ja** — Kernfunktion |
| **Privat / Solo-Modus** | Wanderer, Prepper, Familien, Einzelpersonen | **Der Nutzer selbst** (oder kleine selbstorganisierte Gruppe) | Frei, selbstbestimmt, kein Stab | **Nein** — kein Boss weist zu |

**Leitregeln:**

1. Der **Boss** ist **nur** für **Einsatz** gedacht. Er **erstellt nicht** Wanderer oder Prepper — er erstellt **Untergebene** mit voreingestellten Rechten, Kontakten und Einschränkungen.
2. **Wanderer/Prepper** nutzen den **eigenen Morgendrot-Messenger** (Privat-Modus): selbst installieren, selbst konfigurieren, optional **eigenes** Handoff-ZIP (Backup/Zweitgerät) — **ohne** Einsatzleitung.
3. Der **Export-Assistent** in Einstellungen/Einsatzleitung ist **ausschließlich Einsatz-Modus** („Untergebenen einrichten“).

---

## 2. Einsatz-Modus — Export-Assistent (Ist-Ziel)

### 2.1 Hybrid-Export (kanonisch: **`docs/HANDOFF-EXPORT-HYBRID.md`**)

**Basis-Karten** + **Feineinstellung** + **gespeicherte Vorlagen**:

| Basis (UI) | `.env` `ROLE=` | Typisch | Simple | UI | Transport |
|------------|----------------|---------|--------|-----|-----------|
| **Helfer** | `messenger` | Normale Einsatzkraft | ja | messenger | mesh-first |
| **Führer** | `kommandant` | Truppführer / Gruppenleiter | nein | full | iota-anchored |
| **Spezial** | `messenger` | Reporter, Sonderfälle (`ROLE_ID` oft **4** = nur L) | ja | messenger | mesh-first |

**Arbeiter** nicht eigene Karte — über Feineinstellung `ROLE=arbeiter` oder Vorlage.

**Gemeinsam (immer):** `DEPLOYMENT_PROFILE=einsatz`, Team-Postfächer wählbar, Partner aus Telefonbuch, Boss-Adresse, `PACKAGE_ID`, RPC.

**Stufenlos erweiterbar (Backlog):** `ROLE_ID` (0–63) und **Einsatz-Rollen-Vorlagen** aus Einstellungen — gleiche UI, feinere Bits (Senden, Pinnwand, Nur-Lesen/Reporter).

### 2.2 Was **nicht** im Export-Assistenten steht

| Thema | Warum |
|-------|--------|
| **Leitung / Boss** | Leitung **provisioniert** andere — sie exportiert nicht „sich selbst“ per Assistent. Boss-`.env`: `npm run env:role:boss` lokal. |
| **Wanderer / Prepper / Privat** | Anderer Produktmodus — siehe § 3 |
| **Feldtest** | Kein eigener Typ — Schnelltest = Preset **Helfer** + kurze Bezeichnung |

### 2.3 Was Handoff liefert vs. was woanders liegt

| Im Handoff-ZIP (~3 KB) | Separater Flow |
|------------------------|----------------|
| Öffentliche `.env` (Rolle, Transport, Mailboxes, Partner, Package) | |
| README (PSK-Hinweis, optional IOTA-Archiv) | |
| | **`initialProfile`** / Kontakt-JSON (Provisioning, Einsatzleitung) |
| | Gruppen beitreiten / anlegen |
| | Reporter Nur-Lesen (`ROLE_ID` ohne S-Bit) — Vorlagen |

Handoff **ändert Verhalten** über `ROLE`, `SIMPLE_MODE`, `TRANSPORT_PROFILE`, `deploymentProfile=einsatz` — nicht über sechs gleich klingende Preset-Namen.

---

## 3. Privat / Solo-Modus (Wanderer, Prepper)

| Aspekt | Zielbild |
|--------|---------|
| **Bundle** | `npm run bundle:standalone-smartphone` — **`docs/WANDERER-STANDALONE-BUNDLE.md`** |
| **Start** | Nutzer konfiguriert selbst (`.env`, Tresor, Meshtastic) |
| **Erststart** | Eigener **Solo-Wizard** (Backlog) — nicht der Boss-Export-Assistent |
| **Handoff** | Optional **selbst erzeugt** (Backup, Zweitgerät) — gleiches ZIP-Format, **kein** Boss |
| **Env** | `DEPLOYMENT_PROFILE=consumer`, `SIMPLE_MODE=true`, `TRANSPORT_PROFILE=mesh-first` typisch |

**Abgrenzung:** Privat-Nutzer können **Team-Mailbox beitreten** (ID vom Freund), aber **keinen** organisatorischen Boss im Morgendrot-Sinne.

---

## 4. Kritische Verbesserungen zum 3-Preset-Vorschlag (Helfer / Führer / Leitung)

| Vorschlag | Bewertung | Verbessertes Zielbild |
|-----------|-----------|------------------------|
| Drei Presets **Helfer / Führer / Leitung** | **Teilweise** | **Zwei Stufen im Export:** Helfer-Stufe (inkl. Arbeiter) + **Führer**; **Leitung** = **kein** Export-Preset |
| Helfer + Führer zusammenlegen | **Ja** | Eine Sektion **„Stufe / Rechte“** mit Radio (Helfer · Arbeiter · Führer) |
| Boss provisioniert Wanderer | **Nein** | Wanderer = § 3, aus Export-UI entfernt |
| Reporter mitlesen | **Fehlt in Handoff** | Eigene **Vorlage** `ROLE_ID` (z. B. nur **L**), später im gleichen „Untergebenen“-Dialog |

---

## 5. Roadmap-Anbindung

| Punkt | Fahrplan / Doku |
|-------|------------------|
| Presets vereinfacht (3 Stufen, kein Wanderer im Export) | Code: `handoff-export-presets.ts`, UI: `boss-handoff-export-panel.tsx` |
| Solo-Wizard | Backlog § H.0 / Erststart |
| `ROLE_ID` aus Boss-Vorlagen | **`docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md`**, Einsatz-Vorlagen |
| Mehrere Trupps / Packages | **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** |

---

## 6. Kurz-Fazit

- **Zwei Produkte in einer Codebasis:** Einsatz (boss-geführt) und Privat (selbstbestimmt).
- **Export-Assistent = nur Einsatz**, nur **Untergebene**, Stufe wählbar — nicht „Leitung“, nicht „Wanderer“.
- **Wanderer** bleibt wichtig, aber **außerhalb** der Boss-Handoff-Kachel.
