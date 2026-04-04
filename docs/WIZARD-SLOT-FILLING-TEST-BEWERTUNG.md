# Bewertung: Wizard-Slot-Filling-Stresstest & 10-Aktionen-Wörterbuch

## 1. Wizard-Slot-Filling-Stresstest (30 Szenarien)

### Sinnvoll? **Ja.**

| Aspekt | Bewertung |
|--------|-----------|
| **Vorgegebene Wizard-Pfade + Feldeingaben** | Passt genau zum Ziel: Nutzer hat nur Auswahl/Felder, KI leitet durch. Realistischer als reine Freitext-Blind-30. |
| **Multi-Turn: KI fragt nach Slots** | Sinnvoll, wenn die KI (oder eine Schicht) tatsächlich „Welches Schloss?“ → User „0x…“ → „Wie viele Tage?“ abbildet. |
| **30 Szenarien inkl. Variationen** | Gut: gültige Pfade (1–10) + Randfälle (11–30: falsche Adresse, 0, negative Tage, langer Text) prüfen Robustheit. |
| **Erwartung 28–30/30, 90–98%** | Erreichbar, wenn Slot-Filling **deterministisch** umgesetzt wird (siehe unten). Mit reiner LLM-Antwort pro Schritt eher 70–85%. |

### Zwei Umsetzungsvarianten

- **A) Deterministischer Slot-Filler (ohne LLM)**  
  Backend-Funktion `wizardSlotFilling(tileId, intent, currentState)`:  
  - Liest Param-Schema der Aktion (required/optional).  
  - Fehlende Pflichtfelder → Rückgabe: `{ message: "Bitte gib X an", awaiting: "recipient" }`.  
  - Alle Slots gefüllt → Rückgabe: `{ action: "/create-key", params: [...], confidence: 0.95 }`.  
  **Test:** 30 Szenarien als Abfolge von (tile, intent, stateUpdates). Erwartung: 28–30/30, 90–98% stabil.

- **B) Multi-Turn mit KI**  
  Jeder Schritt: User-Eingabe + aktueller State → Ollama → KI schlägt nächste Frage oder finalen Befehl vor.  
  **Test:** dieselben 30 Szenarien; Erwartung abhängig vom Modell (z. B. 70–85%), weniger stabil als A.

**Empfehlung:** A als Kern (sicher, vorhersagbar). Optional B für „freie“ Formulierung der Slot-Fragen.

---

## 2. Wörterbuch auf 10 Aktionen reduzieren?

### Sinnvoll? **Nein** (wie in WOERTERBUCH-V2-BEWERTUNG.md).

- Aktuell: 23/30 im Blind-30 durch **viele** Intents (Tickets, Vault, Fetch, Handshake, Connect, Exit, …).
- Nur 10 Aktionen → viele Befehle fehlen; Trefferquote droht zu sinken, nicht zu steigen.
- **Beibehalten:** Hybrid mit allen bestehenden Intents, optional `param_schema` pro Eintrag für Slot-Filling.

---

## 3. `wizardSlotFilling(intent, currentState)` – Code-Idee

### Sinnvoll? **Ja**, als **deterministische** Schicht.

- **Eingabe:** `tileId`, `intent` (oder direkt `action`, z. B. `/create-key`), `currentState` (z. B. `{ lock_id: "0x…", recipient: "0x…" }`).
- **Logik:** Param-Schema der Aktion laden (aus wizard-commands oder woerterbuch); erste fehlende Pflichtfeld → „Bitte gib X an“; sonst finalen Befehl + Args bauen.
- **Ausgabe:** `{ action, args[], message?, awaiting? }`; Args als `string[]` für bestehendes `runCommand(cmd, args)`.
- **Integration:** UI ruft bei Wizard-Eingabe zuerst diese Funktion (wenn intent/State bekannt); nur bei unklarer Absicht weiter Ollama nutzen.

---

## 4. Blind-30 „wird irrelevant“?

- **Für den reinen Wizard-Modus** (Nutzer klickt Kachel, füllt nur Felder): Der neue Test (Wizard-Pfade + Feldeingaben) ist der **wichtigere** Qualitätsmaßstab.
- **Blind-30 bleibt nützlich** für: Haupteingabefeld **ohne** Wizard (freie Sprache), Abdeckung von Formulierungen wie „Sende 1 IOTA an 0x…“, „Lass Gast rein“ usw. Beides ergänzt sich.

---

## 5. Kurzfassung

| Vorschlag | Bewertung |
|-----------|-----------|
| Wizard-Slot-Filling-Stresstest (30 Szenarien) | ✅ Sinnvoll, empfohlen |
| Deterministischer Slot-Filler (wizardSlotFilling) | ✅ Sinnvoll, als Kern für 90–98% |
| Wörterbuch auf 10 Aktionen reduzieren | ❌ Nicht empfehlen |
| Blind-30 komplett ersetzen | ❌ Nein; Wizard-Test ergänzt, ersetzt nicht |

**Nächste Schritte (optional):**  
1. Param-Schema pro Aktion (z. B. in wizard-commands) um `required`/Reihenfolge ergänzen.  
2. `wizardSlotFilling(tileId, action, state)` implementieren (deterministisch).  
3. Test-Skript `test:wizard-30` mit 30 Szenarien (Ablauf: State-Updates → erwarteter nächster Prompt oder finaler Befehl).
