# Boss bei 0 — Feldtest (Druck · Modus A)

**Datum:** __________ **Tester:** __________ **Browser:** __________ **Ergebnis:** ☐ PASS ☐ FAIL

**Start:** `npm run env:role:boss` · `npm run dm` · Inkognito · `http://127.0.0.1:3341` · `morgendrot.*` leer

**Legende:** 🟢 ok · 🟡 warn (FINAL ok) · 🔴 fail · — n/a · **Fett** = Pflicht FINAL 🟢

---

| # | Aktion | UI ok? | Boss | Wallet | Pkg | Postf. | Team | Netz | Regeln | Grundkonf. |
|---|--------|:------:|:----:|:------:|:---:|:------:|:----:|:----:|:------:|:----------:|
| 0 | Tresor → **Einsatzleitung einrichten** | ☐ | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 |
| 1 | **Wallet einrichten** → Header-Adresse | ☐ | 🟢 | 🟢 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 |
| 2 | **Beides** → Weiter | ☐ | 🟢 | 🟢 | 🔴 | 🔴 | 🟡 | 🟢 | 🟡 | 🔴 |
| 3 | **Regeln speichern** → Weiter | ☐ | 🟢 | 🟢 | 🔴 | 🔴 | 🟡 | 🟢 | 🟢/🟡 | 🔴 |
| 4 | **Contract Testnet** deploy → Weiter | ☐ | 🟢 | 🟢 | 🟢 | * | 🟡 | 🟢 | 🟢/🟡 | * |
| 5 | **Postfach** ok/anlegen → Weiter | ☐ | 🟢 | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 | 🟢/🟡 | 🟢/🟡 |
| 6 | Telegram **Überspringen** | ☐ | — | — | — | — | — | — | — | — |
| 7 | Funk **Überspringen** | ☐ | — | — | — | — | — | — | — | — |
| 8 | **Fertig** → Modal öffnet | ☐ | 🟢 | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 |
| **FINAL** | Modal **Neu laden** — Pflicht vergleichen | ☐ | **🟢** | **🟢** | **🟢** | **🟢** | 🟡 | **🟢** | 🟢/🟡 | **🟢** |

\* Schritt 4: Postfach 🟢 nur mit Deploy+Postfach — sonst Schritt 5.

---

## FINAL-Check (Modal „Einrichtung prüfen“)

**Pflicht — alles 🟢:**

| ☐ | Modal-Label | Ist (🟢/🟡/🔴) |
|---|-------------|----------------|
| ☐ | Boss-Server | |
| ☐ | Wallet / Signer *(Browser, nicht nur Server)* | |
| ☐ | Move-Package (Chain) | |
| ☐ | Server-Postfach | |
| ☐ | Grundkonfiguration | |

**Optional 🟡 ok:** Team-Postfach · Einsatz-Regeln (nach Skip)

**FINAL+:** ☐ Testnachricht ☐ `/api/status` packageId+mailboxId ☐ Helfer-ZIP (separater Test)

**Abweichungen:** _________________________________________________________________

**Logbuch:** `docs/TEST-RUN-LOGBOOK.md` · Vollversion: `docs/FELDTEST-BOSS-BEI-0.md`

---

*Drucken: Browser Druckvorschau → 1 Seite · Querformat empfohlen*
