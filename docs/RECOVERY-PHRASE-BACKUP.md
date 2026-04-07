# Recovery Phrase / Signer-Backup — Einordnung und Umsetzung

## 1. Warum explizite Anzeige nötig ist („Angst“-Szenario)

Wenn beim ersten Start (oder in Phase C der Produkt-Roadmap) **automatisch** eine Mnemonic erzeugt wird, sieht der Nutzer sie oft **nur kurz** — im Stress **nicht zuverlässig schriftlich** gesichert.

| Ohne Export / erneute Anzeige | Mit Backup-Funktion |
|------------------------------|---------------------|
| Gerät defekt oder verloren → **kein Zugriff** auf die in der Vault verschlüsselt liegenden Daten, sofern kein externes Backup existiert. **Identität on-chain** (0x-Adresse) und **gebundene Objekte** (z. B. Messenger-Credits nach Shop-Mint) sind ohne Wiederherstellung des Signers **nicht** durch einen „Server-Reset“ ersetzbar — der Betrieb speichert **keinen** Klartext-Key zentral. | Der Nutzer kann in den **Einstellungen** (Next-UI) unter **Wallet & Backup** das **Vault-Passwort erneut eingeben** und den **gespeicherten Signer-Import** (Mnemonic oder Bech32-Secret, je nach dem, was in die Vault geschrieben wurde) **noch einmal anzeigen** und **sicher notieren**. |

**Voraussetzungen im aktuellen Morgendrot-Code:**

- **`SIGNER=sdk`** (IOTA SDK im Prozess).
- Beim Tresor-Speichern wurde **„Signer-Import mit speichern“** genutzt (Lite-UI) bzw. der Import liegt verschlüsselt in **`.morgendrot-vault`** (`iotaSdkSignerImport` in `src/vault-local.ts`).
- **Lokale Vault-Datei** vorhanden (`GET /api/status` → `vaultStatus.hasLocal`) oder zuerst von Chain laden, dann lokal sichern.

**Nicht abgedeckt:** **`SIGNER=cli`** — die Recovery läuft über das **IOTA-CLI-Keystore-Backup**, nicht über diese UI-Zeile. **`SIGNER=remote`** — Signatur beim Boss; kein Mnemonic auf dem Endgerät.

---

## 2. Technik

| Komponente | Rolle |
|------------|--------|
| **Befehl** | `POST /api/command` mit `cmd: '/vault-show-signer-import'`, `args: ['<passwort>']` optional zweites Argument: Pfad zur Vault-Datei. |
| **Handler** | `src/messenger-nest/messenger-command-handler.ts` — entschlüsselt nur die Datei, **ohne** Keys im RAM zu verlangen (wie `/vault-load` in der `needKeys`-Ausnahmeliste). |
| **Antwort** | `ok`, `message`, bei Erfolg **`signerImport`** (Klartext — nur über vertrauenswürdige Verbindung nutzen). |
| **Next-UI** | `frontend/frontend/components/views/settings-view.tsx` — Abschnitt **Wallet & Backup**; API-Hilfsfunktion `revealVaultSignerImport` in `frontend/frontend/lib/api.ts`. |

**Sicherheitshinweise:**

- Backend-Session muss **entsperrt** sein (`_commandHandler` gesetzt), sonst liefert die API 503/„Wallet entsperren“ — gleiches Modell wie andere Befehle.
- **Kein** Mitloggen des Feldes in Support- oder Datei-Logs.
- Nutzer: Phrase **nicht** in Chat, Screenshots in unsichere Clouds oder geteilte PCs.

---

## 3. Verifikation (manuell)

Siehe **`TESTING.md`** (Smoke-Ergänzung zu Onboarding). Kurz:

1. `SIGNER=sdk`, Vault mit gespeichertem Import, Backend entsperrt.
2. Einstellungen → Wallet & Backup → Passwort → **Anzeigen** → erwarteter Klartext, danach **Ausblenden**.

---

## 4. Protokoll / Änderungshistorie

| Datum | Änderung |
|-------|----------|
| 2026-03-28 | Erste Fassung: Befehl `/vault-show-signer-import`, Settings-UI, Doku-Verknüpfung mit **`docs/ONBOARDING-WALLET-UX-SPEC.md`**. |
