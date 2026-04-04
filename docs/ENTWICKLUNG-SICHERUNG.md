# Entwicklung: Aufräumen, Git, Chat-/Fortschrittssicherung

## 1. Was „Müll“ ist (typisch löschen oder nicht versionieren)

| Bereich | Empfehlung |
|---------|------------|
| **`tmp/`**, **`test-results/`**, **`test-screenshots/`**, **`logs/`** | Lokal löschen oder leer lassen; liegen in `.gitignore`. |
| **`rustup-init.exe`** (Projektroot) | Installer-Rest → löschen oder ignorieren (bereits ignoriert). |
| **`morgendrot-working-yesterday/`** (neben dem Repo auf dem Desktop) | Referenz-Backup: **behalten**, bis du alle Unterschiede ins Hauptrepo übernommen hast; danach **ZIP archivieren** oder Ordner löschen – **nicht** ins gleiche Git mischen (verhindert Doppelpflege). |
| **Große JSON-Ergebnisse** (`realworld-*-result.json`, Explorer-Exports) | Bereits per `.gitignore` ausgeschlossen; bei Bedarf manuell wegräumen. |
| **`.env`**, **Vault-Dateien** (`.morgendrot-vault*`) | **Nie** committen; nur `.env.example` / Doku. |

## 2. Git: von „fast leerem“ Repo zu sinnvollen Ständen

Aktuell: praktisch nur ein Initial-Commit, der Rest ist untracked. Vorgehen:

1. **`.gitignore` prüfen** (Vault, `tmp/`, Logs, keine Secrets).
2. **`package-lock.json` versionieren** (reproduzierbare Builds) – Zeile dazu in `.gitignore` entfernt.
3. **Erster echter Commit** nur Quellcode + Konfig-Vorlagen:
   ```text
   git add .gitignore package.json package-lock.json tsconfig.json playwright.config.ts
   git add src/ frontend/ scripts/ ui/ docs/ e2e/ move-test/ deploy/ …
   git add .env.example README.md TESTING.md
   git commit -m "Messenger: stabile Limits + Pipeline; Projektstand sichern"
   ```
4. **Tags für Meilensteine** (z. B. `git tag -a v2026-04-02-stabil -m "Bildversand stabil"`).
5. **Regelmäßig** kleine Commits nach logischen Einheiten („fix: …“, „feat: …“), nicht nur am Tagesende alles auf einmal.

Optional: Branch `experiment/` für riskante Refactors, `master`/`main` nur wenn stabil.

## 3. Cursor / Chatverlauf

- **Chat in Cursor** wird von Cursor verwaltet (lokal/globalStorage). Für **langfristige** Sicherung: wichtige Erkenntnisse in **Commit-Messages**, **`docs/`** oder **Issues** im Repo spiegeln – das ist die Quelle, die du mit Git sicherst.
- **Agent-Transkripte** liegen unter Cursor-Daten; nicht auf das Repo verlassen.
- Einstellung **„zu viel speichern“**: lieber **täglich/kleine Commits** + **Tags** nach erfolgreichen Tests als seltene Monster-Commits.

## 4. Kurz-Checkliste „nach einer Session“

- [ ] `npx tsc --noEmit` (Root + ggf. `frontend/`) grün  
- [ ] Sinnvoller **Git-Commit** oder mindestens **Stash** / Tag  
- [ ] Keine Secrets in `git status` (kein `.env` zum Commit markiert)  
- [ ] Backup-Ordner `morgendrot-working-yesterday` nur noch behalten, wenn du ihn noch brauchst  

Damit bleibt der **stabile alte Stand** (Limits, Pipeline) erhalten, **neue Features** liegen im normalen Arbeitsbaum, und **Ballast** liegt außerhalb von Git oder wird gelöscht.
