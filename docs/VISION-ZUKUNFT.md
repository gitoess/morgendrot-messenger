# Vision & Zukünftiges

*Alles in diesem Dokument ist reine Vision bzw. mögliche Erweiterung. **Momentan nichts davon umsetzen** – kein Code, keine neuen Kategorien in der App.*

---

## Bereits als Vision festgehalten

- **Proxy-Chip (Heimnetzwerk-Firewall):** Siehe [PROXY-CHIP-VISION.md](PROXY-CHIP-VISION.md). Traffic-Interception + Chain-Berechtigung.
- **Geführter Assistent „Neu anfangen“ (Tresor):** Mehrstufiger Reset (Inbox, Sperren, optional Vault-Datei, Verweis Notfall/Chain) — Fahrplan **`ROADMAP-FAHRPLAN.md` § H.30**; Ist-Doku **`VAULT-EINRICHTEN.md`** (Checkliste ohne UI).

**Ordner-Idee:** Alles unter **`docs/VISION-ZUKUNFT.md`** und verlinkte `*-VISION.md` / `*-ZIELBILD.md` — **kein** separates `ideas/`-Verzeichnis; Backlog mit Status bleibt **`docs/ROADMAP-FAHRPLAN.md`**.

---

## Mögliche neue Kategorien (Web3 / Rebased 2025–2026)

Nur Ideen – **nicht** im aktuellen Stand der App.

| Nr | Kategorie | Kurzbeschreibung |
|----|-----------|------------------|
| **6** | Werte & Erträge (Staking & Rewards) | Staking-Monitor, Reward-Claimer, Validator-Wahl (DPoS/Rebased). Braucht Staking-/Delegation-APIs. |
| **7** | Token-Fabrik (Assets & DeFi) | Coin-Minter, Swap-Interface (DEX), Gas-Station (Sponsoring). Braucht Move-Module / DEX-Integration. |
| **8** | Identität & Reputation | Profil-Manager (z. B. IOTA Name Service), verifizierte Nachweise (ZK), Reputations-Score. Braucht Identity-Layer. |
| **9** | Energie & Ressourcen | Einspeise-Zähler, Ressourcen-Sharing (Rechenleistung, Speicher). Braucht Domänen-/Hardware-Integration. |

---

## Technische Upgrades (Rebased-spezifisch)

Ebenfalls nur als Optionen notiert – **keine Umsetzung ohne explizite Entscheidung.**

- **Programmable Transaction Blocks (PTB):** *Umsetzung „Key + Nachricht in einer TX“:* `/create-key-and-notify` (lock, recipient, [ttl], Nachricht) bündelt `create_access_key` + Plain-Nachricht in einer Transaction. Weitere PTB-Bündelungen optional.
- **Objekt-Ownership / Move:** Schloss-Objekt direkt an Gast „schicken“, statt nur ID in .env prüfen. Verfeinerung des bestehenden Key/Ticket-Modells.
- **Dynamic Fields:** Tickets/Schlüsseln zur Laufzeit neue Funktionen geben (z. B. Zusatzzahlung für Verlängerung), ohne Code neu hochzuladen. Move-Vertrags-Erweiterung.

---

## Größerer Schritt (Vision): Ticket als Objekt erweitern & darstellen

**Aktuell bewusst nicht umgesetzt** – nur hier eingeordnet.

1. **Dynamic Fields im Move für Tickets**  
   Nachträglich Felder anhängen (z. B. VIP-Upgrade, Nutzungs-Zähler, Badges). Ticket-Objekt „lernt“, ohne neues NFT zu minten.

2. **IOTA Display + Template/QR**  
   - **Display:** Einmaliges Template für den Ticket-Typ; Variablen wie `{sitzplatz}`, `{besitzer_name}` aus dem Objekt füllen → Wallet/Explorer rendern grafisches Ticket (SVG/PNG).  
   - **QR-Code:** Link zu Ticket-Daten im Bild; Einlass-Gate scannt, gleicht on-chain ab, setzt `used`.

3. **Reihenfolge**  
   Zuerst Dynamic Fields (Move), dann Display/QR optional darauf aufsetzen. Kein Code dafür ohne explizite Entscheidung.

---

## Rebased-Features (kurz vermerkt)

- **Mysticeti Consensus:** Schnelle Finality (<500 ms), hoher Durchsatz. Kein Code nötig – Netzwerk-Eigenschaft; OPEN/Key-Prüfungen profitieren.
- **zkLogin (Web2-Login für Web3):** Option für späteres Onboarding (z. B. „Login mit Google“ → Wallet). Für aktuelle Lock/Boss/API-Flows nicht nötig.
- **Shared vs. Owned Objects:** Owned (Key, Ticket, Coins) → sehr schnelle Verarbeitung; Shared (z. B. Pinnwand) → kurzer Konsens. Erklärt Latenz-Unterschiede.
- **Native Liquidity & Stablecoins (z. B. VUSD, DeepBook):** Nur relevant, wenn feste Preise (z. B. Ladesäule in VUSD) gewünscht; optional in Vision.

---

## Status

- **Aktuell:** 5 Kategorien + Setup. PTB: `/create-key-and-notify`. **Sponsored Transactions:** SPONSOR_GAS_OWNER + SPONSORED_TRANSACTION_ENABLED; API-Body `sponsorForSender` für Key-Ausstellung im Namen eines Gastes (Vermieter/Boss zahlt Gas).
- **Vision/Zukünftiges:** Weitere PTB-Bündel, Objekt-Ownership, Dynamic Fields, zkLogin bei Web-Onboarding – nur hier und in PROXY-CHIP-VISION.md; Implementierung bei Bedarf.
