# Stealth `slot_tag` — Spec (Doku-Scheibe)

**Stand:** 2026-11-28 · **Status:** Spec **grün** (User) + Nachzug Multi-Msg + Gas-Ehrlichkeit · **kein** Move-Deploy / Client-Bau bis nächste OK-Scheibe  
**Bezug:** `IDEEN-BACKLOG.md` · `KONTAKT-MAILBOX-VIER-SLOTS-ZIELBILD.md` · Roadmap Arbeitsstand · Gas: `SPONSORING-AND-CREDITS-DOUBLE-FLOOR.md` · Relayer: R1/R2 in Roadmap

---

## 1. Ziel

Metadaten-Druck senken: Nachricht liegt in der **gemeinsamen Haupt-Mailbox** (`MAILBOX_ID` / shared). Explorer sieht **keinen** Empfänger-Wallet-Index, sondern nur einen abgeleiteten **`slot_tag`**. Nur wer den Shared Secret kennt, kann den Slot finden und lesen.

**Nicht Alltag.** Opt-in „Diskret“ — Default **aus**.

**Ehrliche Grenze:** `slot_tag` tarnt den **Empfänger-Index**, nicht automatisch den **Gas-Zahler** (siehe §4 / §5.1).

---

## 2. Abgrenzung (verbindlich)

| Konzept | Löst | Stealth? |
|---------|------|----------|
| **M4e Aktenschrank** (private/shared/team/**buffer**) | Ordnung / Purge-Trennung; Owner sichtbar | **Nein** |
| **Zwischenlager `buffer`** | 4. Schublade | **Nein** (häufig mit „Blind“ verwechselt) |
| **R1-Kurier** | Offline signierte TX → Relayer | **Nein** (kann aber **Gas-Zahler** fremd machen — siehe §5.1) |
| **Stealth `slot_tag`** | Empfänger hinter Ableitung in **Haupt-Mailbox** | **Ja** (Empfänger-Metadaten) |

Private Mailbox als Stealth-Ziel: **untauglich** — Owner leak im Explorer.

---

## 3. Krypto-Skizze

### 3.1 `slot_tag` = Epoch-**Bucket** (nicht Einzel-Nachricht)

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

**Gleicher Tag bei gleicher Epoche + gleichem Peer:** **beabsichtigt** für Lookahead (ein Bucket pro Epoche). Das ist **kein** „eine Nachricht pro Tag“.

### 3.1.1 Mehrere Nachrichten in derselben Epoche (verbindlich)

Wenn Partner A→B in derselben Epoche **mehrfach** sendet, darf Nachricht 2 Nachricht 1 **nicht** überschreiben.

**MVP-Entscheidung (kritisch geprüft):** `slot_tag` adressiert einen **Bucket**; on-chain liegt darunter eine **kleine Queue**, nicht ein Einzel-Slot:

```
StealthBucket {
  slot_tag: vector<u8>,
  entries: vector<StealthEntry>,  // append-only bis Cap
  // StealthEntry: ciphertext, optional msg_id / seq_u16, delete_commit-Felder …
}
```

| Alternative | Urteil |
|-------------|--------|
| **Queue unter `slot_tag(epoch)`** | **MVP** — Lookahead bleibt `epoch±W` Tags; Append statt Replace |
| **Sub-Index im Hash** (`… \|\| seq`) | **Nicht MVP** — Lookahead müsste `seq=0..N` raten/scannen (unbounded oder Cap-Rätsel); mehr RPC |

**Cap:** z. B. max **32** Entries pro Bucket (Gas/DoS). Voll → neuer Send ablehnen oder nächste Epoche erzwingen (Produktregel in Move-Scheibe).

**Purge:** bevorzugt **eine Entry** (per `msg_id` / Index + `delete_secret`), optional ganzes Bucket — siehe §3.3.

### 3.2 Payload

Ciphertext wie heutige Enc-Nachricht (AES-GCM / bestehender Wire). Klartext **nur** lokal nach Entschlüsselung. Stealth ändert den **Index**, nicht zwingend den Content-Codec. Jede Queue-Entry = ein Ciphertext (+ Metadaten für Purge).

### 3.3 Purge / Rebate (Soll-API)

Skizze Move (Namen vorläufig):

```
// Eine Entry im Bucket
purge_stealth_entry(
  mailbox: &mut Mailbox,
  slot_tag: vector<u8>,
  entry_id: u64,              // oder Index / msg_id
  delete_secret: vector<u8>,  // Beweis: kennt Ableitung
  // intern: delete_commit matcht Entry
)

// Optional: ganzes Bucket leeren
purge_stealth_bucket(mailbox, slot_tag, delete_secret)
```

- Nur wer `delete_secret` (aus SharedSecret-Ableitung) kennt, darf löschen → Rebate wie bestehende Purge-Pfade, sofern Mailbox das unterstützt.
- **Ohne** gültigen Commit: Abort.
- Replace-Semantik **verboten** für Store: nur **append** in den Bucket (bis Cap).

Genaues Move-Layout = **Implementierungs-Scheibe** (nicht diese Spec).

---

## 4. Empfänger: Lookahead

1. Kennt `SharedSecret` + vereinbarte Epoch-Regel.  
2. Berechnet `slot_tag` für `epoch ∈ [now−W, now+W]` (kleines Fenster, z. B. W=2…24).  
3. Liest Treffer-**Buckets** aus Haupt-Mailbox und alle `entries` darin.  
4. Nach Lesen: optional `purge_stealth_entry` / Bucket-Purge (Burn-ähnlich) — Produktregel später; Default-Empfehlung: **nach Lesen purge** für Stealth-Charakter.

**Risiken:** Polling/Akku, Uhr-Drift, Gas beim Purge, Explorer-Heuristiken (Traffic-Muster bleiben).

**Gas-Zahler (Empfang/Purge):** Auch Purge-TXs haben einen Zahler — siehe §5.1; für maximale Explorer-Tarnung Purge ggf. über Sponsor/Relayer (Backlog, nicht Stealth-MVP-Pflicht).

---

## 5. Client (Soll, nach User-OK)

| Hebel | Regel |
|-------|--------|
| Composer | Opt-in **„Diskret senden“** — speichert in Shared/`MAILBOX_ID` + append in `slot_tag`-Bucket |
| Default | **aus** |
| Override | Experte darf Mailbox-ID weiter manuell setzen; Diskret ohne Shared Secret → blocken mit klarer Meldung |
| Inbox | Alle Bucket-Entries wie Enc-Mails; Badge „diskret“ optional |
| M4e-Dropdown | Unverändert; Diskret ≠ Zwischenlager |

### 5.1 Sender-Adresse / Gas (Ehrlichkeit)

| Schicht | Was Explorer typischerweise sieht |
|---------|-----------------------------------|
| **Stealth `slot_tag` allein** | Kein Empfänger-Wallet-Index am Slot — **aber** die **Adresse, die Gas zahlt**, bleibt an der TX sichtbar |
| **+ Gas-Sponsor / Relayer** (R2 sponsored oder R1 `submit_ready` mit Relayer-Submit) | Zahler ≠ inhaltlicher Sender → **maximale** Metadaten-Tarnung erst hier |

- Stealth-MVP **darf** mit normaler Sender-Wallet gasen (Empfänger-Index trotzdem geschützt).  
- UI/Doku: klar sagen „Diskret ≠ unsichtbar wer sendet“.  
- Querverweis: Relayer/Kurier **`submit_ready`** (Roadmap R1/R2, geparkt) und **`docs/SPONSORING-AND-CREDITS-DOUBLE-FLOOR.md`** — **kein** Muss für ersten Stealth-Store; **Pflicht-Hinweis** in Composer-Hilfe wenn Diskret an.

---

## 6. Nicht-Ziele dieser Spec-Scheibe

- Move-Deploy / Package-Upgrade  
- Lookahead-Polling-Code  
- Composer-UI „Diskret“  
- M4e-Schubladen-UX-Feinschliff  
- Kurier / Linkify / Handy-Feldtest  
- Pflicht-Sponsoring für jedes Diskret-Send (nur dokumentierte Grenze + später Opt-in)

---

## 7. Abnahme-Reihenfolge

1. ~~User: Spec grün~~ **PASS 2026-11-28** (+ Multi-Msg Queue + Gas-Hinweis).  
2. Mini-Lib Vitest: `slot_tag`-Ableitung deterministisch (ohne Chain).  
3. Move-MVP: Bucket-Append + Cap + Entry-Purge; Client Opt-in — **eigene** kleine Scheiben, Default aus.  
4. 1-Gerät-Smoke (zwei Wallets am PC), dann Logbuch-Zeile.  
5. Optional später: Sponsor/Relayer-Pfad für „Diskret + fremder Gas-Zahler“.

---

## 8. Kurzentscheidungen festgehalten

- Mailbox = **Shared/Haupt**, nicht Privat.  
- Aktivierung = **Opt-in**, nie stiller Default.  
- `buffer` bleibt Aktenschrank.  
- `slot_tag` = **Epoch-Bucket**; Multi-Msg = **Queue/Append**, nicht Replace; **kein** Seq-im-Hash als MVP.  
- Gas-Zahler ≠ Empfänger-Tarnung — Sponsor/Relayer für Maximal-Tarnung, Stealth allein reicht für Empfänger-Index.  
- Bau (Move/UI) erst nach explizitem Start der nächsten Scheibe.
