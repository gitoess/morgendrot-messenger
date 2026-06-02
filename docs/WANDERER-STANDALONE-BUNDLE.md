# „Wanderer“-Abgabe: Standalone Smartphone (Bundle)

**Zweck:** Ein **einziger** Leitfaden für die **Messenger-PWA-Abgabe** (oft **schlanke Oberfläche**, `UI_VARIANT=messenger` / „Wanderer“-Narrativ in **`docs/ROADMAP-FAHRPLAN.md` § H.0**). Für **Boss/Technik** und **Helfer**-Erstinstallation.

**Nicht** dasselbe wie die reinen Messenger-Exports unter **`exports/Morgendrot-Messenger-*`** — hier geht es um **Next.js + API** im Ordner **`exports/morgendrot-standalone-smartphone/`**.

---

## 1. Bundle bauen

```bash
npm run bundle:standalone-smartphone
```

- **Ausgabe:** `exports/morgendrot-standalone-smartphone/` (wird oft per **`.gitignore`** nicht versioniert — bei Bedarf neu bauen).
- **Technik:** `scripts/bundle-standalone-smartphone.ts` — vollständige **`.env.example`** aus dem Hauptrepo + PWA-Overrides; **`postinstall`** → **`scripts/ensure-env.mjs`** legt **`.env`** an, wenn noch keine existiert.
- **Details im Bundle:** `README.md` im erzeugten Ordner (nach dem Bündeln lesen).

---

## 2. Boss → Medium → Helfer (Kurzablauf)

### Variante A — PC/Server mit Morgendrot-Basis (klassisch)

1. Bundle bauen (oder archivierte Kopie verwenden).
2. Auf dem Gerät: `npm install` … **Handoff:** Boss-**ZIP** (~3 KB) → **Einstellungen → Handoff importieren** (oder manuell `.env` aus ZIP, **`docs/HANDOFF-IMPORT-UX.md`**). **Boss-Export** auch unter **Einstellungen** (Rolle Boss). Dann `npm run dev` / Produktionsstart.

### Variante B — APK ohne dauernden Morgendrot-Node (**§ H.15**, Stand 2026-06)

1. **APK:** `cd frontend && npm run apk:debug:build` → installieren (siehe **`docs/HANDY-LATER-MANUAL-TESTS.md`** § B).
2. **Handoff** auf dem Handy: ZIP → **„Lokal vormerken (ohne Basis)“** (RPC + Ketten-IDs) — optional später Basis-Apply, wenn ein Server erreichbar ist.
3. **Peering-QR** (Boss zeigt, Helfer scannt) oder Puls → Partner-Adresse + ECDH-Pub; danach Handshake/Connect/Senden per **Direkt-RPC** (kein Pflicht-`/api/handshake`).
4. **Erwartung:** Node optional für den privaten Online-Chat; Funk (LoRa/Mesh) unverändert lokal. Smoke: **`docs/STANDALONE-SMOKE-CHECKLIST.md`** (4b–4f); Langform **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** § 10.

Vollständigere Tabelle: **`docs/ROADMAP-FAHRPLAN.md` § H.7**.

---

## 3. Optional: zwei getrennte Ordner (Dienst vs. Übung)

Wenn **Interessierte** parallel **Mainnet (Dienst)** und **Testnet (privat)** nutzen wollen — **ohne** Code-Feature:

- Zwei **Kopien** des Bundle-Ordners (z. B. `morgendrot-einsatz` / `morgendrot-test`).
- Je Ordner **eigene** `.env` (`RPC_URL`, `PACKAGE_ID`, `MAILBOX_ID`, …) und ggf. eigener **`VAULT_FILE`**-Pfad.
- Zwei Starter/Verknüpfungen auf dem Desktop/Phone-Homescreen.

Einordnung: **`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`**, Fahrplan **§ H.8**.

---

## Verwandte Dokumente

- **`docs/ROADMAP-FAHRPLAN.md`** — **§ H.0** (#2), **§ H.7** (Ist/Backlog), **§ H.7b** (Feld: Backpack-Node + Heltec + Betriebsmodi / Degraded-Zielbild)  
- **`docs/DEV-START.md`** — Ports, zwei Oberflächen (Lite-UI vs. Next)  
- **`README.md`** — Skript `bundle:standalone-smartphone`  

---

*Stand: 2026-06-02 — **Variante B** APK ohne Pflicht-Node (Handoff lokal, Peering-QR, Direkt-RPC); zuvor 2026-04-28: **§ H.7b**, **§ H.15**, H.0 #2.*
