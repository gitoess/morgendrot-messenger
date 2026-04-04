# 🤖 Morgendrot AI-Copilot – Plan

Anstatt 13 Schritte manuell zu klicken, schreibst du dem Assistenten einfach in **Säule 3** (Chat) in natürlicher Sprache.

## 1. Was der Assistent erledigt

- **Automatisches Setup:** „Bereite alles für ein neues Smart-Lock vor.“ → Die KI setzt ROLE=lock, generiert eine MY_ADDRESS und schlägt ein passendes PACKAGE_ID vor.
- **Befehls-Übersetzer:** „Lass den Gast von vorhin für 2 Stunden rein.“ → Die KI sucht die Adresse aus dem Verlauf, berechnet die TTL und bereitet den /create-key PTB vor.
- **Fehler-Doktor:** „Warum geht das Schloss nicht auf?“ → Die KI prüft den RPC-Status, dein Gas-Guthaben und ob der Handshake (/connect) aktiv ist.
- **Wirtschaftsprüfer:** „Wie viel IOTA kann ich heute rebatten?“ → Die KI scannt deine Objekte und listet alle löschbaren Tickets auf.

## 2. Technische Einbindung

- **Lokale LLM-Schnittstelle:** z. B. Ollama oder Vercel AI SDK.
- **Lokal & privat:** Keys und Chat-Inhalte verlassen dein System nicht.
- **Function Calling:** Die KI erhält eine Liste der Befehle (/create-key, /handshake, /purge, …) und wählt passend zur Nutzer-Eingabe.

## 3. Beispiel in der App

**User:** „Hey, richte mir einen sicheren Kanal zu meinem neuen Sensor 0xabc... ein.“

**KI-Assistent:**  
„Verstanden! Ich habe folgende Schritte vorbereitet:  
- Modus auf 🔒 Verschlüsselt gestellt.  
- /handshake an 0xabc... vorbereitet.  
- Warte nun auf /connect.  
Soll ich den Handshake jetzt für 0,002 IOTA senden? [ ✅ Ja ] [ ❌ Nein ]“

## 4. Vorteile

- **Kein Handbuch nötig:** Der Nutzer muss die 13 Schritte nicht lernen; die KI führt ihn durch.
- **Sicherheit:** Die KI kann warnen: „Achtung, du versuchst gerade eine Nachricht im Klartext zu senden. Soll ich auf Verschlüsselt umstellen?“
- **Effizienz:** Die KI bündelt Aufgaben automatisch in PTBs, um Gebühren zu sparen.

## 5. Aktivierung (optional)

- **Ollama:** Ist **nicht** im Projekt enthalten – muss **separat** installiert werden: [ollama.com](https://ollama.com). **Empfohlen:** `ollama pull qwen2.5-coder` (z. B. 1.5b oder 7b), dann `ollama run qwen2.5-coder:1.5b`. Server: `http://127.0.0.1:11434`.
- **.env:** `ENABLE_AI_COPILOT=true`, optional `OLLAMA_URL=…`, `OLLAMA_MODEL=qwen2.5-coder:1.5b` (Standard). Ohne Ollama zeigt die UI eine Fehlermeldung; die restliche App funktioniert normal.
- **Lean Linux / Industrie (unter 500 MB):** Siehe **AI-COPILOT-LEAN-LINUX.md** (Docker, CPU-only, Raspberry Pi).

## 5b. Fetch.ai (optional, noch nicht integriert)

Für autonome Agenten/Markt (z. B. „Garage vermieten“, Strompreis überwachen) war **Fetch.ai** (uagents) als optionale Erweiterung geplant. Derzeit nutzt der Copilot **nur die lokale KI (Ollama)**. Fetch kann später ergänzt werden (eigener Dienst, Anbindung in Säule 2/Kanal).

## 6. UI (Säule 3)

Block **„🤖 Morgendrot AI-Copilot“** mit Eingabefeld und Button „Fragen“. Optionen: **Intent-Matcher**, **Ollama**, **Als Plan** (Plan-Modus). Bei aktiviertem Copilot: Anfrage an Backend → bei Einzelbefehl Intent oder Ollama → Antwort + optional „ACTION: /befehl args“. Buttons **✅ Ja, ausführen** und **❌ Nein** zur Bestätigung. **Plan-Modus („Als Plan“):** Ollama zerlegt den Wunsch in mehrere Schritte (z. B. CHECK_SETUP → HANDSHAKE → CREATE_KEY → SEND_PLAIN); die UI zeigt die Liste mit **„Schritt ausführen“** pro Schritt. Plan-Modus erfordert Ollama. Alle bestehenden Schritte und Buttons bleiben unverändert nutzbar.

**Kacheln & Mehrfachbefehle:** Die KI kennt alle Projekte (Kacheln) in der UI – Chat, Ticket, Lieferkette, Heimnetzwerk, Zahlung, Pinnwand, Vault, Notfall, Boss, Sensoralarme, Car-Sharing, Heartbeat, Kühlkette, Familienzugang – inkl. Schritte, Refs, Optionen und Verbindungen (siehe `APPLICATION_KNOWLEDGE` in `src/ai-copilot-context.ts`). Bei **mehreren gewünschten Aktionen** (z. B. „sende 1 IOTA an …, danach erstelle Key und Ticket, alles per PTB“) gilt: Pro Antwort nur **eine** ACTION-Zeile (wichtigste zuerst, z. B. `/transfer-coins`); weitere Schritte werden im Text genannt. **PTB:** Aktuell nur eine Kombination in einer TX: Key + Nachricht (`/create-key-and-notify`). IOTA senden und Ticket erstellen sind separate Befehle; die KI schlägt die Reihenfolge vor.

## 7. Was du jetzt tun kannst (Quick Start)

1. **.env:** `ENABLE_AI_COPILOT=true` eintragen. Optional: `OLLAMA_MODEL=qwen2.5-coder:1.5b` (ist bereits Standard).
2. **Ollama + Qwen2.5-Coder** laufen lassen: `ollama pull qwen2.5-coder` (einmalig), dann `ollama run qwen2.5-coder:1.5b` in einem Terminal.
3. **App starten:** `npm run dev`
4. **Chat-Projekt öffnen.** In **Säule 1** siehst du nach dem Öffnen automatisch den **KI-Check** (🟢 KI-Assistent bereit oder Hinweis + Link zu ollama.com). In **Säule 3** den Block **„🤖 Morgendrot AI-Copilot“** aufklappen, etwas eingeben (z. B. „Bereite alles für ein Schloss vor“ oder direkt `/handshake 0x…`) und **Fragen** klicken.

**Anlernen / Verhalten:** Die KI nutzt den vollen Anwendungskontext (Befehle, Config, 4 Säulen). Wenn du bereits einen Befehl tippst (z. B. `/create-key 0x… 0x… 30`), erkennt die App ihn ohne Ollama (Vorfilter). Sonst geht die Anfrage an Ollama; Antworten sind auf 120 Tokens begrenzt (schnell, wenig RAM).

## 8. App-Wissen dauerhaft in Ollama speichern (Modelfile)

Ollama hat keine „Lerntaste“ – der Chat-Verlauf ist nach dem Schließen weg. Damit die KI **jedes Mal** beim Start alles über Morgendrot weiß, kannst du das Wissen **fest ins Modell einbauen** (0 MB extra, keine Cloud).

### Weg 1: Modelfile (empfohlen)

Das Projekt enthält einen **Generator**, der aus derselben Wissensquelle wie der Laufzeit-Copilot (APPLICATION_KNOWLEDGE + Befehle) ein **Ollama-Modelfile** erzeugt.

1. **Modelfile erzeugen:** Bei `npm run dev` wird das Modelfile automatisch neu erzeugt. Sonst manuell:
   ```bash
   npm run prepare:ai
   ```
   (oder `npm run generate:modelfile`). Erzeugt `docs/ollama-Modelfile` mit dem kompletten App-Wissen unter `SYSTEM """ ... """`.

2. **Eigenes Modell anlegen:**
   ```bash
   ollama create morgendrot-ai -f docs/ollama-Modelfile
   ```

3. **Nutzen:** In `.env` optional `OLLAMA_MODEL=morgendrot-ai` setzen. Dann startest du `ollama run morgendrot-ai` (oder die App nutzt es automatisch). Die KI verhält sich wie ein Assistent, der **von Haus aus** alle Säulen, Befehle, API und .env-Optionen kennt – ohne dass du bei jedem Chat alles erneut mitschickst.

**Vorteil:** Eine Quelle (`src/ai-copilot-context.ts` + Befehle). Generator hält Modelfile und Laufzeit-System-Prompt synchron.

**KI?** Mit Modelfile bleibt der Kontext synchron: bei jedem `npm run dev` wird das Modelfile neu gebaut; bei Bedarf `npm run prepare:ai`, danach z. B. `ollama create morgendrot-ai -f docs/ollama-Modelfile` für ein aktualisiertes Modell.

### Weg 2: RAG (für später / große Doku)

Für **sehr große** Wissensbestände (z. B. Siemens-Handbücher, hundert Seiten Doku) eignet sich **Retrieval Augmented Generation**:

- Wissen in einer kleinen Vektordatenbank oder durchsuchbaren Textdatei ablegen.
- Bei jeder Nutzerfrage: zuerst passende Abschnitte suchen („Was steht über Fehler 404?“), dann diese Abschnitte **zusammen mit der Frage** an Ollama senden.
- Vorteil: Gigabytes an Dokumentation nutzbar, ohne das Modell zu verändern. Für das Standard-Morgendrot-Setup reicht Weg 1 (Modelfile).

---

## 9. Lernen, Training und Grenzen („versteht die KI den Code 100 %?“)

### Lernen die KIs selbständig mit?

**Nein.** Weder der Intent-Matcher noch Ollama werden im Projekt automatisch trainiert oder aus Nutzerfeedback angepasst.

- **Intent-Matcher:** Regelbasiert. Feste Phrasen und Muster in `src/ai-intent-matcher.ts` (INTENTS). Kein Machine Learning, keine Anpassung zur Laufzeit.
- **Ollama:** Bei jeder Anfrage wird derselbe System-Prompt (APPLICATION_KNOWLEDGE + Befehle) mitgeschickt. Kein persistenter Chat-Verlauf in der App, kein Fine-Tuning durch Morgendrot.

### Kann man sie bewusst trainieren?

**Ja – auf zwei Wegen:**

1. **Ollama (Modelfile):**  
   `npm run generate:modelfile` erzeugt `docs/ollama-Modelfile` mit dem kompletten App-Wissen. Mit  
   `ollama create morgendrot-ai -f docs/ollama-Modelfile` baust du ein **eigenes Modell**, das dieses Wissen dauerhaft enthält. Bei Änderungen an Befehlen oder Kontext: Modelfile neu erzeugen und Modell neu anlegen. Das ist bewusstes „Trainieren“ im Sinne von: Wissen fest ins Modell packen.

2. **Intent-Matcher:**  
   In `src/ai-intent-matcher.ts` kannst du neue **IntentRule** hinzufügen (Beispielphrasen + `run()`-Funktion). Erweiterung durch Code-Änderung, keine KI-Schulung.

### Ist die KI „perfekt“ / versteht sie Code, Move und Rebased zu 100 %?

**Nein.** Die KI erhält eine **Zusammenfassung** der Anwendung (`APPLICATION_KNOWLEDGE` in `src/ai-copilot-context.ts`): Architektur, Befehle, Config, API, Abläufe, kurzer Abschnitt zu IOTA Rebased/Move. Sie bekommt **keine** vollständigen Source-Dateien, kein Move-Modul, keine komplette Rebased-/SDK-API.

- **Für Alltagsfragen und Befehlsübersetzung** („Schick verschlüsselt an 0x…“, „Key für Gast erstellen“) reicht das in der Regel.
- **Für „ausgereift“ und tiefes Verständnis** (Code-Zeilen, Move-Semantik, Rebased-Details) solltest du:
  - **Modelfile nutzen** (Weg 1 oben), damit das Modell das aktuelle Wissen von Haus aus hat.
  - **Kontext erweitern:** In `ai-copilot-context.ts` gezielt mehr zu Move, Rebased und kritischen Modulen ergänzen (oder RAG mit Code/Doku, Weg 2).
  - Optional ein **größeres oder spezialisierteres Modell** (z. B. Code-fokussiert) als Basis für das Modelfile wählen.

Kurz: Die KI ist **nicht** von selbst lernend und **nicht** perfekt; sie kann bewusst über Modelfile und Intent-Regeln „trainiert“ bzw. erweitert werden. Für 100 % Code-/Move-/Rebased-Verständnis muss das Wissen explizit in Kontext oder Modell eingebaut werden.
