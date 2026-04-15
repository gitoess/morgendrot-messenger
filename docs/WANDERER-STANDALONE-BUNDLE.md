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

1. Bundle bauen (oder archivierte Kopie verwenden).
2. Pro Einsatz/Kunde die **`.env`** im Bundle-Root anpassen (**keine** Seeds auf SD/USB): u. a. `PACKAGE_ID`, `RPC_URL`, `BOSS_ADDRESS` / Partner — siehe **`docs/BOSS-ORIENTIERUNG.md`** (Lieferwege).
3. Auf dem Gerät: `npm install` (Root + ggf. `frontend/`), dann **`npm run dev`** oder produktionsnaher Start laut **`docs/DEV-START.md`**. **Hinweis (Zielbild 2026-04):** Langfristig **kein Pflicht-Node** — siehe **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**; bis zur Umsetzung kann der Bundle-Start weiterhin **Node + Next** meinen.
4. **Seed / Vault-Passwort nur auf dem Gerät** eingeben — nie auf das Medium schreiben.

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

*Stand: 2026-04-28 — Verweis **§ H.7b** (Backpack-Node, Heltec, Degraded-Zielbild); **§ H.15** (Handy-first, optionaler Node); H.0 #2 „Wanderer“/Bundle bleibt kanonische Einstiegsseite.*
