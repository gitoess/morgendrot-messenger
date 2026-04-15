# Boss, Arbeiter und Seed-Verwahrung — Policy & Architektur (Zielbild)

**Zweck:** Eine **scharfe** Entscheidungshilfe: Soll der **Boss** die **Seeds** (bzw. äquivalente Wiederherstellungsgeheimnisse) der **Arbeiter** kennen und dauerhaft speichern?  
**Stand:** 2026-03-31  
**Verknüpft:** **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** (**§ H.10**), **`SECURITY-RATING.md`** (SPOF, Messenger-ECDH, Backend-Grenzen), **`docs/SICHERHEITS-AUDIT.md`**, **`docs/RECOVERY-PHRASE-BACKUP.md`**, **`docs/WANDERER-STANDALONE-BUNDLE.md`**, Rollen **`docs/UI-ROLLEN-WORKSPACES.md`**, Fahrplan **`docs/ROADMAP-FAHRPLAN.md`** (**§ H.10b**).

**§ H.10b / Reihenfolge:** In **`docs/ROADMAP-FAHRPLAN.md`** § **C.0b** Stufe 2 steht **§ H.10b** **parallel** zu **§ H.10** — **nach** **§ H.8**, **ohne** Mesh-/IOTA-MVP (**Phase B**) zu verdrängen. Policy-Doku **ohne** Implementierungszwang; operative Qualität weiter **`TESTING.md`**, **`docs/PWA-MANUAL-CHECKS.md`**.

---

## Leitlinie (ein Satz)

Es ist **kein technischer Zwang**, sondern eine **bewusste Betriebsentscheidung** mit **erheblichen** Sicherheits- und Vertrauenskonsequenzen. **Der Boss kann** Worker-Seeds speichern — **er muss es nicht.** Die Wahl wirkt direkt auf **Wiederherstellbarkeit**, **Blast-Radius bei Kompromittierung** und darauf, ob ihr **organisatorisches Escrow** akzeptiert.

---

## Kurze, klare Antwort

- **Ja — in organisiertem Rettungs-/Einsatzbetrieb oft stark erwünscht**, wenn **schnelle Wiederherstellung derselben on-chain-Identität** ohne Mitwirkung des verletzten Geräts **Betriebsziel** ist. Das bleibt eine **Betriebs- und Vertrauensentscheidung** (Custody durch die Organisation), **kein** Krypto-Zwang.

- **Nein — für Privatnutzung und viele semi-professionelle Teams** ist **dauerhafte Boss-Speicherung** ein **hohes** Risiko: ein kompromittierter Boss-Vault oder missbrauchende Administration kann **alle** im Vault gebündelten Worker-Identitäten **imitieren** und — je nach Nachrichtenpfad — Inhalte **mitlesen**, die an diese Identität gebunden sind.

**Das ist eine der sensibelsten Architektur- und Produktentscheidungen** im Morgendrot-System: **Team-Custody** vs. **nutzergeführte Autarkie**.

---

## Kritische Gegenüberstellung (Konsequenzen für Morgendrot)

Es gibt **keinen** universellen „Gewinner“ — die Spalte **Konsequenz** fasst die **typische** Morgendrot-Einordnung; das Threat Model bleibt **eure** Wahl.

| Aspekt | Boss speichert die Seeds (Team-Custody) | Boss speichert die Seeds nicht (Dezentral) | Konsequenz für Morgendrot |
|--------|----------------------------------------|---------------------------------------------|---------------------------|
| **Wiederherstellung bei Geräteverlust** | Schnell: Boss kann dieselbe Identität auf ein Ersatzgerät bringen | Schwerer: eigenes Backup, Shamir, Org-HSM, oder **neues Gerät + Migration / Identitätswechsel** | Team-Custody **operativ** im Vorteil, wenn Wiederherstellung **ohne** den Verletzten das Ziel ist |
| **Sicherheit / Kompromittierung** | Ein kompromittierter Boss-Vault gefährdet **alle** dort gebündelten Worker-Identitäten (Insider, Malware, Diebstahl) | Blast-Radius **ohne** zentrale Seed-Sammlung **kleiner**; betroffen ist v. a. das jeweilige Gerät / der jeweilige Nutzer | Dezentral **deutlich** günstiger, wenn das Risiko „ein Tresor für alle“ nicht tragbar ist |
| **„Echte“ Ende-zu-Ende ggü. der Organisation** | **Organisatorisches Escrow:** wer den Worker-Seed hat, kann **signieren als** der Arbeiter und typischerweise **mitlesen**, was an diese Identität gebunden ist | **Kein** Seed beim Boss: die Organisation hat **nicht** dieselbe direkte Schlüsselmacht wie der Arbeiter | Dezentral = **stärkere** Trennung Boss ↔ Arbeiter-Secret; siehe **Fußnote** direkt unter der Tabelle |
| **Notfall-Tauglichkeit (Rettung)** | Hoch: Handlungsfähigkeit bleibt auch bei ausgefallenem Arbeitergerät erhalten | Mittel: Ausfälle ohne Backup können zu **Identitäts-** und Leseverlust führen | Team-Custody oft **pragmatisch** für Profi-Einsatz |
| **Vertrauen der Teammitglieder** | Niedriger, wenn unklar bleibt, dass der Boss **kann** | Höher, wenn kommuniziert ist: **nur** der Arbeiter hält das Geheimnis | Transparenz ist **nicht verhandelbar** |

**Fußnote „E2E“:** *Dezentral* bedeutet hier: **der Boss hat keinen Worker-Seed.** Zusätzlich gelten die **Ist-Grenzen** des Messengers: Entschlüsselung läuft im **Morgendrot-Backend**, sobald der **eigene** Vault entsperrt ist — das ist **nicht** das strenge Modell „Server garantiert blind“, sofern nicht jeder nur **eigenen** Node nutzt (**`SECURITY-RATING.md`**, Abschnitt *Messenger: Inhaltsvertraulichkeit*). Die Tabelle betrifft primär **Custody: Boss vs. Arbeiter**, nicht einen vollständigen Consumer-E2E-Beweis.

---

## Präzise Bewertung

**Signatur-Identität und Lesbarkeit:** Ohne den **privaten Seed** (bzw. ohne Wiederherstellung derselben Vault-Identität) fehlen die Schlüssel, mit denen der Messenger **ECDH**, **HKDF** und **AES-GCM** nutzt (**`SECURITY-RATING.md`**). Ciphertext kann auf der Chain oder bei Partnern **weiterliegen**, ist für den Betroffenen aber **in der Regel nicht mehr lesbar** — es geht nicht nur um „den Chat“, sondern um **Entschlüsselbarkeit der Historie** und **Signaturfähigkeit** als dieselbe Adresse.

**Kompromittierungsrisiko:** Ein Boss-Vault mit **allen** Worker-Seeds ist ein **extrem attraktives** Angriffsziel. **Ein** erfolgreicher Zugriff (physisch oder digital) kann **die gesamte** dort gebündelte Kommunikationsidentität der Gruppe kompromittieren — stärker als der Verlust eines einzelnen Arbeitergeräts im Dezentral-Modus.

**Präzision statt „Chat weg“:** Verloren geht primär die **kryptografische Identität**; Daten können **existieren**, ohne dass der Verlierer sie noch **verarbeiten** kann.

---

## Kritische Einordnung (was man leicht übersieht)

1. **„Boss braucht den Seed“ ist nicht die einzige Operations-Option.** Alternativen (alle mit eigenen Kosten): **Papier-/Hardware-Backup beim Arbeiter**, **Shamir / Aufgeteilte Geheimnisse** (z. B. zwei Offiziere), **Organisations-HSM** statt Klartext in einem Laptop-Vault, oder **neue Arbeiter-Identität** ausstellen und Gruppe **organisatorisch** umhängen (Migration/Neu-Einladung). Für Morgendrot ist entscheidend: **welche** dieser Pfade ihr **produktiv unterstützt**, nicht nur „Boss speichert alles“.

2. **E2E-Formulierung präzisieren:** Wenn der Boss eine **entschlüsselbare Kopie** des Worker-Seeds hält, ist das **E2E mit organisatorischem Custody** — **nicht** dasselbe wie „nur Endnutzer-Geräte kennen das Geheimnis“. Details und Backend-Grenzen: **Fußnote E2E** oben und **`SECURITY-RATING.md`**.

3. **Single point of compromise:** Ein Boss-Vault mit **allen** Worker-Seeds ist ein **einziges Hochrisiko-Ziel** (Malware, Raub, Erpressung, Insider). Team-Modus verlangt **starken** Vault-Schutz **und** ggf. **getrennte** Schlüssel (Team-Key vs. Alltags-Passwort), **Zugriffsprotokolle** und **minimale** Aufbewahrung.

4. **Recht / Ethik / Arbeitsrecht:** Dauerhafte Speicherung von Identitätsgeheimnissen Dritter sollte **explizit** eingewilligt und in Einsatzunterlagen **nachvollziehbar** sein (kein stillschweigendes „wir haben eh alles“).

5. **Technische Mindestregeln:** siehe Abschnitt **„Technische Pflichten (beide Modi)“** unten (Klartextverbot, RAM, Vault/HSM, **Audit ohne Geheimnisse**).

---

## Empfohlene Morgendrot-Architektur (2026): Zwei Modi, klar getrennt

Beide Modi sind **explizit** wählbar — **kein** stiller Kompromiss.

### A) **Team-Modus** (Rettung, professioneller Einsatz, „Gerät gehört der Einheit“)

- Beim **Provisioning** wird der Seed des Arbeiters **verschlüsselt** im Boss-Vault abgelegt (oder im **Team-Keystore** — fachlich **organisatorische Custody**).
- Der Boss kann die **Identität** bei Bedarf auf ein Ersatzgerät **übertragen**.
- **Pflicht-UX** (nicht übersehbar), z. B.: *„Dieses Gerät ist team-gebunden. Der Boss besitzt ein **verschlüsseltes Backup** deines Seeds.“* — sinngleich auch: *„Einsatzleiter/Boss kann das Identitätsbackup entschlüsseln — kein rein privater Modus.“*

### B) **Dezentral-Modus** (Privat, kleine vertrauensvolle Gruppen) — **empfohlene Voreinstellung**

- Der Seed wird nur **temporär** im RAM (bzw. minimaler Puffer) gehalten, um das Gerät zu **provisionieren**.
- Danach wird er auf dem Boss-System **zuverlässig gelöscht** (oder **nie** persistent geschrieben, falls technisch möglich).
- Der Arbeiter ist **vollständig eigenverantwortlich**; Verlust ohne eigenes Backup → **Identitätsverlust** (**`docs/RECOVERY-PHRASE-BACKUP.md`**, UI **ehrlich**).

---

## Technische Pflichten (beide Modi)

| Regel | Inhalt |
|--------|--------|
| **Speicher** | Seeds/Mnemonics **niemals** dauerhaft im **Klartext** (Platte, Clipboard-Dumps, Support-Tickets). |
| **RAM** | Seeds nur **so kurz** wie für Provisionierung/Unlock **unbedingt** nötig. |
| **Boss-Vault** | Starkes Master-Passwort; langfristig optional **HSM** / Hardware-Binding (**§ H.10**, Stufe 2–3). |
| **Protokollierung** | Vorgänge **nachvollziehbar** (wer **wann** welches **Gerät** provisioniert, Backup angelegt, Wiederherstellung ausgelöst) — **ohne** Seed, Mnemonic oder Schlüsselmaterial in Logs oder UI-Dumps (**nur** Metadaten / IDs). |

---

## Fazit & Empfehlung (Produkt-Default)

| Thema | Empfehlung |
|--------|------------|
| **Rettungsorganisationen** | Team-Modus ist oft **pragmatisch und notwendig** — aber mit **organisatorischem Escrow** und **höherem** Angriffsrisiko auf den Boss-Vault. |
| **Alle anderen Szenarien** | **Dezentral-Modus** als **Standard** — Boss speichert **keine** Worker-Seeds dauerhaft. |
| **Code & Transparenz** | Die Entscheidung muss **explizit** konfigurierbar sein (**kein** heimliches Verhalten). **Transparenz** gegenüber Teammitgliedern ist **nicht verhandelbar**. |
| **Umsetzung** | Policy über Env/Org-Profil + UI; separater Bestätigungsdialog für Team-Modus; Dokumentationspfad für Einsatzführung. |

---

## Nächste Schritte (Roadmap, ohne Overengineering)

- Policy in **Provisioning-/Onboarding-Specs** verankern (**`docs/ONBOARDING-WALLET-UX-SPEC.md`**, ggf. **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`**).
- Threat Model **Stufe 0** (**`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`**) um eine Zeile **„Boss-Custody vs. dezentral“** ergänzen, wenn intern festgelegt.

---

*Dieses Dokument beschreibt **Zielbild und Entscheidungslogik**; die konkrete Implementierung (Flags, API, Vault-Felder) folgt den bestehenden Messenger-/Vault-Modulen im Repo.*
