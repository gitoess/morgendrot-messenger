# QR-Kontakt-Payload – Schema v2 (Spezifikation)

**Status:** Nur **Doku**; Parser/UI können vorerst bei **v1** bleiben. Implementierung erst nach Bedarf (Setup-Panel, Import, Feld-Einsatz).

**Zweck:** Ein **einheitliches**, **kompaktes** JSON für QR-Codes und Datei-Import, das neben Partner-Adresse und Netzwerk auch **Streams-Anker**, **Morgendrot-API-Basis** und **Gateway-URL** transportieren kann – ohne `RPC_URL` (IOTA-Node) und `GATEWAY_URL` zu verwechseln.

---

## 1. Begriffe (kurz)

| Feld | Bedeutung |
|------|-----------|
| **RPC / `u`** | Öffentlicher **IOTA Rebased**-HTTP-Endpunkt (Node), wie heute `RPC_URL`. |
| **API / `b`** | **Morgendrot-HTTP-API** (typisch Origin + Port, z. B. `https://basis.example:3844`) – **nicht** automatisch gleich RPC. |
| **Gateway / `g`** | **LoRa/Mesh-Gateway** für Endgeräte/Tiny (HMAC, Bridge) – siehe `GATEWAY_URL` in Konfiguration. |
| **Anchor / `s`** | **Streams-Anker** (`STREAMS_ANCHOR_ID`), Objekt-ID auf der Chain. |

---

## 2. Versionen im Überblick

### v1 (bestehend, unverändert)

- Vollständiges JSON: `v: 1`, `kind: 'morgendrot-contact'`, `address`, optional `displayName`, `packageId`, `rpcUrl`.
- Kompakt-QR im UI: `v: 1`, `k: 'mc'`, `a`, optional `n`, optional `p`, `u` (nur wenn „Netzwerk ins QR“).

### v2 (diese Spez)

- **Abwärtskompatibel:** Alles aus **v1** bleibt gültig. **v2** erweitert nur **optionale** Schlüssel.
- **`v`:** `2` kennzeichnet Parser, dass die Zusatzfelder `b`, `g`, `s` **semantisch** definiert sind (nicht freie Texte).

---

## 3. Kompaktes Objekt (empfohlen für QR-Größe)

Minimal dieselbe Idee wie v1: kurze Keys, ein JSON-String pro QR.

| Key | Pflicht | Beschreibung |
|-----|---------|--------------|
| `v` | ja | `2` |
| `k` | ja | `'mc'` (Morgendrot Contact) |
| `a` | ja | Eigene Adresse `0x` + 64 Hex (Partner, der gescannt wird) |
| `n` | nein | Anzeigename (wie v1) |
| `p` | nein | `PACKAGE_ID` |
| `u` | nein | IOTA **RPC**-URL (`https://…`) |
| `b` | nein | **API-Basis-URL** für Morgendrot (siehe §4) |
| `g` | nein | **Gateway-URL** (LoRa/Mesh/Tiny) |
| `s` | nein | **Streams-Anker-ID** (`STREAMS_ANCHOR_ID`, 0x + 64 Hex) |

**Beispiel (lesbar formatiert):**

```json
{"v":2,"k":"mc","a":"0x…64hex…","n":"Basis 3","p":"0x…","u":"https://api.testnet.iota.cafe","b":"https://md.example:3844","g":"https://gw.example/lora","s":"0x…anchor…"}
```

---

## 4. Normalisierung `b` (apiBase)

- **Typisch:** Schema + Host + optional Port, **ohne** Pfad-Suffix `/api`, wenn der Client ohnehin `_api()` + `/api/...` baut – **oder** mit `/api`, wenn der Client nur die Basis ohne weiteren Pfad erwartet.  
- **Implementierungsregel (wenn Code folgt):** Eine klare Konvention im UI festlegen (z. B. „immer Origin ohne `/api`“) und in **`CONFIG-REFERENCE.md`** einen Satz ergänzen.  
- **Sicherheit:** Wie bei `p`/`u`: **nur** aus **vertrauenswürdiger** Quelle übernehmen; zweite Bestätigung, wenn bestehende API/RPC überschrieben werden.

---

## 5. Vollständiges JSON (nicht kompakt, für Datei-Export)

Analog zu v1, mit expliziten Namen:

```json
{
  "v": 2,
  "kind": "morgendrot-contact",
  "address": "0x…",
  "displayName": "optional",
  "packageId": "0x…",
  "rpcUrl": "https://…",
  "apiBaseUrl": "https://…",
  "gatewayUrl": "https://…",
  "streamsAnchorId": "0x…"
}
```

Parser dürfen **v1**-Felder allein oder **v2**-Erweiterungen akzeptieren; unbekannte Keys **ignorieren** (forward-compatible).

---

## 6. Sicherheit & UX (Pflicht für Implementierung)

- **Bösartige QR/JSON** sind möglich: Angreifer kann falsche `b`/`g`/`s` setzen (Phishing, falsches Gateway).  
- **Mindestens:** wie heute beim Netzwerk-Import – **Bestätigungsdialog** vor Überschreiben von Konfiguration.  
- **Empfohlen:** getrennte Checkboxen „API übernehmen“, „Gateway übernehmen“, „Anchor übernehmen“ (nicht alles in einem Klick).

---

## 7. Bezug zum Code (Stand Spez-Datum)

| Thema | Code / Datei |
|--------|----------------|
| Kontakt-QR v1 | `ui/index.html` – `getMorgendrotContactQrText`, `parseContactImport`, `applyContactImport` |
| Boss-kompaktes QR (Provision) | `src/config.ts` – `buildQrPayload` (andere Keys: `r`, `rid`, `pkg`, …) – **nicht** mit Kontakt-v2 vermischen |

**Hinweis:** `buildQrPayload` und **Kontakt-v2** sind **zwei verschiedene** Nutzlasten; bei Bedarf später ein gemeinsamer „Umschlag“ oder nur dokumentierte Trennung beibehalten.

---

## 8. Nächster Schritt (wenn implementiert)

1. `parseContactImport` / Apply um optionale Keys erweitern (`SET`-Äquivalent für `STREAMS_ANCHOR_ID`, ggf. neue Env-Keys für API-Basis, falls nicht schon vorhanden).  
2. QR erzeugen: v2 nur wenn mindestens ein optionales Feld gesetzt oder User „alles ins QR“ wählt.  
3. **`tsc`** / manuelle Tests mit kurzem und langem Payload (QR-Längenlimit beachten).

---

*Diese Datei ist absichtlich **nur** Spezifikation; Priorität bleibt beim Projekt-Fahrplan (**`docs/ROADMAP-FAHRPLAN.md`**, § H).*
