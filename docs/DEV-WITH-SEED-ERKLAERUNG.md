# „App starten und UI einmal befüllen“ – Erklärung

## Was macht `npm run dev:with-seed`?

**Ein Befehl, ein Terminal:** Backend (API), Next.js-UI und **einmaliges Befüllen** der UI laufen zusammen.

1. **Backend** startet (z. B. Port 3342), **Next.js-Frontend** (z. B. Port 3000) startet parallel.
2. Ein dritter Prozess **wartet**, bis die API erreichbar ist (bis zu 90 s).
3. Danach führt er **einmal** `npm run seed:ui` aus:
   - Keys und Tickets anlegen (Zugang → Schlüssel),
   - Nachrichten (Klartext) in die Mailbox schreiben,
   - Streams-Nachrichten veröffentlichen (Lite-UI → Streams → Fetch).

Nach dem Seed läuft nur noch Backend + Frontend weiter; das Seed-Skript beendet sich. Du musst **nicht** in einem zweiten Terminal `seed:ui` starten.

**Öffnen:** Next-UI z. B. http://localhost:3000, Lite-UI http://127.0.0.1:3342/

---

## Warum werden manchmal keine Nachrichten angezeigt?

Das Backend holt Nachrichten **von der Chain** (Mailbox/Events). Wenn du gerade `seed:ui` oder `dev:with-seed` ausgeführt hast und die UI zeigt „Keine neuen Nachrichten“:

1. **Verzögerung:** Die Chain braucht oft ein paar Sekunden, bis neue Events abrufbar sind. → **Nochmal „Aktualisieren“** im Posteingang klicken.
2. **Mailbox/Adresse:** Es werden nur Nachrichten geladen, bei denen **du der Empfänger** bist (`MY_ADDRESS`). Dieselbe Instanz muss senden und die gleiche `MAILBOX_ID` / `PACKAGE_ID` nutzen.
3. **Boss-Rolle:** Wenn du als **Boss** alle Nachrichten (auch an Kommandanten) sehen willst, in der UI **„Boss-Übersicht“** bzw. „Alle Nachrichten (Boss + Kommandanten)“ wählen – dann wird der Posteingang für Boss und alle eingetragenen Kommandanten-Adressen zusammengeführt.

Details und Fehlerbehebung: **`docs/STREAMS-UND-NACHRICHTEN-FAQ.md`**.
