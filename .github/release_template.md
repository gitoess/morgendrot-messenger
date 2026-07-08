## ⚠️ Experimentelles Hobby-Projekt

**Kein fertiges Produkt. Keine Sicherheitsgarantien. Kein Support. Nicht für lebenskritische Einsätze geeignet. Nutzung auf eigene Gefahr.**

- **EU-Nutzer:** Nicht auf EU-„Chat Control“/Scanning-Anforderungen ausgelegt — erhöhtes rechtliches Risiko möglich.
- **Kommerzielle Nutzung** nur mit schriftlicher Erlaubnis — siehe [COMMERCIAL-LICENSING.md](../COMMERCIAL-LICENSING.md).
- **Lizenz:** AGPL-3.0 — siehe [LICENSE](../LICENSE).
- Vollständiger Text: [DISCLAIMER.md](../DISCLAIMER.md).

## Artefakte

| Datei | Beschreibung |
|-------|----------------|
| `morgendrot-messenger-android-debug.apk` | Unsigned debug — **nur Sideload**, nicht aus App Stores |
| `morgendrot-messenger-pc-standalone.zip` | PC-Bundle — **ohne** `.env`, **ohne** `node_modules` |
| `SHA256SUMS.txt` | SHA-256-Prüfsummen |
| `LICENSE`, `DISCLAIMER.md`, `COMMERCIAL-LICENSING.md` | Rechtstexte |

## Installation

### Android (Sideload)

1. APK installieren (unbekannte Quellen erlauben).
2. **Handoff** vom Boss importieren (Einstellungen) — nicht aus diesem Release.
3. Seed/Vault nur auf dem Gerät — nie in Chats oder ZIPs teilen.

### PC (Standalone)

1. [Node.js LTS](https://nodejs.org/) installieren.
2. ZIP entpacken, im Ordner: `npm install`
3. `.env` aus `.env.example` oder Boss-Handoff anlegen.
4. `npm start` → Browser `http://127.0.0.1:3341` (Ports siehe `.env`).

Details: `docs/HOBBY-RELEASE-POLICY.md`, `docs/WANDERER-STANDALONE-BUNDLE.md`.

## Checkliste (Maintainer)

- [ ] Pre-release aktiviert
- [ ] Disclaimer oben unverändert
- [ ] SHA256SUMS verifiziert
- [ ] Keine Secrets in ZIP/APK
