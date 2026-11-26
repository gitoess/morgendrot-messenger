# IOTA-Messenger Solo-Wizard — Vorschlag (kritisch, 2026-11-26)

**Status:** Spec + **Wanderer-Pfad Ist** (2026-11-26) — Willkommen → Tresor → IOTA → optional Telegram → optional Funk → Fertig-Checkliste.  
**Nicht:** § H.36 Team/Helfer-Wizard. **Reuse:** Unlock-Dialog, `StandaloneSoloWizardCard`, Boss-TG-Schritt (Token/Chat-ID), Onboarding-Host (`peerMessengerOnly` → wanderer).

---

## Ziel

Ein **linearer Solo-Assistent**: Tresor → IOTA → optional Telegram → optional Funk. Nach jedem Block: **Weiter / Überspringen**. Am Ende: IDs sichtbar, Einstellungen befüllt — kein zweites Experten-Labyrinth.

---

## Kritische Bewertung des User-Vorschlags

| Idee | Urteil | Verbesserung |
|------|--------|--------------|
| Infobox mit Bot-Token, Funk, … gleich am Start | **Zu früh / riskant** — Secrets ohne Kontext; Funk braucht Radio | Infobox = **Zusammenfassung am Ende** (+ optional Export). Secrets **pro Schritt** eingeben |
| Alles automatisch in „Expertenmodus“ | Expertenmodus ist Filter, kein Ziel | Werte in **Runtime / Prefs / normale Einstellungen**; Expert nur wenn nötig |
| Seed speichern, Import, PW | **Kern — zuerst** | Wiederverwendet Unlock/Vault-Flows (`ONBOARDING-WALLET-UX-SPEC`) |
| IOTA → TG → Funk getrennt + Skip | **Gut** | Reihenfolge verbindlich; Skip speichert „nicht eingerichtet“ |
| Einstellungen durchgehen + Mailbox anlegen + ID zeigen | **Gut** | Jeder Schritt = 1 Aktion + Ergebniszeile (ID/Status), Link „in Einstellungen öffnen“ |

**Nicht im Wizard:** Drehrad/Handy-UI, Visitenkarte/Avatar, Boss-Handoff, TG-Bot-Gruppenchat.

---

## Vorgeschlagene Schritte

0. **Willkommen** (1 Screen): Was der Wizard tut / was er nicht tut (kein Chatverlauf-Backup).  
1. **Tresor** — Neu anlegen **oder** Import **oder** Entsperren; PW; optional Seed in Vault (Schalter). Toast „Tresor sichern?“  
2. **IOTA** — RPC/Testnet-Hinweis; `PACKAGE_ID` / `MAILBOX_ID` eintragen **oder** „Mailbox anlegen“ → **ID sofort anzeigen** + kopieren; Absender aus Wallet.  
3. **Telegram?** → Weiter / Überspringen. Bot-Token + eigene Chat-ID (Runtime); optional Alarmgruppe später. Hinweis: Token ≠ Vault.  
4. **Funk?** → Weiter / Überspringen. Nur App-Hinweise (Meshtastic Region/PSK) + Kanalindex-Pref; **kein** PSK in Morgendrot.  
5. **Fertig-Infobox** — Checkliste: Vault ok · Package/Mailbox · TG · Funk · „Tresor-Backup jetzt?“ · Deep-Links in Einstellungen.

---

## UX-Regeln

- Ein Schritt = eine Karte; Skip immer sichtbar.  
- Kein Mega-Form am Anfang.  
- Resume: Progress in `onboarding-progress-store` (Edition-Pfad `peer`/`messenger`).  
- Nach Wizard: normaler Chat; Wizard erneut nur über Einstellungen / „Einrichtung“.

---

## Sicherheit

- Bot-Token nur Runtime-Datei; optional später Vault-Opt-in (siehe Backup-Handbuch).  
- Seed nie in Infobox-Klartext nach Abschluss.  
- Funk-PSK bleibt in Meshtastic-App.

---

## Abgrenzung Ist

| Ist | Wizard-Soll |
|-----|-------------|
| Unlock + Recovery-Dialog | Schritt 1 orchestriert |
| Einstellungen → IOTA / TG / Funk | Schritte 2–4 führen dorthin |
| H.36 Boss/Helfer | **aus** für iota-messenger |

**Nächster Bau-Schnitt (wenn Start):** Schritt 0–2 MVP (Tresor + IOTA/Mailbox-ID-Anzeige), TG/Funk erst danach.
