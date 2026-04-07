# Rollenwechsel im Team (Sanitäter → Truppführer & Co.) — Ist vs. Erzählung

**Zweck:** Die **organisatorische** Idee („gleiche Hardware, neue digitale Rolle“) mit dem **Repo-Stand** abgleichen — ohne falsche Erwartung an **OTA-Fernumstellung** oder **fertiges Trägerbild-Produkt**.

**Stand:** 2026-03-28 — Abgleich mit `src/config.ts` (`buildDeviceEnvLines`), `POST /api/provision-device`, Lite-UI `ui/index.html`, `messenger-command-handler.ts` (`/set-role`), Doku Trägerbild/Steganographie.

---

## 1. Was stimmt (Kern)

| Aussage | Einordnung |
|--------|------------|
| **Gleiche Software, kein Gerätewechsel nötig** | **Stimmt.** Messenger-/Node-Build ist pro Edition gleich; **Identität und Rechte** kommen aus **Konfiguration** (`.env`: u. a. `ROLE`, `ROLE_ID`, Adressen) und ggf. **lokalem Vault** (`.morgendrot-vault` / `VAULT_FILE`). |
| **„Digitale Identität“ entscheidet** | **Stimmt** im Sinne von: **Wallet-Adresse** + **`.env`-Parameter** + **Vault-Inhalt** bestimmen Verhalten; es gibt keine separate „Sanitäter-Hardware“. |
| **Boss kann ein neues Profil mit anderem `ROLE_ID` erzeugen** | **Stimmt** im **Provisioning-Wizard** (Lite-UI): Profil wählen (`roleId` / Bitmaske) → `POST /api/provision-device` erzeugt u. a. Zeilen `ROLE=…` und **`ROLE_ID=<Zahl>`** in der generierten Geräte-`.env`. |

---

## 2. Was präziser formuliert werden sollte

### 2.1 „Knopfdruck“ und sofort auf dem Helfer-Gerät

- **Ist:** Nach **„Generieren“** liegt das Paket (`.env` / Export / ZIP — je nach Schritt) zuerst beim **Boss** (Browser/Download). Es gibt **keinen** automatischen Server-Push, der die **laufende** `.env** auf dem Telefon des Helfers **fern** überschreibt. Der Helfer (oder die Einsatzstelle) muss das neue Paket **übernehmen** (Kopie, USB, sicherer Kanal) und das Backend **neu starten** bzw. Dateien ersetzen, je nach Deployment.
- **Quelle:** `docs/BOSS-ORIENTIERUNG.md` — Abschnitt zu Lieferwegen nach `provision-device`.

**Kurz:** Der schnelle Weg ist **schnell für die Ausstellung**, nicht automatisch „ein Knopf beim Helfer“.

### 2.2 `ROLE_ID` ändern vs. „Hierarchie-Slot“ am Boss

- **`ROLE_ID` (0–63, Bits D/LW/BW/L/S/P)** steht in der **`.env` des jeweiligen Geräts** und steuert u. a. `hasRoleBit` (Sende-Bit **S**, Delegation **D**, …). Neu setzen geht zuverlässig über **neues Provisioning** oder manuelles Editieren der Helfer-`.env` (und Neustart).
- **`/set-role 0x…64 <rolle>`** auf dem **Boss** (siehe `messenger-command-handler.ts`) pflegt **`DEVICE_ROLES`** und ggf. **`WORKER_ADDRESSES` / `KOMMANDANT_ADDRESSES`** in der **Boss-`.env`** — das ist die **Einstufung in der Hierarchie** (wer ist Arbeiter/Kommandant aus Sicht des Boss), **nicht** dasselbe wie das Bitfeld **`ROLE_ID`** auf dem Endgerät. Dafür sind u. a. **`ENABLE_HIERARCHY_CHANGE`**, **`D`-Bit** und ggf. Policies relevant.
- **Lite-UI-Hinweis** (`ui/index.html`): Die Rollen-Zeile im Boss-Bereich trennt bewusst **Gerätetyp** und **Provisioning-Profil (`ROLE_ID`)**.

**Kurz:** „Truppführer werden“ kann **zwei Schritte** sein: (a) **Organisation/Hierarchie** am Boss (`DEVICE_ROLES` / Listen), (b) **feine Rechte** auf dem Gerät (`ROLE_ID` in der Helfer-`.env`).

### 2.3 Trägerbild (physischer Weg)

- **Zielbild:** Ein **Bild** trägt den **verschlüsselten Vault-Blob** (z. B. Append nach JPEG-EOF); Übergabe wie ein normales Medium — siehe `docs/VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md`, `docs/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md`.
- **Ist im Kern:** Der produktive Standard bleibt die **Vault-Datei** (z. B. `.morgendrot-vault`) und **`.env`**; die **vollständige** UI-Story „aktives Vault aus beliebigem Trägerbild laden“ ist **nicht** als fertiges Endnutzer-Feature überall dokumentiert (Steganographie-Dok: **Konzept/Risiko**, „Implementierung optional“).
- **Technik im Repo:** Es gibt **`VaultImagePipeline`** (`src/vault-image-pipeline.ts`) für **kompakte Bild-Payloads** im **IOTA-/Online-Kontext** (`MORG_COMPACT_IMG_V1`), nicht gleichbedeutend mit dem **Einsatz-Trägerbild-Append** aus den Zielbild-Dokumenten.

**Kurz:** Der **Gedanke** „neues Bild = neues Paket / neue Rolle“ ist für **Planung und Organisation** richtig; **ohne** expliziten Implementierungsnachweis sollte man nicht behaupten, der Helfer „lädt das JPEG und ist sofort umgerollt“ in derselben Form wie beim **Export-Assistenten**.

---

## 3. Empfohlene Formulierung für Einsatzunterlagen

1. **Rollenwechsel mit aktueller Software:** Boss erzeugt im **Werkstatt-/Provisioning-UI** ein **neues Gerätepaket** mit gewünschtem Profil (**`ROLE`**, **`ROLE_ID`**, Adressen, Package, RPC …) und gibt es dem Helfer aus; Helfer **ersetzt** die Konfiguration / importiert nach interner Vorgehensweise und startet neu.
2. **Hierarchie „wer ist Truppführer“:** separat über **Boss-Konfiguration** (`DEVICE_ROLES` / Adresslisten), nicht verwechseln mit **Bitmaske** auf dem Telefon.
3. **Trägerbild:** als **organisatorisches** und optional **zukünftiges** Transportmittel für Vault-Daten — **vor Einsatz** mit dem **aktuellen** Release abgleichen.

---

## 4. Verwandte Dokumente

- `docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md` — `ROLE` vs. `ROLE_ID`, Bits, Heartbeat vs. Senden  
- `docs/BOSS-ORIENTIERUNG.md` — Lieferwege Boss → Helfer, keine automatische Fernverteilung  
- `docs/VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md`, `docs/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md` — Trägerbild-Zielbild, Grenzen  
- `docs/ROADMAP-FAHRPLAN.md` — § H.3g (Rollen-Manager, Provisioning), H.7 (Standalone-Abgabe)
