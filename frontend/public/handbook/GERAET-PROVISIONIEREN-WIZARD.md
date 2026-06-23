# Gerät provisionieren — Wizard & Helfer-Flow

**Stand:** 2026-06-16  
**UI:** Einsatzleitung → **Helfer einrichten** → **Neues Gerät** → **Seed + QR** (Boss) · Helfer: Einstellungen → Handoff importieren → **Seed einrichten?**  
**Custody:** **B** (Boss speichert Seeds verschlüsselt in lokaler Registry — Master-Passwort)  
**Abgrenzung:** Dieser **Geräte-Provisionierungs-Wizard** (Seed + ZIP) ist **nicht** der geplante **Einstiegs-Wizard** für Erststart/Team-Sync — letzterer: **`docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md`**, Roadmap **§ H.36 P0**.

---

## Kurzüberblick

| Schritt | Wer | Was |
|--------|-----|-----|
| 1 | Boss | Wizard: Bezeichnung + Profil (+ optional Sonderrolle) → **Generieren & Exportieren** |
| 2 | Boss | ZIP-Download (+ optional Passwort) + Seed-QR (60 s) + Registry |
| 3 | Helfer | ZIP importieren (**Lokal vormerken** auf Standalone-APK) |
| 4 | Helfer | Dialog **Seed einrichten?** → QR scannen oder Mnemonic eingeben |
| 5 | Helfer | Chat aktiv — ohne Morgendrot-Basis-URL |

**Wichtig:** Der Seed steht **nie** in der Handoff-ZIP. QR-Schema: **`docs/SEED-SETUP-QR-SCHEMA.md`**.

---

## Boss — Wizard

1. **Einsatzleitung** öffnen (Rolle Boss).
2. **Seed + QR** unter **Helfer einrichten** → **Neues Gerät** (Profil/Rechte im Formular darüber).
3. Beim **ersten Mal:** Master-Passwort für die **Boss-Registry** setzen (min. 8 Zeichen).  
   Danach: Registry mit demselben Passwort **entsperren** (einmal pro Browser-Sitzung).
4. **Bezeichnung** + **Profil** (Helfer / Führer / Spezial), optional gespeicherte Vorlage.
5. **Sonderrolle (optional):**
   - **Medic-Funker** — LoRa senden, Telegram nur lesen, IOTA aus (`ROLE_ID=12` + Capabilities)
   - **Reporter (Transport)** — nur lesen auf allen Kanälen
   - Weitere Presets (Nur Funk, …): **Rechte**-Matrix in **Helfer einrichten**
6. **Handoff-ZIP:** Standard **Klartext** (schnell). Optional Checkbox **Handoff-ZIP mit Passwort**.
7. **Generieren & Exportieren** — Mnemonic, ZIP, Seed-QR (60 s), Registry-Eintrag.

### Master-Passwort — wann nötig?

| Situation | Verhalten |
|-----------|-----------|
| Erstes Gerät | Master-Passwort **anlegen** (2× eingeben) |
| Registry existiert, Tab neu | **Entsperren** (1× Master-Passwort) |
| Registry bereits entsperrt | **Kein** erneutes Passwort pro Gerät — bis **Registry sperren** oder Tab schließen |
| Seed erneut anzeigen | Nur bei **gesperrter** Registry: zuerst entsperren |

Das Master-Passwort liegt nach dem Entsperren **nur im RAM** dieser Browser-Sitzung (nicht dauerhaft im Klartext gespeichert). Entschlüsselte Seeds sind während der entsperrten Sitzung im Speicher — deshalb Boss-PC absichern und Registry nach Einsatz sperren.

### Boss-Registry (Custody B) — Sicherheit

- Speicherort: **`localStorage`** in diesem Browser (`morgendrot.bossProvisionRegistry.v1`) — **browser- und profilgebunden**.
- Seeds **verschlüsselt** (AES-256-GCM + PBKDF2), aber bei **kompromittiertem Boss-Laptop** + **entsperrter Registry** oder bekanntem Master-Passwort sind **alle** Helfer-Seeds gefährdet.
- **Betrieb:** Boss-PC als **High-Security-Gerät** (Festplattenverschlüsselung, keine fremden Accounts, physisch gesichert).
- **Backup:** Im Wizard **Registry sichern (JSON)** — Datei bleibt verschlüsselt; auf zweitem Boss-PC **importieren** mit gleichem Master-Passwort.
- **Roadmap:** Automatischer Sync „Importiert auf Helfer“ (on-chain/Heartbeat) — aktuell **nicht** implementiert.

### Status in der Historie

| Status | Bedeutung | Automatisch? |
|--------|-----------|--------------|
| Erzeugt | ZIP + Registry-Eintrag | ja |
| Seed gezeigt | Boss-Haken nach QR | manuell |
| Übergeben | Boss-Haken „Übergeben“ | manuell |
| Importiert | Helfer hat ZIP angewendet | **nein** (Backlog) |

Filter **„Noch nicht übergeben“** zeigt offene Geräte — für längere Einsätze manuell pflegen oder Liste exportieren.

### Abgrenzung

| Aufgabe | Tool |
|---------|------|
| **Neues Handy** (Seed + ZIP) | **Helfer einrichten** → Neues Gerät |
| TTL/Purge für **bestehende** Geräte | **Helfer einrichten** → Bestehende Geräte |
| Partner, volle Capabilities-Matrix | **Helfer einrichten** (oben) |

Wizard und Handoff-Export teilen dieselbe ZIP-Pipeline (`POST /api/standalone-smartphone-handoff-zip`). Zielbild: **`docs/EINSATZ-HELFER-EINRICHTEN-ZIELBILD.md`**.

---

## Helfer — nach ZIP-Import

1. **Einstellungen → Handoff importieren** → ZIP (bei Passwort-ZIP: Passwort vom Boss).
2. Standalone-APK: **Lokal vormerken (ohne Basis)**.
3. **Seed einrichten?** → QR scannen / Mnemonic.
4. Optional: App-Passwort (lokal, 8+ Zeichen).

**Basis-URL:** leer lassen für Standalone.

---

## Technik (Referenz)

| Baustein | Pfad |
|----------|------|
| Wizard-UI | `frontend/frontend/components/boss-device-provision-wizard.tsx` |
| Capability-Presets | `frontend/frontend/lib/handoff-capability-presets.ts` |
| Boss-Registry | `frontend/frontend/lib/boss-provision-registry.ts` |
| Seed-QR | `frontend/frontend/lib/seed-setup-qr.ts` |
| QR-Schema-Doku | `docs/SEED-SETUP-QR-SCHEMA.md` |
| Helfer-Dialog | `frontend/frontend/components/helper-seed-setup-dialog.tsx` |
| Rechte-Übersicht | `docs/HANDOFF-PERMISSIONS-MATRIX.md` |

---

## Checkliste Feldtest

- [ ] Boss: Wizard → ZIP (klar + optional Passwort) + QR + Registry
- [ ] Boss: Medic-Funker / Reporter Preset → Capabilities in `.morgendrot-runtime-config.json`
- [ ] Boss: Registry sperren / neu entsperren
- [ ] Boss: Registry JSON sichern & importieren
- [ ] Helfer: ZIP → Seed-QR → Chat (Direct-IOTA)
- [ ] Verlust Master-Passwort = Registry auf diesem Browser nicht lesbar
