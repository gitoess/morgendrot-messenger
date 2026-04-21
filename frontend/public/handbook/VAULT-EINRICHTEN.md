# Morgendrot – Vault (Tresor) einrichten

Der Vault ist dein digitaler Tresor: Hier werden die **geheimen Schlüssel** gespeichert, mit denen Nachrichten verschlüsselt werden – plus optional die **Streams Anchor-ID** (Kanal-Identität). Ohne Tresor verlierst du bei jedem Neustart die Verbindung zu deinen Partnern.

**Was der Vault ist (Definition):**  
Sicherer Speicher für **ECDH-Messaging-Keys** und optional **Streams Anchor-ID** (und Package-ID-Kontext). Gespeichert wird **eine** verschlüsselte Datei (lokal) bzw. **ein** verschlüsselter Blob pro Adresse on-chain. Es gibt **keinen** Ordner mit mehreren Dateien, **keinen** Befehl zum Versenden des Vaults an andere und **keinen** `/vault-add` für beliebige Einträge – nur `/vault-save` (lokal) und `/vault-onchain` (on-chain). Wer mehr dazu wissen will: **VAULT-KRITIK-BESCHREIBUNG.md** vergleicht diese Definition mit der Code-Realität.

**Passwortmanager:** Einträge für Zugangsdaten (Titel, Benutzername, Geheimnis) liegen **im selben** verschlüsselten Vault-Blob (`personalSecrets`) — **keine** zweite Vault-Datei. **Chatverlauf** liegt **nicht** im Vault; siehe **`docs/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md`**.

**4 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst. Fang mit Schritt 1 an.

---

## Adresse & Paket setzen (1 von 4)

**Ohne Adresse weiß die App nicht, wer du bist.**

- **MY_ADDRESS** = `0x…` (deine Adresse aus der Wallet)  
→ Das ist wie deine Handynummer auf der Blockchain – ohne sie kann das Programm nichts für dich tun.

**Vorher:** Die App kann nichts machen – sie findet dich nicht.

**Nachher:** Du kannst den Tresor nutzen, Nachrichten schicken, Schlüssel ausstellen.

**Beispiel:** Du öffnest deine Wallet-App → kopierst deine Adresse → hier einfügen.

**Setzen?** Ja – das ist der allererste Schritt. Ohne Adresse kommst du nicht weiter!

---

## Speicherort wählen – wo sollen die Schlüssel liegen? (2 von 4)

**Lokal auf dem Gerät oder in der Cloud (auf der Kette)?**

- **VAULT_FILE** = `.morgendrot-vault`  
→ Eine Datei auf deiner Festplatte – wie ein Safe in deinem Zimmer. Nur du (mit Passwort) kommst ran.

**Lokal (am einfachsten):**  
VAULT_FILE setzen → dann `/vault-save` tippen → Passwort eingeben → Schlüssel werden verschlüsselt in der Datei gespeichert.

**Beispiel:** Du tippst `/vault-save` → „Passwort?“ → „geheim123“ → „OK, Schlüssel sind jetzt sicher in der Datei!“

**On-Chain (falls dein Gerät kaputtgeht):**  
VAULT_REGISTRY_ID setzen → `/vault-onchain` tippen → Passwort eingeben → Schlüssel gehen verschlüsselt auf die Kette.

**Beispiel:** `/vault-onchain` → „Passwort?“ → „geheim123“ → „Tresor ist jetzt auf der Kette gespeichert!“

**Vorher:** Ohne Speicherort verlierst du bei jedem Neustart die Schlüssel → du musst mit jedem Partner neu verbinden.

**Nachher:** Beim nächsten Start gibst du nur das Passwort ein → alles ist sofort wieder da.

**Setzen?** Ja – mach das möglichst früh. Lokal ist für den Anfang super, On-Chain für langfristige Sicherheit.

**Recovery (Passwort vergessen):** Die Tresor-Entschlüsselung ist **passwortbasiert**. Ohne Passwort können on-chain gesicherte Daten **nicht** wiederhergestellt werden. Bewahre das Passwort sicher auf (oder ein Backup). Die Wallet-Mnemonic entschlüsselt den Tresor nicht – sie signiert nur Transaktionen. Siehe auch **VAULT-TRESOR-MARKTREIFE.md**.

---

## Keys speichern – mach das nach dem ersten Chat! (3 von 4)

**Die Schlüssel in den Tresor legen.**

- **/vault-save** → Schlüssel lokal speichern (Passwort eingeben)  
→ Die App nimmt deine geheimen Schlüssel und verschlüsselt sie mit deinem Passwort in der Datei.

**Vorher:** Bei Neustart sind die Schlüssel weg → neuer Handshake nötig → Chat mit Partnern geht kaputt.

**Nachher:** Beim nächsten Start fragst du nur noch nach dem Passwort → die App holt die Schlüssel aus der Datei → alles läuft weiter.

**Beispiel:** Du chattest mit jemandem → tippst `/vault-save` → „Passwort?“ → „meinpasswort“ → „Schlüssel gespeichert!“

- **/vault-onchain** → Schlüssel auf der Kette speichern (VAULT_REGISTRY_ID nötig)  
→ Schlüssel gehen verschlüsselt auf die Kette – sicherer, falls die Festplatte kaputtgeht.

**Beispiel:** `/vault-onchain` → „Passwort?“ → „meinpasswort“ → „Tresor ist jetzt auf der Kette!“

**Setzen?** Ja – mach das nach jedem neuen Chat oder Key-Wechsel. Ohne das musst du bei jedem Neustart neu verbinden.

---

## Folgeoptionen – Notfall (4 von 4)

**Wenn etwas Schlimmes passiert: Tresor sofort löschen.**

- **/emergency-purge** → Vault Notfall-Löschung (sofort alles weg)  
→ Wenn dein Gerät gestohlen wird oder jemand dein Passwort geknackt hat → du sagst der App: „Mach den Tresor sofort kaputt!“

**Vorher:** Die Schlüssel sind noch da → jemand könnte sie missbrauchen.

**Nachher:** Der Tresor ist weg – niemand kommt mehr rein.

**Beispiel:** Du merkst, dein Laptop wurde geklaut → tippst `/emergency-purge` → alles ungültig.

**Dafür brauchst du:** VAULT_REGISTRY_ID + ENABLE_PURGE = true

**Ausführen?** Ja – das ist dein Notfall-Knopf. Nutz ihn nur, wenn wirklich etwas passiert ist!

---

## Minimal-Beispiel (.env)

```env
MY_ADDRESS=0x671bf669…
VAULT_FILE=.morgendrot-vault
```

Nach dem ersten `/connect` oder Handshake: `/vault-save` tippen → Passwort eingeben → Schlüssel sind sicher.
