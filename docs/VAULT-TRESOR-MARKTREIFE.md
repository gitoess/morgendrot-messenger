# Vault (Tresor): Kritische Prüfung und Marktreife

Kritische Einordnung der genannten Anforderungen gegenüber dem **aktuellen** Morgendrot-Vault. Was macht Sinn, was ist schon da, was fehlt, was wäre ein logischer nächster Schritt.

---

## Was der Vault heute ist (Definition)

Der Vault speichert **keine beliebigen Nutzerdaten** (Texte, PDFs, Key-Value-Einträge). Er ist ein **Schlüsseltresor** für:

- **ECDH-Messaging-Keys** (Keypair für Ende-zu-Ende-Verschlüsselung)
- optional **Streams Anchor-ID** und **Package-ID**-Kontext

**Ein** verschlüsselter Blob pro Besitzer (lokal = eine Datei, on-chain = ein Dynamic Field unter VaultRegistry). Wer „eigene Texte und Daten sicher speichern“ will, braucht ein **erweitertes Konzept** (siehe unten). Die folgenden Punkte werden vor diesem Hintergrund bewertet.

---

## 1. Verschlüsselungs-Architektur (Security)

| Anforderung | Ist-Zustand | Bewertung |
|-------------|-------------|-----------|
| **Verschlüsselung pro Eintrag** | Ein Blob pro Vault (salt+iv+ciphertext). Keine „Einträge“ – der ganze Vault ist ein Ciphertext. | ✅ Ausreichend für aktuellen Zweck (Keys). Für **beliebige Einträge** wäre pro-Eintrag-AES-256-GCM ein Erweiterungsschritt. |
| **Key-Derivation (KDF)** | **PBKDF2-HMAC-SHA256**, 310.000 Iterationen (OWASP 2023). Passwort wird **nicht** gespeichert. | ✅ KDF ist vorhanden und aktuell empfohlen. **Argon2/Scrypt** wären stärker gegen GPU/ASIC, aber PBKDF2 310k ist akzeptabel. Optional: Argon2 als Option später. |
| **Salting** | **Ja.** Jeder Aufruf `encryptVaultPayloadForChain` / `saveVaultLocal` verwendet `crypto.randomBytes(SALT_LEN)` (16 Byte). Zwei Tresore mit gleichem Passwort erzeugen unterschiedlichen Ciphertext. | ✅ Erfüllt. |

**Fazit:** Security-Grundlagen (AES-256-GCM, KDF, Salt) sind vorhanden. Für „Marktreife“ im aktuellen Umfang reicht das; für einen **generischen Datentresor** käme später pro-Eintrag-Verschlüsselung und ggf. Argon2 dazu.

---

## 2. Struktur & Suche (Usability)

| Anforderung | Ist-Zustand | Bewertung |
|-------------|-------------|-----------|
| **Metadaten-Index / Suche** | Kein Index. Der Vault enthält nur einen verschlüsselten Blob (Keys). Es gibt keine „Einträge“ zum Durchsuchen. | ⚠️ Erst relevant, wenn der Vault **strukturierte Nutzerdaten** (z. B. Key-Value-Liste) speichert. Dann: verschlüsselte Metadaten (Titel/Tags) außerhalb des Volltextes ermöglichen Suche ohne alles zu entschlüsseln. |
| **MIME-Typen** | Nicht vorhanden. Inhalt = ECDH-Keys (festes Format). | ⚠️ Für „eigene Daten“ (PDF, Bild, Text) wäre ein Typ-Feld pro Eintrag sinnvoll; aktueller Vault hat nur einen Inhaltstyp. |

**Fazit:** Struktur & Suche werden wichtig, sobald der Vault zu einem **allgemeinen Datentresor** wird. Bis dahin: UI klarmachen, **was** gesichert wird (Keys, Handshakes, Konfiguration – siehe VAULT-EINRICHTEN.md).

---

## 3. Backup & Recovery

| Anforderung | Ist-Zustand | Bewertung |
|-------------|-------------|-----------|
| **Recovery Seed („Passwort vergessen“)** | **Nein.** Entschlüsselung ist **passwortbasiert**. Die Wallet-Mnemonic signiert nur Transaktionen; sie entschlüsselt den Vault **nicht**. Ohne Passwort sind die on-chain Daten nicht nutzbar. | 🔴 Wichtig: In Doku und UI klar sagen: **Passwort vergessen = Vault-Inhalt nicht wiederherstellbar**, außer man hat ein Backup des Passworts oder einen Export. **Mögliche Erweiterung:** Option „Recovery über Mnemonic“ = Vault-Passwort aus Mnemonic ableiten (deterministisch), dann „nur Mnemonic“ reicht zur Wiederherstellung (aber: gleiche Mnemonic = gleiches Passwort = weniger Diversität). |
| **Sharding (2-von-2)** | Nicht vorhanden. | Optional, hoher Aufwand; erst bei explizitem Bedarf. |

**Fazit:** Recovery muss **dokumentiert** werden (Passwort sicher aufbewahren, optional Export/Backup). Optional später: Recovery-Modus über Mnemonic-Ableitung.

---

## 4. On-Chain-Management

| Anforderung | Ist-Zustand | Bewertung |
|-------------|-------------|-----------|
| **Größen-Limit-Check** | **Fehlt.** Move/IOTA Objekte haben ein Größenlimit (z. B. ~250 KB Objekt). Ein zu großer `encrypted_data`-Blob könnte die TX scheitern lassen. | 🟡 **Sinnvoll:** Vor `createVaultOnChain` / `updateVaultOnChain` Prüfung: `encryptedPayload.length <= VAULT_PAYLOAD_MAX_BYTES` (z. B. 200 KB), klare Fehlermeldung. Bei Überschreitung: Hinweis auf Chaining (mehrere Objekte) als spätere Erweiterung. |
| **Rebate beim Überschreiben** | **Move:** `create_vault` entfernt bei bestehendem Eintrag das alte Vault-Objekt (`object::delete(id)`) und legt ein neues an → Storage Rebate geht an den Sender. `update_vault` ändert nur `encrypted_data` in-place → **kein** neues Objekt, kein Rebate-Verlust. | ✅ Rebate-Logik in Move korrekt. **Client:** Aktuell wird nur `createVaultOnChain` aufgerufen; bei jedem Speichern wird damit ersetzt (delete + neu). **Verbesserung:** Wenn ein Vault bereits existiert, `updateVaultOnChain` nutzen statt `createVaultOnChain`, um das Objekt zu behalten und Rebate nur bei echten Updates zu verbrauchen. |

**Fazit:** Größenlimit prüfen; bei Update **update_vault** nutzen, wenn Vault schon existiert.

---

## 5. Interface (Input, Ansicht, Status)

| Anforderung | Ist-Zustand | Bewertung |
|-------------|-------------|-----------|
| **Text-Area / Key-Value / Datei-Upload** | Vault enthält keine Nutzer-Texte/Key-Value/Dateien. Es gibt **kein** Eingabefeld für „eigene Daten“. Lokal/On-Chain gesichert werden nur die **App-Keys** (über /vault-save, /vault-onchain). | ⚠️ Für **aktuellen** Vault nicht nötig. Für einen **generischen Tresor** wären Text-Area, Key-Value-Editor und Datei-Upload die nächsten UI-Bausteine. |
| **Passwort-Prompt beim Laden** | UI: Passwort-Feld für „Daten sichern“ / „Daten laden“. Beim **Laden von der Chain** (ohne VAULT_FILE) muss das Backend das Passwort haben (z. B. Wallet-Passwort oder separater Prompt). | 🟡 Klarstellen: „Passwort zum Entschlüsseln der Tresor-Daten (nicht das Wallet-Passwort, sofern getrennt).“ Optional: Hinweis „Ohne Passwort können on-chain gespeicherte Daten nicht gelesen werden.“ |
| **Listen-Ansicht (was liegt im Vault?)** | Keine. Es werden keine „Einträge“ angezeigt, nur Buttons „Sichern“ / „Laden“. | 🟡 Sinnvoll: Kurze **Zusammenfassung** ohne Geheimnisse: „Tresor geladen: ECDH-Keys + Konfiguration.“ oder „Noch nichts gesichert.“ Keine Anzeige von Klartext oder Hex. |
| **Sync-Status (lokal vs. on-chain)** | **Fehlt.** Nutzer weiß nicht, ob die letzte Änderung nur lokal oder auch on-chain ist. | 🟡 **Sinnvoll:** Statuszeile oder Icon: „Nur lokal gesichert“ / „Auf Chain gesichert“ (z. B. wenn zuletzt /vault-onchain erfolgreich). Plus expliziter **„Jetzt auf Chain sichern“**-Button in der UI. |

**Fazit:** Für den **aktuellen** Schlüsseltresor: Passwort-Erklärung schärfen, kurze Status-/Zusammenfassungsanzeige, Sync-Status und „On-Chain sichern“-Button ergänzen. Für einen **Datentresor** danach: Input (Text/Key-Value/Datei) und Listen-Ansicht.

---

## Was macht Sinn – Prioritäten

1. **Sofort umsetzbar und sinnvoll**
   - **Größenlimit:** Prüfung vor create/update Vault, klare Fehlermeldung.
   - **updateVaultOnChain** anbinden und nutzen, wenn bereits ein Vault existiert (Rebate, weniger Objekt-Churn).
   - **UI:** „On-Chain sichern“-Button, Sync-Status (lokal / on-chain), klare Passwort-Beschreibung, kurze Inhalts-Zusammenfassung (ohne Geheimnisse).

2. **Dokumentation**
   - **Recovery:** In VAULT-EINRICHTEN.md (oder hier) festhalten: Passwort vergessen = Inhalt ohne Backup nicht wiederherstellbar; Option Backup/Export und ggf. zukünftig Recovery über Mnemonic.

3. **Später / bei Erweiterung zum Datentresor**
   - Pro-Eintrag-Verschlüsselung, Metadaten-Index, MIME-Typen, Text/Key-Value/Datei-Input, Listen-Ansicht.
   - Optional: Argon2 als KDF-Option, Sharding (2-von-2), Chaining bei >250 KB.

---

## Rebased-Dokumentation & Industrie-Standard

**IOTA Rebased (Object Model):**
- Speichermodell: Objekte mit ID, BCS-encoded payload; Dynamic Fields für flexible Strukturen (vgl. [Object Model](https://docs.iota.org/developer/iota-101/objects/object-model), [Dynamic Fields](https://docs.iota.org/developer/iota-101/objects/dynamic-fields/)).
- Größen-/Transaktionslimits liegen im `ProtocolConfig` (iota-protocol-config); typische Angabe für Move-Objekte ~250 KB. Unser `VAULT_PAYLOAD_MAX_BYTES = 200_000` bleibt mit Reserve darunter.
- Storage Rebate: Beim Löschen von Objekten geht Rebate an den Sender; `update_vault` ändert in-place und vermeidet unnötigen Churn.

**Industrie-Standard (Passwort-/Schlüsselspeicher):**
- **KDF:** PBKDF2 mit ≥310.000 Iterationen (OWASP) ist erfüllt. Argon2id wird oft als stärker gegen GPU/ASIC empfohlen (NIST/OWASP) – optional als zweiter Pfad (z. B. `KDF=argon2`), falls keine Abhängigkeit auf Node-`crypto` beschränkt sein soll.
- **Verschlüsselung:** AES-256-GCM mit 12-Byte-IV, 16-Byte-Tag; Salt pro Verschlüsselung – üblich und ausreichend.
- **UX:** Klarer Passwort-Prompt, keine Anzeige von Geheimnissen in Listen, Sync-Status (lokal vs. on-chain) – umgesetzt in Punkt 5.

---

## Kurz: Was fehlt für „Marktreife“ im aktuellen Sinne

- **Bereits gut:** Verschlüsselung (AES-256-GCM), KDF (PBKDF2 310k), Salt, Rebate in Move, Notfall-Löschung, Größenlimit-Check, `update_vault`-Nutzung, **Punkt 5** (Listen-Ansicht, Sync-Status, On-Chain-Button, Passwort-Erklärung), Recovery-Dokumentation.
- **Optional später:** Argon2 als KDF-Option, Chaining bei >200 KB, Erweiterung zum Datentresor (Struktur, Suche, MIME, Input-UI).

Wenn der Vault später **eigene Texte und Daten** speichern soll, kommen die genannten Punkte (Struktur, Suche, MIME, Input-UI) hinzu; die Security-Grundlagen (KDF, Salt, AES-GCM) können beibehalten und pro Eintrag wiederverwendet werden.
