# Standalone-Handy — Schnellstart (1 Gerät)

**Ziel:** Morgendrot-Messenger **ohne PC-Server** auf dem Android-Handy — Handoff + Seed + Direct-IOTA-Chat.

**APK:** `frontend/android/app/build/outputs/apk/debug/app-debug.apk` (Build: `cd frontend && npm run apk:debug:build`)

---

## Boss (PC, einmal pro Helfer)

1. Morgendrot Boss läuft (`npm run start:secrets` o. ä.)
2. **Einsatzleitung → Neues Gerät provisionieren**
3. Master-Passwort (Registry), Bezeichnung, Profil → **Generieren & Exportieren**
4. Helfer erhält: **Handoff-ZIP** + **Seed-QR** (60 s) — Details: `docs/GERAET-PROVISIONIEREN-WIZARD.md`

---

## Helfer (APK)

| Schritt | Aktion |
|--------|--------|
| 1 | APK installieren, App öffnen |
| 2 | **Basis-URL leer lassen** (Einstellungen → ggf. Eintrag löschen) |
| 3 | **Einstellungen → Handoff importieren** → Boss-ZIP |
| 4 | **Handoff übernehmen — weiter mit Mnemonic** (nicht „Import bestätigen“) |
| 5 | Dialog **Seed einrichten?** → **QR scannen** (oder Mnemonic tippen) |
| 6 | Optional: App-Passwort (8+ Zeichen) für späteres Entsperren |
| 7 | **Nachrichten** → Chat → senden/empfangen (Sendepfad **Direkt-RPC**) |

**Dauer Ziel:** ~2 Minuten nach ZIP auf dem Gerät.

---

## Prüfen ob Standalone aktiv ist

- Dashboard: Karte „Schritt 2: Wallet aktivieren“ verschwindet nach Seed
- Status: Hinweis „Standalone-APK aktiv — Direkt-RPC“
- Einstellungen → System-Identität: Package-ID und Mailbox gefüllt
- **Kein** „Ungültige API-Antwort“ beim Handoff

---

## Häufige Fehler

| Symptom | Lösung |
|---------|--------|
| „Ungültige API-Antwort“ beim Import | **Handoff übernehmen**, nicht „Import bestätigen“; Basis-URL leer |
| Kein Entsperren-Dialog | Handoff zuerst; dann Seed-Dialog (nicht alter Tresor-Dialog) |
| Package-ID leer | Handoff erneut importieren; App neu starten |
| Senden schlägt fehl | Seed eingerichtet? Fullnode im Handoff? Puls/Drain = an (automatisch nach Handoff) |
| Boss-PC nötig? | **Nein** für Chat nach Setup — nur für Provisionierung |

---

## Tests & Abnahme

- Checkliste: `docs/STANDALONE-SMOKE-CHECKLIST.md`
- Logbuch: `docs/TEST-RUN-LOGBOOK.md`
