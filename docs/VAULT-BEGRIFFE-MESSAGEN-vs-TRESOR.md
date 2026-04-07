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

*Stand: Abgleich mit `src/vault-local.ts`, `src/messenger-nest/messenger-command-handler.ts` (`/vault-save`), `frontend/.../vault-view.tsx`, `docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`.*
