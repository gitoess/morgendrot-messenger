# Ablauf: Package-ID ist noch nicht bekannt (neu deployen)

Wenn du **noch keine** Package-ID hast (z. B. frisches Projekt oder neue Kette), musst du das Move-Package einmal bauen, auf die Kette publizieren und danach die **globale Konfiguration** (Vault, Mailbox, …) anlegen. Danach hast du die Package-ID und trägst sie in der App ein.

**Voraussetzung:** IOTA-CLI installiert (`iota` im Terminal verfügbar), Wallet/Keystore mit Adresse, RPC_URL in .env (z. B. Testnet).

---

## Schritt 1: Move-Package bauen

Im Projektordner die beiden Befehle **nacheinander** ausführen (in PowerShell/CMD kein `&&` – jeweils einzeln ausführen):

```bash
cd move-test
iota move build
```

Ohne Fehler → Build war erfolgreich.

---

## Schritt 2: Package auf die Kette publizieren

Im Ordner **move-test** (von Schritt 1) mit dem IOTA-CLI das Package **publizieren**. Die genaue Syntax hängt von deiner CLI-Version ab, z. B.:

```bash
iota client publish --gas-budget 100000000
```

(Falls du den Ordner gewechselt hast: zuerst `cd move-test`, dann den Befehl oben.)

oder (je nach Dokumentation):

```bash
iota move publish
```

**Wichtig:** In der Ausgabe oder im Explorer erscheint die **neue Package-ID** (0x…). Diese ID notieren – das ist deine **PACKAGE_ID**.

- Oft steht sie in der TX-Ausgabe als `package_id` oder in einem Event.
- Im Explorer: Transaktion öffnen → „Created“-Objekte / Events → Package-Objekt mit Adresse 0x….

---

## Schritt 3: create_globals ausführen (einmalig)

Mit der **gerade erhaltenen** Package-ID legst du die gemeinsamen Objekte an (Vault-Registry, Mailbox, Command-Registry):

```bash
iota client call --package <PACKAGE_ID> --module messaging --function create_globals --gas-budget 10000000 --json
```

**&lt;PACKAGE_ID&gt;** durch deine 0x… aus Schritt 2 ersetzen.

Aus dem Event **GlobalsCreated** (in der Ausgabe oder im Explorer) die IDs entnehmen:

- **vault_registry_id** → in .env als `VAULT_REGISTRY_ID=0x…`
- **mailbox_id** → in .env als `MAILBOX_ID=0x…`
- **command_registry_id** → in .env als `COMMAND_REGISTRY_ID=0x…`

(Wenn du nur Chat/Keys brauchst, reichen PACKAGE_ID und ggf. MAILBOX_ID; VAULT_REGISTRY_ID für On-Chain-Vault, COMMAND_REGISTRY_ID für On-Chain-Öffnen-Wörter.)

---

## Schritt 4: Package-ID in Morgendrot eintragen

Jetzt ist die Package-ID **bekannt**. Du kannst sie so eintragen:

- **In der App (empfohlen):** Projekt „Nachrichten + Chat“ (oder „1. Anfang & Verbindung“) → Schritt „Package-ID verbinden“ → **(a) Package-ID bekannt** → bei **/set-package-id** auf **Ausführen** klicken → die 0x… aus Schritt 2 eingeben → wird gespeichert und unter „Aktuell“ angezeigt.
- **Oder in der .env:** `PACKAGE_ID=0x…` (die gleiche 0x… aus Schritt 2).
- **Oder in der Datei:** In `.morgendrot-package-id` die Zeile `0x…` speichern (macht die App automatisch bei **/set-package-id**).

Die anderen IDs (VAULT_REGISTRY_ID, MAILBOX_ID, COMMAND_REGISTRY_ID) trägst du bei Bedarf in der .env ein (in der App unter den jeweiligen Einträgen oder direkt in der .env).

---

## Kurzüberblick

| Schritt | Was du machst | Ergebnis |
|--------|----------------|----------|
| 1 | `cd move-test` und `iota move build` | Move-Package gebaut |
| 2 | Package publizieren (`iota client publish` o. ä.) | **Package-ID (0x…)** aus Ausgabe/Explorer notieren |
| 3 | `create_globals` mit dieser Package-ID aufrufen | VAULT_REGISTRY_ID, MAILBOX_ID, COMMAND_REGISTRY_ID aus Event |
| 4 | In Morgendrot: **/set-package-id** mit der 0x… aus Schritt 2 (oder .env) | Package-ID ist gesetzt und überall nutzbar |

**Danach:** Package-ID ist bekannt und eingetragen – du arbeitest wie unter „(a) Package-ID bekannt“ weiter (Handshake, Connect, Nachrichten, etc.).
