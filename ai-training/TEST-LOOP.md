# Test-Loop: 20 typische Nutzerfragen

Vergleiche erwartete Antwort mit tatsächlicher KI-Ausgabe → Modelfile/Intent/Regeln anpassen.

| # | Nutzerfrage | Erwartete Antwort (ACTION / JSON) |
|---|-------------|-----------------------------------|
| 1 | Lass Gast 0x0748... rein | /create-key \<LOCK_ID\> 0x0748... 30 |
| 2 | Sende nachricht Ki läuft an 0x0748... | /send-plain 0x0748... Ki läuft |
| 3 | Schick heyyy an 0x0748... | /send-plain 0x0748... heyyy |
| 4 | sende 1 iota an 0xABC... | /transfer-coins 0xABC... 1 |
| 5 | Verschlüsselt an 0xY senden | /handshake 0xY... |
| 6 | Keys sichern | /vault-save |
| 7 | Handshake an 0x... | /handshake 0x... |
| 8 | Verbinde mit 0x... | /connect 0x... |
| 9 | Letzte 20 Nachrichten | /fetch 20 |
| 10 | Ticket für Event an 0x... | /create-ticket \<event_id\> ... 0x... |
| 11 | Purge Key 0x... | /purge-key 0x... |
| 12 | Package-ID setzen | /set-package-id 0x... |
| 13 | Was sind die 4 Säulen? | Text nur (kein Befehl) oder REASON |
| 14 | Hilf mir | Text nur oder ? |
| 15 | Message 0x... Hallo | /send-plain 0x... Hallo |
| 16 | Access 0x... 7 Tage | /create-key \<LOCK_ID\> 0x... 7 |
| 17 | Klartext an 0x... senden | /send-plain 0x... \<Text\> |
| 18 | Nach Verbindung: Nachricht senden | /send \<Text\> |
| 19 | Liste Keys | /list-keys |
| 20 | Liste Tickets | /list-tickets |

**Ausführung:** Frage in Copilot eingeben → Antwort prüfen (suggestedAction oder JSON action) → bei Abweichung: Few-Shot/Regeln/Intent anpassen.
