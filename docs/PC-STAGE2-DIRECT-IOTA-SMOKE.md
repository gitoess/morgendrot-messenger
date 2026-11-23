# PC Stage‑2 — Direct-IOTA (Browser, Hybrid)

**Zweck:** Kurzprotokoll für **Phase 1 (PC)** — Klartext + Enc am Browser, Tresor weiter über API.  
**Quelle (Langform):** `docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md` § 2.  
**Nicht hier:** Handy-APK 4b–4d (Phase 2), Funk/Meshtastic (Phase 3), physisches 2. Gerät / 4e–4f / Session C (Phase 4).

**Surrogat für E2EE ohne zweites Handy:** zwei Browser-Profile / zwei Wallets **auf demselben PC** (optional zweite Instanz anderer Port) — zählt **nicht** als Phase 4.

---

## 0. Automatisiert (Pflicht vor manuell)

- [ ] Root: `npm run test:h15-direct-submit` **grün**
- [ ] Root: `npm run smoke:standalone-desk` **grün** (Desk-Prep; ersetzt kein Browser-§1)
- Ergebniszeile → `docs/TEST-RUN-LOGBOOK.md`

---

## 1. Manuell Browser (Hybrid)

Voraussetzungen: `npm run dm` (oder `dev`), Tresor offen, Puls **IOTA-Sendeweg = Direkt**, Fullnode OK, Ketten-IDs + Session-Signer, Drain Klartext **an**.

| # | Schritt | Erwartung | PASS |
|---|---------|-----------|------|
| 1 | Klartext an **eigene** Adresse (kurzer eindeutiger Text) | Erfolg **oder** klare Fehlertext (Gas/Flags); Chat-Kopf **Direkt-RPC** / Hybrid wie Ist | |
| 2 | Posteingang: Nachricht sichtbar (API und/oder Direkt-RPC) | Inhalt erkennbar; kein stilles Verschwinden | |
| 3 | Enc **an** + Handshake vorhanden → verschl. Self-Send | Erfolg oder verständlicher Hinweis; kein Klartext-Leak in UI als „verschlüsselt“ | |
| 4 | Optional **Zwei-Wallet:** `npm run dm:b` → http://localhost:3344/ neues Profil (Vault `.morgendrot-vault-b`); Handshake → Enc A→B | Beide Seiten konsistent; **kein** Phase‑4-Anspruch | **PASS** 2026-11-22 (`J8RW6iX4…` / Retest `ETT8mK9E…`) |
| 5 | Puls → **Nur Morgendrot-API** | Klartext geht **nicht** still per RPC | **Vitest:** `direct-iota-plain-submit` / Enc/Handshake `relayBlockedMessage` (CI). Manuell: Puls-Schalter + ein Send-Versuch → Fehlertext „Nur Morgendrot-API“ |
| 6 | Nach Test: Session-Signer in Puls **löschen** | Kein Mnemonic in Support-Screenshots | |

**Zwei-Wallet Hinweis:** Instanz B = eigene Adresse/Gas (`VAULT_FILE=.morgendrot-vault-b`, `PARTNER_ADDRESS_FILE=.morgendrot-partner-b`). Ohne getrenntes Partner-File überschreibt B-Handshake `.morgendrot-partner` mit A → A `/connect` ohne Args → Self-Peer. `/connect` „Bereits verbunden“ gilt nur für denselben Peer; `/cancel-connect` leert peerMap. Empfang Enc braucht B entsperrt.

**Nicht abhaken hier:** Basis aus + Outbox-Drain (steht in Langform § 2.4), Path‑4 Funk-Bild, APK.

---

## 2. Entscheidung

| Ergebnis | Weiter |
|----------|--------|
| §0 + §1.1–1.3 PASS | PC Stage‑2 Kern ok → weiter PC-UX-Rest / Vitest bei Touch |
| §1.4 PASS | E2EE-Surrogat ok — **trotzdem** Phase 4 später mit echtem 2. Gerät |
| Fail reproduzierbar | Fix in kleiner Scheibe + Retest; **kein** Big-Bang |

Siehe Stabilitätsregel: `.cursor/rules/pc-phase-stability.mdc`.
