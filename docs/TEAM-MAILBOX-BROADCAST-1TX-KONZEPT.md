# Team-Mailbox: 1× Fee / Gruppen-Multicast (Konzept)

**Stand:** 2026-05-20 · **Status:** Backlog (nach § H.22 M2c / Team-E2EE)  
**Problem:** Gruppenchat sendet heute **pairwise** (N Empfänger → N Mailbox-TX). Team-Mailbox ist on-chain nur ein weiteres `Mailbox`-Object mit denselben `MsgKey(sender, recipient)`-Feldern.

---

## Ist (Move + TS)

| Teil | Heute |
|------|--------|
| `create_team_mailbox` | Erzeugt normales `Mailbox { id }`, `share_object` — **kein** Gruppenschlüssel |
| Speichern | `store_encrypted_message` / `store_plaintext_message` pro **Paar** (0x Sender, 0x Recipient) |
| TS Send | `use-chat-view-handle-send.ts` → `sendTo = recipient.trim()` (**ein** Composer-Empfänger) |
| TS Store | `my-team-mailbox-store.ts` + `my-mailbox-active.ts` — nur Object-ID, **kein** Team-Key |

**Folge:** „An Gruppe senden“ mit Mailbox-Persistenz = **Schleife über `memberAddresses`** oder manuelles N-mal Senden → **N Fees**.

---

## Zielbild

1. **Eine** on-chain Schreiboperation pro Gruppennachricht (Team-Mailbox-Object-ID).
2. **Alle** Mitglieder mit Team-Key können entschlüsseln (symmetrisch oder Gruppen-E2EE).
3. Mitgliederverzeichnis **off-chain** (wie heute Gruppenliste in `messenger-group-store.ts`).

---

## Move (Vorschlag — nicht `protocol_config.move`, sondern `messaging.move`)

Neues Objekt oder Erweiterung:

```text
struct TeamMailbox has key {
    id: UID,
    // Optional: Key-Version / Rotation-Nonce — KEIN Klartext-Key on-chain
    key_epoch: u64,
}

struct TeamBroadcast has store {
    sender: address,
    epoch: u64,
    nonce: u64,
    ciphertext: vector<u8>,  // AEAD mit Team-Key (off-chain verteilt)
    ttl_days: u64,
}
```

Neue Entry-Funktionen (Skizze):

- `store_team_broadcast(mb: &mut TeamMailbox, ciphertext, …)` — **ein** DF pro Nachricht, **ohne** `recipient` im Key.
- `purge_team_broadcast` — Rebate analog `purge_message`.

**Wichtig:** Den **symmetrischen Team-Key niemals** im Move-Object speichern. Verteilung:

- Boss erstellt Team → Key generieren (32 Byte) → QR / verschlüsselter Export / Pairwise an Mitglieder.
- Optional: pro Mitglied `store_team_member_wrap` mit **dessen** ECDH-Handshake-Key (später, teurer).

Abgrenzung zu heutigem `Mailbox`: Shared/Team-**Pairwise** bleibt für 1:1; **TeamBroadcast** nur für „an alle“.

---

## TypeScript (Vorschlag)

| Datei | Änderung |
|-------|----------|
| `my-team-mailbox-store.ts` | `teamKeyFingerprint`, `keyEpoch` (lokal), **nie** Rohtext-Key in localStorage ohne Vault |
| `messenger-group-store.ts` | `teamMailboxObjectId` + `useTeamBroadcast: boolean` pro Gruppe |
| `use-chat-view-handle-send.ts` | Wenn `isGroup && persistence===mailbox && activeTeamMb`: `encryptTeamBroadcast(plaintext)` → **ein** `store_team_broadcast` |
| `inbox-multi-mailbox-fetch.ts` | Team-Mailbox-Fetch liest **Broadcast-DFs** + weiterhin Pairwise für 1:1 |
| Vault | Team-Key in `.handshakes` oder neues `.team-keys.enc` |

---

## Gruppenchat-UI — pairwise Multicast (**Ist 2026-05**)

**Umgesetzt (Option A):** `frontend/frontend/lib/group-mailbox-pairwise-send.ts`, Schleife in `use-chat-view-handle-send.ts` (`sendMailboxPairwiseGroup`), Checkbox im **Gruppen-Panel**, Hinweis im Composer. LocalStorage: `morgendrot.groupMailboxSendAll.v1` (Default: an).

**Noch nicht:** 1× Fee — siehe Move-Skizze oben (`TEAM-MAILBOX-BROADCAST-1TX-KONZEPT.md`).

---

## Verweise

- `docs/TEAM-MAILBOXES.md`, `docs/SENDEWEGE-KANAL-MAILBOX-UEBERSICHT.md`
- § H.22 **M2c** (Gruppen-E2EE), § H.23 (Ratchet vs. Team-Key)
