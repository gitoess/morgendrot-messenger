# PC Stage‑2 — Direct-IOTA (Browser, Hybrid)

**Zweck:** Kurzprotokoll für **Phase 1 (PC)** — Klartext + Enc am Browser, Tresor weiter über API.  
**Quelle (Langform):** `docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md` § 2.  
**Nicht hier:** Handy-APK 4b–4d (Phase 2), Funk/Meshtastic (Phase 3), physisches 2. Gerät / 4e–4f / Session C (Phase 4).

**Surrogat für E2EE ohne zweites Handy:** zwei Browser-Profile / zwei Wallets **auf demselben PC** (optional zweite Instanz anderer Port) — zählt **nicht** als Phase 4.

---

## 0. Automatisiert (Pflicht vor manuell)

- [x] Root: `npm run test:h15-direct-submit` **grün** (2026-11-23, 88/88)
- [x] Root: `npm run smoke:standalone-desk` **grün** (Desk-Prep; ersetzt kein Browser-§1)
- Ergebniszeile → `docs/TEST-RUN-LOGBOOK.md`

---

## 1. Manuell Browser (Hybrid)

Voraussetzungen: `npm run dm` (oder `dev`), Tresor offen, Puls **IOTA-Sendeweg = Direkt**, Fullnode OK, Ketten-IDs + Session-Signer, Drain Klartext **an**.

| # | Schritt | Erwartung | PASS |
|---|---------|-----------|------|
| 1 | Klartext an **eigene** Adresse (kurzer eindeutiger Text) | Erfolg **oder** klare Fehlertext (Gas/Flags); Chat-Kopf **Direkt-RPC** / Hybrid wie Ist | **PASS** 2026-11-22 Self/Mailbox (`4ZNKyN2…` u. a.) |
| 2 | Posteingang: Nachricht sichtbar (API und/oder Direkt-RPC) | Inhalt erkennbar; kein stilles Verschwinden | **PASS** (mit §1 / Enc) |
| 3 | Enc **an** + Handshake vorhanden → verschl. Self-Send | Erfolg oder verständlicher Hinweis; kein Klartext-Leak in UI als „verschlüsselt“ | **PASS** 2026-11-22 Enc Self `FfbGxHYU…` |
| 4 | Optional **Zwei-Wallet:** `npm run dm:b` → http://localhost:3344/ … Handshake → Enc A↔B | Beide Seiten konsistent; **kein** Phase‑4-Anspruch | **PASS** 2026-11-22 + **2026-11-23** User-Inbox `5jqrFnMS…` / `6LcSJTx6…` |
| 4b | Optional **Peering-QR** statt Tippen (`mp` / Kontakt-QR mit `e`) A↔B | Pub landet, Enc möglich; Vitest `peering-qr` / `install-qr` | **PASS (Vitest)** 2026-11-23 in H.15 88/88. Live-Scan UI = Rest-Ritual bei Touch |
| 4c | Optional **H.23 C1.6:** in **1:1**-Chat-⋮ **Double Ratchet (Experiment)** auf **A und B** an → Enc A↔B (Gruppe hat keinen Toggle) | Klartext lesbar beiderseits; Flag aus = weiter Session Keys+. **Kein** Produktiv-Default | **PASS** 2026-11-27 User-Live A↔B Klartext (nach Peer-Pub/HsKey-Fix) |
| 5 | Puls → **Nur Morgendrot-API** | Klartext geht **nicht** still per RPC | **PASS** Vitest `trySubmit…relay` → Fehler „Nur Morgendrot-API“ (88/88). Live 2026-11-22 Relay-Mailbox `BniNWGBqZzGp…` (API-Pfad, kein stiller Direkt-RPC) |
| 6 | Nach Test: Session-Signer in Puls **löschen** | Kein Mnemonic in Support-Screenshots | **User-Ritual** (Support/Screenshot) — nicht abnahmeblockierend |

**Zwei-Wallet Hinweis:** Instanz B = eigene Adresse/Gas (`VAULT_FILE=.morgendrot-vault-b`, `PARTNER_ADDRESS_FILE=.morgendrot-partner-b`). Ohne getrenntes Partner-File überschreibt B-Handshake `.morgendrot-partner` mit A → A `/connect` ohne Args → Self-Peer. `/connect` „Bereits verbunden“ gilt nur für denselben Peer; `/cancel-connect` leert peerMap. Empfang Enc braucht B entsperrt.

**C1.6 Retest-Ritual (2026-11-27):** Spec `docs/MESSENGER-DOUBLE-RATCHET-C1-SPEC.md` — Opt-in beiderseits, **kein** Default. Live-Fallen: (1) API-Inbox `RATCHET_V3` ohne Client-Unwrap; (2) Outer-Pub ≠ Live-Pub; (3) Ausgangs-`forceNew` destruiert Session; (4) **Merge:** langer API-Hint schlug kurzen Direct-Klartext; (5) **`findPeerHandshake(From)` nur Events** → Mailbox-**HsKey** übersehen → leere Peer-Pub-Map → A→B Hint. Ritual: Hard-Reload → Flag aus→an → **neue** Enc beide Richtungen. Alte Hint-Zeilen nicht als PASS. Partner-Chat: Richtung „Beides“.

**B-Passwort vergessen?** `.morgendrot-vault-b` existiert schon — **kein** neuer Seed nötig, wenn du das Passwort noch hast (**Tresor öffnen**). Unbekanntes PW: auf B **Neu anlegen** (oder Seed importieren) → **neue** Testnet-Adresse (alte B-Adresse/Coins nur mit altem Seed erreichbar). Für Enc-Smoke auf Testnet ist Neu-Anlage ok.

**Nicht abhaken hier:** Basis aus + Outbox-Drain (steht in Langform § 2.4), Path‑4 Funk-Bild, APK.

---

## 2. Entscheidung

| Ergebnis | Weiter |
|----------|--------|
| §0 + §1.1–1.3 PASS | PC Stage‑2 Kern ok → weiter PC-UX-Rest / Vitest bei Touch |
| §1.4 PASS | E2EE-Surrogat ok — **trotzdem** Phase 4 später mit echtem 2. Gerät |
| **2026-11-23** §0 + §1.1–1.5 + §4b Vitest | **PC Stage‑2 geschlossen** → Phase 2 Handy (`docs/STANDALONE-SMOKE-CHECKLIST.md` 4b–4d) |
| Fail reproduzierbar | Fix in kleiner Scheibe + Retest; **kein** Big-Bang |

Siehe Stabilitätsregel: `.cursor/rules/pc-phase-stability.mdc`.
