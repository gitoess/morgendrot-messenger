# GitHub — Repository „About“ (Settings)

**Kanonische Texte:** `docs/POSITIONING.md`  
**Repo:** https://github.com/gitoess/morgendrot-messenger

GitHub speichert Beschreibung/Topics **nicht** im Git-Tree — hier Copy-Paste für **Settings → General → About** (Stift-Symbol rechts oben auf der Repo-Startseite).

---

## Description (max. 350 Zeichen)

```
Boss-geführtes Einsatz-Messenger: LoRa/Meshtastic im Feld + IOTA (Mailbox, Archiv, Delayed LoRa→Tangle). PWA/Next.js, Handoff in unter 20 Sekunden. Getrennte Builds: Messenger (Einsatz) & Morgendrot Projekt (Plattform).
```

Kürzer (nur Einzeiler aus POSITIONING):

```
Boss-geführtes Einsatz-Messenger: LoRa/Meshtastic (Feld-Default) + IOTA (Mailbox, Archiv, Delayed LoRa→Tangle) + Handoff in unter 20 Sekunden.
```

---

## Website

```
https://github.com/gitoess/morgendrot-messenger#readme
```

(Optional später: eigene Docs-URL oder Projektseite — dann hier ersetzen.)

---

## Topics (Tags)

Kommagetrennt eintragen (max. 20):

```
emergency-comms
meshtastic
lora
pwa
offline-first
team-messaging
iota
messaging
typescript
nextjs
```

---

## Releases / Packages

- **Releases:** nur bei echten Versionen (Tags + Notes); nicht Pflicht für Dev-Repo.
- **Packages:** leer lassen, sofern nichts auf GitHub Packages veröffentlicht wird.

---

## CLI (falls `gh` installiert)

```bash
gh repo edit gitoess/morgendrot-messenger \
  --description "Boss-geführtes Einsatz-Messenger: LoRa/Meshtastic im Feld + IOTA (Mailbox, Archiv, Delayed LoRa→Tangle). PWA/Next.js, Handoff in unter 20 Sekunden. Getrennte Builds: Messenger (Einsatz) & Morgendrot Projekt (Plattform)." \
  --homepage "https://github.com/gitoess/morgendrot-messenger#readme" \
  --add-topic emergency-comms --add-topic meshtastic --add-topic lora \
  --add-topic pwa --add-topic offline-first --add-topic team-messaging \
  --add-topic iota --add-topic messaging --add-topic typescript --add-topic nextjs
```

`gh` unter Windows: https://cli.github.com/ — danach `gh auth login`.

---

## Checkliste nach dem Speichern

- [ ] Beschreibung erscheint unter dem Repo-Namen auf GitHub
- [ ] Topics sind klickbar (Discovery)
- [ ] Website-Link öffnet README-Anker
- [ ] README-Einstieg verweist auf `docs/DEV-START.md`, `docs/PRODUCT-MESSENGER-VS-PROJEKT.md`, **`docs/ROADMAP-FAHRPLAN.md`** § **H.3o** (Meshtastic-Verschlüsselung), § **B4** (Telegram-Backlog) (Ist-Stand 2026-05)
