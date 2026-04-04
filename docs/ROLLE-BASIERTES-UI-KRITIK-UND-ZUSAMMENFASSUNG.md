# Rollen-basiertes UI + Verbesserungsvorschläge – Kritische Prüfung & Zusammenfassung

**Stand:** März 2025. Kontext: letzte ~5–10 Nachrichten (Kacheln sinnlos getrennt, Boss will Arbeiter erstellen/überwachen, Arbeiter nur wenige Befehle; Drei-Zonen-Modell; Verbesserungen: device_origin_id on-chain, Wizard AP-Modus für Tiny).

---

## 1. Macht das Rollen-basierte UI Sinn?

**Ja – und der Ist-Zustand bestätigt das Problem.**

- **Aktuell:** Eine Ansammlung von Kacheln (Streams, Keys, Nachrichten, Lock, Monitor, Steuerung, Code ausgeben, …). Die Rolle wird nur **manuell** umgeschaltet (`uiRole`: Boss / Kommandant / Arbeiter / Empfänger), und viele Bereiche sind mit `x-show="uiRole === 'boss' || ..."` ein-/ausgeblendet. Es ist eine **Entwickler-Ansicht**: alles sichtbar, Nutzer muss selbst filtern.
- **Gewünscht:** **Role-Based UI** – nach Login/Backend-Rolle **nur eine** maßgeschneiderte Ansicht:
  - **Boss:** „Kontrollzentrum“: Geräteliste (Name, Status, letzte Aktivität), großer Button „+ Gerät hinzufügen“ (Wizard), kleiner Rebate-Tacho, Klick auf Gerät → Sidebar mit Befehlen, Rollen-Info, Verlauf.
  - **Kommandant:** Gruppen-Management, Kommando-Eingabe (Dropdowns statt Freitext), globaler Verlauf (welcher Arbeiter wann was getan hat).
  - **Arbeiter:** Reduziert auf Status, 2–3 Aktions-Buttons, letzte Aktionen; keine Technik-Kacheln, kein Wizard, keine Key-Ansicht.

**Bewertung:** Das ist ein klassisches **Rollen-Filter- und Fokus-UI-Prinzip**. Es macht Sinn: „Der Boss verwaltet Objekte (Tore, Menschen), nicht Transaktionen. Der Arbeiter nutzt Funktionen, nicht Protokolle.“

---

## 2. Drei-Spalten-Modell (Navigator | Fokus | Verlauf)

**Sinnvoll und gut umsetzbar.**

| Zone | Inhalt | Zweck |
|------|--------|--------|
| **Links (Navigator)** | Geräteliste / Sektor-Gruppen | Schnellwahl: Wer/Was? |
| **Mitte (Fokus)** | Eingaben, Buttons, Wizard oder Kommando-Maske | Handeln |
| **Rechts (Verlauf)** | Timeline / Audit (Echtzeit) | Kontrolle: Was ist wann passiert? |

**Ist-Zustand im Repo:** Es gibt bereits ein **Audit-Log** (`audit-log.ts`: `appendAuditEvent`, `readAuditEvents`, CSV/PDF-Export). In der UI existieren nur **Links** (Audit CSV/PDF), **keine** live Timeline. Eine **Timeline-Komponente**, die `readAuditEvents` (oder einen neuen API-Endpunkt wie `GET /api/audit-events?limit=50`) nutzt und Einträge mit Icon (✅/⚠️/📡) und humanisierten Zeiten („vor 2 Min“) anzeigt, fehlt noch.

**Bewertung:** Drei-Spalten-Layout + Timeline für Verlauf ist konsistent mit dem beschriebenen Ziel und mit dem vorhandenen Audit-System kombinierbar.

---

## 3. Verbesserungsvorschlag: „Identitäts-Dilemma“ (Tiny → device_origin_id on-chain)

**Problem:** Tiny (ESP32) hat keinen IOTA-Private-Key. Er sendet nur HMAC an das Gateway; das Gateway signiert die TX. On-Chain erscheint **nur** der Gateway-Account als `by` (Sender). Im Audit/Compliance ist später nicht beweisbar, **welches physische Gerät** (z. B. welches Tor) die Aktion ausgeführt hat.

**Vorschlag:** Im Move-Event ein Feld **device_origin_id** (oder ähnlich) mitsenden. Das Gateway signiert als Bürge, aber das **Event** auf der Chain enthält die ID des Tiny-Geräts.

**Kritische Prüfung:**

- **Sinn:** **Ja.** Beweissicherung und Nachvollziehbarkeit (Compliance, Streitfälle) verlangen, dass die Herkunft des physischen Geräts **on-chain** festgehalten wird, nicht nur in lokalen Logs.
- **Technik:** Im Move-Code wird heute `TicketUsed { ticket_id, event_id, by: tx_context::sender(ctx) }` emittiert (`messaging.move`). Es gibt **kein** Feld für Geräte-Herkunft. Um das sauber zu lösen, braucht es:
  - **Move:** Erweiterung von `TicketUsed` um ein optionales Feld (z. B. `device_origin_id: vector<u8>` oder `Option<vector<u8>>`) und eine angepasste Entry-Funktion (z. B. `use_ticket(ticket, event_id, device_origin_id)` oder Überladung). Der Signer bleibt der Gateway-Account; `device_origin_id` ist reines Datenfeld im Event.
  - **SDK/chain-access:** `use_ticket` / `batchUseTickets` um Parameter `deviceOriginId?: string` erweitern und an die Move-Funktion durchreichen.
  - **Settlement-Queue / tiny-gateway:** Beim Eintrag in die Queue und beim Bau des PTB die **deviceId** des Tiny mitgeben und als `device_origin_id` in die TX schreiben.

**Risiko:** Ohne diese Erweiterung bleibt die Herkunft nur in Off-Chain-Logs (Audit-Datei, Settlement-Queue). Diese können manipuliert werden; die Chain wäre die einzige fälschungssichere Quelle.

**Fazit:** Der Vorschlag ist **sachlich richtig und umsetzbar**. Er erfordert eine **Move-Änderung** (Event + Entry-Signatur) und Anpassungen in chain-access, Settlement-Queue und ggf. Wärter-/Gateway-Flows.

---

## 4. Verbesserungsvorschlag: „Wizard-Realitätscheck“ (Tiny ohne WLAN → AP-Modus)

**Problem:** Der Wizard erzeugt `config.json` oder `identity.h`. Ein Tiny (ESP32) ist beim ersten Einsatz oft **noch nicht im WLAN**. Wie kommt die Config auf das Gerät? (Henne-Ei-Problem.)

**Vorschlag:** Für Tiny-Devices einen **Access-Point-Modus** im Wizard vorsehen: Beim ersten Start macht das Gerät ein eigenes WLAN auf (z. B. „MORGENDROT_SETUP“), der User verbindet sich mit dem Handy, und eine App/Seite schiebt die Config per HTTP-POST auf das Gerät.

**Kritische Prüfung:**

- **Sinn:** **Ja.** Viele IoT-Geräte werden genau so in Betrieb genommen (AP-Modus → Konfiguration → Wechsel in Stationsmodus). Das löst das Henne-Ei-Problem ohne Kabel oder manuelles Flashen von Config.
- **Wer macht was:**  
  - **Morgendrot (Wizard):** Erzeugt weiterhin `identity.h` / JSON / QR. Zusätzlich könnte der Wizard eine **kurze Anleitung** ausgeben: „Tiny starten → WLAN MORGENDROT_SETUP → Browser/App öffnen → Config hochladen.“  
  - **Tiny-Firmware (außerhalb Repo):** Müsste einen AP „MORGENDROT_SETUP“ starten und einen minimalen HTTP-Server (oder Captive Portal) bereitstellen, der eine POST-Route für Config/identity akzeptiert und in Flash speichert.  
  - **Optional:** Eine minimale „Setup-App“ (z. B. PWA) im Morgendrot-Repo, die der User auf dem Handy öffnet, nachdem er sich mit MORGENDROT_SETUP verbunden hat; sie lädt die vom Wizard erzeugte Config (z. B. aus Zwischenablage oder Datei) und sendet sie per POST an das Gerät.
- **Aufwand:** Die **Firmware** für AP-Modus + Config-Upload liegt typischerweise im Embedded-Projekt (C/Arduino/ESP-IDF), nicht im Morgendrot-Node-Repo. Morgendrot kann: (1) Anleitung + ggf. Beispiel-Payload-Format dokumentieren, (2) optional eine kleine PWA/HTML-Seite bereitstellen, die nur „Config hochladen“ macht (ohne Wizard-Logik).

**Fazit:** Der Vorschlag ist **sinnvoll**. Die eigentliche AP-Modus- und Upload-Logik gehört in die Tiny-Firmware; Morgendrot kann den **Prozess** beschreiben und optional eine **minimale Setup-UI** (z. B. eine statische Seite unter `/setup-tiny` oder in der Lite-UI) anbieten, die die generierte Config an ein fest konfiguriertes Gerät-URL sendet.

---

## 5. Präzise Zusammenfassung für die Umsetzung

### A. Role-Based UI (Struktur)

1. **Routen/Layout nach Rolle (vom Backend):**  
   Beim Laden der App `status.role` vom Backend nutzen (nicht nur manuellen Toggle).  
   - **Boss:** Eine Ansicht „Kontrollzentrum“ (Geräteliste, + Gerät, Rebate, Gerät-Sidebar mit Befehlen/Verlauf).  
   - **Kommandant:** Eine Ansicht „Management“ (Gruppen/Sektoren, Kommando-Eingabe mit Dropdowns, globaler Verlauf).  
   - **Arbeiter (und ggf. Wärter):** Eine Ansicht „Terminal“ (Status, 2–3 Buttons, letzte Aktionen). Keine Navigation zu Wizard/Keys/Streams-Kacheln.

2. **Drei-Spalten-Layout (pro Rolle):**  
   - Links: Navigator (Geräte/Gruppen).  
   - Mitte: Fokus (Wizard, Kommando-Maske oder Quick-Actions).  
   - Rechts: **Timeline** (Audit-Events, live oder Polling), mit Icons und humanisierten Zeiten; Adressen klickbar/kopierbar.

3. **Technik im Hintergrund:**  
   Säule 1–5 und Wallet-Bridge bleiben unverändert; die UI ruft weiter die bestehenden APIs auf, zeigt aber nur die zur Rolle passenden Bereiche und formatiert sie rollenspezifisch (z. B. Klarnamen für Geräte, Dropdowns statt Freitext wo möglich).

### B. Identitäts-Dilemma (Tiny)

- **Move:** `TicketUsed` um optionales Feld `device_origin_id` (z. B. `vector<u8>`) erweitern; Entry-Funktion so anpassen, dass das Gateway diese ID mitsendet.  
- **chain-access + Settlement-Queue:** Beim Aufruf von `use_ticket` / Batch die deviceId des Tiny als `device_origin_id` übergeben und in der TX an Move durchreichen.  
- **Audit/Export:** In CSV/PDF und in der Timeline das Feld „Gerät (Origin)“ anzeigen, sobald es aus dem Chain-Event auslesbar ist.

### C. Wizard-Realitätscheck (Tiny-Provisioning ohne WLAN)

- **Dokumentation:** Im Wizard oder in der Doku einen klaren Schritt „Tiny ohne WLAN“: AP-Modus (z. B. WLAN „MORGENDROT_SETUP“), Verbindung mit Handy/PC, Config-Upload.  
- **Optional:** Minimale Setup-Seite (z. B. unter `/setup-tiny` oder in der Lite-UI), die die generierte Config (identity.h / JSON) per POST an eine konfigurierbare Geräte-URL sendet (z. B. `http://192.168.4.1/config`). Die Tiny-Firmware bleibt eigenes Projekt (C/ESP32).

---

## 6. Kurzbewertung

| Thema | Sinn? | Anmerkung |
|-------|--------|-----------|
| Rollen-basiertes UI (Boss/Kommandant/Arbeiter getrennt) | **Ja** | Reduziert Klick-Chaos, Fokus auf Rolle. |
| Drei-Spalten (Navigator / Fokus / Verlauf) | **Ja** | Passt zu bestehendem Audit-Log; Timeline-Komponente fehlt noch. |
| device_origin_id im Move-Event | **Ja** | Beweissicherung on-chain; erfordert Move + SDK + Queue-Anpassung. |
| Wizard + AP-Modus für Tiny | **Ja** | Klassisches IoT-Provisioning; Morgendrot: Anleitung + optional minimale Setup-UI; AP + Upload-Logik in Tiny-Firmware. |

Damit sind die beschriebenen Ideen **kritisch geprüft und sinnvoll**. Die obige Zusammenfassung kann als Vorlage für konkrete Implementierungsschritte (UI-Refactoring, Move-Änderung, Doku/Setup-Seite) dienen.
