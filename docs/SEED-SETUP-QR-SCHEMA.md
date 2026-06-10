# Seed-Setup-QR — Schema-Spezifikation

**Schema-ID:** `morgendrot-seed-setup-v1`  
**Payload-Version:** `1`  
**Kind (`k`):** `ms` (morgendrot seed setup)  
**Stand:** 2026-06-02  
**Code:** `frontend/frontend/lib/seed-setup-qr.ts`

---

## Zweck

Nach dem Handoff-ZIP-Import soll der Helfer den **Seed** ohne Tippen übernehmen können. Der Boss zeigt einen QR (60-Sekunden-Anzeige im Wizard); der Helfer scannt im Dialog **Seed einrichten?**.

Der Seed steht **nie** in der Handoff-ZIP — nur in diesem QR (einmalig) oder als mündliche Übergabe.

---

## JSON-Payload (QR-Inhalt)

Minimales Beispiel:

```json
{
  "v": 1,
  "s": "morgendrot-seed-setup-v1",
  "k": "ms",
  "w": "word1 word2 … word24",
  "a": "0x…64 hex…"
}
```

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `v` | number | ja | Payload-Version — Parser akzeptiert aktuell nur `1` |
| `s` | string | empfohlen | Schema-ID — muss `morgendrot-seed-setup-v1` sein, wenn gesetzt |
| `k` | string | ja | Muss `ms` sein |
| `w` | string | ja | Signer-Import: Mnemonic (12+ Wörter), IOTA-Bech32-Secret oder 64 Hex |
| `a` | string | nein | Erwartete IOTA-Adresse (`0x` + 64 Hex) — Helfer kann optional prüfen |

---

## Parser-Regeln (Helfer-App)

1. QR-Text als JSON parsen.
2. `v === 1` und `k === "ms"` — sonst ablehnen.
3. Wenn `s` gesetzt ist und ≠ `morgendrot-seed-setup-v1` → ablehnen (zukünftige Schemas).
4. `w` non-empty → an `activateStandaloneHelperWallet` / SDK-Import.
5. **Abwärtskompatibilität:** QR ohne Feld `s` (frühe Builds) weiterhin akzeptieren, solange `v` und `k` passen.

---

## Versionierung & Migration

| Änderung | Vorgehen |
|----------|----------|
| Neues Feld optional | `v` beibehalten, Parser erweitern |
| Breaking Change | Neues `s` (z. B. `morgendrot-seed-setup-v2`) + neues `v`; Parser v1 bleibt für alte QRs |
| Verschlüsselter QR | **Nicht** in v1 — Backlog: `k: "mse"` + Passwort mündlich |

Doku bei jeder Schema-Änderung: dieses File + Changelog-Eintrag.

---

## Sicherheit

- QR enthält **Klartext-Seed** — nur kurz anzeigen (Wizard: 60 s Countdown).
- Kein Speichern des QR in Screenshots/Historie empfohlen.
- Transport: persönliche Übergabe oder vertrauenswürdiger Kanal — nicht per Gruppenchat.

**Verwandt:** `docs/GERAET-PROVISIONIEREN-WIZARD.md`, `docs/HANDOFF-ZIP-ENCRYPTION.md`
