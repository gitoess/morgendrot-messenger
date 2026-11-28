# Stealth / Diskret — 1-Gerät-Smoke (PC)

**Stand:** 2026-11-28 · Zwei Wallets am **selben PC** (kein zweites Gerät).

## Voraussetzung

- Direct-IOTA an (RPC + Session-Signer / Mnemonic), Drain ok  
- Stamm-`PACKAGE_ID` + Haupt-`MAILBOX_ID` im Snapshot  
- Call-Package Stealth: `0xa3e70f…` (Default in App)  
- ECDH-Handshake A↔B (Connect / Peer-Pub)

## Schritte

1. **Wallet A** (Browser/EXE): Kontakt B, Enc an, Plus → **Diskret senden…** (oder Toggle).  
2. Kurztext senden → Status mit TX-Digest.  
3. Explorer: TX `store_stealth_entry` — **kein** Empfänger-Feld am Entry; Gas-Zahler = A.  
4. **Wallet B** (zweiter Profil/Fenster am PC): Diskret **ebenfalls an** (Lookahead gekoppelt), Posteingang laden/Refresh.  
5. Erwartung: Nachricht erscheint (Lookahead Epoch±2), entschlüsselt.  
6. Optional: A und B Uhr/Timezone prüfen bei Grenz-Stunde (Lookahead deckt ±2 h).

## Nicht erwartet in diesem Smoke

- Purge nach Lesen (UI später)  
- Lookahead ohne Diskret-Opt-in  
- Gruppen / Mesh / SOS / Passphrase parallel  
- Gas-Zahler unsichtbar (Sponsor/Relayer geparkt)

## Abnahme

| Check | OK? |
|-------|-----|
| A sendet Diskret, Digest da | |
| B sieht Klartext nach Refresh | |
| Ohne Diskret-Opt-in bei B: kein Stealth-Treffer (oder Pref aus) | |
| Vitest: `stealth-slot-tag`, `stealth-lookahead`, `mailbox-stealth-inbox-rpc` | |

Logbuch: eine Zeile in `docs/TEST-RUN-LOGBOOK.md` nach Live-Lauf.
