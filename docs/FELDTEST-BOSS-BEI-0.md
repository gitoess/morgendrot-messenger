# Feldtest — Boss bei 0

**Stand:** 2026-06-16 · **Spec:** `docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md` §4.4  
**Abnahme = Modus A only** · Readiness-Code: `frontend/frontend/lib/boss-readiness.ts`  
**Druckversion (1 Seite):** [`FELDTEST-BOSS-BEI-0-PRINT.md`](FELDTEST-BOSS-BEI-0-PRINT.md)

---

## Vorbereitung (Modus A)

```powershell
npm run env:role:boss   # möglichst leere .env / frisches Datenverzeichnis
npm run dm
```

Inkognito → `http://127.0.0.1:3341` → Local Storage `morgendrot.*` leer → **Tresor noch nicht** entsperren.

**Modus B** (volle `.env`): nur UX — **kein** Abnahme-Ersatz.

---

## So gehst du vor (chronologisch)

1. Tabelle **Zeile für Zeile** von **#0 → #8** abarbeiten — nicht springen.
2. Nach **jedem Pflicht-Schritt (1–5)** kurz UI prüfen (Spalte „UI muss passen“).
3. **Ampel-Spalten** = erwarteter Stand **wenn du jetzt** das Modal „Einrichtung prüfen“ öffnen würdest (nach Schritt 8 passiert das automatisch).
4. Schritte **6–7** optional — Spalten **—** (Readiness ändert sich nicht).
5. **#FINAL** nach Schritt 8: Modal mit Zeile vergleichen — **alle Pflicht-Felder 🟢**.
6. **#FINAL+** (empfohlen): Testnachricht + ggf. Helfer-ZIP — außerhalb Readiness.

Bei Abweichung notieren: **Zeilen-Nr. · Screenshot · Modal-Label · erwartet/ist**.

---

## Legende

| Symbol | Bedeutung |
|--------|-----------|
| 🟢 | ok |
| 🟡 | warn — für **FINAL** ok, wenn nur optional (Team, Regeln nach Skip) |
| 🔴 | fail — **FINAL nicht bestanden** |
| — | nicht relevant (Telegram/Funk) |

**Spalten = Modal-Labels** (1:1): Boss-Server · Wallet/Signer · Move-Package · Server-Postfach · Team-Postfach · Netzwerk-Wahl · Einsatz-Regeln · **Grundkonfiguration**

---

## Testskript (chronologisch)

| # | Aktion (Modus A) | UI muss passen | Boss | Wallet | Package | Postfach | Team | Netz | Regeln | Grundkonfig. |
|---|------------------|----------------|:----:|:------:|:-------:|:--------:|:----:|:----:|:------:|:------------:|
| **0** | Tresor → **„oder Einsatzleitung einrichten“** | Wizard Schritt **1/8**; Tresor zu; **Zurück zur Einrichtung** nach Wallet-Klick | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 |
| **1** | **Wallet einrichten** → Seed → zurück | Adresse im **Header** | 🟢 | 🟢 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 |
| **2** | **Beides** → **Weiter** | Weiter erst nach Wahl aktiv | 🟢 | 🟢 | 🔴 | 🔴 | 🟡 | 🟢 | 🟡 | 🔴 |
| **3** | **Regeln speichern** (30 Tage) → **Weiter** *(Skip: Regeln 🟡)* | Toast „gespeichert“ | 🟢 | 🟢 | 🔴 | 🔴 | 🟡 | 🟢 | 🟢/🟡 | 🔴 |
| **4** | **Contract anlegen (Testnet)** → warten → **Weiter** | Deploy-Feedback; Package sichtbar | 🟢 | 🟢 | 🟢 | 🔴/🟢* | 🟡 | 🟢 | 🟢/🟡 | 🟡/🟢* |
| **5** | Postfach prüfen/anlegen → **Weiter** | Server-Postfach grün im Schritt | 🟢 | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 | 🟢/🟡 | 🟢/🟡 |
| **6** | Telegram → **Überspringen** | Optional | — | — | — | — | — | — | — | — |
| **7** | Funk → **Überspringen** | Optional (Architektur offen) | — | — | — | — | — | — | — | — |
| **8** | **Fertig** → Modal **„Einrichtung prüfen“** öffnet | Zurück sichtbar; nur Footer **Fertig** | 🟢 | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 |
| **FINAL** | Modal: **Neu laden** → alle Pflicht 🟢 → **Zum Messenger** | Siehe Kasten unten — **Abnahme-Gate** | **🟢** | **🟢** | **🟢** | **🟢** | 🟡 | **🟢** | 🟢/🟡 | **🟢** |
| **FINAL+** | 1× senden/empfangen; `/api/status` prüfen; Helfer-ZIP separat | Kein `.env`-Handedit | — | — | — | — | — | — | — | — |

\* Schritt **4:** Postfach 🟢 nur wenn Deploy **mit** Server-Postfach — sonst Schritt **5**.

---

## FINAL-Check (Abnahme-Gate Modus A)

**Bestanden**, wenn nach Schritt **8** im Modal **„Einrichtung prüfen“** gilt:

### Pflicht — alles 🟢 (sonst FAIL)

| Modal-Label | Muss zeigen |
|-------------|-------------|
| **Boss-Server** | Erreichbar (npm run dm läuft) |
| **Wallet / Signer** | Browser-Signer aktiv — **nicht** nur 🟡 „Server-Tresor offen“ |
| **Move-Package (Chain)** | Package deployed (Testnet-ID sichtbar) |
| **Server-Postfach** | MAILBOX_ID gesetzt |
| **Grundkonfiguration** | Zusammenfassung grün — „Einsatzleitung nutzbar“ o. ä. |

### Optional — 🟡 erlaubt

| Modal-Label | 🟡 ok wenn … |
|-------------|--------------|
| **Team-Postfach** | noch kein Team-Postfach (Helfer später) |
| **Einsatz-Regeln** | Schritt 3 übersprungen (Server-Default) |
| **Netzwerk-Wahl** | aus Server übernommen (selten 🟡 nach Schritt 2) |

### FINAL+ (empfohlen, nicht im Modal)

- [ ] Header: volle `0x…`-Adresse
- [ ] Eine Testnachricht Senden/Empfang
- [ ] `packageId` + `mailboxId` in `/api/status`
- [ ] Helfer: **Einsatzleitung → Helfer einrichten** → `docs/FELDTEST-BLOCK2-SIMPLE-HANDOFF.md`

**Ergebnis:** `docs/TEST-RUN-LOGBOOK.md` — PASS/FAIL · Datum · Browser · Abweichungen

**CLI-Hilfe (nach Wizard, Server-Check):** `npm run feldtest:boss-readiness` — prüft `/api/status` gegen FINAL-Pflicht (ersetzt keinen UI-Wizard).

---

## Wizard ≠ gespeichert

| Signal | Bedeutet |
|--------|----------|
| **Fertig** / Resume-Karte | Wizard durch — kein Speicher-Beweis |
| **Readiness-Modal** | Live-Check — mit **FINAL**-Zeile vergleichen |
| **FINAL alle Pflicht 🟢** | Modus-A-Abnahme bestanden |

---

## Grenzen · Verwandt

| Grenze | Hinweis |
|--------|---------|
| Deploy/Postfach | Server-Tresor + laufender Boss |
| Playwright | Mock — kein echter Deploy |
| Funk Schritt 7 | Bootstrap; Roadmap „Offen — Architektur Funk“ |

`docs/EINSATZ-BOSS-ABLAUF.md` · `docs/EXPORT-ASSISTENT-REFERENZ.md` · `e2e/boss-onboarding-greenfield.spec.ts`
