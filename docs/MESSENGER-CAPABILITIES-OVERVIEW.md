# Messenger – Fähigkeiten-Übersicht (für Prüfer / Ist-Stand)

**Zweck:** Kurz beschreiben, **was der Morgendrot-Messenger (Next-UI + API) heute kann**, wie er zum **Morgendrot-Gesamtprojekt** passt, und **was bewusst noch nicht** implementiert ist.  
**Stand:** lebendes Dokument; bei Abweichung zum Code bitte Code oder dieses Dokument anpassen.

**Verwandt:** Root-**`README.md`** (Funktionsbreite des Repos), **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**, **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**, **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** (geplant, nicht = implementiert). **Backend-Messenger-Kammer (Plain Node, nicht NestJS):** **`src/messenger-nest/README.md`**.

---

## 1. Einordnung „Morgendrot“

| Begriff | Bedeutung |
|---------|-----------|
| **Morgendrot (Repo)** | IOTA-Rebased-Vault, Messenger-Backend (`src/`), Move-Tests, optionale Hardware-Doku (`hardware/`, `heltec/`, `meshtastic/`), Next-Frontend (`frontend/`). |
| **Messenger-UI** | Primär **`frontend/`** (Chat, Wallet-Anbindung über Backend-API). Technisch dieselbe API wie andere Oberflächen (`/api/*`). |
| **Notfall-/Krisen-Fokus** | Produktstrategie: **IOTA**, wenn Netz da; **LoRa/Meshtastic** als Offline-/Funk-Fallback – siehe **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**. |

---

## 2. Was der Messenger (UI + Backend-Pfad) bereits kann

### 2.1 Identität & Schlüssel

- **Wallet/Tresor** über Backend: Senden/Empfangen verschlüsselter Nachrichten setzt **entsperrten Vault** voraus (UI-Hinweis + Dashboard).
- **Handshake / Partner**: Adresse eintragen, Handshake starten; **Schnell verbinden** (`/connect`) mit Standard-Adresse aus Konfiguration.

### 2.2 Nachrichten über IOTA (Mailbox / Chain)

- **Verschlüsselt (ECDH + AES-GCM)** über Backend in die Mailbox / Chain (je nach Deploy und Move-Setup).
- **Klartext-Kanal** (`/send-plain`), wenn Backend so konfiguriert – mit sichtbarem Warnhinweis in der UI bei aktiviertem Klartext-Speicher.
- **Posteingang**: Abruf über API (`fetchInbox`), Anzeige mit Transport-Badge (z. B. Internet vs. Mesh).

### 2.3 Medien & Anhänge (MORG-Wires)

- **Kompaktes Bild** (WebP-Pipeline über Backend), **.txt**, **Opus/Ogg** (rollenabhängig).
- **LoRa-Zweiphasen-Bild** (Luma/Chroma-Wires) für **Mesh v2**, mit explizitem **Online-Fallback** nur nach Nutzerbestätigung (kein stiller Wechsel zu IOTA).

### 2.4 LoRa / Meshtastic (experimentell)

- **Web Bluetooth** zum Heltec: Verbinden/Trennen, **PRIVATE_APP Binary v2** senden/empfangen.
- **Meshtastic-First:** Funk nutzt den **Standard-Meshtastic-/App-Pfad** soweit möglich; **kein** eigenes Mesh-Routing in der Web-UI.
- **Kontaktverzeichnis** mit Mesh-Feldern; **„Mesh verifiziert“** = gebundene LoRa-Identität im Kontakt-JSON (nicht gleichbedeutend mit on-chain „Protokoll-Verankerung“).

### 2.5 Sneakernet / Pakete

- **`.morg-pkg`**: Import, Export pro Nachricht (ECDH-Bundle), **Gerät → .morg-pkg** (mehrere Dateien), JSON-Snapshot-Export.

### 2.6 Rollen & Modi

- **Nachrichten** (eine Kachel): Umschalter **Privat** vs. **Pinnwand** (Broadcast-Kontext); Posteingang-Filter **Alles / Verschlüsselt / Klartext** (heuristisch); Pinnwand-Karte mit **PACKAGE_ID**-Copy & Einbindungs-Hinweis.
- **Boss-Ansicht** für Posteingang (Konfiguration).
- **Sendepfad-Auswahl** (privat + Klartext): **online** (IOTA/Mailbox) vs. **funk** (Meshtastic, oft per **Web-BT** zum Heltec → LoRa) vs. **adhoc** (Platzhalter **BLE Handy↔Handy**, nicht Web-BT). In **Simple Mode** (`SIMPLE_MODE`, Helfer) ist **adhoc** ausgeblendet — Fahrplan **§ H.0-SIMPLE** Phase 4.

### 2.7 Sonstiges (UI)

- **Messenger-Credits-Anzeige** (wenn Backend/RPC konfiguriert).
- **Konfig-Hinweise** aus Status-API.
- **Lokaler Klartext-Cache** des Servers: Hinweis + **Shred**-Button (best effort).

---

## 3. Was (Stand heute) bewusst noch nicht oder nur als Spec existiert

| Thema | Status |
|-------|--------|
| **Delayed LoRa → IOTA Upload** inkl. Queue, Gateway-Custody, Manifest on-chain | **Geplant** (**`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** §9.8); **nicht** als End-to-End-Produktfeature implementiert. |
| **Protokoll & Nachweis** (Auswahl, Verankerung, „Verifiziert“ gegen Anker) | **Spec** **`docs/PROTOCOL-ANCHOR-VERIFY-SPEC.md`**; UI-Menü **nicht** umgesetzt. |
| **Vollständige Hop-Signaturkette** auf jedem Relais | Optional / Phase 2 Firmware (**`meshtastic/PHASE-2-FIRMWARE-SPEC.md`**). |

---

## 4. Typische Architektur beim Betrieb

```
[Browser Next-UI] ──HTTPS──▶ [Node API / Messenger-Nest] ──▶ [IOTA RPC / Move]
        │
        └── Web Bluetooth ──▶ [Heltec / Meshtastic] ── LoRa ──▶ Mesh
```

**Basis-Station** (z. B. CM4) kann zusätzlich **LTE**, **MQTT-Gateway** und später die **Outbound-Queue** für Delayed Upload hosten – siehe **`hardware/README.md`**.

---

## 5. Prüfhinweise

- **Sicherheitsrelevant:** `.env`, Vault-Passwort, `ENABLE_PLAINTEXT_CHANNEL` / `MAILBOX_STORE_PLAINTEXT`, RPC-Proxy-Einstellungen.
- **Quellcode „Messenger“ (Logik):** überwiegend `src/messenger-nest/`, `frontend/frontend/components/views/chat-view.tsx` (Orchestrierung) sowie ausgelagerte Komponenten/Hooks unter `frontend/frontend/components/` und `frontend/frontend/hooks/` (u. a. **`use-chat-view-inbox.ts`** für Mailbox-Laden + Mesh-Merge).
- **Bundles:** gebaute Exporte unter `exports/` spiegeln `src/` – siehe **`docs/MESSENGER-BUNDLE-SOURCE-OF-TRUTH.md`**.
