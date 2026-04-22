# R1 Kurier-Paket (submit_ready) - Volltestplan

Zweck: Vollstaendige Pruefung des aktuellen R1-Umfangs im Messenger (Builder, Import, Queue, Relayer-Status, Anchoring, Inventory, Vault-Autosave, Expertenpfade), ohne R2 sponsored.

Verwandt:
- `docs/MORG_TX_RELAY_V1-SPEC.md`
- `docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`
- `docs/TEST-RUN-LOGBOOK.md`

---

## 0) Scope und Nicht-Scope

In Scope:
- R1 `submit_ready` im Dialog `R1 Kurier-Paket (Beta)`.
- Builder-Flow inkl. Digest-Berechnung und Signatur-Flow.
- Import/Validation/Queue-Status.
- Expertenaktionen (Event/Mailbox-Bypass, Relayer-Protokoll, Nachweis abrufen, Loeschen).
- Integration mit Tangle-Inventory und optional Vault-Autosave.

Nicht in Scope:
- R2 `sponsored`.
- Multi-Client-Interop mit mehreren echten Relayern im Feld.
- „R1 verschluesselt generieren“ (bewusst Backlog laut Fahrplan).

---

## 1) Testvoraussetzungen

- [ ] App startet, Messenger nutzbar, R1-Dialog erreichbar.
- [ ] Testdaten vorhanden:
  - gueltige Senderadresse (`0x...64hex`)
  - gueltige Empfaengeradresse (`0x...64hex`) fuer optionale Tests
  - kurzer Payload-Text
- [ ] Optional fuer Signaturtest: Session-Signer im RAM gesetzt (Einstellungen -> Signer anwenden).
- [ ] Optional fuer Inventory/Vault:
  - Tangle-Inventory verfuegbar
  - Vault verfuegbar und (falls getestet) Auto-Save von Digests aktiv.

---

## 2) Schnell-Gate (vor dem manuellen Volltest)

- [ ] `frontend`: `npx tsc --noEmit`
- [ ] `frontend`: `npm run test:unit`
- [ ] Dialog oeffnet ohne UI-Fehler in DevTools (keine neue Warning/Error durch R1-Panel-Render).

---

## 3) Builder-Funktionen (Pfad „Paket erzeugen“)

### 3.1 Pflichtfelder und Guardrails

- [ ] Ungueltige `sender`-Adresse blockiert Builder mit klarer Fehlermeldung.
- [ ] Ungueltige optionale Empfaengeradresse blockiert Builder mit klarer Fehlermeldung.
- [ ] Leerer Payload blockiert Builder mit klarer Fehlermeldung.
- [ ] TTL ist nur ueber Presets waehlbar, max. 24h.
- [ ] `networkId` wird automatisch gesetzt (Status-Poll beim Oeffnen), nicht frei manipulierbar im Hauptfluss.
- [ ] `payloadEncoding` bleibt intern fix (`base64`), nicht als Freitext editierbar.

### 3.2 Envelope-Erzeugung

- [ ] Klick auf `Paket erzeugen` erzeugt gueltiges JSON (`version`, `mode`, `networkId`, `nonce`, `payloadHash`, ...).
- [ ] `payloadHash` aendert sich deterministisch bei Payload-Aenderung.
- [ ] `nonce` ist bei wiederholtem Erzeugen neu/eindeutig.
- [ ] `mode` ist `submit_ready`.
- [ ] Export via `JSON kopieren` kopiert den zuletzt erzeugten Envelope.
- [ ] `Paket teilen (LoRa/Copy)` arbeitet (Clipboard-Hinweis oder fallback-Hinweis).

---

## 4) Signatur-Flow (eigener Sender)

### 4.1 Ohne Signer

- [ ] `Digest jetzt signieren` liefert klare Meldung, wenn kein Session-Signer aktiv ist.

### 4.2 Mit Signer

- [ ] Bei passender Senderadresse erzeugt `Digest jetzt signieren` eine `senderSig`.
- [ ] UI zeigt anschliessend „senderSig gesetzt (...)“.
- [ ] Erzeugen uebernimmt diese Signatur in den Envelope.

### 4.3 Address-Mismatch

- [ ] Wenn Signer-Adresse != sender-Adresse, erscheint klare Blockade-Meldung (kein stilles Signieren).

---

## 5) Import-/Validierungs-Flow (Pfad „Paket importieren“)

### 5.1 JSON-Validierung

- [ ] Ungueltiges JSON -> Fehlermeldung.
- [ ] Falsche `version` -> Fehlermeldung.
- [ ] Falscher `mode` -> Fehlermeldung.
- [ ] Fehlende Pflichtfelder -> Fehlermeldung.
- [ ] Ungueltige Adressfelder -> Fehlermeldung.

### 5.2 R1-Fokus

- [ ] `mode = sponsored` wird klar abgelehnt (Backlog-Hinweis).

### 5.3 Uebernahme in Queue

- [ ] Gueltiger Import legt Queue-Eintrag an.
- [ ] Builder-Felder werden aus importiertem Envelope befuellt (sender, recipient, payload, senderSig, TTL).
- [ ] Bei `UNSIGNED_PLACEHOLDER` wird Status auf `draft_unsigned` gesetzt inkl. Report-Hinweis.

---

## 6) Queue-Status und Expertenaktionen

### 6.1 Statusdarstellung

- [ ] Eintrag zeigt `status`, `nonce`, `sender -> network`, `Ablauf`, optional `txDigest`.
- [ ] Relay-Report wird korrekt angezeigt (`submitted/reject/error`, `errorCode`, `note`).

### 6.2 Relayer-Submit protokollieren

- [ ] Expertenbereich ein/ausblendbar.
- [ ] `Relayer-Submit protokollieren` akzeptiert nur `submitted|reject|error`.
- [ ] Ungueltiger Status wird mit Fehlermeldung abgewiesen.
- [ ] Optionaler Fehlercode/Note werden gespeichert und angezeigt.

### 6.3 Nachweis abrufen (manuelles Anchoring)

- [ ] `Nachweis abrufen` erlaubt Eingabe eines `txDigest`.
- [ ] Danach: Queue-Status wird `anchored`.
- [ ] `relayReport.rpcStatus` wird auf `submitted` gesetzt.
- [ ] Digest wird in Tangle-Inventory aufgenommen.
- [ ] Optionales Vault-Autosave greift (wenn aktiviert) fuer den neuen Digest.

### 6.4 Eintrag loeschen

- [ ] `Eintrag loeschen` ist pro Queue-Eintrag vorhanden.
- [ ] Bestaetigungsdialog erscheint.
- [ ] Nach Bestaetigung ist der Eintrag aus der lokalen Queue entfernt.
- [ ] Abbruch im Dialog laesst Eintrag unveraendert.

---

## 7) Experten-Transport (Event/Mailbox als Klartext-Envelope)

- [ ] Experten-Transport standardmaessig ausgeblendet.
- [ ] Mit gueltigem Empfaenger + Envelope: Versand als Event funktioniert.
- [ ] Mit gueltigem Empfaenger + Envelope: Versand als Mailbox funktioniert.
- [ ] Ohne gueltigen Empfaenger: klare Fehlermeldung.
- [ ] Ohne erzeugten/importierten Envelope: klare Fehlermeldung.

---

## 8) Persistenz- und Reload-Verhalten

- [ ] Queue ueberlebt Dialog schliessen/neu oeffnen (LocalStorage).
- [ ] Queue ueberlebt Seiten-Reload.
- [ ] `refresh()`/UI-Aktualisierung zeigt neuen Stand konsistent.
- [ ] Dedup-Logik bei gleichem `nonce+sender` wirkt (kein ungewuenschtes Duplikatwachstum).

---

## 9) Negativ- und Robustheitstests

- [ ] Sehr grosse Payload fuehrt zu kontrolliertem Verhalten (kein Freeze, klare Rueckmeldung).
- [ ] Prompt-Abbruch bei Expertenaktionen fuehrt nicht zu inkonsistentem Zustand.
- [ ] Ungueltiger `txDigest`-Input bei Anchoring wird nicht still als gueltig behandelt.
- [ ] Keine unklaren Statuswechsel ohne Benutzeraktion.

---

## 10) Abschlusstor („R1 testbereit“)

R1 gilt als testbereit fuer Stage-2-Handychecks, wenn:

- [ ] Alle Punkte 3-8 sind mindestens einmal erfolgreich gelaufen.
- [ ] Mindestens 1 kompletter Happy-Path dokumentiert:
  - Builder -> Signieren -> Erzeugen -> Import -> Queue -> Nachweis abrufen -> Inventory/Vault.
- [ ] Mindestens 1 kompletter Fehlerpfad dokumentiert:
  - z. B. `ERR_BAD_SIGNATURE`/`draft_unsigned` inkl. nachvollziehbarer UI-Meldung.
- [ ] Ergebnis in `docs/TEST-RUN-LOGBOOK.md` eingetragen (Datum, Build/Commit, bestandene/fehlgeschlagene Punkte, offene Restpunkte).

---

## 11) Minimaler Testablauf (kompakt, 10 Minuten)

1. Gueltige Senderadresse + Payload eintragen.
2. `Digest jetzt signieren` (mit RAM-Signer).
3. `Paket erzeugen`.
4. `Paket pruefen & uebernehmen` (Import-Box).
5. Expertenbereich aufklappen, `Relayer-Submit protokollieren` (`submitted`).
6. `Nachweis abrufen` mit Test-`txDigest`.
7. Pruefen: Status `anchored`, Digest im Inventory.
8. Optional: `Eintrag loeschen`.
9. Fehlerpfad: Envelope mit Platzhalter-Signatur importieren -> `draft_unsigned` pruefen.
10. Logeintrag in `docs/TEST-RUN-LOGBOOK.md`.

Stand: 2026-04-22.
