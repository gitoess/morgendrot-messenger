# Asset-Echtheit: Boss-Signatur („Geburtszertifikat“)

## Ziel

Antwort auf die Frage: **„Ist das Teil echt oder ein Fake?“** – ohne DNS/DID, nur mit der Kryptografie der Blockchain.

- Der **Boss** (Ersteller) signiert das Asset beim Erstellen.
- Beim **Scan** prüft Morgendrot: Passt die gespeicherte Signatur zur offiziellen Boss-Adresse?
- **Ergebnis:** Blaues „Verifiziert“-Häkchen = Original aus deiner Produktion.

---

## 1. Protokoll (mathematisch präzise)

### 1.1 Bezeichnungen

- **object_id** = Object-ID des PhysicalAsset (32 Bytes, z. B. aus `0x` + 64 Hex).
- **creator_address** = Adresse des Erstellers (Boss), 32 Bytes (z. B. `0x` + 64 Hex).
- **M** = Nachricht zur Signatur (kanonisch): **M := object_id ‖ creator_address** (64 Bytes, Konkatenation).
- **σ** = Ed25519-Signatur über M (mit dem privaten Schlüssel des Boss-Wallets).
- **pk** = Öffentlicher Schlüssel des Boss (zu creator_address gehörig).

### 1.2 Erstellung (Create + Attest)

1. **Create:** `create_physical_asset(...)` → Chain liefert **object_id**; Objekt hat **creator_address = sender**, **creator_signature = []**.
2. **Signatur:** Backend bildet M = object_id ‖ creator_address (je 32 Bytes, Big-Endian aus Hex).
3. **Sign:** σ = Ed25519.sign(sk, M) (z. B. `signPersonalMessage(M)`).
4. **Attest:** `attest_physical_asset(asset, σ)` → **creator_signature** wird on-chain gesetzt (nur einmal, nur durch creator_address).

### 1.3 Verifikation (Echtheits-Check)

Gegeben: **object_id**, **creator_address**, **creator_signature** (von der Chain), **BOSS_ADDRESS** (aus .env / Config).

1. **Adress-Check:** creator_address === BOSS_ADDRESS (als 32-Byte-Vergleich oder normalisierter Hex-String).
2. **Nachricht rekonstruieren:** M = object_id ‖ creator_address (gleiche Kodierung wie beim Signieren).
3. **Signatur prüfen:** Ed25519.verify(σ, M, pk). Dabei: **pk** ist der zur creator_address gehörige öffentliche Schlüssel.  
   - Wenn die Chain/ das SDK **Adresse = pk** (32 Bytes) verwendet: pk = bytes(creator_address).  
   - Typisch bei IOTA: `verifyPersonalMessageSignature(M, σ)` liefert den öffentlichen Schlüssel; dann prüfen, ob die daraus abgeleitete Adresse mit **BOSS_ADDRESS** übereinstimmt.

**Ergebnis:** „Verifiziert“ genau dann, wenn (1) und (2) und (3) erfüllt sind.

**Hinweis:** Das IOTA-SDK verwendet ggf. ein Intent-Prefix (z. B. „PersonalMessage“) beim Signieren. Falls die Verifikation in der Praxis fehlschlägt, muss die Nachricht M beim Signieren und Verifizieren exakt dieselbe Kodierung haben (gleicher Prefix/Hash, falls vom SDK gefordert).

### 1.4 Warum manipulationssicher?

- Ein Fälscher kann ein neues Asset anlegen, hat aber **nicht** den privaten Schlüssel des Boss-Wallets.
- Er kann **keine** gültige Signatur σ über M = object_id ‖ creator_address erzeugen.
- Sein Asset hat entweder **creator_signature = []** (unverifiziert) oder eine Signatur, die bei Schritt (3) scheitert.

---

## 2. Move (Contract)

- **PhysicalAsset:** Zusätzliche Felder:
  - `creator_address: address` (beim Create = sender)
  - `creator_signature: vector<u8>` (anfangs leer)
- **attest_physical_asset(asset, signature):** Nur aufrufbar, wenn `tx_context::sender() == asset.creator_address` und `creator_signature` noch leer; setzt `creator_signature = signature`.

---

## 3. Backend

- **create_physical_asset** wie bisher; danach optional:
  - M = object_id ‖ creator_address bilden,
  - mit Boss-Key signieren (nur möglich bei SIGNER=sdk mit passendem Keypair),
  - **attest_physical_asset** aufrufen.
- **Verifikation:** Hilfsfunktion z. B. `verifyAssetCreatorSignature(objectId, creatorAddress, signatureHex, bossAddress)` (Nachricht M rekonstruieren, Signatur prüfen, Adresse vergleichen).
- **getOwnedPhysicalAssets** / **getPhysicalAssetById:** Liefern **creator_address** und **creator_signature** mit (für UI und Verifikation).

---

## 4. UI

- Beim Anzeigen eines Assets: Verifikation ausführen (Backend-API oder im Frontend, wenn Crypto verfügbar).
- Wenn **verifiziert:** Blaues „Verifiziert“-Häkchen neben dem Namen.
- Wenn **nicht verifiziert:** Kein Häkchen oder Hinweis „Unverifiziert“.

---

## 5. Kurz: Wann „Verifiziert“?

| Bedingung | Bedeutung |
|-----------|-----------|
| creator_signature nicht leer | Boss hat das Asset attestiert. |
| creator_address == BOSS_ADDRESS | Attestation kommt von der konfigurierten Boss-Adresse. |
| verify(σ, M, pk) = ok | Signatur ist kryptografisch gültig. |

Alle drei → **„Verifiziert“**. Sonst → **nicht verifiziert**.
