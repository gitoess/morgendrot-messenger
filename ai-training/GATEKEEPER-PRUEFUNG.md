# Prüfung: Gatekeeper-Skript & 12-Tage-Härtung

## Macht es Sinn? **Ja – mit Anpassungen**

Die Idee (Gewaltenteilung: Verb-Block → KI → Backend-Veto) passt zur bestehenden Architektur. Einige Details müssen an den **aktuellen Flow** angepasst werden.

---

## 1. Wo es heute steht

| Komponente | Heute |
|-----------|--------|
| **Eingang** | UI → `POST /api/ai-copilot` (message) → `askAiCopilot()` → Antwort mit `suggestedAction: { cmd, args }`. |
| **Ausführung** | User klickt „Ja, ausführen“ → UI → `POST /api/command` mit `{ cmd, args }` → `_commandHandler` (wallet-bridge). |
| **Veto** | Nur Hierarchie (keyIssue/revokeDown/commandDown) in api-server; **kein** Min-Betrag für Pay, **kein** Rebate-vs-Gas-Check für Purge. |
| **Fehlerrückgabe** | `_commandHandler` liefert `{ ok: false, message }` → API 200 + body → UI kann Message anzeigen. |

Der Vorschlag ergänzt: (A) Vor-Ollama-Filter (Verb/Adresse), (B) zentrales Backend-Veto vor der eigentlichen Ausführung.

---

## 2. Was genau sinnvoll ist

- **Verb-Block vor Ollama:** Reduziert Token und verhindert „leere“ Anfragen – **sinnvoll**, aber der Regex darf **nicht** legitime Fälle blockieren (s. u.).
- **Backend-Veto (`validateAndExecute`):** Mathematik/Ökonomie schlägt KI – **sehr sinnvoll**. Am besten **vor** dem Aufruf von `_commandHandler` in api-server (oder als erste Prüfung in wallet-bridge).
- **Silent-Fail-Vermeidung:** Backend-Fehler müssen in der UI sichtbar sein („Befehl gestoppt, weil …“) – **sinnvoll**, primär UI-Text + garantierte Anzeige von `result.message` / `result.error`.
- **0x ohne Verb:** „Ich sehe eine Adresse – was soll ich damit tun?“ – **sinnvoll**, verbessert UX und Sicherheit.
- **Rebate-Orakel (Echtzeit):** Purge nur wenn geschätzter Rebate > Gas – **sinnvoll**; Implementierung braucht Abfrage Rebate (z. B. Object-Storage) + aktueller Gas-Preis (Node/API).
- **Confidence 0.85:** Nur Vorschläge mit hoher Confidence als „ausführbar“ anzeigen – **sinnvoll**, in der UI oder in der API-Antwort auswertbar.

---

## 3. Kritische Anpassungen (damit Cursor nicht in die falsche Ecke baut)

### 3.1 Verb-Regex (REQUIRED_VERBS)

Der gezeigte Regex enthält **keine** Begriffe für Hilfe, Auflisten, Abrufen, Prüfen. Das würde z. B. blockieren:

- „Hilfe“, „Zeig Befehle“, „/help“
- „Hole Nachrichten“, „Fetch“, „Liste Keys“, „Zeig Tickets“
- „Prüfe ob Chain läuft“, „Status“

**Anpassung:** Entweder den Verb-Block **erweitern** (z. B. `help|hilfe|zeig|liste|hole|fetch|prüfe|status|zeige`) **oder** den Block nur für „aktionelle“ Pfade nutzen und reine Abfragen/Help explizit durchlassen (z. B. „wenn kein Verb, aber /help oder ‚hilfe‘ oder ‚hole‘ → durchlassen“).  
**Zusatz für Cursor:** „Wenn kein Verb gefunden wird, aber eine 0x-Adresse im Text vorkommt, nicht pauschal ablehnen, sondern Rückfrage: ‚Ich sehe eine Adresse – was soll ich damit tun? (Senden / Zutritt?)‘.“

### 3.2 Wo der Verb-Block sitzt

`processUserIntent` gibt es so nicht. Der Einstieg ist **`askAiCopilot`** (ai-copilot.ts). Der Verb-Block sollte **ganz am Anfang** von `askAiCopilot` (oder in einer gemeinsamen Vorprüfung, die von api-server vor dem Aufruf von `askAiCopilot` genutzt wird) laufen – **bevor** Intent-Matcher/Ollama/RAG. So werden 0 Tokens an Ollama geschickt, wenn der Block greift.

### 3.3 validateAndExecute vs. aktueller Flow

Es gibt **kein** strukturiertes `AIProposal` mit `intent` und `params`. Die KI liefert **konkrete Befehle** (`suggestedAction.cmd` + `args`). Das „Veto“ muss also auf **cmd + args** arbeiten, nicht auf ein abstraktes Intent-Schema.

**Konkret:**

- **PAY_IOTA** → entspricht `cmd === '/transfer-coins'`: Min-Betrag (z. B. 1000 Nanos oder konfigurierbar) prüfen; bei Unterschreitung: `{ ok: false, message: 'Betrag zu klein (Min …).' }`.
- **PURGE_REQUEST** → entspricht `cmd === '/purge-key' || cmd === '/purge-ticket' || cmd === '/purge-handshake'`: geschätzten Rebate besorgen (z. B. aus chain-access: Object-Storage-Rebate oder vorhandene Rebate-Candidates), aktuellen Gas-Preis (Node/API) holen; wenn Rebate < Gas: `{ ok: false, message: 'Unwirtschaftlich: Gebühr > Ertrag.' }`.

**Ort:** Entweder in api-server **vor** `_commandHandler(cmd, args)` eine Funktion `validateBeforeExecute(cmd, args)` aufrufen, oder die gleiche Logik als erste Prüfung in wallet-bridge (vor der eigentlichen Chain-Aktion). Beides ist konsistent mit „Backend kontrolliert“.

### 3.4 Rebate-Orakel (Echtzeit)

**Zusatz für Cursor:** „`calculateEstimatedRebate` (oder äquivalent) muss auf **echten** Daten basieren: z. B. Objekt-Storage-Rebate von der Chain (getObject mit showStorageRebate) und aktueller Gas-Preis (Reference Gas Price / letzte TX). Keine fest verdrahteten Konstanten für ‚CURRENT_GAS_FEE‘ – Abfrage gegen IOTA-Node/API.“

---

## 4. Die drei Ergänzungen (bereits eingearbeitet)

- **Silent Fail:** Veto- und andere Backend-Fehler müssen in der UI ankommen und klar angezeigt werden („Der Befehl wurde gestoppt, weil: …“). API liefert bereits `message`/`error`; UI muss sie immer anzeigen.
- **0x ohne Verb:** Siehe 3.1 – Rückfrage statt harter Block.
- **Rebate-Orakel:** Siehe 3.4 – Echtzeit Rebate + Gas, keine Platzhalter.

---

## 5. 12-Tage-Plan – Einordnung

| Phase | Inhalt | Passt zu Codebase? |
|-------|--------|---------------------|
| Tag 1–3 | Verb-Block + Backend-Veto-Layer | Ja; Verb-Block in askAiCopilot/Vorprüfung, Veto vor _commandHandler. |
| Tag 4–5 | locked-rules + „Goldene 100“ Few-Shots | Ihr habt bereits locked-corrections.jsonl; „Goldene 100“ = Reduktion/Curating der Few-Shots in ai-copilot (z. B. FEW_SHOT_MAX/Indizes). |
| Tag 6–10 | 20 Todeszonen-Tests | Bereits umgesetzt (run-todeszonen-tests.ts, 20/20). Evtl. erweitern um Backend-Veto-Tests (Pay Min, Purge Rebate). |
| Tag 11–12 | 500er-Kombinationen, > 98 % | test:ai-500 existiert; Ziel > 98 % Stabilität ist messbar. |

---

## 6. Solltest du das so an Cursor geben?

**Nicht 1:1.** Der gezeigte Code ist ein **Konzept** (processUserIntent, validateAndExecute mit Intent-Namen). Cursor sollte an der **bestehenden** Codebasis arbeiten:

- **Verb-Block** in/vor `askAiCopilot` (ai-copilot.ts), mit erweitertem Regex oder Ausnahmen (help/list/fetch/0x-Rückfrage).
- **Veto** als `validateBeforeExecute(cmd, args)` in api-server oder wallet-bridge, mit konkreten Regeln für `/transfer-coins` (Min-Betrag) und Purge-Befehle (Rebate > Gas, Echtzeit-Daten).
- **Fehler** weiterhin als `{ ok: false, message }` an die UI; UI-Text: „Befehl gestoppt, weil …“.

---

## 7. Finaler Cursor-Befehl (zum Kopieren)

Nachfolgender Block ist so formuliert, dass er **genau** zu eurer Architektur passt und die drei Ergänzungen sowie die Anpassungen enthält.

```
Setze das Gatekeeper-Prinzip (Verb-Block + Backend-Veto) in der bestehenden Morgendrot-Architektur um.

Kontext:
- KI-Eingang: askAiCopilot() in ai-copilot.ts; Ausführung: POST /api/command → _commandHandler (wallet-bridge).
- Kein neues processUserIntent – die Logik in askAiCopilot bzw. einer Vorprüfung vor dem Ollama-Aufruf einbauen.

Fokus Tag 1–3:

1) SEMANTISCHER SCHUTZ (vor jedem Ollama/Intent-Aufruf):
   - Regex für erlaubte Verben/Trigger (z. B. sende|schicke|pay|zahle|lass|gib|erstelle|open|öffne|purge|lösche|handshake|connect|vault|sichere) UND Abfragen (help|hilfe|zeig|liste|hole|fetch|prüfe|status).
   - Wenn weder Verb/Trigger noch Abfrage getroffen: Prüfen, ob eine 0x-Adresse im Text vorkommt. Wenn ja: Rückgabe mit Text wie „Ich sehe eine Adresse – was soll ich damit tun? (Senden / Zutritt?)“. Wenn nein: „Bitte nenne ein Verb (z. B. ‚sende‘ oder ‚lass rein‘).“
   - 0ms Latenz: diese Prüfung vor Intent-Matcher und Ollama.

2) BACKEND-VETO (vor der Ausführung):
   - Vor dem Aufruf von _commandHandler in api-server (oder am Anfang der Handler-Logik in wallet-bridge): validateBeforeExecute(cmd, args).
   - Für /transfer-coins: Min-Betrag prüfen (z. B. 1000 Nanos oder Konfiguration); bei Unterschreitung: { ok: false, message: "Betrag zu klein (Min …)." }.
   - Für /purge-key, /purge-ticket, /purge-handshake: geschätzten Storage-Rebate (Echtzeit von Chain/Node) und aktuellen Gas-Preis holen; wenn Rebate < Gas: { ok: false, message: "Unwirtschaftlich: Gebühr > Ertrag." }.
   - Rebate/Gas nicht hardcoden – echte Abfrage (z. B. getObject mit showStorageRebate, Reference Gas Price).

3) SILENT-FAIL VERMEIDEN:
   - Sicherstellen, dass jede Veto-Meldung (ok: false, message) von der API unverändert an die UI geht und die UI diese Nachricht klar anzeigt (z. B. „Der Befehl wurde gestoppt, weil: …“). Kein stilles Nichts-Tun.

4) CONFIDENCE:
   - Für finanzielle Aktionen (Pay, Purge) Confidence-Threshold 0.85 nutzen: entweder in der API-Antwort kennzeichnen oder in der UI „Ausführen“ nur anbieten, wenn confidence >= 0.85.

Zero-Trust: KI schlägt vor, Backend prüft und führt aus. Keine Ausführung ohne bestandenes Veto.
```

Damit kann Cursor direkt in `ai-copilot.ts`, `api-server.ts` und ggf. `wallet-bridge.ts` und `chain-access.ts` die richtigen Stellen anpassen, ohne ein paralleles „processUserIntent“-Modell zu erfinden.
