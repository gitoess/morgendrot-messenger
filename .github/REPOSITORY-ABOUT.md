# GitHub — Repository „About“ (Settings)

**Kanonische Texte:** `docs/POSITIONING.md`  
**Repo:** https://github.com/gitoess/morgendrot-messenger

GitHub speichert Beschreibung/Topics **nicht** im Git-Tree — hier Copy-Paste für **Settings → General → About** (Stift-Symbol rechts oben auf der Repo-Startseite).

---

## Description (max. 350 Zeichen)

**Empfohlen (Hobby + Technik):**

```
Experimental hobby messenger: LoRa/Meshtastic + IOTA mailbox/PWA. AGPL-3.0; not a finished product; no store builds. Boss handoff, offline-first. Commercial use requires permission.
```

Deutsch (falls gewünscht):

```
Experimenteller Hobby-Messenger: LoRa/Meshtastic + IOTA (Mailbox, PWA). AGPL-3.0, kein fertiges Produkt, nur Sideload. Kommerzielle Nutzung nur mit Erlaubnis.
```

Technik-Einzeiler (kurz):

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
experimental
hobby-project
agpl-3.0
```

---

## Releases / Packages

- **Releases:** nur **experimental** (`v*-experimental`), Draft + Pre-release — siehe `docs/HOBBY-RELEASE-POLICY.md`
- **Nicht** in Hobby-Releases: Verkaufs-Bundle (`sales`), `.env`, Handoff-Secrets
- **Packages:** leer lassen, sofern nichts auf GitHub Packages veröffentlicht wird

---

## CLI (falls `gh` installiert)

```bash
gh repo edit gitoess/morgendrot-messenger \
  --description "Experimental hobby messenger: LoRa/Meshtastic + IOTA mailbox/PWA. AGPL-3.0; not a finished product; no store builds. Commercial use requires permission." \
  --homepage "https://github.com/gitoess/morgendrot-messenger#readme" \
  --add-topic emergency-comms --add-topic meshtastic --add-topic lora \
  --add-topic pwa --add-topic offline-first --add-topic team-messaging \
  --add-topic iota --add-topic messaging --add-topic typescript --add-topic nextjs \
  --add-topic experimental --add-topic hobby-project --add-topic agpl-3.0
```

`gh` unter Windows: https://cli.github.com/ — danach `gh auth login`.

---

## Checkliste nach dem Speichern

- [ ] Beschreibung erwähnt **experimental / hobby** (nicht nur Produktfeatures)
- [ ] Topics `experimental`, `hobby-project`, `agpl-3.0` gesetzt
- [ ] README-Disclaimer sichtbar (`DISCLAIMER.md` verlinkt)
- [ ] Releases nur nach `docs/HOBBY-RELEASE-POLICY.md`
