# Evidenz-Bild (Object-ID) & NFT-Attribute im Messenger

**Stand:** 2026-11-05  
**Status:** Viewer-Experiment (automatisch). Move-`ImageNFT` **nicht** im Morgendrot-Repo — bewusst separates Package (`morgendrot_nft`).

## Bekanntes Experiment-Package

```
0x236609dff5ad4a4e118bf29c0df1a9013ca4585348d4b2d94a3028c505d106c7
```

Nur als **Hinweis** in `KNOWN_IMAGE_NFT_PACKAGE_IDS`. Der Nutzer gibt die Package-ID **nicht** ein.

## 1. On-Chain-Bild — Automatik (Ist)

**Nicht** die Package-ID als Bild laden — das ist nur das Modul.  
Echte Bild-Object-IDs z. B. aus Mint-Events / Explorer.

Ablauf:

1. **Object-ID** → `getObject` → `ImageNFT` / `image_data` **oder** URL-NFT (`url` / IPFS in Description, z. B. `SimpleNFT`) → lokal bzw. Gateway-Bild  
2. **Besitzer-Adresse** → `getOwnedObjects` StructType `…::image_nft::ImageNFT`, **10er-Seiten** (Galerie filtert weiter auf ImageNFT; fremde URL-NFTs per Object-ID laden)  
3. **On-Chain / NFT** (Posteingang-Toolbar) → Tabs ohne Auto-Laden; **Eigene NFT anzeigen** oder Adresse/Object suchen  
 

4. **Wire** → nur lokale `MORG_COMPACT_IMG_V1`  
5. **Klartext** → `PlainMsgKey`-DFs **und** `PlaintextMessage`-Events (Default-Send oft Event → nur Events)

### Was die Galerie listet / nicht listet

`getOwnedObjects` filtert **nur** `…::image_nft::ImageNFT` des bekannten Packages.  
**Nicht** gescannt: Tickets, AccessKeys, generische „TXT“, Mailbox-DFs, andere Packages.

### Verschlüsselung (echt vs. Flag)

| Variante | On-chain | Schlüssel |
|----------|----------|-----------|
| Move-Feld `encrypted: bool` | oft trotzdem Klartext-`image_data` | **kein** Schlüssel — nur Metadaten |
| Client **MORGIMGE1** | Ciphertext in `image_data` | Passphrase **nur off-chain** |

**Mint-UI:** Werkzeuge → Minten → Datei, Klassifikation, optionale Attribute, optional verschlüsseln.  
Auto-Verkleinerung (~12 KB), Gas ≥ 200 M MIST. Attribute: siehe §2.

UI: Posteingang → **On-Chain / NFT**  
Code: `evidence-*-*.ts`, `evidence-mailbox-plain-scan.ts`, `chat-view-evidence-image-viewer.tsx`

## 2. Mint-Attribute (ohne Move-Redeploy)

Contract-Felder (fest): `name`, `description`, `classification`, `hash`, `encrypted`, `content_type`, `image_data`, `created_at`.  
**Keine** Dynamic Fields im aktuellen Move-Modul.

| UI | On-chain |
|----|----------|
| Klassifikation | Feld `classification` |
| Freie Key/Value (max. 6) | Block `[morg-attrs]` in `description` (`evidence-image-attrs.ts`) |

Alles öffentlich lesbar. Caps klein halten. Echte DF-Attribute = neues Move-Deploy.

## 3. Fremde Adresse → Klartext-Chat? (Bewertung)

Idee: „Adresse eingeben, alle TXT/Objekte scannen, Unverschlüsseltes anzeigen.“

### Was daran stimmt

- Unverschlüsselte Payloads sind on-chain **öffentlich**, wenn man die **richtigen Objekte** findet.
- ImageNFTs per Besitzer-Adresse gehen bereits (`getOwnedObjects` + StructType).
- Ein Klartext-Viewer *könnte* analog gebaut werden — aber **nicht** über „Wallet = Chat-Inbox“.

### Fehler / Ungenauigkeiten in der Kurzfassung

| Aussage | Korrektur |
|---------|-----------|
| „In den IOTA Explorer einloggen“ | Apps nutzen **RPC** (`getOwnedObjects`, `getDynamicFields`, Events) — kein Explorer-Login. |
| „Alle TXT einer Adresse“ | Morgendrot speichert Nachrichten **nicht** als generische TXT-Owned-Objects. Klartext liegt in **Mailbox-Dynamic-Fields** (`PlainMsgKey`) und/oder **Events** — Parent ist `MAILBOX_ID`, nicht die User-Adresse als Object-Owner der Nachricht. |
| „getOwnedObjects reicht“ | Für ImageNFT ja. Für Messaging: Shared-/Private-Mailbox scannen (`getDynamicFields` am bekannten Mailbox-Objekt) und nach `recipient`/`sender` filtern — oder Event-Queries. Ohne bekannte `MAILBOX_ID` + Package findet man den Chat einer Adresse **nicht** zuverlässig. |
| „Unverschlüsselt = Ausnahme, widerspricht Kern“ | Teilweise überzeichnet: Klartext-Pfade sind **first-class** (Events/Mailbox). Hochsicherheit heißt: E2EE ist der **Normalfall für sensibel**, Klartext bleibt bewusst möglich und öffentlich. |
| „Wer Klartext sendet, liest ihn sowieso im Explorer“ | Nur wenn man **weiß wo** (Mailbox-Objekt, DF-Layout, Events). Ein Wallet-Adress-Scan allein liefert das **nicht** „wie WhatsApp fremder Chats“. |
| „Metadaten: App-Abfrage verknüpft Adresse“ | Öffentliche Fullnodes sehen Queries ohnehin. Relevanter: **UX-Erwartung** („fremde Chats lesen“) und RPC-Last / Abuse. |

### Produkt-Empfehlung

| Feature | Status |
|---------|--------|
| Eigene / fremde **ImageNFTs** per Adresse | Ja (Ist) |
| Wire-Bilder fremder Adresse | Nein (lokal) |
| Fremde Klartext-**Mailbox**-Zeilen nur mit Adresse | Nein als Default — bräuchte Mailbox-ID + Package; wirkt wie Chat-Viewer für Dritte |
| Klartext DF + Events (Tab Klartext) | Ist — Expert; Events ohne MAILBOX_ID möglich |

## 2b. Mint-Attribute vs. Dynamic Fields

Feste Struct-Felder: name, description, classification, content_type, hash, encrypted, created_at.  
Zusatz-Attribute: UI max. 6; **aktuell** in `description` als `[morg-attrs]` (deploytes Package hat keine `add_attr`-Entry). Echte Move-DFs = Redeploy.

## 4. Reihenfolge

1. ~~Object-ID / Owner / Mint / Wire~~  
2. ~~Klassifikation + freie Attrs in description~~ / ~~NFT anzeigen Toolbar~~  
3. Move-Modul optional ins Morgendrot-Repo; DF-Attribute nur mit neuem Deploy  
4. Fremd-Klartext-Scanner **nicht** als Messenger-Kern
