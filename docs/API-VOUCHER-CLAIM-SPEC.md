# POST `/api/voucher-claim` — Claim-Token, Idempotenz

**Status:** **Stufe 1** im Repo: **Idempotenz** (Token einmal verbrauchen); **Burn/Mint, Wallet-Provisioning** sind **noch** anzubinden.

**Konfiguration:** `ENABLE_VOUCHER_CLAIM_API` (Default **false**), `VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE` (Default **30**, **0** = aus). **API** läuft nur bei **`ENABLE_UI=true`** (wie alle `/api/*`-Routen dieses Servers).

---

## Kritik am Namen `/api/provision`

**Nicht** den öffentlichen Claim unter **`/api/provision`** legen — Kollision mit **`/api/provision-device`** (Boss, authentifiziert). Besser: **`/api/voucher-claim`** (wie implementiert).

---

## Request

```http
POST /api/voucher-claim
Content-Type: application/json

{ "claimToken": "<hoch-entropisches Geheimnis aus dem E-Mail-Link>" }
```

- **claimToken:** 16–2048 Zeichen (nach Trim). Zu kurze Tokens ablehnen (Enumeration).

---

## Antwort (200)

```json
{
  "ok": true,
  "status": "consumed" | "already_consumed",
  "claimKeyPrefix": "a1b2c3d4e5f67012",
  "consumedAt": "2026-03-28T12:00:00.000Z",
  "note": "Nur Idempotenz-Schicht. …"
}
```

- **`already_consumed`:** gleicher Token **nochmal** geschickt (Doppelklick, Retry) — **kein zweites Wallet** auf dieser Schicht; `consumedAt` ist der **erste** Verbrauch.
- **`claimKeyPrefix`:** erste 16 Hex-Zeichen von **SHA-256(Token)** — **kein** Geheimnis; für Support/Logs. Die Datei `.morgendrot-voucher-claim-state.json` speichert nur **SHA-256-Keys**, nicht den Klartext.

---

## Idempotenz & Sicherheit

| Thema | Umsetzung |
|--------|-----------|
| **Doppelklick** | Zweiter POST mit gleichem Token → `already_consumed`, HTTP **200** (retry-freundlich). |
| **Rate-Limit** | Pro **IP** (siehe Env); zusätzlich im Fulfillment **Webhook-Idempotenz** (Zahlungsanbieter). |
| **TLS** | Claim-Links nur **HTTPS**; Token nicht in Logs. |
| **Nächste Schritte** | In derselben Session optional: **ephemeralPublicKey** mitsenden, dann **verschlüsselte** Antwort mit Seed — **noch nicht** im Code. |

---

## Nächste Implementierungsschritte

1. Nach erfolgreichem `consumed` (oder nur beim ersten Mal): **Move-TX** Burn Voucher → Mint Credits (oder Transfer Voucher an Nutzer, je nach Modell).  
2. **Webhook-Fulfillment** reserviert Objekt + erzeugt Token; Mapping **Token → objectId** serverseitig, bis Chain-Schritt erledigt.  
3. Production: State-Datei durch **DB** oder **replizierten Store** ersetzen bei mehreren Instanzen.

---

*Siehe auch **`docs/VOUCHER-PRE-MINT-AND-SHOP.md`** §8.*
