# Kritische Prüfung: Beschriebenes Vault-Konzept vs. MORGENDROT-Code

Die beschriebene Vision („dynamischer Tresor“, Versand, laufend beschreiben, Ordner vs. Direct-to-Move) wird **punktgenau** mit dem **aktuellen Code** abgeglichen. Was stimmt, was ist anders, was wäre neu zu bauen.

---

## 1. „Kommandant liest den Vault mit Private Key; App scannt Chain und zeigt Inhalte“

**Im Code:**
- **Lesen:** `getVaultFromChain(registryId, packageId, ownerAddress)` holt das **eine** Vault-Objekt pro Owner aus dem VaultRegistry (Dynamic Field mit Key = Owner). Der Inhalt ist **ein** verschlüsselter Blob (`encrypted_data`).
- **Entschlüsseln:** Mit **Passwort** (nicht „Private Key“ im Sinne von Wallet-Signatur). Der Blob wurde mit Passwort (PBKDF2 + AES-GCM) erzeugt; zum Dekodieren braucht die App **dasselbe Passwort**. Der Wallet-Private-Key signiert nur Transaktionen; die Vault-Entschlüsselung macht `loadVaultFromChainPayload(encryptedData, password)` → ergibt **ECDH-Keys** (Messaging), nicht beliebige „Passwörter/Anker-IDs“.
- **Dashboard:** Die Kachel „Tresor“ hat Buttons **Lokal sichern** (/vault-save) und **On-Chain speichern** (/vault-onchain). Es gibt **keinen** „Scan Chain und zeige Vault-Inhalte im Klartext“-View; die App zeigt keine Liste von Einträgen aus dem Vault. Wer on-chain gespeichert hat, kann beim nächsten Start **ohne** VAULT_FILE mit Passwort die Keys von der Chain laden (siehe wallet-bridge: wenn VAULT_REGISTRY_ID gesetzt und kein lokaler Vault, wird von Chain geladen).

**Fazit:** „Lesen mit Private Key“ ist ungenau – Entschlüsselung ist **passwortbasiert**. „App scannt Chain und zeigt Inhalte“ – nur indirekt: beim Start wird ggf. von Chain geladen; es gibt keine UI, die „Vault-Inhalte“ als Liste anzeigt (weil der Inhalt nur ECDH-Keys + optional Anchor-ID ist, keine generische Key-Value-Datenbank).

---

## 2. „Vaults versenden (Transferable Object)“

**Im Code (Move):**
- Der **Vault** ist **kein** eigenständiges transferierbares Objekt. Er ist ein **Dynamic Field** unter dem **shared** `VaultRegistry`: Key = `VaultKey { owner }`, Value = `Vault { encrypted_data, owner, ... }`. Das VaultRegistry ist `transfer::share_object` – geteilt, nicht im Besitz einer Adresse. Die **Vault-Instanz** pro Owner „gehört“ dem Registry; man kann sie **nicht** an eine andere Adresse übertragen wie ein Coin.
- Es gibt **keine** Move-Funktion `transfer_vault` oder ähnlich. `purge_vault` löscht den Eintrag; es wird nichts „versendet“.

**Konsequenz:** „Kommandant kann den gesamten Vault an den Boss übertragen“ ist im **aktuellen Design nicht umgesetzt**. Um das zu haben, müsste entweder: (A) der Vault als **owned object** geführt und per `transfer::transfer` versendet werden (große Move- und Client-Änderung), oder (B) der Boss liest den Vault des Kommandanten (getVaultFromChain(..., kommandantAddress)) – dafür müsste der Boss das **Passwort des Kommandanten** kennen oder der Inhalt müsste mit dem Public Key des Bosses (oder Shared Secret) verschlüsselt sein. Aktuell: ein Vault ist pro Owner, ein Blob, passwortverschlüsselt; kein Versand.

**Fazit:** „Vaults versenden“ – **nein**, so nicht vorhanden. Würde neues Design/Implementierung brauchen.

---

## 3. „Vault laufend neu beschreiben; /vault-add [Daten]; von Purge ausgeschlossen“

**Im Code:**
- **/vault-add** existiert **nicht**. Es gibt nur `/vault-save` (lokale Datei: ECDH-Keys + optional Anchor-ID) und `/vault-onchain` (einmalig **create_vault** mit verschlüsseltem Blob).
- **Move:** `update_vault(registry, encrypted_data, auto_purge_after_days)` existiert – der **Owner** kann seinen Vault-Eintrag durch einen **neuen** `encrypted_data`-Blob **ersetzen**. Das ist „laufend neu beschreiben“ in dem Sinne: man kann den gesamten Blob ersetzen (z. B. nach dem Mergen alter + neuer Daten clientseitig). Es gibt **keine** „append“- oder „add entry“-Funktion in Move; kein key-value pro Eintrag.
- **TypeScript:** `update_vault` wird **nirgends** aufgerufen. Es gibt nur `createVaultOnChain`. Für „laufend aktualisieren“ müsste `updateVaultOnChain()` in chain-access implementiert und irgendwo (Befehl/UI) aufgerufen werden.
- **Purge:** Die **Mailbox**-Purges (purge-handshake, purge-msg) und Key/Ticket-Purges haben **keine** Abfrage „ist das im Vault?“. Der **Vault** selbst kann mit `purge_vault` gelöscht werden (nach TTL oder Notfall). Die Aussage „Vault von der /purge-Logik ausgeschlossen“ meint vermutlich: Handshake/Nachricht/Key/Ticket werden unabhängig gelöscht; der Vault-Inhalt wird dabei nicht ausgelesen. Richtig: es gibt keinen Code „prüfe Vault vor Purge“. Der Vault wird nur durch explizites `purge_vault` gelöscht.

**Fazit:** „Laufend neu beschreiben“ – in Move als **update_vault** (ganzer Blob ersetzen) vorhanden, im **Client nicht angebunden**. `/vault-add` und „Einträge anhängen“ existieren nicht. „Von Purge ausgeschlossen“ – korrekt in dem Sinne, dass normale Purge-Befehle den Vault nicht lesen/anfassen; der Vault selbst hat aber purge_vault (TTL/Notfall).

---

## 4. „Vault als Ordner (/vault) vs. Chain-Objekt; Sync Ordner → Chain“

**Im Code:**
- Es gibt **keinen** Ordner `/vault` oder `VAULT_FILE` als Verzeichnis mit mehreren Dateien. `VAULT_FILE` ist **eine Datei** (z. B. `.morgendrot-vault`), in der **ein** verschlüsselter Payload (ECDH-Keys) liegt. Zusätzlich Sidecar-Dateien für Package-ID und Streams Anchor-ID.
- Es gibt **keine** Logik „lies Ordner, packe Dateien, lade als ein Datenpaket auf die Chain“. On-Chain geht nur **ein** Blob (das Ergebnis von `encryptVaultPayloadForChain(keys, password)` = verschlüsselte ECDH-Keys).
- Es gibt **keinen** Hintergrundprozess, der einen Ordner beobachtet und den Chain-Vault aktualisiert.

**Fazit:** „Vault als Ordner“ und „Sync Ordner → Chain“ – **nicht** im Projekt. Würde neues Konzept und Implementierung bedeuten.

---

## 5. „Direct-to-Move: keine lokale Datei, direkt binäres Feld in Move; vault::update_entry; Live-Datenbank“

**Im Code:**
- Das Move-Vault-Objekt hat **ein** Feld `encrypted_data: vector<u8>`. Es gibt **kein** `update_entry` oder Dynamic Fields **innerhalb** des Vaults für einzelne Keys/Values. Ein Update = **gesamtes** `encrypted_data` ersetzen via `update_vault`.
- Die TypeScript-Seite kennt nur **einen** Inhaltstyp für diesen Blob: **ECDH-Keys** (VaultKeys). Keine generische „Live-Datenbank“ mit key/value pro Eintrag.
- „Direct-to-Move“ ohne lokale Datei ist theoretisch möglich: App verschlüsselt Payload (z. B. Keys), ruft `create_vault` bzw. `update_vault` auf – ohne jemals VAULT_FILE zu schreiben. Das wäre eine **Option** (z. B. „nur on-chain, kein lokaler Vault“), aber aktuell ist die Standardbahn: lokal speichern, optional on-chain als Backup.

**Fazit:** „vault::update_entry“ und „Dynamic Field Object“ pro Eintrag – **gibt es nicht** im Move-Vertrag. „Direct-to-Move“ als „ein Blob, kein Ordner“ ist vereinbar mit dem bestehenden Move, aber der beschriebene API-Stil (vault.update({ key, value })) und die Semantik (beliebige Keys/Values, für Boss verschlüsseln) wären **neu** zu definieren und zu bauen.

---

## 6. Sinn „Vault als Ordner“?

**Als Idee:** Ein lokaler Ordner, den die App beim Purge nicht anfasst und den man optional auf die Chain synchronisiert, kann sinnvoll sein (z. B. für Techniker, die vor Ort Dateien ablegen). **Im aktuellen Morgendrot:** Der Vault ist **kein** Ordner, sondern **eine verschlüsselte Datei** (+ Sidecars) mit festem Inhalt (Keys, optional Anchor-ID). Ein „Ordner-Vault“ wäre eine **Erweiterung** mit neuem Verhalten und ggf. neuem Move-Design (z. B. mehrere Einträge, Versand als Archiv).

---

## Zusammenfassung: Was stimmt, was nicht, was wäre neu

| Behauptung / Vision | Im Code? | Anmerkung |
|---------------------|----------|-----------|
| Kommandant liest Vault mit Passwort | Ja (indirekt: Laden von Chain mit Passwort) | „Private Key“ ungenau; Entschlüsselung ist passwortbasiert. |
| App zeigt Vault-Inhalte im Dashboard | Teilweise | Tresor-Kachel: Buttons Speichern; keine Anzeige „Inhalte als Liste“. |
| Vault versenden (an Boss) | **Nein** | Vault ist Dynamic Field pro Owner, nicht transferierbar. |
| Vault laufend neu beschreiben | Move: ja (update_vault). Client: **nein** | update_vault wird im TS nicht aufgerufen; kein /vault-add. |
| /vault-add [Daten] | **Nein** | Befehl existiert nicht. |
| Vault von Purge (Mailbox/Key/Ticket) ausgeschlossen | Ja | Purge-Befehle lesen den Vault nicht. |
| Vault als Ordner auf dem Gerät | **Nein** | VAULT_FILE = eine Datei, kein Verzeichnis. |
| Sync Ordner → Chain | **Nein** | Nicht implementiert. |
| Direct-to-Move ohne Ordner | Möglich | Nur als „ein Blob“; kein update_entry/key-value. |
| vault::update_entry, Dynamic Fields pro Eintrag | **Nein** | Move hat nur encrypted_data (ein Blob). |

**Empfehlung:** Die **bisher vereinbarte Vault-Definition** (ECDH-Keys + optional Streams Anchor-ID; Kommandant Lese+Schreibzugriff für Persistenz; **kein** Purge-Filter, **kein** Versand, **kein** /vault-add) in **VAULT-EINRICHTEN.md** und **ENV-ERKLAERUNG.md** klar machen. Die beschriebene erweiterte Vision (Versand, Ordner, laufend Einträge hinzufügen, update_entry) als **mögliche spätere Erweiterung** dokumentieren, nicht als Ist-Stand.
