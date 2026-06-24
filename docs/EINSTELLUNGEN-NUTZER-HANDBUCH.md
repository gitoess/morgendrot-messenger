# Einstellungen — Nutzerhandbuch

Kurzreferenz für die Messenger-Einstellungen. Die Oberfläche zeigt nur Felder und Aktionen; Details stehen hier.

---

## Allgemein

### Sprache

Anzeigesprache für Menüs und Dialoge — auch im Entsperr-Fenster oben rechts.

### Einstiegs-Wizard

Geführter Erststart für **Boss/Einsatzleitung** und **Wanderer (Privat)** — Schritt für Schritt: Adresse, IDs, Postfächer, Telegram, Funk.

**Helfer** nutzen keinen Wizard: Handoff-ZIP vom Boss importieren (Einstellungen → Import).

### Erscheinungsbild

- **Standard** — ziviles Dienst-UI, Blau-Grau mit Morgendrot-Grün
- **Taktisch** — Oliv/Amber, NVG-Nachtbetrieb
- **Hoher Kontrast** — Schwarz/Weiß/Gelb für Sonne und Handschuhe
- **Hell** — Innenräume, Einsatzleitung am PC
- **Eigene Farben** — freie Wahl für Hintergrund, Primär, Akzent, Rahmen und Sendepfad-Farben

Einsatz-Branding (THW/POL-Badge) bleibt zusätzlich sichtbar.

### Volle Oberfläche

Alle Funktions-Kacheln im Dashboard anzeigen — wird in diesem Browser gespeichert.

---

## IOTA (Online / Chain)

### Netzwerkprofile (Boss)

**Übung** = Testnet, **Produktion** = Mainnet. Package-ID und RPC werden aus Deploy-Dateien übernommen.

### Adresse & Package

Deine IOTA-Adresse (0x+64 Hex), Package-ID des Move-Pakets, optional Direkt-Send im Browser.

### Postfächer

| Typ | Bedeutung |
|-----|-----------|
| **Server-Postfach** | Gemeinsames Einsatz-Postfach des Betriebs — immer sichtbar |
| **Team** | Geteiltes Postfach; Beitritt per ID/QR (erstellt meist die Leitung) |
| **Privat** | Nur dein Wallet; du erstellst sie selbst |

**Fokus-Mailbox:** Genau eine steuert Senden und welcher Posteingang zuerst geladen wird. Ohne Fokus gilt das Server-Postfach.

### Tresor

Lokal sichern, auf Chain sichern, Passwort ändern, Tresor sperren.

---

## Funk (Meshtastic)

Puls, Heartbeat, Node-ID und Kanal — getrennt von IOTA/Online.

---

## Telegram

| Feld | Wer | Zweck |
|------|-----|--------|
| **Bot-Token** | Boss | Bot für Relay und Alarme |
| **Admin-Chat-ID** | Alle | Deine persönliche Chat-ID für Tests und Alarme |
| **Einsatz-Alarmgruppe** | Boss | Gruppen-Einladung, Chat-ID, Fan-out an Team |
| **Gruppe beitreten** | Helfer/Wanderer | Einladungslink vom Boss, eigene Mitgliedschaft |

**Hinweis:** Die Gruppen-Chat-ID erscheint beim Boss nur einmal im Formular „Einsatz-Alarmgruppe“. Helfer tragen ihre Gruppen-ID nach dem Beitritt unter „Gruppe beitreten“ ein.

---

## Helfer einrichten (Einsatzleitung)

### Drei Wege

1. **Handoff-ZIP** — Boss exportiert Profil, Rechte, Team, Partner. Helfer importiert (Standard).
2. **Spontan** — Helfer: Beitrittsanfrage (Einstellungen → Import). Boss: Einsatzleitung → Freigeben → Team-Update an alle.
3. **Telefonbuch** — Kontakt mit Funk-ID/Telegram → initialProfile JSON oder Mesh-Backup verteilen.

### Daten zurück zum Boss

| Quelle | Was kommt zurück |
|--------|------------------|
| Team-Update (`MORG_TEAM_MEMBER_UPDATE_V1`) | meshNodeId, telegramChatId, Name — Posteingang Ja/Nein |
| Beitrittsanfrage | Optional Funk + Telegram in der Anfrage; bei Freigabe ins Telefonbuch |
| Registry | Nur Boss-seitig: provisionierte Geräte (Adresse, Label) — kein Live-Sync |

Meshtastic-Kanal-PSK wird **nicht** in Morgendrot gespeichert — nur in der Meshtastic-App (identisch auf allen Geräten).

---

On-Chain-Vault-Purge ist unwiderruflich. Nur bei dokumentiertem Notfall.

---

*Stand: 2026-06-24*
