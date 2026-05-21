# Sendewege: Kanäle (1:1, Gruppe, Pinnwand) × Speicher × Mailbox

**Stand:** 2026-05  
**UI:** Posteingang → **Meine Mailboxen** → „Übersicht: Kanäle, Speicher & Mailboxen“

---

## Die drei Ebenen (nicht vermischen)

| Ebene | Frage | Beispiele |
|-------|--------|-----------|
| **1 — Kanal** | Welche **UI-Ansicht** / welches Produkt? | 1:1 Privat, Gruppenchat, Pinnwand |
| **2 — Speicher** | Bleibt die Nachricht in einer **Mailbox** on-chain? | Flüchtig (Event) vs. Persistent (Mailbox) |
| **3 — Ziel-Mailbox** | **Welches Postfach-Objekt** (bei Persistent)? | Server-Shared, Team, Private, Kontakt-Mailbox |

**Verschlüsselung** ist eine **vierte** Achse (Handshake zwischen zwei Wallet-`0x`), unabhängig von Kanal und Mailbox-Typ.

---

## Kanäle (UI)

| Kanal | Ist-Zustand | Posteingang | Senden |
|-------|-------------|-------------|--------|
| **1:1 Privat** | Standard-Dialog | Partner-Filter, alle Transporte | Empfänger-`0x`; Event/Mailbox-Umschalter sichtbar (online) |
| **Gruppenchat** | **M2a** — kein Chain-Gruppenraum | Union aller **Mitglieder-0x** im Posteingang | **Persistent + online:** optional **„Mailbox an alle Mitglieder“** → pairwise an jede 0x (`group-mailbox-pairwise-send.ts`); sonst eine 0x im Composer; Streams-Anchor optional |
| **Pinnwand** | **M3** — Broadcast | Klartext-Filter, Broadcast-Adresse | Empfänger = `BROADCAST_PINNWAND_ADDRESS`; UI erzwingt Klartext; Funk-Broadcast möglich |

**Wichtig:** Gruppenchat ≠ Shared Mailbox „für alle“. Gruppe = **lokale Mitgliederliste** + gefilterter Posteingang. Pinnwand ≠ Gruppe — Brett mit autorisierten Sendern.

---

## Speicher (nur online, Kanal 1:1 + Gruppe)

| Modus | On-chain | Purge/Rebate |
|-------|----------|--------------|
| **Flüchtig (Event)** | `PlaintextMessage` / `EncryptedMessage` Events | anders als Mailbox-DF |
| **Persistent (Mailbox)** | Dynamic Fields unter Mailbox-Object-ID | Mailbox-Purge möglich |

Umschalter **„Speicher auf der Chain“** erscheint bei **1:1 Privat** und **Gruppenchat** (online), **nicht** bei Pinnwand (dort Klartext-Hinweise).

---

## Mailbox-Ziele (Persistent)

| Typ | Immer im Posteingang? | Aktiv für Senden? | On-chain Mitgliedschaft |
|-----|----------------------|-------------------|-------------------------|
| **Server-Shared** (`.env` `MAILBOX_ID`) | **Ja** | Nein (Fallback wenn nichts aktiv) | Alle am gleichen Server-Einsatz |
| **Team-Mailbox** | Nur wenn **aktiv** | **Ja** | **Nein** — wer die Object-ID hat, kann lesen/schreiben (organisatorisch absichern) |
| **Private Mailbox** | Nur wenn **aktiv** | **Ja** | Owner = deine Wallet |
| **Kontakt-Mailbox** (Telefonbuch, M4e) | — | **Gewählter Slot** im Composer | Bis zu vier IDs: Shared / Privat / Team / Puffer |

**Senden (Persistent):** Dropdown **Ziel-Postfach** (Kontakt-Slot oder „meine aktive“ / Server-Shared) → `resolveOutboundMailboxObjectId`; leerer Slot → Fallback aktiv → Server-`MAILBOX_ID`.

**Posteingang-Union:** Server-Shared **immer** + höchstens **eine** aktive Team- oder Private-Mailbox (nicht alle Team-Einträge parallel).

---

## Korrekturen zur vereinfachten Tabelle

| Vorstellung | Realität |
|-------------|----------|
| „Shared = Gruppenchat“ | Shared = **ein Postamt pro Server**; Nachrichten sind **pairwise** (sender/recipient). Gruppenchat = **UI-Filter** über mehrere 0x. |
| „Team = nur Mitglieder sehen“ | On-chain gibt es **keine** Mitgliederliste — **Object-ID teilen** = Zugang (wie ein gemeinsames Postfach-Passwort). |
| „Gruppenchat voll umgesetzt“ | **Archiv/Überblick ja**; Mailbox-Multicast = **N× pairwise** (2026-05); 1× Fee nur mit Team-Broadcast (Backlog, `TEAM-MAILBOX-BROADCAST-1TX-KONZEPT.md`). |
| „Pinnwand nur Klartext“ | **UI-Policy ja**; technisch kann Mailbox-Pfad auch verschlüsselt — für Brett unüblich. |
| „Event = nur 1:1“ | Ja für **online**-Pfad; Pinnwand/Gruppe nutzen andere Sendelogik (Funk / Broadcast). |

---

## Wann was wählen?

| Situation | Empfehlung |
|-----------|------------|
| Schnelle 1:1-Absprache, kein Archiv | 1:1, online, **Flüchtig (Event)** |
| Einsatz-Standard, alle am Server | 1:1 oder Gruppe, **Persistent**, aktiv = Server (oder nichts aktiv) |
| THW getrennt von Feuerwehr | **Team-Mailbox** erstellen/beitreten, **aktiv** setzen |
| Persönlich / nur ausgewählte Kontakte | **Private Mailbox**, ID im QR/Telefonbuch |
| Lagebild für alle | **Pinnwand**, Klartext, autorisierte Sender |

---

## Verweise

- `docs/MESSENGER-KANAL-MAILBOX-MEILENSTEINE.md` (M1–M4)
- `docs/TEAM-MAILBOXES.md`
- `docs/MAILBOX-BEGRIFFE-UND-NUTZUNG.md`
- `docs/BROADCAST-PINNWAND.md`
