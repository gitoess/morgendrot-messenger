# Telegram in Morgendrot einrichten

Telegram ist ein **optionaler Zustellkanal** für Systemalarme (Monitor) und Kurz-Hinweise — **kein Ersatz** für den Messenger-Chat auf IOTA/LoRa.

## Was die Einstellungen können

- **System-Alarme (Monitor):** Push in deine Telegram-App bei konfigurierten Sensoren.
- **„Test an mich“:** Schickt eine Testmeldung in **deinen** Chat mit dem Bot (nicht in Morgendrot angezeigt).
- **Partner-Hinweise:** Chat-ID im **Telefonbuch**; im Chat Schalter „Telegram-Hinweis“.

Es gibt in den Einstellungen **kein Nachrichtenfeld** — alles läuft über die Telegram-App.

## Schritt für Schritt

1. Bei **@BotFather** einen Bot anlegen → **Token** kopieren.
2. In Telegram den Bot öffnen → **Start** tippen.
3. **Chat-ID** holen (z. B. von **@userinfobot**).
4. In Morgendrot unter **Einstellungen → Integrationen · Telegram:** Schalter **System-Alarme** an, Token und Chat-ID eintragen → **Speichern**.
5. **Optional (Monitor):** Zweites Terminal: `npm run telegram-webhook` (nur wenn du den Relay/Webhook-Pfad nutzt).
6. **Test an mich** → Meldung in deiner Telegram-App prüfen.
7. **Partner:** Chat-ID im Telefonbuch hinterlegen; im Chat „Telegram-Hinweis“ aktivieren.

## Eingehende Partner-Antworten

- **Long Polling (empfohlen lokal):** Läuft im API-Server (`npm run dev`). Nach Speichern ggf. Backend neu starten.
- **Webhook:** Braucht öffentliche HTTPS-URL.
- **Aus:** Nur Senden, keine Antworten in Morgendrot.

Nur Chats aus dem **Telefonbuch** (hinterlegte Telegram Chat-ID) werden verarbeitet.

## Technik & Zielbild

Ausführliche Spezifikation (Architektur, Phasen, Sicherheit): `docs/TELEGRAM-INTEGRATION-ZIELBILD.md` im Repository.
