# NFT-Parameter: Ticket & AccessKey – Abgleich & Roadmap

Vergleich der Kern-, Promo- und Zusatzparameter mit dem aktuellen Stand. **metadata** kann viele Werte encodieren (z. B. JSON/Hex), bis eigene Felder in Move ergänzt werden.

---

## 1. Ticket-NFT – Parameter-Mapping

| Parameter | Beschreibung | Ticket (aktuell) | Umsetzung |
|-----------|--------------|------------------|-----------|
| **event_id / lock_id** | Event/Gate/Festival – welches Tor/Zone | ✅ `event_id` | Muss-Feld |
| **owner / recipient** | Aktueller Besitzer (Wallet) | ✅ via `transfer::transfer` | Owner = Objekt-Besitzer |
| **valid_from_ms** | Gültig ab (Unix ms) | ✅ `valid_from_ms` | Muss-Feld |
| **valid_until_ms** | Gültig bis (Unix ms) | ✅ `valid_until_ms` | Muss-Feld |
| **used** | Einmalnutzung (eingelöst?) | ✅ `used` | Muss-Feld |
| **tier** | Kategorie (0=Early, 1=Normal, 2=VIP, 3=Backstage, 4=Crew) | ⚠️ in `metadata` | metadata encodieren; v2: eigenes Feld |
| **issuer** | Aussteller (Veranstalter) | ✅ `issuer` | Für Rückruf |
| **created_at_ms** | Erstellungszeit | ✅ `created_at_ms` | – |
| **purge_allowed** | Notfall-Purge aktiviert | ✅ `purge_allowed` | – |
| **metadata** | Erweiterbare Daten | ✅ `metadata` (vector&lt;u8&gt;) | Enthält: tier, seat, promo_code, zone_list, holder_name |
| **promo_code** | Promo-Code (z. B. FRIEND25) | ⚠️ in metadata | Hex/JSON in metadata |
| **discount_percent** | Rabatt in % | ⚠️ in metadata | Hex/JSON in metadata |
| **credit_amount** | Guthaben (z. B. Getränke) | ⏳ geplant | Mutierbar, v2 |
| **credit_spent** | Verbrauchtes Guthaben | ⏳ geplant | Mutierbar, v2 |
| **credit_valid_until_ms** | Guthaben-Gültigkeit | ⏳ geplant | v2 |
| **max_uses** | Max. Nutzungen (1=Einmal, 0=unbeschränkt) | ⏳ geplant | v2: use_ticket inkrementiert |
| **current_uses** | Bereits genutzt | ⏳ geplant | v2 |
| **zone_list** | Erlaubte Zonen/Gates | ⚠️ in metadata | Hex/JSON in metadata |
| **seat** | Sitzplatz (z. B. Block A, Reihe 12) | ⚠️ in metadata | Hex/JSON in metadata |
| **holder_name** | Name des Inhabers (personalisiertes Ticket) | ⚠️ in metadata | UTF-8 → Hex, z. B. „Nicole“ → `0x4e69636f6c65`. Name steht **im Ticket**; am Eingang zeigt die Person ihren **Ausweis** zum Abgleich – **kein** IOTA Name Record/Nameservice. |
| **qr_data** | QR-Inhalt/Hash (Offline) | ⚠️ clientseitig | Lokal aus objectId + event_id generieren |
| **revoked** | Widerrufen durch Issuer | ⏳ geplant | v2: Registry + revoke_ticket |
| **price_paid_iota** | Kaufpreis (Refund) | ⚠️ in metadata | Hex/JSON in metadata |
| **purchase_timestamp_ms** | Kaufzeitpunkt | ⚠️ = created_at_ms | Oder in metadata |

---

## 2. AccessKey-NFT – Parameter-Mapping

| Parameter | Beschreibung | AccessKey (aktuell) | Umsetzung |
|-----------|--------------|---------------------|-----------|
| **lock_id / event_id** | Schloss/Gate – welcher Zugang | ✅ `lock_id` | Muss-Feld |
| **owner / recipient** | Aktueller Besitzer | ✅ via `transfer::transfer` | Owner = Objekt-Besitzer |
| **valid_from_ms** | Gültig ab | ⚠️ implizit `created_at_ms` | v2: eigenes Feld |
| **valid_until_ms** | Gültig bis | ✅ `expires_at_ms` | Muss-Feld |
| **used** | Einmalnutzung | ❌ nicht vorhanden | AccessKey = Mehrfachnutzung („open“) |
| **tier** | Kategorie (z. B. VIP-Zone) | ❌ | v2: metadata oder eigenes Feld |
| **issuer** | Aussteller | ✅ `issuer` | – |
| **created_at_ms** | Erstellungszeit | ✅ `created_at_ms` | – |
| **purge_allowed** | Notfall-Purge | ✅ `purge_allowed` | – |
| **metadata** | Erweiterbare Daten | ❌ | v2: metadata-Feld |
| **zone_list** | Erlaubte Zonen (Multi-Lock) | ❌ | v2: metadata oder lock_ids |
| **max_uses** | Max. Öffnungen | ❌ | AccessKey typisch unbeschränkt |
| **transfer** | Weitergabe | ✅ `transfer_access_key` | CLI: /transfer-key |

**Hinweis:** AccessKey ist für **Mehrfach-Zugang** (Tür öffnen, bis TTL abläuft). Ticket ist für **Einmal-Einlass**. Beide ergänzen sich.

---

## 2b. Promo- & Gutschein-Parameter (beide NFTs)

| Parameter | Beschreibung | Ticket | AccessKey | Umsetzung |
|-----------|--------------|--------|-----------|-----------|
| **promo_code** | Promo-Code (z. B. FRIEND25) | ⚠️ metadata | ❌ | metadata encodieren |
| **discount_percent** | Rabatt in % | ⚠️ metadata | ❌ | metadata encodieren |
| **credit_amount** | Guthaben (kleinste Einheit, z. B. 5000 = 5 €) | ⏳ v2 | ❌ | Mutierbar bei Bar-Verbrauch |
| **credit_spent** | Bereits verbrauchte Gutschrift (Start 0) | ⏳ v2 | ❌ | Mutierbar bei jedem Kauf |
| **credit_valid_until_ms** | Gültigkeit der Gutschrift (oft kürzer als Ticket) | ⏳ v2 | ❌ | v2 |

---

## 2c. Weitere sinnvolle Parameter (je nach Event-Typ)

| Parameter | Beschreibung | Ticket | AccessKey | Umsetzung |
|-----------|--------------|--------|-----------|-----------|
| **max_uses** | Nutzungen (1=Einmal, 5=5×, 0=unbeschränkt) | ⏳ v2 | ❌ (typisch unbeschr.) | Saisonkarten, Familien-Tickets |
| **current_uses** | Bereits genutzt (Start 0) | ⏳ v2 | ❌ | Mutierbar bei Einlass |
| **zone_list** | Erlaubte Zonen/Gates | ⚠️ metadata | ❌ | metadata oder v2 lock_ids |
| **seat** | Sitzplatz (z. B. Block A, Reihe 12) | ⚠️ metadata | ❌ | metadata encodieren |
| **holder_name** | Name des Inhabers | ⚠️ metadata | ❌ | metadata encodieren |
| **qr_data** | QR-Inhalt/Hash (Offline-Scan) | ⚠️ clientseitig | ⚠️ clientseitig | Lokal aus objectId + event_id/lock_id |
| **issuer** | Aussteller (Veranstalter) | ✅ | ✅ | Für Rückruf |
| **revoked** | Widerrufen durch Issuer | ⏳ v2 | ❌ | Registry + revoke_ticket |
| **price_paid_iota** | Kaufpreis in IOTA-Nano (Refund) | ⚠️ metadata | ❌ | metadata encodieren |
| **purchase_timestamp_ms** | Kaufzeitpunkt | ⚠️ = created_at_ms | ❌ | Oder in metadata |

---

## 3. metadata-Encoding (Ticket, heute nutzbar)

`metadata` ist `vector<u8>`. **Einheitliches Schema (JSON in UTF-8 → Hex)** inkl. optionale Konvention für Bild-Links: siehe **[TICKET-METADATA-SCHEMA.md](TICKET-METADATA-SCHEMA.md)**. Empfohlene Formate:

**Option A – JSON (UTF-8):**
```json
{"tier":2,"seat":"A-12-5","promo":"FRIEND25","discount":25,"zones":["vip","backstage"]}
```
→ Hex: `7b2274696572223a322c2273656174223a22412d31322d35222c...`

**Option B – Kompaktes BCS/TLV:**
- Byte 0: tier (u8)
- Bytes 1–n: seat (Länge + UTF-8)
- usw.

**Beispiel /create-ticket mit metadata:**
```bash
# metadata = tier 2 (VIP), leer sonst: 02 (Hex)
/create-ticket 0x… 0 1735689600000 02 0x…
```

---

## 4. Abgleich: Ähnliche Schritte für AccessKey

| Ticket | AccessKey | Status |
|--------|-----------|--------|
| /create-ticket | /create-key, /create-keys | ✅ |
| /use-ticket | – (AccessKey nutzt „open“-Nachricht) | N/A |
| /purge-ticket | /purge-key | ✅ |
| /emergency-purge-ticket | /emergency-purge-key | ✅ |
| /transfer-ticket | /transfer-key | ✅ |
| /list-tickets | /list-keys | ✅ |
| hasValidTicket | hasValidAccessKey | ✅ |
| metadata (tier, seat) | – | v2: metadata für AccessKey |

---

## 5. Roadmap (Move v2 – optionale Erweiterungen)

| Änderung | Ticket | AccessKey | Aufwand |
|----------|--------|-----------|---------|
| **tier** (u8) | Eigenes Feld | Eigenes Feld oder metadata | 1 Std |
| **metadata** | Bereits vorhanden | Neu hinzufügen | 1 Std |
| **max_uses / current_uses** | Für Saisonkarten | – | 2 Std |
| **credit_* (Guthaben)** | Für Bar/Getränke | – | 3 Std |
| **revoked** | Registry + Flag | – | 2 Std |
| **transfer_access_key** | – | ✅ erledigt | – |
| **valid_from_ms** (AccessKey) | – | Optional | 0.5 Std |

---

## 6. UI-Optionen (bereits eingebaut / ergänzt)

- **Festival:** Alle Ticket-Schritte mit refs zu /create-ticket, /use-ticket, /purge-ticket, /transfer-ticket, /list-tickets
- **Ticket-Projekt:** AccessKey vs. Ticket-NFT, metadata für tier/seat
- **AccessKey:** /create-key, /create-keys, /purge-key, /emergency-purge-key, /transfer-key, /list-keys – analog zu Ticket
- **metadata-Hinweis:** In HELP und Projekt-Schritten: metadata_hex kann tier, seat, promo_code, zone_list, holder_name encodieren
- **Promo & Gutschein:** promo_code, discount_percent in metadata; credit_* (v2)
- **Weitere Parameter:** max_uses, zone_list, seat, holder_name, qr_data (clientseitig), issuer, revoked (v2), price_paid_iota, purchase_timestamp_ms
