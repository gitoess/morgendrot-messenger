# Gerät provisionieren — Wizard & Helfer-Flow

**Stand:** 2026-06-02  
**UI:** Einsatzleitung → **Neues Gerät provisionieren** (Boss) · Helfer: Einstellungen → Handoff importieren → **Seed einrichten?**  
**Custody:** **B** (Boss speichert Seeds verschlüsselt in lokaler Registry — Master-Passwort)

---

## Kurzüberblick

| Schritt | Wer | Was |
|--------|-----|-----|
| 1 | Boss | Wizard: Bezeichnung + Profil → **Generieren & Exportieren** |
| 2 | Boss | ZIP-Download + Seed-QR (60 s) + optional Registry-Historie |
| 3 | Helfer | ZIP importieren (**Lokal vormerken** auf Standalone-APK) |
| 4 | Helfer | Dialog **Seed einrichten?** → QR scannen oder Mnemonic eingeben |
| 5 | Helfer | Chat aktiv — ohne Morgendrot-Basis-URL |

**Wichtig:** Der Seed steht **nie** in der Handoff-ZIP. QR-Schema: `morgendrot-seed-setup-v1` (`k: "ms"`).

---

## Boss — Wizard

1. **Einsatzleitung** öffnen (Rolle Boss).
2. **Wizard öffnen** unter „Neues Gerät provisionieren“.
3. Beim **ersten Mal:** Master-Passwort für die **Boss-Registry** setzen (min. 8 Zeichen).  
   Danach: Registry mit demselben Passwort **entsperren**.
4. **Bezeichnung** (z. B. „Anna – Helfer Zug Süd“) und **Profil** wählen:
   - **Helfer** — Standard, Simple, Funk zuerst
   - **Führer** — mehr UI, kommandant
   - **Spezial** — z. B. Reporter (ROLE_ID anpassbar)
5. Optional: **Vorlage laden** (gespeicherte Einsatz-Rollen).
6. **Generieren & Exportieren** — das System:
   - erzeugt Mnemonic + Adresse (`POST /api/generate-mnemonic`)
   - baut Handoff-ZIP (`POST /api/standalone-smartphone-handoff-zip`)
   - zeigt **Seed-QR** (60 Sekunden Countdown)
   - speichert Eintrag in der **verschlüsselten Boss-Registry** (Seed als AES-GCM-Blob)

### Boss-Registry (Custody B)

- Speicherort: **localStorage** in diesem Browser (`morgendrot.bossProvisionRegistry.v1`).
- **Kein Klartext-Seed** in der Tabelle — nur Metadaten nach Entsperren.
- Status (manuell): **Erzeugt** → **Seed gezeigt** (Checkbox) → **Übergeben**.
- **Seed erneut anzeigen:** Registry entsperren → „Seed“ in der Historie (Master-Passwort).

Siehe auch: `docs/BOSS-WORKER-SEED-CUSTODY.md` (Team-Modus A/B).

### Export-Assistent

Der **Export-Assistent** bleibt für Feineinstellung (Partner, verschlüsseltes ZIP, IOTA-Versand). Der Wizard nutzt **Boss-Defaults** (Team-Mailboxen, Partner aus Telefonbuch).

---

## Helfer — nach ZIP-Import

1. **Einstellungen → Handoff importieren** → ZIP wählen.
2. Auf **Standalone-APK ohne PC-Server:** **Lokal vormerken (ohne Basis)** — nicht „Import bestätigen“.
3. Dialog **Seed einrichten?** erscheint automatisch (oder Dashboard → **Seed einrichten**).
4. **QR scannen** (Capacitor-APK) oder **QR-Text einfügen** / Mnemonic manuell.
5. Optional: **App-Passwort** (lokal, 8+ Zeichen) für späteres Entsperren.
6. **Wallet aktivieren** — Direct-IOTA + Chat bereit.

**Basis-URL:** leer lassen für Standalone. RPC/Package kommen aus dem Handoff.

---

## Technik (Referenz)

| Baustein | Pfad |
|----------|------|
| Wizard-UI | `frontend/frontend/components/boss-device-provision-wizard.tsx` |
| Boss-Registry | `frontend/frontend/lib/boss-provision-registry.ts` |
| Seed-QR | `frontend/frontend/lib/seed-setup-qr.ts` |
| Helfer-Dialog | `frontend/frontend/components/helper-seed-setup-dialog.tsx` |
| Handoff-Defaults | `frontend/frontend/lib/handoff-export-defaults.ts` |

---

## Checkliste Feldtest

- [ ] Boss: Wizard → ZIP + QR + Registry-Eintrag
- [ ] Helfer: ZIP → Seed-QR → Chat senden/empfangen (Direct-IOTA)
- [ ] Boss: Seed nach 60 s über Registry wieder anzeigen
- [ ] Verlust Master-Passwort = Seeds in Registry **nicht** wiederherstellbar (Browser-local)
