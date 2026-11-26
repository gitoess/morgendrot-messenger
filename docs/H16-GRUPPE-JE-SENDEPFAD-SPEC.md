# H.16 — Gruppe verwalten je Sendepfad (Spec / Skizze)

**Stand:** 2026-11-26 · **Status:** S0–S2 Teil-Ist (Tabs im Sheet, gleiche Stores).  
**Ort UI:** Sheet „Gruppe verwalten“ (`ChatViewGroupSettingsSheet` → `ChatViewGroupPanel`) mit Tabs IOTA / Funk / Telegram.  
**Verwandt:** `docs/IDEEN-BACKLOG.md` · Chat-Handbuch FAQ 5–6 · `docs/CHAT-GRUPPE-EINRICHTEN.md` (älter, .env-lastig).

---

## Problem

Eine „Gruppe“ meint in der Praxis **drei verschiedene Welten**:

| Welt | Was der Nutzer steuert | Persistenz |
|------|------------------------|------------|
| **IOTA** | Mitglieder `0x`, Team-/Shared-Mailbox, Enc vs Klar, Handshake 1:1 | Chain + lokales Telefonbuch |
| **Funk** | Meshtastic-Kanalindex 0–7, Name, PSK-Ref (PSK selbst in Meshtastic-App) | Lokal + Gerätekanal |
| **Telegram** | Alarmgruppen-Chat-ID / Label (Hinweis-Broadcast) | Runtime + Prefs — **kein** Bot-Gruppenchat |

Heute steckt IOTA + Funk-Meta oft in **einem** Sheet. Telegram-Alarm liegt unter **Einstellungen → Telegram**. Das verwirrt („eine Gruppe = alles?“).

---

## Zielmodell (ein Datensatz, drei Fenster)

```
GroupRecord (lokal + optional Sync-Felder)
├── id, displayName
├── iota: { memberAddresses[], mailboxObjectId?, mode: pairwise|team|plain }
├── mesh: { channelIndex?, channelName?, pskRef? }   // optional
└── telegramAlarm: { chatId?, label? }               // optional; Edition: oft ausgeblendet
```

**Drei Fenster / Tabs** (später UI):

1. **IOTA** — Mitglieder, Mailbox, Enc/Handshake (heutiger Kern von Gruppe verwalten).  
2. **Funk** — nur Kanal-Felder + Link „in Meshtastic prüfen“; kein Fake-PSK-Editor.  
3. **Telegram** — nur Alarm-ID/Label; Copy: „Hinweis, kein Chatverlauf hier“.

Composer-Sendepfad wählt weiterhin den **Transport**; die Fenster pflegen nur die **Kanal-Stammdaten**.

---

## Nicht-Ziele

- Kein Morgendrot-Gruppenchat über Telegram-Bot (`IDEEN-BACKLOG` — Entscheidung 2026-11-22).  
- Kein zweites „Mega-Wizard“ parallel zu Solo-Wizard / H.36.  
- Kein Umbau Wallet/IOTA-Aktivität; kein LoRa-Encode-Anfassen.  
- Keine Profilbilder an Gruppen jetzt.

---

## MVP-Schritte (Reihenfolge)

| Stufe | Was | Akzeptanz |
|-------|-----|-----------|
| **S0 Spec** | Dieses Dokument + Handbuch-Hinweis | **Ist 2026-11-26** |
| **S1 Copy** | Sheet-Beschreibung ehrlich | **Ist** |
| **S2 Tabs** | Drei Tabs im Sheet, gleiche Stores; Funk immer pflegbar; TG-Tab = Hinweis | **Ist 2026-11-26** (Vitest) |
| **S3 Edition** | IOTA-Messenger: Tab Telegram aus (`hideTelegramEinsatzAlarm`) | **Ist** (Cap blendet Tab) |

**Weiter:** kein Big-Bang an Wire/Handoff-`groupPaths`; Live kurz Gruppe speichern + Funk-Tab prüfen.

---

## Wire / Speicher

- **Keine** neue Wire-Version für S0–S1.  
- S2: weiter bestehende lokale Gruppen-Stores + Telefonbuch; Telegram weiter Prefs/`einsatzGroup*`.  
- Später optional: ein Export-Feld `groupPaths` im Handoff — **nicht** Teil von S0–S2.

---

## Claims (ehrlich)

| Claim | Wahr? |
|-------|--------|
| „Eine Gruppe = ein Chat überall“ | **Nein** — drei Transporte, ggf. verschiedene Mitglieder-Mengen |
| „Funk-PSK in Morgendrot setzen“ | **Nein** — nur Index/Name/Ref; PSK in Meshtastic |
| „TG-Alarm = Gruppenchat“ | **Nein** — nur Klingel/Hinweis |

---

## Verknüpfung

- Roadmap **H.16 / Gruppen** · Später-Tabelle Profilbild getrennt.  
- Caps: `hideTelegramEinsatzAlarm` blendet Telegram-Fenster in Edition aus.
