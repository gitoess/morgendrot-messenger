# Telegram in Morgendrot einrichten

Telegram ist ein **optionaler Zustellkanal** für Systemalarme (Monitor), Kurz-Hinweise an Partner — und seit **B4b** für die **Einsatz-Alarmgruppe** (SOS, Team-Updates). **Kein Ersatz** für den Messenger-Chat auf IOTA/LoRa.

## Was die Einstellungen können

- **System-Alarme (Monitor):** Push in deine Telegram-App bei konfigurierten Sensoren.
- **„Test an mich“:** Schickt eine Testmeldung in **deinen** Chat mit dem Bot (nicht in Morgendrot angezeigt).
- **Partner-Hinweise:** Chat-ID im **Telefonbuch**; im Chat Schalter „Telegram-Hinweis“.
- **Einsatz-Alarmgruppe (Boss):** Eine Telegram-Gruppe für Team-weite Hinweise — SOS, Team-Update, wichtige Meldungen der Einsatzleitung.

Es gibt in den Einstellungen **kein Nachrichtenfeld** — alles läuft über die Telegram-App.

## Schritt für Schritt (Bot & persönlicher Chat)

1. Bei **@BotFather** einen Bot anlegen → **Token** kopieren.
2. In Telegram den Bot öffnen → **Start** tippen.
3. **Chat-ID** holen (z. B. von **@userinfobot**).
4. In Morgendrot unter **Einstellungen → Integrationen · Telegram:** Schalter **System-Alarme** an, Token und Chat-ID eintragen → **Speichern**.
5. **Optional (Monitor):** Zweites Terminal: `npm run telegram-webhook` (nur wenn du den Relay/Webhook-Pfad nutzt).
6. **Test an mich** → Meldung in deiner Telegram-App prüfen.
7. **Partner:** Chat-ID im Telefonbuch hinterlegen; im Chat „Telegram-Hinweis“ aktivieren.

## Einsatz-Alarmgruppe (Boss, B4b)

Für **Team-weite** Hinweise — nicht für den 1:1-Partner-Chat.

### Telegram-Gruppe anlegen

1. In Telegram eine **neue Gruppe** erstellen (z. B. „Einsatz Team Alpha“).
2. Den **Morgendrot-Bot** zur Gruppe hinzufügen und als **Administrator** mit Recht **Nachrichten senden** einstellen.
3. **Permanenter Einladungslink** (nicht BotFather):
   - Gruppe öffnen → **Gruppeninfo** → **Einladungslink** → **Link erstellen** (oder bestehenden kopieren).
   - Format: `https://t.me/+AbCdEfGh…` (privater Link mit `+`).
4. **Gruppen-Chat-ID** (optional, für Tests): Bot in die Gruppe, dann z. B. `@getidsbot` oder API — typisch `-100…`.

### In Morgendrot konfigurieren

**Einstellungen → Telegram → Einsatz-Alarmgruppe:**

| Feld | Inhalt |
|------|--------|
| Alarmgruppe aktiv | Schalter an |
| Bezeichnung | z. B. „Einsatz Team Alpha“ |
| Permanenter Einladungslink | `https://t.me/+…` aus Schritt 3 |
| Gruppen-Chat-ID | `-100…` (für „Test an Gruppe“ / Zustellung) |

**Speichern** → optional **An Team senden** (Wire `MORG_TELEGRAM_ALARM_GROUP_V1` an Team-Mailbox).

### Helfer-Beitritt

- **Erst-Handoff:** Link steht im ZIP (`README-HANDOFF.txt`) und in `.morgendrot-handoff-extras.json`.
- **Später:** Systemkarte im Posteingang nach Boss-Update.
- **Onboarding-Wizard:** Schritt „Telegram-Alarmgruppe“ — Button **Gruppe beitreten** öffnet Telegram (kein automatischer Beitritt).

**Regel:** Beitritt ist **optional**. In der Gruppe stehen nur **Kurz-Hinweise** — keine Mnemonics, keine volle SOS-Lage, kein Wiederholen des Einladungslinks in Gruppennachrichten.

### Boss-Aktionen

| Button | Wirkung |
|--------|---------|
| **Team alarmieren** | Kurz-Hinweis an die Alarmgruppe („Morgendrot prüfen“) |
| **Test an Gruppe** | Testnachricht in der konfigurierten Gruppe |
| **An Team senden** | Vollständiger Wire + optional Funk-Ping |

Bei **SOS** im Messenger wird die Alarmgruppe **zusätzlich** per API benachrichtigt (wenn aktiv und Chat-ID gesetzt).

## Eingehende Partner-Antworten

- **Long Polling (empfohlen lokal):** Läuft im API-Server (`npm run dev`). Nach Speichern ggf. Backend neu starten.
- **Webhook:** Braucht öffentliche HTTPS-URL.
- **Aus:** Nur Senden, keine Antworten in Morgendrot.

Nur Chats aus dem **Telefonbuch** (hinterlegte Telegram Chat-ID) werden verarbeitet.

## Technik & Zielbild

Ausführliche Spezifikation (Architektur, Phasen, Sicherheit): `docs/TELEGRAM-INTEGRATION-ZIELBILD.md` im Repository. Team-Wizard: `docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md`.
