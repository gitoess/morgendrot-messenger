# Ticket-Layer: Bewertung Logik, Sicherheit, Anwendbarkeit

## Kurzfassung

**Bewertung: Sehr gut.** Das Konzept passt nahtlos zu den bestehenden Mustern (AccessKey, Vault, Purge, TTL) und wird als optionaler Ticket-Layer umgesetzt.

---

## Logik

| Aspekt | Bewertung | Begründung |
|--------|-----------|------------|
| Ticket als Owned Object | ✅ | Wie AccessKey: Besitzer = Käufer, Übertragung, Purge. Konsistent. |
| Zeitfenster valid_from / valid_until | ✅ | Eindeutig; Ablauf = automatisch purgebar (wie Vault TTL). |
| used-Flag | ✅ | Einmalnutzung; nach use_ticket → used=true, kein Doppel-Einlass. |
| Purge-Regeln | ✅ | Owner bei !used (Rückgabe), Issuer (Veranstalter) jederzeit (Rückruf), nach Ablauf jedermann (Rebate). |
| event_id / lock_id | ✅ | Eindeutige Zuordnung zu Tür/Veranstaltung; gleiche Semantik wie lock_id beim AccessKey. |

---

## Sicherheit

| Risiko | Maßnahme |
|--------|----------|
| Doppel-Nutzung | Nur Ticket-Besitzer kann use_ticket aufrufen (übergibt Objekt); used wird auf true gesetzt. |
| Fälschung | Ticket wird on-chain geminted; event_id + issuer fest. |
| Rückruf durch Veranstalter | Issuer darf purge_ticket immer (Notfall-Rückruf). |
| Rückgabe nach Nutzung | Owner darf nur bei !used purgen (Refund nur für ungenutzte Tickets). |
| Ablauf | valid_until_ms strikt; nach Ablauf Purge durch jedermann (kein Anreiz, alte Tickets zu horten). |

Mutation nur durch: (1) Besitzer (use_ticket, purge wenn !used), (2) Issuer (purge_ticket immer). Kein Dritter kann used setzen oder Ticket löschen (außer nach TTL).

---

## Anwendbarkeit

- **M2M:** Einlass wie Lock: Prüfung hasValidTicket(owner, event_id) statt/supplementär zu AccessKey; Befehl „use_ticket“ verschlüsselt an Gate, Gate prüft on-chain und Nutzer führt use_ticket aus (oder Gate zeigt QR/Signatur-Flow).
- **Zahlung → Ticket:** Außerhalb des Contracts (Escrow/Backend); Backend prüft Zahlung, ruft create_ticket auf, übergibt an Käufer. Kein Change am Ticket-Modul nötig.
- **Offline:** Ticket-NFT lokal/QR; Einlass kann bei Netzausfall auf vorher geprüftes Token/QR zurückfallen (Out-of-Scope für erste Version).

---

## Fazit

Logik und Sicherheit sind stimmig und an die bestehenden Bausteine anschlussfähig. Umsetzung als optionaler Ticket-Layer (Move + TS) erfolgt.

---

## Umgesetzter Ticket-Layer (Kurz)

- **Move** (`messaging.move`): `Ticket` (event_id, issuer, valid_from_ms, valid_until_ms, used, purge_allowed, metadata), `create_ticket`, `use_ticket`, `purge_ticket`, `enable_emergency_purge_ticket`. Events: TicketCreated, TicketUsed, TicketPurged.
- **TS** (`chain-access.ts`): `hasValidTicket(client, packageId, ownerAddress, eventId)` – prüft gültiges, ungenutztes Ticket für event_id.
- **Einlass:** Gate prüft `hasValidTicket(sender, event_id)`; Nutzer kann danach `use_ticket(ticket, event_id)` aufrufen (signiert mit eigenem Wallet). M2M: verschlüsselter Befehl „use_ticket“ + gleiche Prüfung wie bei AccessKey möglich.
- **Purge:** Nur Owner kann Ticket übergeben. Erlaubt: !used (Refund), purge_allowed (Emergency), oder now > valid_until_ms (Rebate). Issuer-Rückruf (ohne Ticket-Inhaber) wäre optional über Registry + revoke_ticket.
