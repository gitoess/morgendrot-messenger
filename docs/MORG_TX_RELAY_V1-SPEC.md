# MORG_TX_RELAY_V1 (Draft v0)

Zweck: Offline erzeugte, kryptografisch gebundene IOTA-Submit-Daten über Funk (LoRa/S-ARQ) an einen Relayer übertragen, der später online einreicht.

## 1) Modi

- `R1 submit-ready`:
  - Sender liefert vollständig signierte, submit-fähige Payload.
  - Relayer validiert und reicht unverändert an RPC ein.
  - Relayer braucht kein Wallet (nur Node-Zugang).
- `R2 sponsored`:
  - Sender liefert signierten Intent.
  - Relayer/Gasstation finalisiert/sponsert Submit nach Policy.
  - Relayer/Service ist aktiver Transaktionsakteur.

## 2) Envelope-Felder (v0)

- `version`: `"MORG_TX_RELAY_V1"`
- `mode`: `"submit_ready" | "sponsored"`
- `networkId`: Zielnetz (Replay-Schutz gegen falsches Netz)
- `sender`: Absenderadresse
- `createdAt`: Epoch ms
- `expiresAt`: Epoch ms
- `nonce`: eindeutiger U64/U128 Nonce
- `payloadEncoding`: z. B. `base64`
- `payload`: signierte Submit-Payload (R1) oder signierter Intent (R2)
- `payloadHash`: SHA-256 über `payload`
- `senderSig`: Signatur über Header + `payloadHash`

## 3) Transport über Funk

- Envelope wird als Bytefolge über vorhandenes S-ARQ segmentiert.
- Empfang:
  - CRC/S-ARQ-Integrität
  - vollständige Reassembly
  - dann Envelope-Validierung
- ACK zurück über Funk als kurzer Wire:
  - `MORG_TX_RELAY_ACK_V1`
  - Felder: `nonce`, `status`, optional `txDigest`, optional `errorCode`

## 4) Minimale Validierung am Relayer

Relayer muss vor Submit prüfen:

- `version` unterstützt
- `networkId` passt
- Zeitfenster gültig (`createdAt <= now <= expiresAt`)
- `nonce` nicht bereits verarbeitet (Idempotenz/Replay-Schutz)
- `payloadHash` stimmt
- `senderSig` gültig

Bei Fehlern: `ACK` mit `status=reject` und `errorCode`.

## 5) Fehlercodes (Startset)

- `ERR_EXPIRED`
- `ERR_NETWORK_MISMATCH`
- `ERR_BAD_SIGNATURE`
- `ERR_PAYLOAD_HASH_MISMATCH`
- `ERR_REPLAY_NONCE`
- `ERR_RPC_SUBMIT_FAILED`
- `ERR_SPONSOR_REQUIRED` (R1 nicht möglich ohne Gas)

## 6) UI-Hinweise (Backlog)

- Composer optionales Feld: `Verschlüsselter Funk-Block` (readonly).
- Aktionen:
  - `Über Funk senden`
  - `In Zwischenablage`
  - optional `An IOTA-Netzwerk weiterleiten` (am Relayer-Client)
- Optionaler Proof-Block:
  - `payloadHash`
  - `senderSig`
  - nach Submit `txDigest`

