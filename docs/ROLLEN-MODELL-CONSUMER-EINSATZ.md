# Rollen-Modell: Consumer vs. Einsatz

**Zweck:** Ein **kanonisches Zielbild** für zwei Produktlinien im **gleichen** Messenger-Code — **Consumer** (Privatpersonen, Prepper, Freiwillige) und **Einsatz** (Feuerwehr, THW, Polizei, Hilfsorganisation) mit Hierarchie **Boss → Kommandant → Arbeiter**.

**Stand:** 2026-05-21  
**Status:** **Spezifikation + Schritt 2 (Teil)** — `deploymentProfile`, `teamManage`, Team-Gate und UI-Gates in Code; Mitgliederverwaltung Team weiter Phase 2.

**Verwandt:** **`docs/ARCHITECTURE-ROLES-AND-HUB.md`**, **`docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md`**, **`docs/UI-ROLLEN-WORKSPACES.md`**, **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`**, **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`**, **`docs/TEAM-MAILBOXES.md`**, **`docs/DEV-START.md`**, Roadmap **§ H.3g**, **§ H.17**, **§ H.24**.

---

## 1. Zwei Achsen — nicht vermischen

| Achse | Frage | Skala |
|-------|--------|--------|
| **A) Chat-Funktionen** | Was kann ich **nutzen**? (Senden, Posteingang, Telefonbuch, Mailboxen **beitreten**, Gruppe, Pinnwand **lesen**, Export **eigener** Daten) | ~0–100 % **Produkt** |
| **B) Verwaltungsrechte** | Was darf ich **steuern**? (Team **erstellen**, Kontakte **verteilen**, User provisionieren, Runtime/`.env`, Rebate, globaler Export) | ~0–100 % **Admin** |

**Leitregel:** **Arbeiter** hat **mindestens** dieselben Chat-Funktionen wie **Citizen** — nur **weniger Verwaltung**. Ein Feldhelfer darf nicht „schlechterer Messenger“ sein als ein Privatnutzer.

**Nicht dasselbe wie:**

- **`ROLE_ID` (0–63)** — sechs Bits **D/LW/BW/L/S/P** (Senden, Gas-Modell, Pinnwand-Objekte); siehe **`docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md`**
- **`getHierarchyPermissions`** — Befehle nach unten, Keys ausstellen, `configChange` — siehe § 4

---

## 2. Produktmodus vs. Hierarchie-Rolle

### 2.1 Produktmodus (`deploymentProfile`)

| Modus | Zielgruppe | UI-Schwerpunkt |
|-------|------------|----------------|
| **`consumer`** | Privatpersonen, Prepper, Freiwillige **ohne** Stab | Next-PWA: **schlank**, keine Einsatz-Admin-Panels |
| **`einsatz`** | Organisationen mit Leitstelle / Stab | Next-PWA + optional **Boss-Werkstatt** (`ui/`, Port 3342) für schwere Admin-Flows |

`deploymentProfile` ist **Zielbild** (Roadmap **§ H.24**); heute trennt **`UI_VARIANT=messenger`** und Bundle/Deploy teilweise Consumer vs. Voll-Repo — bis `deploymentProfile` in **`GET /api/status`** steht, gilt: **Consumer-Bundle = keine Einsatz-Admin-UI**, unabhängig vom Server-`ROLE`-String.

### 2.2 Hierarchie-Rollen (nur sinnvoll bei `deploymentProfile=einsatz`)

| Rolle (Produkt) | Typisch `.env` `ROLE=` | Zielgruppe |
|-----------------|------------------------|------------|
| **Citizen** | `messenger` (Consumer-Deploy) | Privat, Prepper, Freiwillige |
| **Arbeiter** | `arbeiter` | Einsatzkraft im Feld |
| **Kommandant** | `kommandant` | Zugführer, Gruppenleiter |
| **Boss** | `boss` | Einsatzleitung, Administrator |

**Wichtig:** Im Code heißt die Standard-Geräteklasse **`ROLE=messenger`** — das ist **nicht** dasselbe Wort wie „Messenger-App“. In Consumer-Dokumentation **Citizen** verwenden, um Verwechslung zu vermeiden.

**Rollen gelten pro Gerät/Instanz** (`.env` der Node), nicht global pro Person. Eine Person kann ein Handy (Citizen/Arbeiter) und einen Laptop (Boss) haben.

---

## 3. Die vier Rollen — Chat vs. Verwaltung

Übersicht (Zielbild, gerundet):

| Rolle | Chat-Funktionen | Verwaltung | Bemerkung |
|-------|-----------------|------------|-----------|
| **Citizen** | ~95 % | ~0 % | Voller Messenger für Alltag; **keine** Einsatz-Administration |
| **Arbeiter** | ~95 % | ~10 % | Wie Citizen; plus Einsatz-Kontext (Profil, Tags); **kein** Team-Admin |
| **Kommandant** | ~95 % | ~70 % | Team-Mailboxes **erstellen/verteilen**, Team-Kontakte, Team-Export |
| **Boss** | 100 % | 100 % | + globale Profile, Provisioning, Runtime, Rebate, Boss-Werkstatt |

### 3.1 Citizen

**Zielgruppe:** Privatpersonen, Prepper, Freiwillige ohne organisatorischen Stab.

**Begründung:** Der Messenger soll **nicht überladen** wirken — kein Provisioning, kein Geräte-Radar, keine Runtime-`.env`-Pflege. Voller **Chat**-Umfang (1:1, Gruppe, Mailbox, Telefonbuch, QR) reicht für 90 %+ der Alltagsfälle.

**Chat:** Private Mailbox erstellen, Team-Mailbox **beitreten** (wenn jemand die ID teilt), eigene Kontakte, Einsatz-/Package-Profil **wechseln** (Registry, § H.24), Pinnwand **lesen** (wenn Server erlaubt).

**Verwaltung:** Keine Team-Erstellung, keine globale Kontaktverteilung, kein User-Provisioning, kein Rebate fremder Mailboxen.

### 3.2 Arbeiter

**Zielgruppe:** Normale Einsatzkraft (Funkgerät, Handy im Verband).

**Begründung:** Im Einsatz zählt **Bedienbarkeit unter Stress** — gleicher Chat wie Citizen, aber **ohne** Führungs- und Konfigurationslast. Hierarchie „Befehle von oben“ bleibt über **`BOSS_ADDRESS` / `KOMMANDANT_ADDRESSES`** und Provisioning, nicht über UI-Vollmachten.

**Chat:** Wie Citizen; optional Einsatz-Tags aus **`initialProfile`** (Medic, Scout = **Anzeige**, nicht Chain-Rolle — **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`**).

**Verwaltung:** Nur **eigenes** Profil / eigene Kontakte; **kein** Team anlegen, **kein** globales Admin.

### 3.3 Kommandant

**Zielgruppe:** Zugführer, Gruppenleiter, technischer Gruppenverantwortlicher.

**Begründung:** Führungsebene **ohne** Leitstellen-Vollmacht — kann **sein Team** organisieren (Team-Mailbox, Kontakte, QR-Einladung), aber **keine** globale Server-Konfiguration und **kein** Rebate/Löschen fremder Infrastruktur.

**Chat:** Wie Arbeiter.

**Verwaltung:** Team-Mailbox **erstellen** und Object-ID **verteilen**; Team-Kontakte / **`initialProfile`** an Gruppe; Forensik/Export **Team + eigene** Daten; **teilweise** Admin-Befehle (z. B. `/create-team-mailbox`); **kein** `configChange` global (Zielbild — heute im Code oft noch `configChange: false`, siehe § 7).

### 3.4 Boss

**Zielgruppe:** Einsatzleitung, Administrator, Stab.

**Begründung:** **Organisatorische Zentrale** — Struktur verteilen, Geräte provisionieren, Bundles exportieren, Runtime/Package pflegen (**`docs/ARCHITECTURE-ROLES-AND-HUB.md`**). Schwere Flows in der **Boss-Werkstatt** (`ui/`), nicht im Chat-Composer.

**Chat:** Vollständig inkl. erweiterter Inbox-Sichten (z. B. `bossView` bei `KOMMANDANT_ADDRESSES`).

**Verwaltung:** Alles aus der Matrix § 5.1; **`permissions.configChange`**; Provisioning (**§ H.3g**); Rebate; globale Einsatz-Profile definieren; Pinnwand-Rechte **pflegen** (Server-Listen + UI).

---

## 4. Technische Erkennung

### 4.1 Quelle der Wahrheit

Rollen und Rechte kommen von der **laufenden Node-Instanz** (`.env` + Runtime), nicht von einer zentralen „User-Datenbank“ im Messenger.

```
GET /api/status
```

Relevante Felder (Ist + Zielbild):

| Feld | Bedeutung |
|------|-----------|
| **`role`** | Grobe Geräteklasse: `boss`, `kommandant`, `arbeiter`, `messenger`, … |
| **`permissions`** | Aus **`getHierarchyPermissions(role)`** in **`src/config.ts`**: u. a. `commandDown`, `keyIssue`, `revokeDown`, `statusReadDown`, `statusReadUp`, **`configChange`**, `hierarchyChange`, **`teamManage`** |
| **`roleId`** | **`ROLE_ID`** 0–63 (Feinrechte Bits) |
| **`uiVariant`** | `messenger` vs. volles Dashboard — **`docs/UI-ROLLEN-WORKSPACES.md`** § 5–6 |
| **`deploymentProfile`** | `consumer` \| `einsatz` — steuert Einsatz-Admin-UI (`CFG.DEPLOYMENT_PROFILE`, **`GET /api/status`**) |
| **`locked`** | Tresor gesperrt → On-Chain-Signatur blockiert; **kein** Ersatz für Rollenprüfung |

**Nicht** für Boss-Erkennung:

- **`VAULT_REGISTRY_ID`** — On-Chain-Vault des **Geräts**
- **`COMMAND_REGISTRY_ID`** — erlaubte **Open-Wörter** für Lock-Modus

### 4.2 UI-Regeln (Zielbild)

1. **`deploymentProfile=consumer`** → Einsatz-Admin-Komponenten **nie** rendern (auch wenn Server fälschlich volle `permissions` meldet).
2. **`deploymentProfile=einsatz`** → Admin-Elemente an **`permissions.*`** + **`role`** koppeln.
3. **On-Chain-Aktionen** zusätzlich: **`locked !== true`** und ggf. Messenger-Credits / Direct-IOTA-Flags.
4. **Schwere Admin-Flows** (Provisioning-Stapel, Messenger-Export, Runtime-JSON, Rebate) → **Boss-Werkstatt** **`ui/`** (**`docs/DEV-START.md`**), nicht als vollwertige Chat-Tabs.

### 4.3 Beispiel-Entscheidungsbaum (Frontend)

```text
if deploymentProfile === 'consumer':
  showEinsatzAdmin = false
else if role === 'boss' && permissions.configChange:
  showEinsatzAdmin = true
  showBossWerkstattLink = true
else if role === 'kommandant' && permissions.teamManage:  // Zielbild — Flag noch einzuführen
  showTeamAdmin = true
else:
  showTeamAdmin = false
```

---

## 5. Rechte-Matrix

### 5.1 Funktionen (Zielbild)

Legende: ✅ erlaubt · ❌ nicht · 🔶 eingeschränkt · **S** = zusätzlich **Server-Policy** (`.env` / Runtime)

| Funktion | Citizen | Arbeiter | Kommandant | Boss |
|----------|---------|----------|------------|------|
| Private Mailbox erstellen | ✅ | ✅ | ✅ | ✅ |
| Team-Mailbox **beitreten** (ID/QR) | ✅ | ✅ | ✅ | ✅ |
| Team-Mailbox **erstellen** | ❌ | ❌ | ✅ | ✅ |
| Team einladen (QR / Profil-Payload) | ❌ | ❌ | 🔶 nur „eigene“ Teams | ✅ global |
| Kontakte **eigen** | ✅ | ✅ | ✅ | ✅ |
| Kontakte **an Team verteilen** | ❌ | ❌ | ✅ | ✅ |
| Einsatz-Profil **wechseln** (Registry) | ✅ | ✅ | ✅ | ✅ |
| Einsatz-Profil **definieren** (neu) | ❌ | ❌ | 🔶 Templates | ✅ |
| User provisionieren / sperren | ❌ | ❌ | 🔶 eigene Gruppe | ✅ |
| Team-Mailbox Rebate / Löschen | ❌ | ❌ | ❌ | ✅ |
| Forensik / Export | nur eigene | nur eigene | Team + eigene | global |
| Admin-API (`configChange`) | ❌ | ❌ | ❌ | ✅ |
| Pinnwand lesen | ✅ | ✅ | ✅ | ✅ |
| Pinnwand schreiben | **S** | **S** | **S** + UI | **S** + Rechte pflegen |
| Boss-Werkstatt `ui/` | ❌ | ❌ | 🔶 optional read-only | ✅ |

**Team-Mailbox heute:** Zugang = **Object-ID kennen** — kein On-Chain-Mitgliederverzeichnis (**`docs/TEAM-MAILBOXES.md`**). „Mitglieder verwalten / sperren“ = **Phase 2** (Off-Chain-Team-Key, Broadcast, Provision — **`docs/TEAM-MAILBOX-BROADCAST-1TX-KONZEPT.md`**).

**Pinnwand schreiben:** **`BROADCAST_AUTHORIZED_SENDERS`** / `broadcastPinnwand` in **`GET /api/status`** — Rolle allein reicht nicht.

### 5.2 UI-Elemente — Next-PWA (Chat & Dashboard)

Spalten: **Sichtbarkeit** im Zielbild — **Ist (2026-05)** oft noch ohne Rollen-Gate (siehe § 8).

Legende UI: ✅ sichtbar/aktiv · ❌ ausgeblendet · 🔶 nur wenn Server-Policy · 🔒 sichtbar, bei gesperrtem Tresor disabled · **Z** = Zielbild nach Schritt 2 (Code)

| UI-Element (Label im Produkt) | Ort | Citizen | Arbeiter | Kommandant | Boss |
|-------------------------------|-----|---------|----------|------------|------|
| **Kanal 1:1 / Gruppe / Pinnwand** (Chat-Header) | Chat | ✅ | ✅ | ✅ | ✅ |
| **Verschlüsselung** (Schloss), **Transport** (online/funk) | Send-Panel / Transport-Karte | ✅ | ✅ | ✅ | ✅ |
| **Ziel-Postfach** (4 Slots, M4e) | Send-Panel | ✅ | ✅ | ✅ | ✅ |
| **Mailbox an alle Mitglieder** (Gruppe, M2a) | Gruppen-Panel | ✅ | ✅ | ✅ | ✅ |
| **Meine Mailboxen** (Toolbar-Button) | Posteingang-Toolbar | ✅ | ✅ | ✅ | ✅ |
| Server-Shared (Badge „Server“, immer Posteingang) | Panel „Meine Mailboxen“ | ✅ | ✅ | ✅ | ✅ |
| **Private Mailbox erstellen** | Panel „Meine Mailboxen“ | ✅ 🔒 | ✅ 🔒 | ✅ 🔒 | ✅ 🔒 |
| **Team-Mailbox erstellen** | Panel „Meine Mailboxen“ | ❌ **Z** | ❌ **Z** | ✅ 🔒 **Z** | ✅ 🔒 **Z** |
| **Team beitreten** (Prompt ID/QR) | Panel „Meine Mailboxen“ | ✅ | ✅ | ✅ | ✅ |
| **Als aktiv setzen** (Team/Privat) | Panel „Meine Mailboxen“ | ✅ | ✅ | ✅ | ✅ |
| **Archiv / Wiederherstellen** (Team/Privat lokal) | Panel „Meine Mailboxen“ | ✅ | ✅ | ✅ | ✅ |
| **Telefonbuch** | Posteingang-Toolbar / Gruppe | ✅ | ✅ | ✅ | ✅ |
| Kontakt anlegen, QR, 4 Mailbox-Felder | Telefonbuch-Dialog | ✅ | ✅ | ✅ | ✅ |
| **Gruppenchat** — speichern, Mitglieder aus Telefonbuch | Gruppen-Panel | ✅ | ✅ | ✅ | ✅ |
| **Pinnwand** — Kontext-Karte, Anheften | Kanal Pinnwand | ✅ lesen | ✅ lesen | ✅ + schreiben **S** | ✅ + Admin **S** |
| Posteingang-Export (Einsatzbericht, Protokoll, …) | Posteingang-Menü | ✅ eigen | ✅ eigen | ✅ + Team **Z** | ✅ global **Z** |
| **Einsatz-Rollen-Vorlagen** | Einstellungen | ❌ **Z** | ❌ **Z** | 🔶 lesen **Z** | ✅ **Z** (heute auch `messenger`) |
| **Puls / Wallet & Session** | Einstellungen | ✅ | ✅ | ✅ | ✅ |
| **Geräte-Radar** | Dashboard (volles Layout) | ❌ | ❌ | 🔶 **Z** | ✅ (heute: Boss + `full`) |
| Kachel **Boss-Modus** (Befehle, Handoff) | Dashboard | ❌ | ❌ | 🔶 **Z** | ✅ |
| Kachel **Nachrichten / Tresor** | Dashboard | ✅ | ✅ | ✅ | ✅ |
| Link **Boss-Werkstatt** (`http://…:3342/`) | Einstellungen / Hilfe | ❌ | ❌ | 🔶 optional | ✅ |
| Handshake-Banner / Badge (§ H.27) | Posteingang | ✅ | ✅ | ✅ | ✅ |

**Hinweise:**

- **„Meine Mailboxen“** lädt Posteingang-Union: Shared **immer** + aktive Team/Privat nach **Aktualisieren** (siehe Panel-Hinweistext).
- **Gruppen-Mailbox-Senden** ist **kein** Team-Postfach on-chain, sondern **N× pairwise** an Mitglieder (**`group-mailbox-pairwise-send.ts`**).
- **Einsatz-Rollen-Vorlagen:** Ist-Code zeigt Block bei `role === 'boss' \|\| role === 'messenger'` — für **Consumer** soll das später an **`deploymentProfile=consumer`** gekoppelt werden (**Z**).

### 5.3 UI-Elemente — Boss-Werkstatt (`ui/`, Port 3342)

Schwere Admin-Flows — primär **Boss**; Kommandant optional read-only/export (**Zielbild**).

| UI-Bereich (Lite-UI) | Boss | Kommandant | Arbeiter / Citizen |
|----------------------|------|------------|---------------------|
| **Provisioning** (`provision-device`, Handshake Schritt 3) | ✅ | 🔶 **Z** | ❌ |
| **Messenger-Stapel / Export-Assistent** | ✅ | ❌ | ❌ |
| **Runtime-Config** (`.env` vs. Runtime-JSON) | ✅ | ❌ | ❌ |
| **Rebate / Gas / Package publish** | ✅ | ❌ | ❌ |
| **Einsatz-Rollen-Templates** (Datei `.morgendrot-einsatz-templates.json`) | ✅ | 🔶 **Z** | ❌ |
| **Steuerung → Dokumentation** (`GET /api/doc`) | ✅ | ✅ | ❌ |
| Volle Befehls-Oberfläche / Monitoring-Kacheln | ✅ | 🔶 | ❌ |

Consumer-Nutzer **ohne** Einsatz-Deployment sehen diese Oberfläche typischerweise **gar nicht** (eigener Rechner/Bundle).

---

## 6. Beispiel: Ein Einsatz mit Feuerwehr + THW

**Szenario:** Großschadenslage — **eine** Leitstelle (Boss), zwei Züge (Feuerwehr + THW), Helfer mit Handys. **Empfehlung Roadmap:** unter **einem** Katastrophenschutz-**`PACKAGE_ID`** + Shared-**`MAILBOX_ID`** arbeiten (**`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** § 2) — nicht täglich zwischen Verbänden die Chain wechseln.

### 6.1 Beteiligte und Rollen

| Person / Gerät | Rolle (Produkt) | `.env` `ROLE=` | Was sie tun |
|----------------|-----------------|----------------|-------------|
| Leitstelle-Laptop | **Boss** | `boss` | Package/Runtime, Provisioning Helfer-Handys, Team „FW-Zug 1“ + „THW-Zug 1“ anlegen, Pinnwand-Whitelist pflegen |
| FW-Gruppenführer-Handy | **Kommandant** | `kommandant` | Team-Mailbox **FW-Zug 1** erstellen, QR an Zug, Kontakte (Führung, Atemschutz) im Telefonbuch |
| THW-Gruppenführer-Handy | **Kommandant** | `kommandant` | Team-Mailbox **THW-Zug 1** erstellen, analog |
| FW-Mannschaft (×N) | **Arbeiter** | `arbeiter` | Chat, Funk, Team **beitreten** per QR, senden an 0x-Kontakte |
| THW-Helfer (×N) | **Arbeiter** | `arbeiter` | wie FW |
| Privat-Helfer (optional) | **Citizen** | `messenger` + Consumer-Bundle | Gleicher Chat, **kein** Team erstellen; kann Team **beitreten**, wenn QR vorliegt |

### 6.2 Ablauf (praxisnah)

**Tag 0 — Vorbereitung (Boss, Werkstatt + Dashboard)**

1. Boss deployt Move-Paket, setzt **`PACKAGE_ID`**, **`MAILBOX_ID`** (Shared-Einsatz-Postfach).
2. Boss legt **Einsatz-Rollen-Vorlagen** an (Anzeige: „Atemschutz“, „Melder“ — **Labels**, nicht Chain-`ROLE`).
3. Boss **provisioniert** Helfer-Handys (`provision-device`) → `.env`-Handoff oder ZIP (**§ H.7**).
4. Optional: **`initialProfile`** mit Stamm-Kontakten (Leitstelle, Führungskräfte) — **`POST /api/contact-labels/apply-initial-profile`**.

**Tag 1 — Lage (Kommandanten + Arbeiter, Messenger-PWA)**

1. Kommandant FW: Chat → **Meine Mailboxen** → **Team-Mailbox erstellen** („FW Zug 1“) → Object-ID per **QR/Kopieren** an Zug.
2. Kommandant THW: analog **„THW Zug 1“**.
3. Arbeiter: **Team beitreten** (ID einfügen) → **Als aktiv setzen** → Posteingang **Aktualisieren**.
4. Abstimmung **1:1** und **Gruppenchat** (Mitgliederliste = Zug) für Lage; **Pinnwand** für Lage-Meldungen (nur wenn Adresse auf Whitelist).
5. **Persistent (Mailbox) + online:** Nachrichten an Partner-0x oder Gruppe mit **Mailbox an alle Mitglieder** (M2a, pairwise).

**Leitstelle (Boss)**

- Liest **Shared-Postfach** + optional **bossView**-Inbox für Kommandanten-Adressen.
- Pflegt **Pinnwand-Autorisierung** serverseitig; nutzt **Geräte-Radar** / Monitor für „wer lebt“.
- **Kein** Mischbetrieb: FW- und THW-Team-Mailboxes sind **zwei Object-IDs** — beide können parallel existieren; Shared bleibt gemeinsamer Anker.

### 6.3 Was bewusst **nicht** passiert (häufige Fehler)

| Fehler | Richtig |
|--------|---------|
| Jeder Helfer legt selbst eine Team-Mailbox an | Nur **Kommandant/Boss** (Zielbild) |
| „Gruppenchat“ = ein on-chain Team-Postfach | Gruppe = **lokale Mitgliederliste**; Mailbox = **pairwise** oder separates **Team-Object** |
| Medic/Scout als `ROLE=medic` in `.env` | **Einsatz-Label** im Profil/Telefonbuch (**§ EINSATZLEITUNG-…**) |
| FW und THW wechseln stündlich `PACKAGE_ID` | **Ein** Einsatz-Package; Teams über **Object-IDs** trennen |
| Boss erwartet zentrale „User-Liste aller Handshakes“ | Heute: **eigene** pending Handshakes (§ H.27); Lage über **Monitor/Radar**, nicht globales User-DB |

### 6.4 Bezug zur UI-Matrix (§ 5.2)

| Wer | Sieht typischerweise | Sieht **nicht** (Zielbild) |
|-----|----------------------|----------------------------|
| FW-Arbeiter | Chat, Telefonbuch, Team **beitreten**, Gruppe, Senden | **Team erstellen**, Provisioning, Runtime |
| FW-Kommandant | + **Team erstellen**, Team-Kontakte verteilen | Rebate, globale Package-Config |
| Boss | + Werkstatt, Geräte-Radar, Vorlagen, Provisioning | — (Consumer-Overhead optional ausblenden) |
| Citizen-Helfer | Wie Arbeiter im Chat | Einsatz-Admin komplett |

---

## 7. Zwei Oberflächen — eine Codebasis

| Oberfläche | Wer | Anteil „100 % Boss“ |
|------------|-----|---------------------|
| **Next-PWA** (`frontend/`) | Alle | Chat + **kompakte** Einsatz-Erweiterungen (Team, Kontakte, Profilwechsel) |
| **Boss-Werkstatt** (`ui/`, Port 3342) | Boss (primär) | Provisioning, Export-Stapel, Runtime, Rebate, tiefe Befehle |

Boss **100 %** = Messenger **plus** Werkstatt — nicht nur extra Tabs im Chat.

---

## 8. Ist-Code vs. Zielbild (ehrlicher Abgleich)

| Thema | Zielbild (dieses Dokument) | Ist (2026-05) |
|-------|---------------------------|---------------|
| **`ROLE=messenger` + `configChange`** | Consumer: **kein** Admin | **`getHierarchyPermissions`:** bei **`deploymentProfile=consumer`** → **`configChange: false`** |
| **Kommandant + Team erstellen** | ✅ | **`/create-team-mailbox`** + UI: **`permissions.teamManage`** (Boss/Kommandant) |
| **`deploymentProfile` in `/api/status`** | `consumer` \| `einsatz` | **`CFG.DEPLOYMENT_PROFILE`** + Heuristik (`ROLE`, `UI_VARIANT`, `MESSENGER_EDITION`) |
| **`permissions.teamManage`** | Kommandant + Boss | **Implementiert** in `getHierarchyPermissions` + `canCreateTeamMailbox` |
| **Mitgliederverwaltung Team** | Phase 2 | Nur lokales Beitreten per ID |

**Erledigt (Schritt 2):** `deploymentProfile` in Status; Consumer ohne Admin-Flags; `teamManage`-Gate API + UI; Einsatz-Vorlagen nur `einsatz` + Boss/Kommandant.

**Offen:** Consumer-Bundle explizit `DEPLOYMENT_PROFILE=consumer` in Export-Skripten; weitere Admin-UI-Gates (Boss-Werkstatt, Runtime); Phase-2-Team-Mitgliederverwaltung.

---

## 9. Verwandte Dokumentation

| Dokument | Inhalt |
|----------|--------|
| **`docs/ARCHITECTURE-ROLES-AND-HUB.md`** | Boss als Steuerungs-/Exportzentrale; Kommandant-Hub; eine Instanz pro Gerät |
| **`docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md`** | `ROLE` vs. `ROLE_ID` vs. `getHierarchyPermissions`; Lock vs. Messenger |
| **`docs/UI-ROLLEN-WORKSPACES.md`** | Dashboard-Workspaces, Action Center, Geräte-Radar |
| **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`** | Medic/Scout vs. Chain-`ROLE`; Provisioning-Maske; Lite-UI zuerst |
| **`docs/PACKAGE-PROFILE-WECHSEL-SPEC.md`** | Einsatz wechseln ≠ Chat-Raum; Profil-Registry (§ H.24b) |
| **`docs/TEAM-MAILBOXES.md`** | Shared / Team / Privat; `/create-team-mailbox` |
| **`docs/BOSS-MODUS.md`** | Remote-Signer, Maschinen ohne Wallet |
| **`docs/DEV-START.md`** | Boss-Werkstatt vs. Next-Kunden-UI |
| **`docs/ROADMAP-FAHRPLAN.md`** | § H.3g (Einsatzleitung), § H.17 (Dashboard), § H.24 (Profile) |

---

## 10. Kurz-Fazit

- **Zwei Achsen:** Chat-Funktionen ≠ Verwaltungsrechte.
- **Vier Rollen:** Citizen, Arbeiter, Kommandant, Boss — **Arbeiter nicht schlechterer Chat** als Citizen.
- **Erkennung:** **`/api/status`** → `role` + `permissions` + **`deploymentProfile`** (Ziel) + `uiVariant`; Tresor **`locked`** separat.
- **Umsetzung:** Eine App, zwei Produktmodi; schwere Admin-Flows in **Boss-Werkstatt**, leichte in der PWA.

*Stand: 2026-05-21 — inkl. UI-Matrix § 5.2–5.3 und Einsatz-Beispiel § 6; Abgleich Ist-Code § 8.*
