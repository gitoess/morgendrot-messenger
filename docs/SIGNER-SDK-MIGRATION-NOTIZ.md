# SIGNER Migration: `cli` -> `sdk` (Produktpfad)

Status: Entscheidungsnotiz / Migrationsrahmen fuer **Handy-first**.

Verknuepft:
- `docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md` (§ H.15 Leitlinie)
- `docs/ROADMAP-FAHRPLAN.md` (§ H.6e, § H.15, § H.20)
- `docs/ONBOARDING-WALLET-UX-SPEC.md`
- `docs/ENV-ERKLAERUNG.md`

---

## 1) Kritische Einordnung

`SIGNER=cli` war als frueher Uebergangsmodus sinnvoll, ist aber fuer den Produkt-Standard (PWA/Handy-first, local-first) langfristig zu friktionsreich:

- Client-UX muss um CLI-Keystore herumarbeiten.
- Signaturfluesse sind im Frontend schwer konsistent.
- Tresor-/Backup-/Recovery-Pfade sind uneinheitlich.

Deshalb gilt als Zielbild:

- **Default fuer neue Bundles/Neuinstallationen: `SIGNER=sdk`**
- **`SIGNER=cli` nur Legacy/Expertenmodus**, klar sichtbar markiert.

---

## 2) Was wandert aus `.env` in Runtime-Konfig (Prioritaet)

Prinzip: `.env` fuer Infra/Betrieb behalten; nutzernahe Messenger-Entscheidungen in Runtime-Config (Storage/DB) und Provisioning schieben.

### Prioritaet A (frueh migrieren)

- `SIGNER` (Produktmodus im Client, nicht als versteckte Deploy-Falle)
- `WALLET_DERIVATION_PATH` (nur falls im UI bewusst angeboten)
- Messenger-Betriebsmodi/Flags (z. B. Direct-vs-Relay, Persistenzmodus)
- Mailbox-Kontext fuer den Nutzerfluss (Package/Mailbox/Sender-Context)

### Prioritaet B (mittelfristig migrieren)

- usernahe UX-/Feature-Flags, die heute nur in `.env` leben
- Rollen-/Onboarding-Defaults fuer Bundles (soweit kein Sicherheitsrisiko)

### In `.env` / Secret-Manager belassen

- Infrastruktur: RPC-Basis, Host/Port, Proxy, Deploy-Modi
- serverseitige Tokens/Secrets
- Betriebsparameter, die nicht zur Endnutzer-UI gehoeren

---

## 3) Zeitplan (Versionen)

- **Version X**:
  - neue Bundles und Neuinstallationen standardmaessig `SIGNER=sdk`
  - UI-Hinweis bei `SIGNER=cli`: „Legacy-Modus“
  - produktkritische Flows (z. B. R1-Signatur) mit klaren Guards pro Signer-Modus

- **Version X+1**:
  - Runtime-Konfig fuer Prioritaet-A-Parameter breit ausgerollt
  - `.env` bleibt fuer Infra, aber nicht mehr fuer Kern-UX-Entscheidungen

- **Version X+2**:
  - `SIGNER=cli` offiziell als **deprecated** markieren (weiterhin funktionsfaehig, aber nicht mehr Produkt-Default)
  - Doku/Onboarding fuehrt primaer `sdk`

---

## 4) UI-Regeln fuer Legacy-CLI

Wenn `SIGNER=cli`:

- klarer Badge/Hinweis im relevanten Dialog (nicht versteckt)
- nicht verfuegbare Funktionen deaktivieren (statt irrefuehrende Fehler)
- kurze Alternative anzeigen (z. B. manueller Signer nur als Expertenpfad)

Wenn `SIGNER=sdk`:

- Standardfluesse ohne Expertenwissen
- Tresor/Recovery/Signer-Import konsistent im selben UX-Pfad

---

## 5) Abnahmekriterien

- R1-Signaturflow ohne Umweg bei `sdk`
- eindeutiges Verhalten bei `cli` (keine stillen Sackgassen)
- Runtime-Konfig deckt Prioritaet-A-Parameter ab
- keine Regression in `TESTING.md`-Ritual + H.15-Checks

---

## 6) Architekturregel Signer-Factory (schlank halten)

Zur Vermeidung einer "Gott-Klasse" gilt fuer den Signer-Pfad:

- **Ein Minimal-Interface** im Kern:
  - `sign(data: Uint8Array): Promise<SignatureResult>`
- Die Factory entscheidet nur den Modus (`sdk` / `cli` / `remote`) und liefert einen Provider zurueck.
- Adapter-Details (CLI-Spawn, Remote-HTTP) bleiben getrennt und austauschbar.
- Fehler muessen klar und operativ sein (ungueltiger Modus, Remote nicht erreichbar, SDK-Signer fehlt), damit UI-Dialogs den Zustand verstaendlich anzeigen koennen.
