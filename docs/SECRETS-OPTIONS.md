# Keys/Passwörter: Rebased vs. verschlüsselte .env

Kurzvergleich und Umsetzungsideen, um das Betriebsrisiko „Secrets in .env“ zu verringern.

---

## Option A: Secrets auf Rebased (on-chain) auslagern

**Idee:** Sensible Werte (z. B. REMOTE_SIGNER_TOKEN, OPEN_COMMAND_LIST_KEY, Mnemonic-Referenz) nicht in .env, sondern als **verschlüsselte Blobs on-chain** speichern. Beim Start: App lädt Blob von der Chain, Nutzer gibt **ein** Entschlüsselungs-Passwort ein → .env enthält keine Secrets mehr, nur IDs und RPC.

### Ablauf (konzeptionell)

1. **Einmalig:** Nutzer wählt ein „Secrets-Passwort“. App erzeugt z. B. einen verschlüsselten Payload (wie Vault: PBKDF2 + AES-256-GCM), speichert ihn on-chain (z. B. erweiterter Vault-Eintrag oder eigenes Shared Object „SecretStore“ mit `owner → encrypted_blob`).
2. **.env:** Nur noch z. B. `RPC_URL`, `PACKAGE_ID`, `VAULT_REGISTRY_ID`, `MY_ADDRESS`, optional `SECRETS_OBJECT_ID` – **keine** Passwörter, Tokens oder Keys.
3. **Beim Start:** App fragt nach dem „Secrets-Passwort“, lädt den verschlüsselten Blob von der Chain, entschlüsselt (gleiche Krypto wie Vault), parst z. B. KEY=VALUE und stellt die Werte dem Prozess bereit (oder merged sie in eine Config).

### Vorteile

- **Keine Secrets in .env** – Backup/Versionierung der .env ist unkritisch; gleiche .env auf mehreren Rechnern möglich.
- **Ein Passwort für alles** – ein „Bootstrap“-Passwort entschlüsselt alle on-chain gespeicherten Secrets; gut für mehrere Geräte (PC + Lock).
- **Wiederherstellung** – wer Chain-Zugriff und Passwort hat, kann überall neu starten.
- **Audit** – wer welche Objekte besitzt, ist on-chain nachvollziehbar (nicht der Inhalt).

### Nachteile

- **Netzwerk beim Start nötig** – ohne RPC kein Laden der Secrets (mit Offline-Cache lösbar, aber wieder Speicherort für verschlüsselte Daten).
- **Entschlüsselungs-Key** – bleibt „was du weißt“ (Passwort) oder „was du hast“ (Key-Datei); wenn das Passwort in einem Passwortmanager/Agent steckt, verschiebt sich das Risiko dorthin.
- **Kosten/Latenz** – Speicher auf der Chain, eine Lese-TX pro Start (oder gecacht).
- **Move/Contract** – entweder bestehenden Vault erweitern (z. B. zweites Feld `encrypted_secrets`) oder neues Objekt „SecretStore“; gleiche Berechtigung (nur Owner schreibt/löscht).

**Fazit:** Sinnvoll, wenn du **mehrere Instanzen** mit derselben Konfiguration betreibst oder **keine lokalen Secrets** in Dateien wollen willst. Der Gewinn ist: .env ist „public-safe“; das einzige Secret ist das eine Passwort (oder ein Key-File), das du beim Start eingibst.

---

## Option B: .env AES-verschlüsselt (gleiche Krypto wie Nachrichten/Vault)

**Idee:** Statt `.env` im Klartext eine Datei **`.env.enc`** (oder `secrets.enc`), die den **Inhalt** einer .env (KEY=VALUE pro Zeile) enthält, **verschlüsselt** mit derselben Krypto wie der Vault: PBKDF2 (Passwort → Key) + AES-256-GCM. Beim Start: Passwort eingeben (oder Key-Datei), Datei entschlüsseln, Inhalt parsen und in `process.env` / Config mergen.

### Gleiche Funktion wie Vault?

- **Ja, gleicher Baukasten:** `vault-local.ts` hat bereits:
  - `deriveKeyFromPassword(password, salt)` (PBKDF2, 310k)
  - Format: Salt (16) + IV (12) + Ciphertext (AES-GCM, 16-Byte-Tag)
- **Unterschied:** Payload ist kein Keypair, sondern **Text** (env-Zeilen: `MY_ADDRESS=0x...\nREMOTE_SIGNER_TOKEN=...`). Entschlüsselung liefert String → Zeilen parsen → Key/Value in Config.
- **Alternative (Key-File statt Passwort):** Wie `read-command-list.ts`: 32-Byte-Hex-Key aus Datei, AES-GCM. Dann kein Passwort nötig, aber die Key-Datei muss geschützt werden (chmod 600, anderer Speicherort).
- **Sensible Dateien:** Vault, Replay-State, Payment-Trigger-State, Heartbeat-State werden nach Schreiben automatisch mit `chmod 600` geschützt (nur Eigentümer lesbar/schreibbar; unter Unix).

### Ablauf (konzeptionell)

1. **Einmalig:** Alle sensiblen Variablen in eine Datei (z. B. `secrets.txt`):  
   `REMOTE_SIGNER_TOKEN=xyz\nOPEN_COMMAND_LIST_KEY=...`  
   Mit Passwort verschlüsseln (PBKDF2 + AES-GCM wie Vault) → `secrets.enc` speichern. Normale `.env` enthält nur Nicht-Sensibles (RPC_URL, PACKAGE_ID, ROLE, …).
2. **Start:** Zuerst `dotenv.config()` für .env (ohne Secrets). Optional: wenn `ENCRYPTED_ENV_FILE` gesetzt ist, Passwort abfragen, `secrets.enc` laden, entschlüsseln, parsen und Werte in Config/process.env übernehmen.
3. **Gleiche Funktion:** Eine kleine Hilfsfunktion `loadEncryptedEnv(filePath, password)` nutzt intern `deriveKeyFromPassword` + gleiches Salt/IV/Ciphertext-Format wie `loadVaultFromPayload`, nur dass der Payload als Env-Text geparst wird.

### Vorteile

- **Keine Klartext-Secrets in .env** – .env kann in Repo/Backup; nur `secrets.enc` + (optional) Passwort oder Key-File sind sensibel.
- **Wiederverwendung der Krypto** – dieselbe bewährte Funktion (PBKDF2 + AES-GCM) wie Vault; kein neues Schema.
- **Lokal, ohne Chain** – funktioniert offline; keine RPC-Abhängigkeit beim Start.
- **Key-File-Variante** – z. B. Key auf USB-Stick oder in sicherer Umgebung; Passwort nur einmal beim Erzeugen von `secrets.enc`.

### Nachteile

- **Entschlüsselungs-Key** – Passwort beim Start (wie jetzt) oder Key-Datei; wenn die Key-Datei auf derselben Maschine liegt, ist das Risiko ähnlich wie bei .env (aber getrennt von Klartext-Backups).
- **Zwei Dateien** – .env (öffentlich) + secrets.enc (geheim); Startablauf etwas aufwendiger (Passwort oder Pfad zur Key-Datei).

**Fazit:** Gute Verbesserung ohne Chain: .env „clean“, Secrets nur in verschlüsselter Datei; gleiche Krypto wie beim Vault nutzbar.

### Option B – konkret umgesetzt

- **Krypto:** Wie Vault: `decryptPayloadToUtf8` / `encryptUtf8ToPayload` in `vault-local.ts` (PBKDF2 + AES-GCM).
- **Loader:** `load-secrets.ts`: liest `ENCRYPTED_ENV_FILE` aus .env, fragt nach Passwort, entschlüsselt und merged Key=Value-Zeilen in `process.env`.
- **Start:** Damit Config die Werte sieht, App über **`start-with-secrets.ts`** starten (lädt .env → entschlüsselt → startet wallet-bridge):
  ```bash
  # In .env nur: ENCRYPTED_ENV_FILE=.env.secrets.enc (und alle nicht-sensiblen Werte)
  npx tsx src/start-with-secrets.ts
  # oder: npm run start:secrets
  ```
- **Verschlüsselte Datei erzeugen:** Secrets in eine Textdatei (z. B. `secrets.txt`) schreiben, eine Zeile pro Variable:
  ```
  REMOTE_SIGNER_TOKEN=dein-token
  OPEN_COMMAND_LIST_KEY=64hex...
  ```
  Dann:
  ```bash
  npx tsx scripts/encrypt-env.ts secrets.txt .env.secrets.enc
  ```
  Passwort eingeben; danach `.env.secrets.enc` verwenden und in .env `ENCRYPTED_ENV_FILE=.env.secrets.enc` setzen.

---

## Option C: Externe Secret-Manager („Tresor für Profis“) — Doppler, CI-Secrets, Cloud-Vaults

**Idee:** Statt Sponsor-Seed, API-Token oder `SPONSOR_GAS_PASSWORD` dauerhaft als **Klartext** in einer Datei auf der VPS-Platte zu halten, liegen die Werte in einem **zentralen Secret-Store** (z. B. **Doppler**, **HashiCorp Vault**, **AWS Secrets Manager**, **Azure Key Vault**, **1Password Connect**, …). **GitHub Secrets** sind primär für **CI/CD** (Build/Deploy), nicht automatisch für den laufenden Server.

### Wie es typischerweise funktioniert

1. **Speicherung:** Secrets sind in der Cloud des Anbieters **verschlüsselt at rest**, mit **Zugriffskontrolle** (RBAC), **Audit-Log** und oft **Rotation**.
2. **Zur Laufzeit:** Beim **Start** oder **Deploy** holt ein Agent/CLI die Werte und setzt sie als **Umgebungsvariablen** (z. B. `doppler run -- your-start-command`, systemd-`EnvironmentFile` nach Fetch, Kubernetes Secret → Pod-Env).
3. **Ergebnis:** Auf der Festplatte des Servers liegt **keine** `.env` mit dem Sponsor-Mnemonic — oder nur eine `.env` mit **Referenzen** (Projekt-ID, Config-Name), **nicht** die Geheimnisse selbst.

### Ehrliche Grenzen (kritisch)

| Erwartung | Realität |
|-----------|----------|
| „Secrets sind nur im RAM, Festplatten-Hacker findet nichts“ | **Teilweise richtig** für *reinen Dateizugriff* ohne Root. Sobald der Prozess läuft, sind die Werte **im Prozess** — **Speicherabbilder**, **Debugger**, kompromittierte **root**-Session, **Malware** im gleichen User-Kontext oder **Core-Dumps** können sie auslesen. Es ist **schwieriger** als `cat .env`, aber **kein absoluter Schutz**. |
| „GitHub Secrets = Server-Tresor“ | **Nein** — GitHub Secrets werden in **Workflows** injiziert. Ein **VPS** bekommt sie nur, wenn ihr sie beim Deploy **explizit** über SSH, API oder ein Secret-Sync-Tool übertragt. |
| „Cloud = automatisch sicherer“ | **Falsch ohne Prozess:** Fehlkonfiguration (zu breite IAM-Rolle), **leaked Service-Account-Key** auf dem Server, oder **gleicher** Secret-Store für Dev und Prod kann schlimmer sein als eine gut geschützte lokale `secrets.enc`. |

### Echter Nutzen (wofür sich Option C lohnt)

- **Kein Klartext in Backups** der VM und **kein versehentliches** Einchecken in Git (wenn `.env` nie den Mnemonic enthält).
- **Team-Betrieb:** Wer darf prod deployen, ohne den Seed zu sehen? **RBAC + Audit** im Secret-Manager.
- **Rotation:** Neuer Sponsor-Key ohne manuelles Editieren vieler Server-Dateien (wenn der Prozess neu startet und neu zieht).
- **Trennung:** Build-Pipeline hat andere Identität als Laufzeit-Server.

### Kleine Umsetzungsschritte (ohne großen Code-Umbau)

1. **Dokumentieren:** Startbefehl z. B. `doppler run -- npm start` (oder euer Wrapper) in **`deploy/README-DEPLOY-BUNDLES.md`** / Runbook — **kein** Mnemonic in systemd-Unit-Dateien im Klartext.
2. **CI:** Production-Deploy-Workflow liest **nur** aus Secret-Store, schreibt **temporär** auf den Host oder setzt Env für **einen** Restart — kein Klartext in Repo-Artefakten.
3. **Kombination:** Option **B** (`ENCRYPTED_ENV_FILE` + `start:secrets`) für **Edge** ohne Internet beim Boot; Option **C** für **VPS** mit Team und Audit-Pflicht.

**Fazit:** Secret-Manager sind **sinnvoll** für **Betrieb, Compliance und Fehlervermeidung** (kein Seed in `/home/app/.env`). Die Story „nur RAM, Hacker kann nie etwas“ ist **überzeichnet** — korrekt ist: **Defense in Depth** (kein Klartext auf Disk **plus** gehärteter Host, Updates, minimaler Footprint im Prozess).

---

## Vergleich kurz

| Kriterium              | Rebased (A)           | Verschlüsselte .env (B)     | Secret-Manager (C)        |
|------------------------|------------------------|-----------------------------|---------------------------|
| Secrets in .env        | Nein                   | Nein (nur in .env.enc)      | Nein (nur injiziert)      |
| Abhängigkeit           | RPC beim Start         | Keine (lokal)               | Netz/Agent beim Start/Deploy |
| Gleiche Krypto wie App | Ja (z. B. Vault-Format)| Ja (PBKDF2 + AES-GCM)       | Anbieter + Transport-TLS |
| Mehrere Geräte         | Ein Passwort, überall  | Pro Gerät secrets.enc/Key   | Zentral, RBAC/Audit       |
| Implementierungsaufwand| Move + Client          | Nur Client (klein)          | Betrieb/Deploy (gering)   |
| Laufzeit-Schutz        | Passwort/Key nötig     | Passwort/Key nötig          | Prozess hat trotzdem Klartext in RAM |

---

## Empfehlung

- **Schnell und ohne Chain:** **Option B** (verschlüsselte .env) mit derselben Funktion wie Vault (PBKDF2 + AES-GCM). Optional: zusätzlich Key-File-Modus wie bei OPEN_COMMAND_LIST_KEY.
- **Multi-Device / kein lokales Secret-File:** **Option A** (Rebased): verschlüsselter Blob on-chain, ein Passwort beim Start; .env nur IDs und RPC.
- **VPS / Team / Audit / kein Seed in Backups:** **Option C** (Doppler o. Ä.) + dokumentierter Startpfad; **nicht** die Illusion „absolut sicher weil RAM“.

Beide Optionen können kombiniert werden: z. B. Default = verschlüsselte lokale Datei; wenn `SECRETS_FROM_CHAIN=true` und Vault-Registry gesetzt, Secrets aus Chain laden (gleiches Format wie Vault-Payload). **B + C:** Edge mit `secrets.enc`, Server mit Doppler-injizierten Variablen.
