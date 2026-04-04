# Ticket-Features: Status & Roadmap

## DLT / Blockchain: Ticket im Wallet

**Ja.** Tickets und AccessKeys sind **on-chain NFTs** (Owned Objects). Bei `create_ticket` bzw. `create_access_key` wird das Objekt per `transfer::transfer(..., recipient)` an die Empfänger-Adresse übertragen. Der Empfänger **besitzt** das Ticket/Key in seinem Wallet (seine Adresse = Owner on-chain). Das ist vollständig DLT/Blockchain – kein zentraler Server, keine Datenbank. Ticket teilen = Objekt-ID weitergeben oder Transfer an neue Adresse.

---

## Feature-Tabelle

| # | Feature | Warum wichtig? | Umsetzung | Aufwand | Status |
|---|---------|----------------|-----------|---------|--------|
| 1 | **Ticket-Weitergabe / Transfer** | Käufer kann Ticket weiterverkaufen/verschenken (wie normales NFT) | Move: `transfer_ticket(ticket, new_owner)` + TS-Wrapper `/transfer-ticket` | 1–2 Std | ✅ Move + TS + CLI |
| 2 | **Ticket-Status ändern / mutieren** | Einmal-Nutzung (used=true), Upgrade (Normal→VIP), Verlängerung | Move: `use_ticket` (used=true) ✅; `upgrade_ticket`, `extend_ticket` – geplant | 2–4 Std | ⚠️ use_ticket ✅; Upgrade/Verlängerung geplant |
| 3 | **Ticket zurückgeben / Refund** | Käufer gibt Ticket zurück → Geld zurück + Ticket löschen | `enable_emergency_purge_ticket` + `purge_ticket` + externer Zahlungsfluss | 3–5 Std | ⚠️ Purge ✅; Geld-Rückfluss extern |
| 4 | **Meine Tickets anzeigen / Liste** | Nutzer sieht alle eigenen Tickets (gültig, abgelaufen, benutzt) | `getOwnedObjects` + Filter nach Ticket-Typ → `/list-tickets` | 1–2 Std | ✅ |
| 5 | **Offline-Prüfung (Ticket lokal cachen + QR/NFC)** | Einlass ohne Internet (z. B. Festival ohne Netz) | Ticket-Daten lokal speichern + QR-Generierung | 2–4 Std | ⏳ Geplant |
| 6 | **Batch-Purge für Event** | Veranstalter löscht alle Tickets eines Events auf einmal | Script: alle Keys/Tickets eines lock_id/event_id purgen | 1 Std | ⏳ Geplant |
| 7 | **Ticket-Kategorien / Tier-System** | Normal, VIP, Backstage – unterschiedliche Rechte | `tier`-Feld in Ticket + Prüfung bei use_ticket | 1 Std | ⏳ Geplant |
| 8 | **Ticket-Transfer-Gebühr** | Kleine Gebühr bei Weitergabe (z. B. 0.001 IOTA) | Transfer-Funktion mit Coin-Transfer | 1 Std | ⏳ Geplant |
| 9 | **hasValidTicket** | Gate prüft: Hat Adresse gültiges Ticket? | `hasValidTicket(client, packageId, ownerAddress, eventId)` | – | ✅ |

---

## Implementierte CLI-Befehle

| Befehl | Beschreibung | Parameter |
|--------|--------------|-----------|
| `/create-ticket` | Ticket-NFT ausstellen | event_id valid_from_ms valid_until_ms metadata_hex recipient |
| `/use-ticket` | Ticket einlösen (Einlass) | ticket_id event_id |
| `/purge-ticket` | Ticket löschen | ticket_id |
| `/emergency-purge-ticket` | Notfall-Purge aktivieren | ticket_id |
| `/transfer-ticket` | Ticket an neue Adresse übertragen | ticket_id new_owner |
| `/list-tickets` | Eigene Tickets auflisten | [owner_adresse] |

---

## AccessKey vs. Ticket-NFT

| Aspekt | AccessKey | Ticket-NFT |
|--------|-----------|------------|
| Erstellen | `/create-key`, `/create-keys` | `/create-ticket` |
| Gültigkeit | `expires_at_ms` (TTL Tage) | `valid_from_ms`, `valid_until_ms` |
| Einmalnutzung | Nein | Ja (`used` nach use_ticket) |
| Transfer | Wie NFT | `/transfer-ticket` |
| Prüfung | `hasValidAccessKey` | `hasValidTicket` |
