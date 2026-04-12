# Boss, Arbeiter und Seed-Verwahrung — Policy & Architektur (Zielbild)

**Zweck:** Eine **scharfe** Entscheidungshilfe: Soll der **Boss** die **Seeds** (bzw. äquivalente Wiederherstellungsgeheimnisse) der **Arbeiter** kennen und dauerhaft speichern?  
**Stand:** 2026-03-29  
**Verknüpft:** **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** (**§ H.10**), **`SECURITY-RATING.md`** (SPOF Seed/Vault), **`docs/SICHERHEITS-AUDIT.md`**, **`docs/RECOVERY-PHRASE-BACKUP.md`**, **`docs/WANDERER-STANDALONE-BUNDLE.md`**, Rollen **`docs/UI-ROLLEN-WORKSPACES.md`**, Fahrplan **`docs/ROADMAP-FAHRPLAN.md`** (**§ H.10b**).

---

## Kurze, klare Antwort

- **Ja — in organisiertem Rettungs-/Einsatzbetrieb oft unvermeidbar oder stark erwünscht**, wenn **schnelle Wiederherstellung derselben on-chain-Identität** ohne Mitwirkung des verletzten Geräts **Betriebsziel** ist. Das ist **kein** technisches „Muss“ der Kryptografie, sondern eine **Betriebs- und Vertrauensentscheidung** (Custody durch die Organisation).

- **Nein — für Privatnutzung und viele semi-professionelle Teams** ist **dauerhafte Boss-Speicherung** ein **hohes** Risiko: ein kompromittierter Boss-Vault oder ein missbrauchender Administrator kann **alle** team-gebundenen Identitäten **lesen und imitieren** (Signatur, Mailbox, je nach Setup).

**Das ist eine der sensibelsten Architektur- und Produktentscheidungen** im Morgendrot-System: Sie bestimmt, ob ihr **organisatorische Ende-zu-Ende-Sicherheit mit Escrow** akzeptiert oder **nutzergeführte Autarkie** priorisiert.

---

## Vergleich (ohne Schein-Sieger)

Es gibt **keinen** universellen „Gewinner“ — nur **Passung** zum Einsatzprofil und zum **akzeptierten Threat Model**.

| Aspekt | Boss speichert Worker-Geheimnis (verschlüsselt, Team-Modus) | Boss speichert **nicht** (Dezentral-Modus) |
|--------|-------------------------------------------------------------|---------------------------------------------|
| **Wiederherstellung nach Geräteverlust / Akku tot** | Sehr gut: gleiche Identität auf Ersatzgerät | Gut **nur**, wenn der Arbeiter **eigenes** Backup hat (Papier, zweites sicheres Medium) — sonst **Identität verloren** |
| **Vertraulichkeit ggü. Organisation** | Niedrig: Boss/Org **kann** (wenn Vault offen oder später kompromittiert) **alles**, was vom Seed abhängt | Hoch: Org sieht **nicht** automatisch den privaten Schlüssel des Arbeiters |
| **Blast-Radius bei Kompromittierung des Boss** | **Maximal** für alle, deren Geheimnis im Boss-Vault liegt | **Begrenzt** auf das Boss-Konto und Prozesse — **nicht** automatisch alle Arbeiter-Seeds |
| **Einsatz-/Notfall-Tauglichkeit** | Hoch, wenn Prozess „Ersatzgerät in Minuten“ verlangt | Mittel: möglich, aber nur mit **disziplinierten** Backups oder **bewusster** Neu-Ausstellung (neue Adresse, ggf. Gruppen-Migration) |
| **Nutzer-/Helfer-Vertrauen („Big Brother“)** | Gefährdet, wenn **nicht** transparent und **nicht** freiwillig eingewilligt | Deutlich höher, wenn kommuniziert wird: „Nur du hast den Seed“ |

**Wichtige Korrektur zur Argumentation „ohne Boss-Backup sind Nachrichten weg“:**  
Was primär verloren geht, ist die **kryptografische Identität** (Signieren, Entschlüsseln **als dieselbe Adresse**). **Historische** Inhalte auf der Chain oder in Partner-Vaults können je nach Kanal und Schlüsselvereinbarung **weiter existieren**, sind für den Verlierer des Seeds aber **ohne Wiederherstellung oft unlesbar** — das ist präziser als pauschal „Chat weg“.

---

## Kritische Einordnung (was man leicht übersieht)

1. **„Boss braucht den Seed“ ist nicht die einzige Operations-Option.** Alternativen (alle mit eigenen Kosten): **Papier-/Hardware-Backup beim Arbeiter**, **Shamir / Aufgeteilte Geheimnisse** (z. B. zwei Offiziere), **Organisations-HSM** statt Klartext in einem Laptop-Vault, oder **neue Arbeiter-Identität** ausstellen und Gruppe **organisatorisch** umhängen (Migration/Neu-Einladung). Für Morgendrot ist entscheidend: **welche** dieser Pfade ihr **produktiv unterstützt**, nicht nur „Boss speichert alles“.

2. **E2E-Formulierung präzisieren:** Wenn der Boss eine **entschlüsselbare Kopie** des Worker-Seeds hält, ist das **E2E mit organisatorischem Custody** — **nicht** dasselbe wie „nur Endnutzer-Geräte kennen das Geheimnis“ (klassisches Consumer-E2E).

3. **Single point of compromise:** Ein Boss-Vault mit **allen** Worker-Seeds ist ein **einziges Hochrisiko-Ziel** (Malware, Raub, Erpressung, Insider). Team-Modus verlangt **starken** Vault-Schutz **und** ggf. **getrennte** Schlüssel (Team-Key vs. Alltags-Passwort), **Zugriffsprotokolle** und **minimale** Aufbewahrung.

4. **Recht / Ethik / Arbeitsrecht:** Dauerhafte Speicherung von Identitätsgeheimnissen Dritter sollte **explizit** eingewilligt und in Einsatzunterlagen **nachvollziehbar** sein (kein stillschweigendes „wir haben eh alles“).

5. **Technische Mindestregel (unabhängig vom Modus):** Seeds und Mnemonics **niemals** dauerhaft im Klartext auf Platte/Logs; nur **kurz** im RAM für Provisionierung/Unlock; am Ruhepunkt **verschlüsselt** (z. B. Boss-Vault mit starkem Passwort; langfristig optional Hardware-Binding — siehe **§ H.10** Stufe 2–3).

---

## Zielbild Morgendrot: Zwei konfigurierbare Modi (kein stiller Kompromiss)

### A) **Team-Modus** (Rettung, behördlich-organisierter Einsatz, „Gerät gehört der Einheit“)

- Beim Anlegen/Provisionieren eines Arbeiters wird das Wiederherstellungsgeheimnis **verschlüsselt im Vault des Bosses** abgelegt (oder in einem dafür vorgesehenen **Team-Keystore** — fachlich dasselbe: **organisatorische Custody**).
- Der Boss kann die **Identität** auf ein Ersatzgerät **übertragen**, ohne dass der verunglückte Arbeiter sein altes Gerät noch bedienen muss.
- **Pflicht-UX:** Sichtbarer Hinweis, **bevor** der Arbeiter „fertig“ ist, z. B.: *„Team-gebunden: Der Einsatzleiter/Boss kann dein Identitätsbackup entschlüsseln. Kein rein privater Modus.“*

### B) **Dezentral-Modus** (Privat, Hobby, viele Freiwilligen-Setups) — **empfohlene Voreinstellung**

- Das Geheimnis wird nur **so lange** gehalten, wie für die **einmalige** Einrichtung nötig (typisch: RAM / temporärer Puffer).
- Nach erfolgreicher Bestätigung auf dem Arbeitergerät wird die **Boss-seitige Kopie zuverlässig gelöscht** (oder nie persistent geschrieben, falls technisch möglich).
- Der Arbeiter trägt die Verantwortung für **eigenes** Backup (**`docs/RECOVERY-PHRASE-BACKUP.md`**); Verlust des Geräts **ohne** Backup = **Identitätsverlust** — das muss in der UI **ehrlich** stehen.

---

## Empfehlung (Produkt-Default)

| Thema | Empfehlung |
|--------|------------|
| **Standard beim ersten Setup** | **Dezentral-Modus** (keine dauerhafte Boss-Kopie). |
| **Team-Modus** | **Explizit** wählen; nicht verstecken; idealerweise **separater** Bestätigungsdialog + Dokumentationspfad für Einsatzführer. |
| **Implementierung** | Modus als **konfigurierbare Policy** (Env/Org-Profil + UI), nicht als verstecktes Verhalten; **Audit-Log** auf Boss-Seite, *dass* ein Backup existiert hat (ohne Klartext-Log). |

---

## Nächste Schritte (Roadmap, ohne Overengineering)

- Policy in **Provisioning-/Onboarding-Specs** verankern (**`docs/ONBOARDING-WALLET-UX-SPEC.md`**, ggf. **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`**).
- Threat Model **Stufe 0** (**`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`**) um eine Zeile **„Boss-Custody vs. dezentral“** ergänzen, wenn intern festgelegt.

---

*Dieses Dokument beschreibt **Zielbild und Entscheidungslogik**; die konkrete Implementierung (Flags, API, Vault-Felder) folgt den bestehenden Messenger-/Vault-Modulen im Repo.*
