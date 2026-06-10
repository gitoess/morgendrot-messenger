# Gruppenchat — Ist, Optionen, Empfehlung

**Stand:** 2026-06-02 · **Fahrplan:** **§ H.22 M2** · **Move-Backlog:** **`docs/TEAM-MAILBOX-BROADCAST-1TX-KONZEPT.md`**

---

## 1. Realistischer Stand heute (kritisch)

| Aussage | Bewertung |
|---------|-----------|
| Shared **`MAILBOX_ID`** = Deployment-Postfach für den **ganzen Einsatz** | **Ja** — ein Move-`Mailbox`-Object, **kein** dynamischer Gruppenraum |
| Messenger-**Gruppe (M2)** = lokale Mitgliederliste + Union-Filter + Pairwise-Senden | **Ja** — Tab **Gruppe**, `messenger-group-store.ts`, `group-mailbox-pairwise-send.ts` |
| Kein on-chain Thread, in den alle schreiben und **automatisch** alle lesen | **Ja** — Move speichert **`MsgKey(sender, recipient)`** pairwise |
| „Alle sehen alles in der Shared Mailbox“ | **Nein** — sichtbar ist nur, was **an mich** oder **von mir** adressiert ist |
| **`create_team_mailbox`** = Gruppenchat gelöst | **Nein** — weiter normales `Mailbox`-Object, **gleiche** Pairwise-Felder |
| Gruppenschlüssel / Team-E2EE | **Nein** — Backlog **M2c** / **§ H.23** |
| Streams-Anchor (M2b) | **Ja, aber nur Metadaten** — Vorschau bei Send (`/api/streams-publish`), **kein** Chat-Verlauf |

**Nutzen heute:** 3–6 Personen, **Klartext** oder Handshake mit **allen**, **Mailbox an alle** für Archiv, **Funk Secondary** für Echtzeit. Fühlt sich nicht wie Telegram an — **by design** (noch).

**Bugfix 2026-06-02:** Gruppen-Posteingang filterte Mitglieder nicht (`groupMemberFilter` war aus) — behoben in `use-chat-view-core.ts`.

---

## 2. Optionen — kritisch geprüft

### A. „Gemeinsame Gruppen-0x“ + App-Index

**Idee:** Alle senden an eine feste Gruppen-Adresse; App zeigt Thread.

**Kritik:** In Move-Mailbox ist **Empfänger** Teil des Schlüssels. Nachrichten **an** Adresse X sind für **Besitzer von X** bestimmt — nicht automatisch für alle Mitglieder lesbar, es sei denn:

- alle teilen denselben Private Key (**inakzeptabel**), oder
- ein Relay liest für alle (**zentral**), oder
- es ist faktisch **Pinnwand** (Broadcast-Adresse + Whitelist).

**Fazit:** Ohne Move-Änderung **kein** echter 1-TX-Gruppenraum. App-Index allein repariert Pairwise nicht.

### B. IOTA Streams / Channels (historisch)

**Idee:** Root/Branch-Channel, Mitglieder abonnieren.

**Ist in Morgendrot:** **M2b Streams-Anchor** = optionaler **Hinweis-Kanal** (Live/Monitor), **nicht** Posteingang. Alte Streams-Frameworks sind **nicht** der Messenger-Pfad; IOTA 2.0/Move = **Mailbox + Shared Objects**.

**Fazit:** Streams-Anchor **ergänzen** Archiv/Echtzeit-Hinweis — **ersetzen** keinen Gruppenchat.

### C. Move Shared Object / `store_team_broadcast` (**stärkster IOTA-Weg**)

**Idee:** `TeamMailbox` + Broadcast-DF ohne `recipient` im Key; Team-Key **off-chain** (Handoff/Vault).

**Ist:** Skizze in **`docs/TEAM-MAILBOX-BROADCAST-1TX-KONZEPT.md`**. **`create_team_mailbox`** existiert — **ohne** Broadcast-Entry.

**Fazit:** **Richtige** on-chain Richtung für **1 TX / alle lesen** — **M2c umgesetzt (2026-06)**, Klartext-MVP + Handoff `MESSENGER_GROUP_HANDOFF`.

### D. Hybrid Funk + IOTA (**Empfehlung für Einsatz heute**)

| Schicht | Rolle |
|---------|--------|
| **Funk (Meshtastic Secondary)** | Echtzeit, offline, echtes „Team-Gefühl“ |
| **IOTA Mailbox (pairwise oder künftig Broadcast)** | Archiv, Beweis, Nachladen |
| **Pinnwand** | Offizielle Lage (nicht Dialog) |

**Fazit:** Entspricht **Mesh-First** + gekoppeltes IOTA (`docs/TRANSPORT-AND-IOTA-LAYERS.md`). **Jetzt umsetzbar** ohne Move.

### E. „Eigene Mailbox-ID pro Gruppe“

**Idee:** `create_team_mailbox` pro Gruppe, alle schreiben dort hinein.

**Kritik:** Zusätzliches Object — **speichert intern weiter pairwise**. Ohne **`store_team_broadcast`** = gleiches N×-Problem, nur anderes Object.

**Fazit:** Sinnvoll **zusammen mit C**, nicht allein.

---

## 3. Empfehlung (Priorität)

### Jetzt (Phase 1 — ohne Move)

1. **Hybrid D:** Gruppe + **Funk** (Secondary) für Chat-Gefühl; **IOTA** mit **Mailbox an alle** für Archiv (kleine Teams, Klartext).
2. **UI ehrlich:** Kein Telegram-Versprechen; Kosten N× TX sichtbar.
3. **Posteingang:** Union-Filter Mitglieder (Fix 2026-06-02).
4. **Streams-Anchor:** optional für Monitor — nicht als Chat verkaufen.

### Als Nächstes (Phase 2 — Move + TS)

**C + E zusammen:** **`store_team_broadcast`** auf Team-Mailbox-Object, Gruppenschlüssel im Handoff/Vault, Gruppe in `messenger-group-store` mit `teamMailboxObjectId` — siehe **`TEAM-MAILBOX-BROADCAST-1TX-KONZEPT.md`**.

### Bewusst getrennt

| Bedarf | Kanal |
|--------|--------|
| Dialog im Team | Gruppe (+ künftig Team-Broadcast) oder Funk |
| Amtliche Lage an alle | **Pinnwand** |
| 1:1 vertraulich | **1:1** |

---

## 4. Vergleich (korrigiert)

| | Pairwise Gruppe (Ist) | Team-Broadcast (Ziel C) | Pinnwand | Funk Secondary |
|--|----------------------|-------------------------|----------|----------------|
| 1 Send → alle erreicht | N× TX | 1× TX (Ziel) | 1× (Leser viele) | Broadcast Kanal |
| Alle sehen Thread | Nur mit N Empfängern | Ja (mit Team-Key) | Ja (Klartext) | Ja (PSK-Kanal) |
| Verschlüsselung | N Handshakes | 1 Team-Key (off-chain) | Keine (Whitelist) | PSK (Meshtastic) |
| On-chain Beweis | Stark | Stark | Stark (öffentlich) | Schwach (Spiegel Pfad 4 optional) |

---

## 5. Verweise

- **`docs/MESSENGER-CHAT-HANDBUCH.md`** § Gruppenchat  
- **`docs/TEAM-MAILBOXES.md`**, **`docs/TEAM-MAILBOX-BROADCAST-1TX-KONZEPT.md`**  
- **`docs/ROADMAP-FAHRPLAN.md`** § H.22 M2a–M2c  
- **`docs/ROLLEN-MODELL-CONSUMER-EINSATZ.md`** § Gruppen-Mailbox  
