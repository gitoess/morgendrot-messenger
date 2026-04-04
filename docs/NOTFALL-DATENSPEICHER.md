# Morgendrot – Notfall-Datenspeicher einrichten

Verschlüsselte Daten auf der Blockchain – sicher, aber nach einer bestimmten Zeit löschbar. Perfekt für Testament, Patientenverfügung, PINs oder Notfall-Kontakte: Nur du kommst mit Passwort ran, und nach z. B. 365 Tagen kannst du alles löschen (Datenschutz).

**4 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Vault on-chain vorbereiten (1 von 4)

**Der „sichere Tresor“ auf der Blockchain.**

- **VAULT_REGISTRY_ID** = `0x…` (Adresse des Tresoren-Registers)  
→ Das ist wie die Adresse eines Bankschließfachs auf der Blockchain. Dort liegen später deine verschlüsselten Daten.

**Vorher:** Ohne diese ID kannst du keine Daten on-chain speichern.

**Nachher:** Du hast einen Platz, wo deine Daten liegen – verschlüsselt, und nur du kommst mit Passwort ran.

**Woher bekommst du die ID?**  
Einmalig `create_globals` ausführen (oder schon gemacht) → im Terminal oder Explorer steht VAULT_REGISTRY_ID → hier eintragen.

**Beispiel:** Du tippst den Befehl für create_globals → das Event „GlobalsCreated“ zeigt die ID → kopieren und hier einfügen.

**Setzen?** Ja – das ist der allererste Schritt. Ohne diese ID geht nichts On-Chain.

---

## Daten speichern (2 von 4)

**So legst du etwas Wichtiges in den Tresor.**

- **/vault-onchain**  
→ Du gibst dein Passwort ein → die App verschlüsselt deine Daten (z. B. Gesundheitsdokumente, Testament-Text, PINs) → schickt sie in den Tresor auf der Kette.

**Vorher:** Daten liegen nur lokal auf deinem Gerät → wenn die Festplatte kaputtgeht oder das Gerät verloren geht → alles weg.

**Nachher:** Daten sind auf der Blockchain – sicher verschlüsselt. Nur du mit Passwort kannst sie wieder holen.

**Dafür brauchst du:** VAULT_REGISTRY_ID muss gesetzt sein + Wallet muss Gas haben.

**Beispiel:** Du tippst `/vault-onchain` → „Passwort?“ → „geheim123“ → „Daten sind jetzt sicher auf der Kette!“

**Setzen?** Ja – mach das, wenn du etwas wirklich Wichtiges sichern willst (z. B. Testament, Notfall-Kontaktdaten).

---

## TTL setzen – nach wie vielen Tagen löschbar? (3 von 4)

**Wie ein Verfallsdatum für deine Daten.**

- **DEFAULT_TTL_DAYS** = `30` oder `365`  
→ Nach X Tagen können die Daten gelöscht werden (von dir oder automatisch).

**Vorher:** Daten bleiben ewig auf der Kette (nur verschlüsselt).

**Nachher:** Nach 30 oder 365 Tagen kannst du sie löschen → Datenschutz (DSGVO) + Speicher sparen.

**Beispiel:** Du speicherst ein Testament → setzt 365 Tage → nach einem Jahr kannst du es löschen (oder es wird automatisch ungültig).

**Setzen?** Ja – 30 Tage ist gut für normale Daten, 365 für wichtige Dokumente wie Testament.

---

## Notfall-Purge – sofort alles löschen (4 von 4)

**Wenn etwas Schlimmes passiert: Tresor sofort kaputt machen.**

- **/emergency-purge**  
→ Du sagst der App: „Mach den Tresor sofort kaputt – Notfall!“

**Vorher:** Daten sind noch da → bei Diebstahl oder Passwort-Leck könnte jemand sie missbrauchen.

**Nachher:** Tresor ist weg – niemand kommt mehr ran.

**Beispiel:** Du merkst, dein Gerät wurde geklaut → tippst `/emergency-purge` → alles ungültig.

**Dafür brauchst du:** VAULT_REGISTRY_ID + ENABLE_PURGE = true

**Setzen?** Ja – das ist dein Notfall-Knopf. Nutz ihn nur, wenn wirklich etwas passiert ist!

---

## Minimal-Beispiel (.env)

```env
MY_ADDRESS=0x…
VAULT_REGISTRY_ID=0x…
DEFAULT_TTL_DAYS=365
ENABLE_PURGE=true
```

Nach dem ersten Handshake: `/vault-onchain` → Passwort eingeben → Daten sind verschlüsselt on-chain. Bei Notfall: `/emergency-purge`.
