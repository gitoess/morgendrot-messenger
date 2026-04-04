# Morgendrot – Boss-Modus: Maschinen ohne Wallet einrichten

**Siehe auch:** Rollenmodell Boss / Kommandant / Arbeiter und optionaler Hub → **`docs/ARCHITECTURE-ROLES-AND-HUB.md`**. Offene Fragen (z. B. zentrale Signatur vs. Verteilung) → **`docs/DISCUSSION-OPEN.md`**.

Maschinen (Schlösser, Roboter, Sensoren) brauchen normalerweise ein eigenes Wallet und Passwort. Im Boss-Modus hast nur du (der Boss) ein Wallet – die Maschinen haben nur eine Adresse und sagen: „Der Boss unterschreibt für mich.“ So musst du keine Passwörter auf jeder Maschine verwalten.

**5 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Boss: Adressen erstellen (1 von 5)

**Du erzeugst für jede Maschine eine eigene Adresse – wie Handynummern für deine Geräte.**

Mit dem IOTA-CLI (oder ähnlich) legst du Adressen an, z. B. `iota client new-address`. Jede Maschine bekommt eine Adresse, aber kein eigenes Wallet und kein Passwort – du verwaltest alles.

**Vorher:** Keine Adressen → Maschinen können nichts empfangen oder senden.

**Nachher:** Du hast z. B. 5 Adressen für 5 Schlösser → du gibst sie den Maschinen und behältst die Kontrolle.

**Beispiel:** Du tippst im Terminal den Befehl für eine neue Adresse → sie wird angezeigt → notier sie dir für die Maschine.

**Setzen?** Ja – mach das als Erstes. Jede Maschine braucht ihre eigene Adresse.

---

## Boss: Signer-Service starten (2 von 5)

**Du wirst der „Unterschreiber“ für alle Maschinen.**

- **npm run boss-signer**  
→ Ein Programm läuft auf deinem Rechner. Die Maschinen schicken dir fertige Befehle (z. B. „Tür öffnen“), du prüfst und unterschreibst – oder sagst Nein.

**Vorher:** Jede Maschine müsste selbst unterschreiben (braucht Seed/Passwort).

**Nachher:** Maschinen schicken dir die Transaktion → du entscheidest → unterschreibst (oder nicht).

**Beispiel:** Du startest den Service → eine Maschine schickt „open die Tür“ → du siehst „Unterschreiben? (y/n)“ → y → Befehl geht durch.

**Setzen?** Ja – starte den Service auf deinem PC oder Pi – er läuft dann im Hintergrund (z. B. Port 3340).

---

## Maschine: Nur Adresse + .env (3 von 5)

**Auf der Maschine: Kein Wallet, kein Passwort – nur drei Dinge in der .env.**

- **SIGNER** = `remote`  
→ „Ich lass den Boss unterschreiben.“

- **REMOTE_SIGNER_URL** = `https://boss.example:3340/sign`  
→ Wo dein Boss-Signer läuft (die Adresse im Netzwerk).

- **MY_ADDRESS** = `0x…` (die Adresse, die du der Maschine gegeben hast)  
→ Das ist die „Handynummer“ dieser Maschine.

**Vorher:** Jede Maschine bräuchte eigenes Wallet → kompliziert und unsicher.

**Nachher:** Maschine schickt Befehle an den Boss-Signer → der Boss entscheidet.

**Beispiel:** Maschine startet → schickt an Boss „open“ → Boss prüft und unterschreibt → Tür geht auf.

**Setzen?** Ja – jede Maschine braucht SIGNER=remote + REMOTE_SIGNER_URL + ihre MY_ADDRESS.

---

## Handshake beim Provisioning (4 von 5)

**Damit die Maschine verschlüsselt reden kann – optional.**

Du (Boss) schickst im Namen der Maschine einen Handshake an einen Partner. Die Maschine muss dann nur noch /connect machen (oder du machst es einmal für sie).

- **boss-provision-handshake:**  
  `npx tsx scripts/boss-provision-handshake.ts --address 0x…Maschine --partner 0x…Partner --pubkey <base64>`  
→ Du schickst „Hallo“ von der Maschine an den Partner.

- **Maschine macht /connect:**  
→ Handshake vom Partner abholen.

**Vorher:** Maschine müsste selbst Handshake machen (braucht App oder Terminal).

**Nachher:** Boss macht Handshake → Maschine kann später verschlüsselt antworten.

**Setzen?** Nein – nur wenn die Maschine verschlüsselt reden soll. Für reine Status-Meldungen reicht oft Klartext.

---

## Folgeoptionen (5 von 5)

**Lock ohne Signer:** ROLE=lock – das Schloss hört nur zu, braucht keine eigene Signatur.  
→ Beispiel: Schloss liest nur die Kette → kein eigenes Wallet nötig.

**Ameisen-Maschinen:** ROLE=arbeiter, BOSS_ADDRESS, KOMMANDANT_ADDRESSES  
→ Maschine hört auf Boss oder Kommandanten – Hierarchie wie in einem Ameisenhaufen.

**Setzen?** Nein – das ist für spezielle Fälle (z. B. viele einfache Geräte mit einem Boss).

---

## Minimal-Beispiel

**Boss:** Keystore mit Adressen für Maschinen anlegen, dann `npm run boss-signer` starten.

**Maschine (.env):**
```env
SIGNER=remote
REMOTE_SIGNER_URL=https://boss.example:3340/sign
MY_ADDRESS=0x…   # vom Boss vergeben
ROLE=lock
```

Damit hat die Maschine keine eigene Wallet – der Boss unterschreibt alles.
