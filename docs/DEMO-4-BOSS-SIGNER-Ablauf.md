# Demo 4: Boss-Signer – Ablauf Schritt für Schritt

**Ziel:** Eine Maschine ohne eigenes Wallet löst eine Aktion aus; der Boss autorisiert per Signer-Service. Im Log des Bosses: „Signieranfrage … genehmigt.“

---

## Vor dem Start (einmalig)

1. **Boss-Rechner:** IOTA-CLI + Keystore mit mindestens zwei Adressen:
   - eine für dich (Boss),
   - eine für die „Maschine“ (Arbeiter).
2. **Boss-Signer:** `npm run boss-signer` (Port 3340). In `.env` am Boss:
   - `BOSS_SIGNER_TOKEN=` mindestens 16 Zeichen (gleicher Wert wie `REMOTE_SIGNER_TOKEN` am Arbeiter)
   - `BOSS_SIGNER_BIND_HOST=0.0.0.0` nur wenn Arbeiter im LAN (sonst Default `127.0.0.1`)
   - Optional: `BOSS_SIGNER_ALLOWED_ADDRESSES=0x…` (nur Maschinen-Adressen)
   - Nur Entwicklung ohne Token: `BOSS_SIGNER_ALLOW_INSECURE=1`
3. **Arbeiter-Instanz:** Eigenes Verzeichnis oder zweite .env mit:
   - `MY_ADDRESS` = die **Maschinen-**Adresse (vom Boss angelegt),
   - `SIGNER=remote`,
   - `REMOTE_SIGNER_URL=http://<Boss-IP>:3340/sign` (oder `http://127.0.0.1:3340/sign` lokal),
   - `REMOTE_SIGNER_TOKEN=` **gleicher Wert** wie `BOSS_SIGNER_TOKEN` am Boss,
   - `BOSS_ADDRESS` = Boss-Adresse,
   - `PACKAGE_ID` (gleich wie beim Boss),
   - Optional: `ROLE=arbeiter` (dann AUTHORIZED_SENDERS aus BOSS_ADDRESS abgeleitet).

---

## Ablauf

### Schritt 1: Boss-Signer starten (Boss)

Im Projektordner (oder dort, wo der Boss läuft):

```bash
npm run boss-signer
```

Service meldet sich z. B. mit: `Boss-Signer: http://localhost:3340` (oder dein PORT). Offen lassen – hier erscheinen Signieranfragen.

### Schritt 2: Arbeiter (Maschine) starten

In der **Arbeiter-**Konfiguration (eigene .env / zweites Verzeichnis):

```bash
npm run start
```

Kein Passwort nötig auf der Maschine – sie nutzt den Remote-Signer. Bei Bedarf Passwort-Eingabe leer lassen oder abbrechen; für „open“ reicht, dass der Boss später signiert.

### Schritt 3: Aktion auslösen (z. B. „open“)

- **Option A:** Ein Kommandant (oder du im Chat) sendet eine Nachricht an die Arbeiter-Adresse; Arbeiter empfängt „open“ und baut eine TX → schickt sie an den Boss-Signer.
- **Option B:** Über API der Arbeiter-Instanz einen Befehl auslösen, der eine TX erfordert (z. B. Handshake, Key nutzen).

Der **Boss-Signer** zeigt die Signieranfrage (z. B. im Terminal: „Unterschreiben? (y/n)“) → **y** → TX wird ausgeführt.

### Schritt 4: Im Log prüfen

- **Boss-Signer-Terminal:** Meldung, dass signiert wurde (bzw. Signatur gesendet).
- **Arbeiter-Log:** TX erfolgreich ausgeführt (z. B. „OPEN GRANTED“ oder Befehl bestätigt).

**Satz für die Demo:** „Die Maschine hat kein Guthaben und kein Passwort – ich unterschreibe für sie. Die Keys bleiben bei mir.“

---

## Kurz-Checkliste

- [ ] Boss: Adresse für Maschine angelegt, boss-signer läuft (Port 3340)
- [ ] Arbeiter: SIGNER=remote, REMOTE_SIGNER_URL, MY_ADDRESS=Maschinen-Adresse, BOSS_ADDRESS
- [ ] Aktion ausgelöst → Signieranfrage beim Boss → genehmigt → TX durch

**Details:** [BOSS-MODUS.md](BOSS-MODUS.md) · [DEMO-VORBEREITUNG.md](DEMO-VORBEREITUNG.md) (Demo 3).
