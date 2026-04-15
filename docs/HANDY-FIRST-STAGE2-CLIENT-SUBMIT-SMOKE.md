# H.15 Stufe 2 — Kontrollierter Client-Submit (Smoke / Feldprotokoll)

**Zweck:** Erfolgskriterium aus **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** § 4 Stufe **2** — ein **nachvollziehbarer** Ablauf: **Browser** → **`@morgendrot/core`** (PTB + Signatur) → **IOTA-RPC**; Node-`/api`-Pfad bleibt Fallback für verschlüsselte Outbox und Relais.

**Verwandt:** **`docs/PWA-HANDBUCH-OFFLINE.md`** (Sendeweg § 5), **`TESTING.md`** (Smoke, Merge-Ritual), **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8 (Outbox vs. andere Queues), **`docs/HANDY-TEST-WINDOW.md`** (wann Gerätetest), **`docs/TEST-RUN-LOGBOOK.md`** (letzte dokumentierte Läufe).

---

## 0. Automatisierte Mindestabdeckung

- **Schnell (Repo-Root):** **`npm run test:h15-direct-submit`** — nur **`frontend/frontend/lib/direct-iota-plain-submit.test.ts`** (Modus „Nur API“, Drain aus).
- **Voll im Ordner `frontend/`:** **`npm run test:unit`** — gesamter Vitest-Lauf inkl. dieser Datei.

---

## 1. Voraussetzungen (Testnet / Dev)

| # | Bedingung |
|---|-----------|
| 1 | **`npm run dev`** (API **3342** + Next **3341**), Tresor entsperrt, **`GET /api/status`** zeigt für **Direkt-Klartext** passende Flags (Mailbox-Klartext **ohne** Messenger-Credits-Sperre — siehe Chat-/Puls-Hinweise und **`canUseDirectPlaintextMailboxDrain`**). |
| 2 | In **Chat → Puls:** **IOTA-Sendeweg** = **Direkt (Standard)** (nicht „Nur Morgendrot-API“). |
| 3 | **Fullnode-URL** gesetzt (`NEXT_PUBLIC_DIRECT_IOTA_RPC_URL` oder in Puls **URL speichern**); **Erreichbarkeit prüfen** = OK. |
| 4 | **Ketten-IDs** vorhanden (aus Basis **`/api/current-ids`** übernehmen oder manuell in Puls persistieren): Package, Mailbox, Absender = Session-Signer-Adresse. |
| 5 | **Session-Signer:** Mnemonic/Secret in Puls **anwenden** (nur RAM; kein Screenshot in Support-Tickets). |
| 6 | **Direkt-Mailbox-Drain (Klartext)** = **an**. |
| 7 | Optional: **`localStorage`** **`morgendrot.offlineMailboxQueue`** = **`1`**, um fehlgeschlagene Sends in die Outbox zu legen — Drain testet dann denselben Pfad wie der Chat. |

---

## 2. Protokoll (manuell, abhaken)

1. [ ] **Sicherheit:** Mnemonic nur in vertrauenswürdiger Umgebung; nach Test **Signer löschen** in Puls.
2. [ ] Chat: Transport **Online**, Empfänger gültig, **Klartext**-Nachricht (kurzer Text, eindeutiger Inhalt).
3. [ ] Senden — **Erwartung:** Erfolg **oder** verständliche Fehlermeldung (Gas, Flags, Adresse). Bei Erfolg optional Digest/Explorer prüfen.
4. [ ] Basis kurz **stoppen** (`npm start` beenden): mit aktivem Drain und gültigem RPC soll **Outbox-Drain** (bzw. verzögerter Spiegel) **Klartext** weiterhin über **Direkt-RPC** versuchen — nicht über `/api` (solange Modus Direkt und Drain an).
5. [ ] Modus auf **Nur Morgendrot-API** stellen: erneuter Klartext-Versuch darf **nicht** still per RPC gehen — Nutzerhinweis / HTTP-Pfad, sobald Basis wieder da.
6. [ ] **`npm run test:unit`** im Ordner **`frontend/`** ausgeführt (grün).

---

## 3. Nicht-Ziele dieses Protokolls

- Kein **Ersatz** für **`npm run test:messages`** / Chain-Realworld (Server-Session, verschlüsselte Pfade).
- Kein **Proof** für Multi-Gerät-Konflikte — siehe **§ H.12** / **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**.

---

## 4. Anhang: **Stufe 4** — Direkt vs. Morgendrot-Relay im Ritual

**Zielbild:** **Direkt** bleibt Default; **Relay** = nur **`/api`**, sobald die Basis da ist — siehe **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** Stufe **4**.

| # | Check (Release / größerer Messenger-PR) |
|---|----------------------------------------|
| 1 | **`npm run test:h15-direct-submit`** (Root) **grün**. |
| 2 | **Puls:** Modus **Direkt** → Stufe **2** § 2 Schritte **1–3** mindestens einmal manuell oder dokumentiert erledigt. |
| 3 | **Puls:** Modus **Nur Morgendrot-API** → Klartext **ohne** funktionierenden Fullnode-Pfad (kein stiller RPC-Submit); verschlüsselter Versand weiter über **`/api`**. |
| 4 | Vollständiges Merge-Ritual: **`TESTING.md`** § *Qualitätsritual vor Merge* (inkl. **`test:unit`** / **`test:core`** bei Core-Änderungen). |

---

## 5. Vor dem Feldtest (Stufe 2 — technische Vorprüfung)

- Root: **`npm run test:smoke`**; bei Änderungen unter **`frontend/frontend/`** zusätzlich **`npm run test:frontend-unit`**.
- Schnell nur H.15-Direkt: **`npm run test:h15-direct-submit`**.

---

*Stand: 2026-04-28 — Stufe 2; Anhang Stufe 4 + Feldtest-Vorprüfung 2026-04-28.*
