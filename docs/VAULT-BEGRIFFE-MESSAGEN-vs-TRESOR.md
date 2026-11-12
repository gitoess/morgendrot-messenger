# Vault, Tresor, Passwortmanager — Begriffe (strikt)

**Zweck:** Verwechslungen vermeiden: **Chatverlauf** vs. **verschlüsselte Identitätsdatei** vs. **Passwort-Einträge**.

---

## 1. Gibt es „mehrere Vaults“?

| Begriff | Was es ist |
|---------|------------|
| **Lokale Vault-Datei** (z. B. `.morgendrot-vault`) | **Eine** verschlüsselte Datei auf dem Server-Rechner — **ein** AES-GCM-Blob mit mehreren **logischen Bereichen** darin. |
| **On-Chain-Vault** (`VAULT_REGISTRY_ID`) | **Derselbe** Blob-Typ, nur **Speicherort** = Chain-Registry — kein anderes Produkt „Vault“. |
| **Passwortmanager („Mein Safe“)** | **Kein** separates Programm und **keine** zweite Datei — es sind **`personalSecret`-Einträge** **innerhalb** derselben Vault-Datei / desselben Chain-Blobs wie die Messaging-Keys. |

Es gibt also **nicht** „einen Vault für Keys“ und „einen Vault für Passwörter“ als zwei Dateien — nur **einen** Container mit **zwei sinnvollen Kategorien** in der UI: **Messaging-Tresor** vs. **Passwortmanager**.

---

## 2. Liegt der Nachrichten-/Chatverlauf im Vault?

**Nein.** Der durchsuchbare Chat in der Next-UI kommt aus:

- **Chain** (Mailbox-Events) und
- optional **lokaler Klartext-Cache** **`.inbox.enc`** (neben der Vault-Datei, eigenes Konzept) und
- **Browser-Sitzung** (keine dauerhafte Chat-Datenbank im Vault).

Details: **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`** (Persistenz).

Notfall-Purge (was genau gelöscht wird, Vault-Datei vs. Inbox-Cache): **`docs/NOTFALL-PURGE-MESSENGER.md`**. Optional-Zielbild Vault in Bildern tarnen: **`docs/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md`**.

Exporte (Einsatzbericht, ZIP) nutzen die geladenen Messages — das ist **kein** „Verlauf in der Vault-Datei speichern“.

---

## 3. Was liegt wo? (Kurztabelle)

| Inhalt | Wo |
|--------|-----|
| ECDH-Messaging-Keys, optional Streams-Anker-Kontext, Notizen, optional `iotaSdkSignerImport` | Vault-Blob (Datei und/oder Chain) |
| Passwortmanager-Einträge (Titel, User, Geheimnis, Notiz) | **Derselbe** Vault-Blob (`personalSecrets`) |
| Entschlüsselte Nachrichten (Cache) | **`.inbox.enc`** — nicht im Vault-Blob |
| Wallet-**Session** (RAM) | Backend nach `/api/unlock` — nicht identisch mit Vault-Datei-Passwort (kann aber gleich gewählt werden) |

---

## 4. UI-Wortwahl (Messenger)

- **Tresor öffnen & sichern** = Messaging-Keys laden/speichern, Chain-Backup, Vault-Datei — **Identität für Chat/Signatur**.
- **Passwortmanager** = Einträge bearbeiten und in **dieselbe** Vault-Datei mitschreiben — **kein** eigener „Mini-Vault“.

---

## 5. FAQ: „Vault erstellen“, Export, erneut speichern (Ist vs. Missverständnis)

**Wir nennen den Schritt in der Next-UI nicht „Vault erstellen“, sondern typisch „Lokal sichern“** — technisch **`/vault-save`**. Die folgenden Punkte beziehen sich auf **diesen** Ablauf.

| Aussage (häufig gehört) | Stimmt so im Projekt? |
|-------------------------|------------------------|
| „Das ist eher ein Export der aktuellen Identität.“ | **Grundsätzlich ja:** Es werden die **aktuell in der Sitzung** vorhandenen Messaging-Keys (plus Notizen, Passwortmanager-Einträge) in **eine verschlüsselte Datei** geschrieben — portabel, wie ein verschlüsselter Export. |
| „Vorher liegen die Keys lose und ungeschützt.“ | **Zu stark formuliert.** Nach dem Entsperren liegen die Keys im **Backend-RAM**; sie sind nicht automatisch „öffentlich“, aber **ohne** `/vault-save` gehen sie bei manchen Neustarts / nach `/vault-lock` verloren, wenn nichts auf Platte/Chain liegt. |
| „Beim Erstellen wird der Container zum ersten Mal erzeugt.“ | **Jedes Speichern** erzeugt neuen Salt/IV und überschreibt die Zieldatei — nicht nur „das erste Mal“. Der erste erfolgreiche Speichervorgang **legt** die Datei unter dem Standardpfad an, falls sie noch nicht existiert. |
| „Wenn ich nochmal auf den Button drücke, entsteht eine Kopie?“ | **Nein (Standardpfad):** Es wird die **gleiche** Datei (z. B. `.morgendrot-vault` laut `VAULT_FILE`) **überschrieben** — **keine** automatische zweite Datei mit neuem Namen. |
| „Das System fragt: Überschreiben oder neu?“ | **Nein** — im normalen Flow **kein** solcher Dialog; Überschreiben ist das erwartete Verhalten. **Andere Datei** nur, wenn du bewusst einen **anderen Pfad** nutzt (z. B. CLI-Argument bei `/vault-save`). |
| „Zwei Vaults = zwei getrennte Schließfächer ohne Bezug.“ | **Zwei Dateien** sind **zwei unabhängige Dateien**; sie „wissen“ nichts voneinander. Inhalt kann sich **gleichen**, wenn du aus **derselben** laufenden Sitzung zweimal mit **unterschiedlichem** Pfad speicherst — dann hast du **Kopien** desselben Stands. |
| „Passwortmanager wird erst beim Erstellen aktiv.“ | **Nein.** Sobald die Sitzung Keys hat und du im UI Einträge anlegst und speicherst, landen sie im RAM und beim nächsten **Lokal sichern** in derselben Datei. War noch nie gespeichert, ist die Datei beim ersten Mal ohne Passwortmanager-Einträge oder mit leerem Array. |

**Goldene Regel (technisch korrekt):**  
Sobald du Nachrichten nutzen willst, **regelmäßig „Lokal sichern“** (und bei Bedarf **On-Chain**), wenn sich Keys, Notizen oder Passwortmanager-Einträge geändert haben — nicht weil jedes Mal eine „neue“ Vault entsteht, sondern weil die **Datei den aktuellen Stand** widerspiegeln soll.

---

## 6. Mehrere Profile / Accounts (Ist vs. Ziel)

### Produktziel (gewünscht)

Beim **Einloggen / Unlock** ein Profil wählen können: mehrere lokale Accounts mit **eigenem Seed/Signer**, eigener Vault, eigener Adresse — **nacheinander**, **nie parallel** in einer UI. Wechsel = Lock → Profil wählen → Unlock.

### Ist (2026-11)

Pro laufender App/API-Instanz gilt **eine** aktive Identität (eine Wallet-Adresse `MY_ADDRESS`, eine entsperrte Vault-Sitzung, eine Rolle). Es gibt **keinen** Profil-Picker beim Unlock.

| Was geht heute | Was nicht |
|----------------|-----------|
| Andere `.morgendrot-vault`-Datei laden → andere Messaging-Keys/Notizen/Safe | Zwei Identitäten gleichzeitig in einer UI (bewusst unerwünscht) |
| Zweite Vault-Datei unter anderem Pfad speichern (Backup/Kopie) | Fertiger „Account anlegen + beim Login wählen“-Flow |
| Helfer-Gerät: anderer Handoff = andere Rolle/Rechte | Parallele Sessions |

**Worum es geht (Vault laden):** Eine **andere** `.morgendrot-vault`-Datei zu laden ersetzt im Backend die **Tresor-Daten in der RAM-Sitzung**: andere **Messaging-Keys**, andere **Notizen**, anderer **Passwortmanager**-Inhalt (sofern in der Datei). Das ist **kein** Wechsel des Windows-/Linux-Benutzerkontos — aber für **Morgendrot** wirkt es wie ein **Wechsel der Tresor-/Chat-Schlüsselidentität**.

**Roadmap:** Profil-Picker + „Account anlegen“ (eigener Seed) → Backlog **§ H.37** in `docs/ROADMAP-FAHRPLAN.md` (nach Messenger-Durchgang / vor Feature-Wildwuchs).

| Frage | Kurzantwort |
|--------|--------------|
| Bin ich danach „ein neuer Nutzer“? | **Für den Tresor ja** (andere Keys/Notizen/Safe). **Wallet-/Chain-Adresse** (`MY_ADDRESS` aus Signer/`.env`) bleibt in der Regel dieselbe Konfiguration — es sei denn, die geladene Vault bringt einen anderen Signer-Kontext mit (z. B. SDK-Import in der Datei). Nicht mit einem zweiten OS-Login verwechseln. |
| Werde ich aus der Web-App **ausgeloggt**? | **Nein** automatisch: `GET /api/status` bleibt „entsperrt“, solange das Backend läuft und du nicht **`/vault-lock`** ausführst. Beim **Laden** werden nur die **Tresor-Keys im RAM** ausgetauscht — kein erzwungenes erneutes **`POST /api/unlock`**. |
| Brauchen **beide** Vaults dasselbe Passwort wie zum App-Entsperren? | **Nein zwingend.** Jede Datei wurde mit **ihrem** Vault-Passwort verschlüsselt. In der UI: Wenn du ein **Tresor-Passwort** im Feld einträgst, wird es **zuerst** zum Entschlüsseln dieser Datei verwendet (Vorrang vor dem Wallet-Passwort der Sitzung). **Leeres Feld:** es wird das **Wallet-Passwort** der Sitzung versucht — praktisch nur passend, wenn du für Vault und Unlock dasselbe Passwort nutzt. |
| Zwei Dateien = zwei Kopien? | Nur wenn du **bewusst** zweimal mit **unterschiedlichen Pfaden** speicherst. Standard: wiederholtes „Lokal sichern“ **überschreibt** eine Datei. |

---

## 7. Größe: Notizen extra speichern? Ist das bedacht?

**Design-Entscheidung:** Ein **einziges** verschlüsseltes Blob (Datei / Chain) hält **alles**, was zum Wiederherstellen der **Messaging-Identität** und der **optionalen** Zusatzdaten nötig ist — **ein** Passwort, **ein** Backup. Das ist bewusst **einfach**, nicht „alles in eigene Dateien splitten“.

**Was begrenzt ist (Stand Code):**

| Bereich | Begrenzung |
|---------|------------|
| **Passwortmanager** (`personalSecrets`) | Max. **300** Einträge; pro Eintrag u. a. Titel/User/Geheimnis/Notiz mit Obergrenzen (siehe `sanitizePersonalSecrets` in `src/vault-local.ts`). |
| **Freitext-Notizen** (`notes` im JSON) | Max. **`VAULT_FREETEXT_NOTES_MAX_CHARS`** (500.000 Zeichen) — verhindert unkontrolliert riesige Blobs und teure On-Chain-Schreibvorgänge. Überschuss wird beim Speichern **abgeschnitten**. |

**Warum keine separate Notizendatei im Produkt?** Zusätzliche Dateien würden **zweites** Backup, **zweites** Passwort oder Sync-Konflikte bedeuten. Stattdessen: **kurze** Notizen im Vault; **große** Texte/Journale extern (USB, Cloud außerhalb Morgendrot) — in der UI ist das kurz erklärt.

**Fazit:** Ja, **Größe ist bedacht** (Caps + klare UI-Hinweise); **bewusst keine** getrennte Notiz-Datei im Kern — Tradeoff **Einfachheit** vs. maximale Aufteilung.

---

---

## 8. Drei Lock-Schichten (UI: Soft vs Hard vs Sidecar)

Unter „Tresor/Privacy“ laufen **drei** Mechanismen — nicht drei Passwörter:

| Schicht | Zustand | Wirkung |
|---------|---------|---------|
| **A · API-Tresor** | `apiStatus.locked` | Backend-Messaging-Keys / Signer; Hard-Lock → Unlock-Dialog |
| **B · Privacy Soft-Lock** | Badge „Privacy: gesperrt“ | Secrets + Browser-Signer weg; **Chat bleibt lesbar**; Senden aus |
| **C · Vault-Password-Session** | RAM-Passwort für Browser-Sidecars | AES-GCM-`localStorage`-Sidecars (Passphrasen, Team-Keys, Keycards, NFT-Index, Ratchet) |

**Policy (kurz):** Secrets und Merken nur bei C; Schreiben bei Soft/Hard gesperrt; **Frei-/Gesichert-Saldo und NFT-Galerie** bleiben sichtbar (on-chain/öffentlich). Einstellungen browsen offen; Exports/Emergency/Keys nur entsperrt oder maskiert. **Kein zweiter Passwort-Tresor.**

**Double Ratchet (Experiment):** Menü ⋮ setzt nur `morgendrot.experiment.doubleRatchet.v1`. **Composer sendet weiter Envelope v2** (Session Keys+) — der Toggle ändert den Wire heute nicht. Echte Ist-FS: **Schlüssel erneuern** (`keyEpoch`). Ratchet-State liegt in Sidecar C (`ratchet.enc.v1`), das Flag nicht.

Details Nutzer: `docs/ANLEITUNG-PRIVACY-VAULT-SCHLUESSELKARTE.md` §1.

---

## 9. Seed vs. Passwort — SPOF (Stand 2026-11-12)

| | **Seed / Mnemonic** | **Tresor-Passwort** |
|--|---------------------|---------------------|
| Schützt | Wallet-Adresse, Signatur, Coins | Vault-Datei / on-chain Vault-Blob |
| SPOF? | **Ja** für Identität/Signatur | **Ja** für Keys/Notizen/Safe im Tresor |
| Reicht allein? | **Nein** für Vault-Inhalt (Ist: PW getrennt) | **Nein** für Coins ohne Seed/Signer |

**Ordner:** `.morgendrot-vault`, Sidecars, Runtime-JSON, `.env`, Journal, Inbox-Cache — Sicherheit = Gerät + Rechte + Backups, nicht „liegt im Repo-Ordner = ok“. Roadmap **T54**.

---

*Stand: 2026-11-12 — §9 Seed/PW-SPOF; Abgleich vault-local / Soft-Lock / Sidecar.*
