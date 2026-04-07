# Einsatzleitung: Rollen-Manager & Provisioning-Maske — Ist-Code, Fehler, Rollenlandschaft

**Zweck:** Die Produktvision (**Boss-Bereich**: Rollen-Manager mit Icons; **Provisioning-Maske**: Rolle + Einsatz-Kanal → „Provisionieren“ → Handshake + Paket) **gegen den aktuellen Code** prüfen — **Begriffsverwechslungen** vermeiden und **Umsetzungsschritte** klar von der Roadmap ableiten.

**Verwandt:** **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`** (§ 2.3 Medic/Scout), **`docs/UI-ROLLEN-WORKSPACES.md`**, **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`**, **`docs/DEV-START.md`** (Boss-Werkstatt `ui/` vs. Next `frontend/`), Roadmap **`docs/ROADMAP-FAHRPLAN.md` § H.3g**.

---

## 1. Was an der Vision stimmt

| Baustein | Einordnung |
|----------|------------|
| **Zentraler Boss-Workflow** | Passt zur Architektur: Boss ist Steuerungs-/Exportzentrale (**`docs/ARCHITECTURE-ROLES-AND-HUB.md`**). |
| **Getrennte Begriffe** | **Einsatz-Rolle** (Medic, Scout, Sanitäter, …) als **Anzeige-/UX-Label** ist sinnvoll — sie darf **nicht** mit **Chain-`ROLE`** verwechselt werden (siehe § 3). |
| **Paket „Wallet + lokales Profil“** | Konsistent mit **Stufe A** in **`PROVISIONING-PAYLOAD-CRITIQUE.md`**: Metadaten **off-chain** im Bundle/Vault — **kein** Pflicht-Move-Upgrade für Labels. |
| **Ort der Umsetzung (Admin)** | Schwergewichtige Boss-Funktionen (**Batch, Provisioning, Messenger-Stapel**) liegen in der **Lite-UI / Boss-Werkstatt** (`**ui/**`, API-Port) — nicht ausschließlich im Next-Dashboard; Next hat **`BossView`**-Varianten, aber kein vollständiges „Einsatzleitungs-Modul“ im beschriebenen Umfang. |

---

## 2. Typische Fehler / Lücken in der naiven Formulierung

### 2.1 „Medic / Scout“ = Chain-Rolle

**Falsch:** Im Move-/Env-Modell gibt es **keine** Rolle `medic` oder `scout` als `ROLE=…`.

**Richtig:** Sichtbare **Hierarchie** und Rechte kommen aus **`.env`**: `ROLE` (z. B. `arbeiter`, `messenger`, `monitor`, `lock`, …), **`ROLE_ID`** (0–63), **`BIT_MASK`** / Profil-Bits (**`src/config.ts`**, **`docs/PROJEKT-IST-ZUSTAND.md`**). Labels wie **Medic** oder **Scout** sind **zusätzliche** Metadaten (UI, Kontaktliste, `initialProfile`) — sie steuern **keine** Chain-Policy ohne explizites Design (neues Struct, Registry, oder nur lokale UI).

**Konsequenz für den Rollen-Manager:** Jede **Einsatz-Rolle** (Template) muss intern abbilden:

- **Pflicht:** eine **technische** `ROLE` + `roleId` (+ ggf. Hardware-Typ),
- **Optional:** Anzeigename, Icon-Farbe, **sichtbare** Kanal-/Feature-Hinweise (rein clientseitig oder über Profil-JSON).

### 2.2 „Noch mehr Rollen“ — welche gibt es überhaupt?

**Provisioning-Zielrollen** (`POST /api/provision-device`, **`src/api-server.ts`**): `kommandant`, `arbeiter`, `lock`, `monitor`, `waerter`, `user` — **nicht** `boss`/`messenger` als *provisioniertes Endgerät* in dieser Liste (Boss/Messenger sind typischerweise die **provisionierende** Instanz).

**Laufzeit-Rollen** (`CFG.ROLE`): u. a. `boss`, `kommandant`, `arbeiter`, `lock`, `monitor`, `messenger` (Fallback für vieles), hierarchische Rechte (**`getHierarchyPermissions`**).

**64 Profil-IDs** über Bit-Maske — nicht mit Marketing-Labels verwechseln.

**Fazit:** Der Rollen-Manager sollte **zwei Ebenen** trennen:

1. **Technische Provision** (was `provision-device` versteht),
2. **Einsatz-Template** (Medic, Scout, …) → Mapping auf (1) + lokales Profil.

### 2.3 „Erst beim Klick Provisionieren wird der Handshake ausgelöst“

**Teilweise richtig, aber Reihenfolge beachten:**

- **`POST /api/provision-device`** liefert u. a. `envContent`, `jsonConfig`, `qrPayload` — **kein** automatischer Handshake.
- **`POST /api/boss-provision-handshake`** braucht **`address`**, **`partner`**, **`pubkey` (Base64)** und ein **entsperrtes** Boss-Wallet — siehe **`src/api-server.ts`**.

Der **Handshake** ist eine **eigene** On-Chain-TX (`buildHandshakeTransaction`). Das Gerät muss dem Boss also **mindestens** die **Partner-Adresse** und den **öffentlichen ECDH-Key** liefern (QR, Übertragung, oder aus dem Provision-Schritt, wenn dort erzeugt). Ein reiner „alles in einem Klick“ ist nur dann stimmig, wenn die **Maske** vor dem Aufruf diese Werte hat (Wizard: Schlüssel erzeugen → anzeigen → Boss bestätigt → `provision` + `boss-provision-handshake` in definierter Reihenfolge).

**Verbesserung der Story:** Nicht „Handshake kommt magisch nach dem Paket“, sondern: **„Ein Klick startet die definierte Kette: Profil+Env finalisieren → optional Handshake mit bekanntem Pubkey.“**

**Lite-UI (`ui/index.html`, Provisioning Schritt 3):** Nach erfolgreichem **`provision-device`** kann der Boss optional **Partner-Adresse** (Standard: `MY_ADDRESS` dieser Instanz) und **Messenger-ECDH-Pubkey** (Base64, nicht der IOTA-Ed25519-Key aus `generate-mnemonic`) eintragen und **`POST /api/boss-provision-handshake`** auslösen (`sendProvisionHandshake`). Reihenfolge: immer zuerst Provisioning, dann Handshake.

### 2.4 „Einsatz-Kanal zuweisen (z. B. Sektor Nord)“

**Lücke im Ist-Produkt:** Mehrere **benannte** Kanäle pro Einsatz sind **kein** fertiges Chain-Feature „pro Label eine Mailbox“ — typisch gibt es **`MAILBOX_ID`** / Streams-Anker pro Deployment; Routing über **mehrere** Kanäle erfordert **Klartext-Policy** in der App, weitere Object-IDs oder Streams-Topics (**`docs/PROVISIONING-PAYLOAD-CRITIQUE.md` § 2.4**).

**UI:** „Sektor Nord“ kann als **Tag** im Profil und als Filter in der Client-UI starten — **ohne** dass der String on-chain in `EcdhInit` steht.

### 2.5 Wo liegt das „Admin-Dashboard“?

| Oberfläche | Rolle |
|------------|--------|
| **`ui/` (Boss-Werkstatt)** | Bereits: umfangreiche `boss.*`-State (Provisioning-Schritte, Messenger-Stapel, …) in **`ui/index.html`**. Ein **Rollen-Manager** passt hierher **zuerst** (gleiche API-Schicht). |
| **`frontend/` (Next)** | Kunden-Produkt; Boss-Kacheln eingeschränkt — **parallel** oder später, wenn dieselbe API stabil ist. |

---

## 3. Konsolidierte Empfehlung (ohne Scope-Explosion)

1. **Rollen-Manager (Datenmodell):** JSON-/Server-Datei unter Boss-Kontrolle: Liste **Einsatz-Templates** `{ id, label, iconHint, chainRole, roleId, defaultChannels[], tags[] }` — **Versionierung** und **Maximalgröße** für Feldtests.
2. **Provisioning-Maske:** Erweiterung um gewähltes Template + Kanal-Tag → in **`initialProfile`** (oder `jsonConfig`-Erweiterung) schreiben; **`provision-device`**-Response um dieses Paket ergänzen (**Roadmap § H.3g**).
3. **Handshake:** Expliziter zweiter Schritt oder Subflow derselben Maske — **Voraussetzungen** (Pubkey) in der UI validieren.
4. **Client:** Lite-UI und/oder Next: Profil beim ersten Start anwenden (**`/api/contact-labels`** oder Bulk — siehe **`OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`**).

---

## 4. Abhängigkeit zur Offline-Boss-Warteschlange

Store-and-Forward (Boss ohne Internet, LoRa rein) ist **orthogonal**: zuerst **korrekte** Queue-Semantik (**nicht** `mintMessengerCreditsBatchForRecipients` als Universal-Flush) — **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`**.

---

*Stand: Abgleich mit `api-server.ts` (`provision-device`, `boss-provision-handshake`), `PROVISIONING-PAYLOAD-CRITIQUE.md`, `DEV-START.md`, `UI-ROLLEN-WORKSPACES.md`.*
