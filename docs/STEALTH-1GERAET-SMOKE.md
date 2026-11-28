# Stealth / Tarnmodus — 1-Gerät-Smoke (PC)

**Stand:** 2026-11-28 · Zwei Wallets am **selben PC** (kein zweites Gerät).

## Voraussetzung

- Direct-IOTA an (RPC + Session-Signer / Mnemonic), Drain ok  
- Stamm-`PACKAGE_ID` + **bestehende** Haupt-`MAILBOX_ID` (kein neues Postfach anlegen)  
- Call-Package Stealth: `0xa3e70f…` (Default in App)  
- ECDH-Handshake A↔B (Connect / Peer-Pub)

## Schritte

1. **Wallet A** (`npm run dm`): Kontakt B, Enc an, Plus → **Tarnmodus…** (oder Toggle).  
2. Kurztext senden → Status mit TX-Digest.  
3. Explorer: TX `store_stealth_entry` — **kein** Empfänger-Feld am Entry; Gas-Zahler = A.  
4. **Wallet B** (`npm run dm:b` → :3344): ECDH-Peer A bekannt; Tarnmodus-Toggle **nicht** nötig für Empfang. Posteingang aktualisieren.  
5. Erwartung: Nachricht erscheint (DOF-Scan + Decrypt), Zeitstempel ≈ Sendezeit (Event-ts, nicht klebende Move-ms).  
6. Neuere Tarnmodus-Zeilen sortieren **über** ältere Visitenkarten.

## Nicht erwartet in diesem Smoke

- Purge nach Lesen (UI später)  
- Zweites „Stealth-Postfach“ anlegen  
- Gruppen / Mesh / SOS / Passphrase parallel  
- Gas-Zahler unsichtbar (Sponsor/Relayer geparkt)

## Abnahme

| Check | OK? |
|-------|-----|
| A sendet Tarnmodus, Digest da | |
| B sieht Klartext nach Refresh | |
| Sort: heutige Tarnmodus-Zeile über gestriger Visitenkarte | |
| Vitest: `stealth-slot-tag`, `stealth-lookahead`, `mailbox-stealth-inbox-rpc` | |

Logbuch: eine Zeile in `docs/TEST-RUN-LOGBOOK.md` nach Live-Lauf.
