# Telegram einrichten (kurz)

Optionaler **Hinweis-Kanal**. Kein Ersatz für IOTA-Chat oder Funk.

Vollständige Einstellungs-Erklärung: **`EINSTELLUNGEN-NUTZER-HANDBUCH.md`** → Telegram.

---

## Bot + ich (alle)

1. @BotFather → Token  
2. Bot in Telegram öffnen → **Start**  
3. Eigene Chat-ID von @userinfobot  
4. **Einstellungen → Telegram:** Token + Chat-ID → Speichern  
5. **Test an mich** → Meldung in der Telegram-App  

System-Alarme = nur Monitor. Für Chat-Hinweise reicht Token + Long Polling (Schalter Alarme kann aus).

**Token ersetzen:** speichert nur den neuen; alt+neu parallel geht nicht.

---

## Partner

Telegram-Chat-ID im **Telefonbuch**. Dann:

- Antworten per Long Polling → Posteingang, oder  
- Schalter **„Nach IOTA-Chat: Telegram-Push an Kontakt“** (1:1 Online-Send).

**Test an Kontakt** = Probe an eine eingegebene Partner-ID (≠ Test an mich).

---

## Einsatz-Alarmgruppe (nur Boss)

1. Telegram-Gruppe + Bot als Admin (Nachrichten senden)  
2. Permanenter Link `https://t.me/+…`  
3. Optional Gruppen-Chat-ID `-100…`  
4. Einstellungen → Einsatz-Alarmgruppe → Speichern  

Helfer: Link aus Handoff / Posteingang — Beitritt optional. Nur Kurz-Hinweise in der Gruppe (kein Seed, keine volle SOS-Lage).

---

## Long Polling vs. Webhook

| Modus | Wann |
|-------|------|
| Long Polling | Lokal / Boss-PC — empfohlen |
| Webhook | Nur mit öffentlicher HTTPS-URL |
| Aus | Nur Senden, keine Antworten in Morgendrot |

Nach Speichern ggf. `npm run dev` neu, wenn Poll nicht startet.

---

*Stand: 2026-11-12*
