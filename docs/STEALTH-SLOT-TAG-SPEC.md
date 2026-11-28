# Stealth `slot_tag` — Spec (Doku-Scheibe)

**Stand:** 2026-11-28 · **Status:** Spec only — **kein** Move-Deploy, **kein** Client-Bau bis User-OK  
**Bezug:** `IDEEN-BACKLOG.md` · `KONTAKT-MAILBOX-VIER-SLOTS-ZIELBILD.md` · Roadmap Arbeitsstand

---

## 1. Ziel

Metadaten-Druck senken: Nachricht liegt in der **gemeinsamen Haupt-Mailbox** (`MAILBOX_ID` / shared). Explorer sieht **keinen** Empfänger-Wallet-Index, sondern nur einen abgeleiteten **`slot_tag`**. Nur wer den Shared Secret kennt, kann den Slot finden und lesen.

**Nicht Alltag.** Opt-in „Diskret“ — Default **aus**.

---

## 2. Abgrenzung (verbindlich)

| Konzept | Löst | Stealth? |
|---------|------|----------|
| **M4e Aktenschrank** (private/shared/team/**buffer**) | Ordnung / Purge-Trennung; Owner sichtbar | **Nein** |
| **Zwischenlager `buffer`** | 4. Schublade | **Nein** (häufig mit „Blind“ verwechselt) |
| **R1-Kurier** | Offline signierte TX → Relayer | **Nein** |
| **Stealth `slot_tag`** | Empfänger hinter Ableitung in **Haupt-Mailbox** | **Ja** |

Private Mailbox als Stealth-Ziel: **untauglich** — Owner leak im Explorer.

---

## 3. Krypto-Skizze

### 3.1 `slot_tag`

```
slot_tag = Blake2b256(
  SharedSecret || UTF8("slot") || epoch_u64_be
)
```

| Feld | Bedeutung |
|------|-----------|
| `SharedSecret` | Aus bestehendem Peer-ECDH / Team-Secret (gleiche Ableitung wie produktiver Chat-Key-Pfad — **kein** zweites Trust-Modell in v1) |
| `"slot"` | Domain-Trennung (feste ASCII-Bytes) |
| `epoch` | `u64` Big-Endian; Fenster für Lookahead (z. B. aktuelle Stunde oder diskrete Epoche laut Client-Uhr + Toleranz) |

**Ausgabe:** 32 Byte → on-chain als `vector<u8>` / Hex-ID je Move-Konvention.

**Kollision:** Bei 256 Bit vernachlässigbar; bei Epoch-Wiederverwendung gleicher Peer → gleicher Tag (beabsichtigt für Lookahead).

### 3.2 Payload

Ciphertext wie heutige Enc-Nachricht (AES-GCM / bestehender Wire). Klartext **nur** lokal nach Entschlüsselung. Stealth ändert den **Index**, nicht zwingend den Content-Codec.

### 3.3 Purge / Rebate (Soll-API)

Skizze Move (Namen vorläufig):

```
purge_stealth_message(
  mailbox: &mut Mailbox,
  slot_tag: vector<u8>,
  delete_secret: vector<u8>,   // Beweis: kennt Ableitung
  // intern: delete_commit = Hash(delete_secret || slot_tag) muss Slot-Commit matchen
)
```

- Nur wer `delete_secret` (aus SharedSecret-Ableitung) kennt, darf löschen → Rebate wie bestehende Purge-Pfade, sofern Mailbox das unterstützt.
- **Ohne** gültigen Commit: Abort.

Genaues Move-Layout = **Implementierungs-Scheibe** (nicht diese Spec).

---

## 4. Empfänger: Lookahead

1. Kennt `SharedSecret` + vereinbarte Epoch-Regel.  
2. Berechnet `slot_tag` für `epoch ∈ [now−W, now+W]` (kleines Fenster, z. B. W=2…24).  
3. Liest nur Treffer aus Haupt-Mailbox.  
4. Nach Lesen: optional sofort `purge_stealth_message` (Burn-ähnlich) — Produktregel später; Default-Empfehlung: **nach Lesen purge** für Stealth-Charakter.

**Risiken:** Polling/Akku, Uhr-Drift, Gas beim Purge, Explorer-Heuristiken (Traffic-Muster bleiben).

---

## 5. Client (Soll, nach User-OK)

| Hebel | Regel |
|-------|--------|
| Composer | Opt-in **„Diskret senden“** — speichert in Shared/`MAILBOX_ID` + setzt `slot_tag` |
| Default | **aus** |
| Override | Experte darf Mailbox-ID weiter manuell setzen; Diskret ohne Shared Secret → blocken mit klarer Meldung |
| Inbox | Stealth-Treffer wie Enc-Mail; Badge „diskret“ optional |
| M4e-Dropdown | Unverändert; Diskret ≠ Zwischenlager |

---

## 6. Nicht-Ziele dieser Spec-Scheibe

- Move-Deploy / Package-Upgrade  
- Lookahead-Polling-Code  
- Composer-UI „Diskret“  
- M4e-Schubladen-UX-Feinschliff  
- Kurier / Linkify / Handy-Feldtest  

---

## 7. Abnahme-Reihenfolge (nach Spec-Review)

1. User: Spec grün oder Änderungswunsch.  
2. Mini-Lib Vitest: `slot_tag`-Ableitung deterministisch (ohne Chain).  
3. Move-MVP + Client Opt-in — **eigene** kleine Scheiben, Default aus.  
4. 1-Gerät-Smoke (zwei Wallets am PC), dann Logbuch-Zeile.

---

## 8. Kurzentscheidungen festgehalten

- Mailbox = **Shared/Haupt**, nicht Privat.  
- Aktivierung = **Opt-in**, nie stiller Default.  
- `buffer` bleibt Aktenschrank.  
- Bau erst nach dieser Spec + explizitem User-OK.
