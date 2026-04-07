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

*Stand: Abgleich mit `src/vault-local.ts`, `frontend/.../vault-view.tsx`, `docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`.*
