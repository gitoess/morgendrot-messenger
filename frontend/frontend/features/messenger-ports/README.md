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
- **`composerSendPath`** — Zustellweg + Team-Mailbox (`composerMailboxObjectId`)
- **`attachmentBar`** — Anhänge inkl. `sending` / `setSending`
- **`sendActions`** — Senden, Status, LoRa-Fallback
- **`shellOrchestration`** (nur Panel) — Handshake-Offers + Inbox-Panel-Aktionen

Einzelne Port-Dateien folgen dem Muster `*-port.ts` mit `as*`-Factory und optionalem `assemble*`-Slice im Core-Assembler.
