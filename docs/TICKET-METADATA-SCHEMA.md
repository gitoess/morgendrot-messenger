# Ticket-Metadata-Schema

Einheitliches Schema für das Ticket-Feld **metadata** (vector&lt;u8&gt; im Move). UI und CLI nutzen dasselbe Encoding – Wallets/Explorer können darauf aufbauen, **ohne Move-Änderung**.

---

## 1. Empfohlenes Format: JSON (UTF-8)

Metadata wird als **UTF-8-JSON** gespeichert und beim Aufruf von `/create-ticket` als **Hex** übergeben (z. B. `metadata_hex = 0x` + Buffer.from(JSON.stringify(obj), 'utf8').toString('hex')).

### Feldübersicht

| Feld | Typ | Beschreibung | Beispiel |
|------|-----|--------------|----------|
| **tier** | number | 0=Early, 1=Normal, 2=VIP, 3=Backstage, 4=Crew | `2` |
| **seat** | string | Sitzplatz (Block, Reihe, Nummer) | `"A-12-5"` |
| **block_nummer** | string | Block/Zone | `"Nord"` |
| **lounge_zugang** | boolean | Lounge-Zugang | `true` |
| **besitzer_name** | string | Klarname (für Ausweiskontrolle) | `"Nicole M."` |
| **geburtsdatum** | string | z. B. YYYY-MM-DD für Ü18-Check | `"1990-05-12"` |
| **rabatt_code** | string | Promo-Code | `"FRIEND25"` |
| **referral_id** | string | Wer hat das Ticket empfohlen? | `"ref_abc"` |
| **discount_percent** | number | Rabatt in % | `25` |
| **is_vip** | boolean | VIP-Status | `true` |
| **is_transferable** | boolean | Darf weiterverkauft werden? | `false` |
| **zone_list** | string[] | Erlaubte Zonen/Gates | `["vip","backstage"]` |
| **image_url** | string | Link zum Ticket-Bild (siehe Abschnitt 2) | `"https://…"` oder `"ipfs://Qm…"` |

Alle Felder sind **optional**. Leeres Objekt `{}` oder `0x` ist gültig.

### Beispiel-JSON

```json
{
  "tier": 2,
  "seat": "A-12-5",
  "besitzer_name": "Nicole M.",
  "is_vip": true,
  "rabatt_code": "FRIEND25",
  "discount_percent": 25,
  "image_url": "ipfs://QmXyz…"
}
```

### Encoding in UI/CLI

- **Eingabe:** User gibt z. B. Sitzplatz und Name ein → App baut JSON, serialisiert zu UTF-8, dann zu Hex.
- **Ausgabe:** Beim Lesen von Chain/Events: Hex → UTF-8 → JSON parsen und anzeigen.
- **Bestehender Befehl:** `/create-ticket <event_id> <valid_from_ms> <valid_until_ms> <metadata_hex> <recipient>`. `metadata_hex` = `0x` + Hex des JSON-Strings (oder `0x` für leer).

---

## 2. Konvention: Bild-Link (image_url / IPFS)

**Ohne Move-Änderung:** Ein optionales Feld **image_url** im JSON-Metadata wird als Konvention genutzt. Wallets und Explorer können danach suchen und ein Bild anzeigen.

- **image_url** (string): Vollständiger Link zum Ticket-Bild.
  - **IPFS:** `ipfs://Qm...` – Bild dezentral auf IPFS; nur der Link steht on-chain.
  - **HTTPS:** `https://example.com/tickets/xyz.png` – z. B. eigener Server oder Pinata/CDN.

Es wird **kein** Bild direkt on-chain gespeichert (kosteneffizient). Die Konvention ermöglicht später einheitliche Anzeige (z. B. IOTA Wallet, Explorer), sobald Clients dieses Feld auslesen.

---

## 3. Kurzreferenz Encoding

| Aktion | Vorgehen |
|--------|----------|
| JSON → metadata_hex | `0x` + Buffer.from(JSON.stringify(obj), 'utf8').toString('hex') |
| metadata_hex → JSON | JSON.parse(Buffer.from(hex.replace(/^0x/i, ''), 'hex').toString('utf8')) |
| Nur Text (z. B. Name) | Einzelnes Feld oder einfacher String: `{"besitzer_name":"Nicole"}` → dann Hex |

---

## 4. Bezug zu bestehender Doku

- **Move-Struct:** `messaging::Ticket` hat `metadata: vector<u8>`. Keine Änderung nötig.
- **Parameter-Details:** Siehe [NFT-PARAMETERS.md](NFT-PARAMETERS.md) (tier, seat, holder_name, promo_code etc. in metadata).
- **UI:** `/create-ticket` in UI mit 5 Argumenten; metadata_hex kann aus Formular (Sitzplatz, Name, VIP-Checkbox, Rabatt) als JSON→Hex erzeugt werden (einheitliches Encoding).
