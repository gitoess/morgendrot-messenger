# NFT-Schlüsselkarte (§ H.23 B2)

**Stand:** 2026-11-06  
**Status:** **P0 Ist** (Spec + Enc-Store + `local-secret-vaults`); P1–P3 offen.  
**Voraussetzung:** H.23 B1 Vault-Sidecars Ist (`teamKeys.enc.v1`, Chat-/ImageNFT-Passphrasen).  
**2-Geräte-Feldtest (Team-Key / Erneut sperren):** bewusst **später** — blockiert B2-P0 nicht.

## 1. Ziel

**Zusätzlicher Zugriffsmodus** für spezielle Enc-Inhalte (Evidenz / geteilte Bilder / selten PWMSG) — **kein** Ersatz für die normale Absender-Passphrase und **nicht** für den Alltags-Direktchat (dafür ECDH/Session bzw. manuelle Passphrase).

Ein on-chain **besessenes** NFT dient als **Schlüsselkarte**: die App speichert lokal (vault-verschlüsselt) eine oder mehrere Passphrasen/Ableitungen an die **Object-ID**. Beim Lesen entscheidet die App nach Bindungsmodus:

| Modus | Klartext frei wenn |
|-------|-------------------|
| **Passphrase** (Default, ohne Karte) | Nutzer kennt / Vault hat Slot — wie heute |
| **NFT-Besitz** | Signer besitzt die Karten-Object-ID (`getOwnedObjects` / Owner) **und** lokaler Slot passt |
| **Beides** (optional) | Besitz **und** Passphrase |

Optional beim Senden: **„Key an NFT binden“** — Wire/Meta referenziert die Karten-Object-ID (off-chain Hinweis); Empfänger mit Besitz (und ggf. Passphrase) können entschlüsseln. Nutzen: geteilte Evidenz, temporäre Leserechte, Weitergabe durch **NFT-Transfer**.

**Reihenfolge:** Absender-Passphrase-Komfort (Vault-Remember nach Send/Mint) stabil → dann B2 P1 UI.

## 2. Nicht-Ziele

| Nicht | Warum |
|-------|--------|
| Ersatz für Alltags-Passphrase / Absender-Remember | Komfort-Pfad bleibt Vault-Sidecar ohne NFT |
| Ersatz für Handshake / Session-Keys | Besitz ist on-chain öffentlich; Transfer = Leserecht weitergeben |
| Ersatz für Team-Key | Team-Broadcast bleibt Gruppen-Geheimnis + Handoff |
| Geheimnis on-chain speichern | Passphrasen bleiben off-chain (Vault-Sidecar) |
| Verhindern von Klartext-Kopieren | UI kann kopieren — OPSEC bleibt Nutzerverantwortung |

## 3. Bedrohungsmodell (kurz)

- **Chain-Observer:** sieht NFT-Meta, Owner, ggf. Bindungs-Hinweis in Wire/Description — **nicht** die Passphrase.
- **Diebstahl der Wallet:** Angreifer mit Signer kann Besitz nachweisen → App würde lokal entschlüsseln, **wenn** Vault-Passwort + Sidecar auf dem Gerät liegen.
- **Transfer des NFT:** neuer Owner „darf“ laut Produktmodell lesen — alte lokale Keys auf dem Verkäufer-Gerät bleiben, bis Purge/Erneut sperren.
- **XSS/Malware:** wie andere Vault-Sidecars.

## 4. Datenmodell

### 4.1 Lokaler Sidecar (P0)

`localStorage` Enc-Blob (Vault-Passwort), Schema z. B.:

```text
morgendrot.nftKeycard.enc.v1
schema: morgendrot.nft-keycard.enc.v1
```

Klartext-JSON:

```json
{
  "v": 1,
  "cards": {
    "0x<objectId>": {
      "label": "Einsatz-Karte Alpha",
      "slots": [
        { "id": "default", "passphrase": "…", "note": "PWMSG" },
        { "id": "img", "passphrase": "…", "note": "MORGIMGE1" }
      ],
      "boundWires": { "fnv:…": "default" }
    }
  }
}
```

Unlock/Lock/Purge über **`unlockLocalSecretVaults`** (wie Chat/ImageNFT/Team-Keys).

### 4.2 On-chain (optional, später)

- **P1:** nur bestehende ImageNFT/SimpleNFT — Bindung rein lokal + Wire-Hinweis.
- **P2:** Description-Block `[morg-keycard]` mit öffentlicher Karten-ID / Slot-Namen (**keine** Secrets).
- **P3:** eigenes Move-Typ nur wenn nötig (nicht Blocker).

### 4.3 Wire-Hinweis (P1)

Bei Passphrase-Send mit Bindung: Meta im bestehenden PWMSG oder Prefix-Hinweis z. B. lokal gespeicherte Object-ID am Wire-Fingerprint (`boundWires`). Empfänger ohne Besitz sieht weiter normales „Passphrase nötig“.

## 5. UX

| Ort | Aktion |
|-----|--------|
| On-Chain / NFT Galerie | „Als Schlüsselkarte merken“ → Slots anlegen / Passphrase speichern |
| Composer Passphrase-Schutz | Checkbox **„Key an NFT binden“** → Karte wählen |
| Bubble / ImageNFT | Auto-Unlock wenn Besitz + Slot; sonst Passphrase; **Erneut sperren** analog |
| Einstellungen Notfall | Purge inkl. `nftKeycard.enc` |

## 6. Lieferphasen

| Phase | Liefergegenstand | Move? |
|-------|------------------|-------|
| **P0** | Spec (dieses Doc) + Enc-Store + Unlock-Hook + Vitest | Nein |
| **P1** | Galerie „Als Schlüsselkarte“ + Composer-Bindung PWMSG + Besitz-Check | Nein |
| **P2** | Multi-Slot UI + ImageNFT-Mint an Slot | Nein |
| **P3** | Optional Description-Marker / Move | Optional |

## 7. Abnahme (später Feld)

1. Mint/besitze NFT → als Karte merken → PWMSG mit Bindung senden → auf **demselben** Gerät nach Lock/Unlock auto-lesbar.  
2. Zweites Gerät **ohne** Karte/Slot: nur Ciphertext.  
3. (Später) Transfer-Szenario dokumentieren, nicht Automatik-Löschen auf Altgerät.

## 8. Verwandte Docs

- **`docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`** §13 B2  
- **`docs/EVIDENCE-IMAGE-AND-NFT-ATTRIBUTES.md`**  
- **`docs/SECURITY-CLAIMS-CHECK-2026-11.md`**  
- **`docs/ROADMAP-FAHRPLAN.md`** Nachtrag H.23
