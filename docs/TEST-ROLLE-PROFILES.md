# Rollen-Profile zum Schreibtisch-Test (Consumer / Arbeiter / Kommandant / Boss)

**Zweck:** Eine Node-Instanz = **eine** Rolle. Für UI-Tests (Team-Mailbox-Gate, Einsatz-Vorlagen, Dashboard-Kacheln) schnell zwischen Profilen wechseln — **ohne** vier komplette `.env`-Kopien mit Secrets.

**Modell:** Siehe **`docs/ROLLEN-MODELL-CONSUMER-EINSATZ.md`**.

---

## Empfohlener Ansatz (Overlay, nicht volle Kopie)

| ❌ Schwach | ✅ Besser |
|-----------|----------|
| Vier vollständige `.env.consumer` … mit duplizierten Secrets | **Eine** `.env` (Wallet, RPC, `PACKAGE_ID`, …) + **Overlays** `.env.role-*.example` |
| `copy .env.boss .env` überschreibt versehentlich Secrets | `npm run env:role:boss` patcht nur `ROLE`, `DEPLOYMENT_PROFILE`, `UI_VARIANT` |

Overlays liegen unter **`env/roles/`** (committbar, **keine** Geheimnisse):

- `env/roles/consumer.env`
- `env/roles/arbeiter.env`
- `env/roles/kommandant.env`
- `env/roles/boss.env`

---

## Ansteuern

```powershell
# Overlay auf bestehende .env anwenden
npm run env:role:consumer
npm run env:role:arbeiter
npm run env:role:kommandant
npm run env:role:boss

# Danach Backend neu starten (Pflicht für deploymentProfile!)
npm run dev
```

Kombiniert (Overlay + Dev in einem Schritt):

```powershell
npm run dev:role:kommandant
```

**Verifikation:** Browser oder `GET /api/status` — Felder `role`, `deploymentProfile`, `permissions.teamManage`, `permissions.configChange`.

| Profil | Erwartung (Kurz) |
|--------|------------------|
| **consumer** | `deploymentProfile=consumer`, kein Team erstellen |
| **arbeiter** | `einsatz`, kein Team erstellen |
| **kommandant** | `einsatz`, Team erstellen, Vorlagen nur lesen |
| **boss** | `einsatz`, Team + Vorlagen speichern |

---

## Alternative: manuelles Kopieren

Wenn du lieber **komplette** Dateien pflegst (z. B. `.env.boss` mit allem):

```powershell
Copy-Item .env.boss .env -Force
npm run dev
```

**Nachteil:** Vier Dateien mit `MY_ADDRESS`, Vault-Passwort, … — leicht **Drift** und versehentliches Committen (nur `.env` ist in `.gitignore`).

---

## Wichtige Grenzen

1. **Neustart nötig:** `DEPLOYMENT_PROFILE` wird beim Prozessstart gesetzt — nach `env:role:*` immer **`npm run dev`** neu.
2. **Eine Rolle pro Lauf:** Nicht zur Laufzeit im Chat umschaltbar (kein Citizen↔Boss-Dropdown).
3. **Gleiche Wallet, andere Rolle:** Overlays ändern nur die **Geräteklasse** — für realistische Hierarchie optional `BOSS_ADDRESS`, `KOMMANDANT_ADDRESSES`, `WORKER_ADDRESSES` in `.env` setzen.
4. **UI vs. API:** ConfigView (`.env anpassen`) kann `ROLE` schreiben — nur **Boss** + `configChange`; Consumer-`messenger` ohne Override: **403**.
5. **Test-Hack:** `ALLOW_TEST_ROLE_OVERRIDE=true` in `.env` erlaubt Hierarchie-Keys auch ohne Boss (nur Dev).
6. **Parallel:** Vier Rollen **gleichzeitig** = vier Prozesse mit **verschiedenen Ports** und **verschiedenen** `.env`-Verzeichnissen — Overlays reichen für **sequenzielles** Durchklicken.

---

## Checkliste pro Profil (Mailbox / Gruppe)

Nach Wechsel + Neustart kurz prüfen:

- [ ] Posteingang → **Meine Mailboxen** → Team **erstellen** ja/nein
- [ ] Einstellungen → **Einsatz-Rollen-Vorlagen** sichtbar / Speichern ja/nein
- [ ] Chat-Kanal **Gruppe** + **Persistent** → „Mailbox an alle Mitglieder“ (Kommandant/Boss/Arbeiter gleich — pairwise)
- [ ] `GET /api/status`: `deploymentProfile`, `permissions.teamManage`

Protokoll: **`docs/TEST-RUN-LOGBOOK.md`**.

---

*Stand: 2026-05-21*
