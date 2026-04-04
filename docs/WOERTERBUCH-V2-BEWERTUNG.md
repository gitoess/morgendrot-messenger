# Bewertung: „Finales Morgendrot-Wörterbuch“ (V2-Vorschlag)

## 1. Vorschlag im Überblick

- **Neues Format:** `version` + `actions[]` mit `intent`, `action`, `triggers`, `params` (name, type, required, default, range), `confidence_base`, `description`.
- **Reduktion auf 8 Kern-Aktionen** (statt aktuell 26 Einträge).
- **extractArgsForAction(intent, text)** gibt Objekt zurück (statt Array).
- **Erwartung:** 80–92 % Trefferquote im Blind-30.

---

## 2. Was sinnvoll ist

| Aspekt | Bewertung |
|--------|-----------|
| **Param-Schema** (type, required, range, default) | ✅ Gut: Dokumentation, Validierung, zukünftige UI/Slots. Kann als Zusatz ins bestehende Format. |
| **version** + **description** | ✅ Sinnvoll für Pflege und Erweiterbarkeit. |
| **Objekt statt Array in extractArgs** | ✅ Möglich: intern Objekt nutzen, vor `runCommand` in `string[]` umwandeln (Reihenfolge pro Befehl fest definieren). |
| **Datei-basiert, kein Modell-Rebuild** | ✅ Entspricht bereits dem aktuellen Ansatz. |

---

## 3. Kritische Punkte (warum 8 Aktionen riskant sind)

### 3.1 Aktueller Stand

- **Blind-30 mit Wizard:** 23/30 Treffer (≈77 %), u. a. durch **viele, spezifische** Intents.
- Genutzt werden u. a.: `purge_key`, `purge_ticket`, `list_tickets`, `create_ticket`, `handshake`, `connect`, `fetch`, `vault_*`, `exit`, `send_verschluesselt`, `nachricht_klartext`, `zahlung`, `help`, …

### 3.2 Im Vorschlag fehlende Aktionen

Im V2 sind nur 8 Intents vorgesehen. **Nicht mehr abgedeckt** wären z. B.:

- `/handshake`, `/connect` → „Handshake an 0x…“, „Verbinde“
- `/fetch` → „Hole letzte 10 Nachrichten“
- `/list-tickets`, `/create-ticket`, `/use-ticket`, `/purge-ticket`
- `/vault-save`, `/vault-onchain`, `/purge-handshake`, `/purge-msg`, `/emergency-purge*`
- `/set-package-id`, `/exit`, `/transfer-key`, `/transfer-ticket`, `/create-key-and-notify`

Diese Fälle würden **nicht mehr** vom Wörterbuch getroffen und landen bei Ollama/Intent – mit dem Risiko, die **bereits erreichte 77-%-Quote zu verschlechtern**, nicht zu verbessern.

### 3.3 Zu breite Trigger

Vorschlag für **nachricht_verschluesselt** (`/send`):

```json
"triggers": ["sende", "schick", "nachricht", "schreib", "melde", "an", "sage"]
```

- **Problem:** „sende“/“schick“ kommen auch bei **Zahlung** und **Klartext** vor.
- Genau das hatte vorher zu Fehlzuordnungen geführt (z. B. „Sende …“ → `/exit` oder falscher Befehl). Erst **spezifischere** Trigger (z. B. „sende iota“, „sende mal “, „an alle partner“, „offen an 0x“) haben 23/30 ermöglicht.
- **Fazit:** So breite Trigger für „sende/schick“ würden mit hoher Wahrscheinlichkeit **Regressionen** auslösen (falsche Befehle, weniger saubere Treffer).

### 3.4 Param-Struktur vs. Backend

- **Backend:** erwartet `(cmd, args: string[])`, z. B. `runCommand('/transfer-coins', [addr, amount])`.
- **Vorschlag:** `extractArgsForAction` liefert ein Objekt, z. B. `{ recipient, amount_iota }`.
- **Lösung:** Zentrales Mapping pro Befehl von Objekt → feste Arg-Reihenfolge, z. B.:

  `objectToArgs('/transfer-coins', obj) → [obj.recipient, String(obj.amount_iota)]`

  Das ist umsetzbar und sauber, aber **zusätzlicher Schritt**; die aktuelle Array-Logik bleibt kompatibel.

---

## 4. Empfehlung: Hybrid statt radikale Reduktion

### 4.1 Wörterbuch

- **Format erweitern, nicht ersetzen:**
  - Optionale Felder: `version`, `description` (global und pro Eintrag).
  - Pro Eintrag optional: `params` als Array von `{ name, type, required?, default?, range? }` (für Doku/UI), **ohne** die bestehenden `action`/`triggers` zu entfernen.
- **Alle bisherigen Intents beibehalten** (Zutritt, Keys, Tickets, Nachricht, Zahlung, Purge, Vault, Fetch, Handshake, Connect, Help, Exit, …), damit 23/30 und Wizard-Kacheln weiter funktionieren.
- **Keine Verbreiterung** der Trigger für „sende“/“schick“: weiter **spezifische** Phrasen (z. B. „sende iota“, „sende mal “, „an alle partner“, „offen an 0x“) nutzen.

### 4.2 extractArgsForAction

- **Option A (minimal):** Aktuelle Signatur und Array-Rückgabe beibehalten; nur Param-Logik verfeinern (wie bereits für create-key/create-keys, send, Zahlung).
- **Option B (V2-ähnlich):**  
  - Intern pro Intent ein **Objekt** mit typisierten Parametern bauen (z. B. `{ recipient, amount_iota }`).  
  - Eine feste Tabelle **intent/action → Reihenfolge der Argumente**; daraus `string[]` für `runCommand` erzeugen.  
  So bleibt die Rückwärtskompatibilität gewahrt und das Param-Schema kann genutzt werden.

### 4.3 Erwartung 80–92 %

- **Mit nur 8 Aktionen und breiten Triggern:** eher **nicht** zu halten; Gefahr von mehr Fehlzuordnungen und weniger Abdeckung (Tickets, Vault, Fetch, Connect, …).
- **Mit Hybrid (bestehende Abdeckung + Param-Schema + evtl. Objekt-Args):** 80 %+ sind **realistisch**, wenn man die aktuellen 23/30 beibehält und gezielt die verbleibenden Lücken (z. B. reine Rückfragen, mehrdeutige Formulierungen) über Wizard/Ollama/Intent abdeckt.

---

## 5. Kurzfassung

| Vorschlag | Bewertung |
|----------|-----------|
| Param-Schema (type, required, range, default) | ✅ Übernehmen als Erweiterung |
| version + description | ✅ Übernehmen |
| Nur 8 Aktionen | ❌ Nicht empfehlen – zu viele heute genutzte Befehle fehlen |
| Breite Trigger „sende“, „schick“, „nachricht“ für /send | ❌ Nicht übernehmen – Risiko für Regressionen |
| extractArgs als Objekt | ✅ Möglich mit Mapping Objekt → string[] für runCommand |
| Erwartung 80–92 % | ✅ Erreichbar mit **Hybrid** (Abdeckung behalten + Schema); ❌ riskant mit reiner 8-Aktionen-Version |

**Pragmatischer Weg:** Bestehendes `woerterbuch.json` um `version`, `description` und optionale `params`-Schemas ergänzen, alle bewährten Intents und spezifischen Trigger beibehalten und nur die Arg-Extraktion schrittweise verfeinern (inkl. optional Objekt → Array).
