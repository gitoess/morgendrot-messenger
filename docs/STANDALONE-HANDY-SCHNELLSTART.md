# Standalone-Handy — Schnellstart (1 Gerät)

**Ziel:** Messenger **ohne Morgendrot-PC** auf Android — Direct-IOTA (Mobilfunk ok).

**APK:** `frontend/android/app/build/outputs/apk/debug/app-debug.apk`  
**Build:** `cd frontend && npm run apk:debug:build`  
**Abnahme:** [`STANDALONE-SMOKE-CHECKLIST.md`](STANDALONE-SMOKE-CHECKLIST.md) · Logbuch: [`TEST-RUN-LOGBOOK.md`](TEST-RUN-LOGBOOK.md)

---

## Welcher Einstieg?

| Pfad | Wann | Handoff-ZIP? |
|------|------|----------------|
| **Solo (empfohlen für „wie Messenger“)** | Privat / IOTA-Messenger-Nähe | **Nein** — Seed + Lab-Testnet (RPC/Package/Mailbox) |
| **Einsatz-Helfer** | Boss provisioniert | **Ja** — ZIP → Lokal vormerken → Seed |
| **Boss auf APK** | Einsatzleitung auf dem Handy | Nein (eigenes Boss-Profil) |

---

## Solo — Schrittfolge (4b ohne ZIP)

1. APK installieren, App öffnen  
2. **Basis-URL leer** (Einstellungen prüfen)  
3. **Bevorzugt:** Tresor → **Neues Profil** → Solo/Privat + Seed + Passwort (≥8)  
   - Drei-Karten-Erststart (`Boss` / `Einsatz` / `Solo`) kann auf dem Gerät **ausgegraut** sein — **nicht blockieren**; bypass über Neues Profil. Nach Tests UX fixen / für IOTA-Messenger weglassen (`docs/IOTA-MESSENGER-EDITION-V1.md`).  
4. Karte **Netzwerk / Solo-Wizard** (falls sichtbar) → **Testnet-Vorlage laden** → Speichern  
   - Sonst Puls/Einstellungen: RPC + Package-ID + Mailbox-ID (Lab-Defaults)  
5. **Testnet-Gas** (Faucet) für die Wallet-Adresse — ohne Gas Send oft ohne Digest  
6. App kalt neu starten → entsperren  
7. **Nachrichten** → Online, Klartext → senden; Kopf **Direkt-RPC**

---

## Einsatz-Helfer (nur wenn Boss-ZIP)

1. APK, Basis-URL leer  
2. Erststart → **Einsatz** *oder* Einstellungen → Handoff  
3. ZIP → **Lokal vormerken (ohne Basis)** — nicht „Import bestätigen“  
4. Seed (QR vom Boss oder tippen)  
5. Nachrichten / Direkt-RPC  

Details Boss-Export: `docs/GERAET-PROVISIONIEREN-WIZARD.md`

---

## Prüfen

- Solo: Wizard weg nach Speichern; Absender-Adresse sichtbar  
- Kein Dauerfehler „Basis/API“ bei leerer Basis-URL  
- Chat-Kopf beim Send: **Direkt-RPC**, nicht „über Relay“

## Häufige Fehler

| Symptom | Lösung |
|---------|--------|
| Keine Erststart-Karte | Alte App-Daten: App-Info → Speicher löschen, neu öffnen |
| Send ohne Feedback / hängt | Testnet-Gas (Faucet); RPC erreichbar (Mobilfunk) |
| „Ungültige API-Antwort“ (Einsatz) | Lokal vormerken, nicht Import bestätigen; Basis leer |
| Package/Mailbox leer (Solo) | Testnet-Vorlage laden + Speichern |
