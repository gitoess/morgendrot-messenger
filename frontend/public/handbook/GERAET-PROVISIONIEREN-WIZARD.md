# Gerät provisionieren — Wizard & Helfer-Flow

**Stand:** 2026-06-02  
**UI:** Einsatzleitung → **Neues Gerät provisionieren** (Boss) · Helfer: Einstellungen → Handoff importieren → **Seed einrichten?**  
**Custody:** **B** (Boss speichert Seeds verschlüsselt in lokaler Registry — Master-Passwort)

---

## Kurzüberblick

| Schritt | Wer | Was |
|--------|-----|-----|
| 1 | Boss | Wizard: Bezeichnung + Profil (+ optional Sonderrolle) → **Generieren & Exportieren** |
| 2 | Boss | ZIP-Download (+ optional Passwort) + Seed-QR (60 s) + Registry |
| 3 | Helfer | ZIP importieren (**Lokal vormerken** auf Standalone-APK) |
| 4 | Helfer | Dialog **Seed einrichten?** → QR scannen oder Mnemonic eingeben |
| 5 | Helfer | Chat aktiv — ohne Morgendrot-Basis-URL |

**Wichtig:** Der Seed steht **nie** in der Handoff-ZIP. QR-Schema: `morgendrot-seed-setup-v1` (`k: "ms"`).

---

## Boss — Wizard

1. **Einsatzleitung** öffnen (Rolle Boss).
2. **Wizard öffnen** unter „Neues Gerät provisionieren“ (erste Karte).
3. Beim **ersten Mal:** Master-Passwort für die **Boss-Registry** setzen (min. 8 Zeichen).  
   Danach: Registry mit demselben Passwort **entsperren** (einmal pro Browser-Sitzung).
4. **Bezeichnung** + **Profil** (Helfer / Führer / Spezial), optional gespeicherte Vorlage.
5. **Sonderrolle (optional):**
   - **Medic-Funker** — LoRa senden, Telegram nur lesen, IOTA aus (`ROLE_ID=12` + Capabilities)
   - **Reporter (Transport)** — nur lesen auf allen Kanälen
   - Weitere Presets (Nur Funk, …): **Erweitert → Export-Assistent**
6. **Handoff-ZIP:** Standard **Klartext** (schnell). Optional Checkbox **Handoff-ZIP mit Passwort**.
7. **Generieren & Exportieren** — Mnemonic, ZIP, Seed-QR (60 s), Registry-Eintrag.

### Abgrenzung

| Aufgabe | Tool |
|---------|------|
| **Neues Handy** (Seed + ZIP) | **Wizard** |
| TTL/Purge für **bestehende** Geräte | **Einsatz-Parameter geändert** |
| Partner, volle Capabilities-Matrix | **Erweitert → Export-Assistent** |

Weitere Details: **`docs/EINSATZ-BOSS-ABLAUF.md`**, **`docs/HANDOFF-PERMISSIONS-MATRIX.md`**.

---

## Helfer — nach ZIP-Import

1. **Einstellungen → Handoff importieren** → ZIP (bei Passwort-ZIP: Passwort vom Boss).
2. Standalone-APK: **Lokal vormerken (ohne Basis)**.
3. **Seed einrichten?** → QR scannen / Mnemonic.
4. Optional: App-Passwort (lokal, 8+ Zeichen).

**Basis-URL:** leer lassen für Standalone.
