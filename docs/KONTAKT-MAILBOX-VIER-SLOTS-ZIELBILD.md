# Kontakt-Mailboxen — Zielbild (4 Slots + Send-Auswahl)

**Stand:** 2026-05-20  
**Status:** **Umgesetzt** (2026-05-20) — Telefonbuch vier Felder, Send-Dropdown „Ziel-Postfach“, API/JSON `mailbox*Id`, QR `ms`/`m`/`mt`/`mb`.

---

## Problem

Heute hat ein Kontakt **höchstens eine** optionale `mailboxObjectId`. Beim Senden gilt:

1. Kontakt-Mailbox-ID (falls gesetzt)  
2. sonst **eine** aktive eigene Mailbox (Team **oder** Privat)  
3. sonst Server-Shared (`MAILBOX_ID`)

Der Messenger **errät nicht**, ob der Empfänger Shared, Privat, Team oder „Puffer“ lesen soll — ohne dass der Nutzer die Object-ID kennt und speichert.

---

## Zielbild (Produkt)

Pro Kontakt (Wallet `0x…`) vier **optionale** IOTA-Object-IDs (0x + 64 Hex):

| Slot | Rolle | Beispiel |
|------|--------|----------|
| **shared** | Einsatz-Postfach des Servers des Partners | bekannte `MAILBOX_ID` des Einsatzes |
| **private** | Private Mailbox des Partners | aus QR/Profil |
| **team** | Team-Mailbox des Partners | geteilte Team-ID |
| **buffer** | Reserve / zweite Gruppe / Übergang | frei benannt |

**Senden:** Dropdown „Ziel-Postfach“ (Default aus Kontakt + letzte Wahl, überschreibbar pro Nachricht).  
**Empfang:** Unverändert beim Empfänger — er muss die Mailbox lesen, in die geschrieben wurde.

**Nicht verwechseln:**

- **Gruppenchat (M2a)** = Kanal + Mitgliederfilter, kein viertes Chain-Objekt pro Kontakt  
- **„4 aktiv bei mir“** = separates Thema (`my-mailbox-active.ts`); Ziel hier = **4 Ziele pro Kontakt**

---

## Lieferung (Vorschlag)

1. Schema: `ContactMeshEntry` + API `contact-label` + QR `docs/QR-CONTACT-SCHEMA-V2.md`  
2. Telefonbuch-UI: vier Felder + Kurzlabels  
3. `resolveOutboundMailboxObjectId` + Send-Panel: explizite Zielwahl  
4. Vitest + `docs/SENDEWEGE-KANAL-MAILBOX-UEBERSICHT.md` aktualisieren  

**Ist heute:** ein Feld „Private Mailbox des Kontakts“ — siehe `contact-phonebook-contact-dialog.tsx`.
