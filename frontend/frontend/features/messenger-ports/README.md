# Messenger Ports (ChatView)

Leseschnittstellen zwischen `useChatViewCore` und den Panel-Hooks/Komponenten.

## `messengerPorts` vs. `panelMessengerPorts`

| | `messengerPorts` | `panelMessengerPorts` |
|---|---|---|
| **Quelle** | `buildChatViewCoreState` / `assembleChatViewMessengerPorts` | `useChatViewPanelMessengerPorts` |
| **Umfang** | Composer, Inbox, Send, Routing, Attachment — alles aus Sub-Hooks | Core-Ports **plus** Shell-Orchestration (P7) |
| **Zusatz** | — | Handshake-Poll, Inbox-Antwort/Aktionen, optional `onChannelModeChange` auf `shellRouting` |
| **Konsumenten** | Core-Hook-Rückgabe; Basis für Panel-Assembly | Inbox-, Send-, Shell- und Transport-Panel-Hooks in `ChatViewMainContent` |

**Regel:** Panel-Hooks bekommen `panelMessengerPorts`. Direkter Zugriff auf Core-State außerhalb der Ports ist nach P9 nicht mehr vorgesehen — `useChatViewCore` liefert nur `{ messengerPorts }`.

## Port-Gruppen (Auswahl)

- **`shellRouting`** — Kanal, Gruppe, Rolle, Adresse (`channelMode`, `isPrivate`, `isGroup`, `activeGroup`, …)
- **`shellOrchestration`** (nur Panel) — Handshake-Offers + Inbox-Panel-Aktionen
- **`composerSendPath`** — Zustellweg + Team-Mailbox (`composerMailboxObjectId`)
- **`attachmentBar`** — Anhänge inkl. `sending` / `setSending`
- **`sendActions`** — Senden, Status, LoRa-Fallback

Einzelne Port-Dateien folgen dem Muster `*-port.ts` mit `as*`-Factory und optionalem `assemble*`-Slice im Core-Assembler.

## P10: Binding-Glue (Main-Content)

| Modul | Rolle |
|---|---|
| **`useChatViewComposerBindings(messengerPorts)`** | Aliase aus Core-Ports (`setMessage`, `channelMode`, …) — entlastet `ChatViewMainContent` |
| **`buildComposeReplyTargets(...)`** | Reply-Bundle für `inbox-reply-context` / `useChatViewPanelMessengerPorts` |

## `handshakeOffersRead` (Stub vs. Panel)

Im Core-Assembler liefert `handshakeOffersRead` oft **leere** Defaults (`pendingHandshakes: undefined`, leere `connectedAddresses`). Die **autoritative** Quelle im UI ist `shellOrchestration` in `useChatViewPanelMessengerPorts` (Poll, Cache, Vault-Lock). Panel-Hooks sollen `panelMessengerPorts` nutzen, nicht den Core-Stub direkt.

## `shellRouting` vs. `shellOrchestration`

- **`shellRouting`** — reine Routing-/Kanal-Felder aus dem Core (inkl. optional `onChannelModeChange` vom Parent).
- **`shellOrchestration`** — Panel-only: Handshake-Poll, Inbox-Antwortdialoge, lokale Panel-Aktionen. Wird in `useChatViewPanelMessengerPorts` auf `panelMessengerPorts` gelegt.

## Namenskonvention Callbacks

| Muster | Bedeutung | Beispiel |
|---|---|---|
| **`on*Change`** | Port-Callback (React-Event-Stil) | `onMessageChange`, `onEncryptedChange` |
| **`set*`** | Direkter Setter-Alias in Bindings/Main-Content | `setMessage` ← `composerDraft.onMessageChange` |
| **`setSending`** | Imperativer Zustand (Attachment-Bar) | `attachmentBar.setSending(true)` |

Neue Ports: Callbacks als `on*Change` in der Port-Definition; Aliase `set*` nur in Hooks wie `useChatViewComposerBindings`.
