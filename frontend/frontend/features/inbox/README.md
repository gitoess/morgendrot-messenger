# `features/inbox/`

Reine Posteingangs-Hilfen (API→`Message`-Mapping, Zeilenliste, Partner-Filter, Fehlertexte, Slides, …) ohne React. **`lib/inbox-*.ts`** und **`lib/chat-view-inbox-rows.ts`** re-exportieren für alte Pfade. **Partner/Richtung:** eingehende **Mesh-/Funk-Zeilen** werden wie Funk behandelt und nicht über Mailbox-Partner-/Ausgang-Filter weggeblendet (**`inbox-partner-filter.ts`**).

Siehe `features/README.md`, **`docs/INBOX-PACKAGE-EXPERT-MODE.md`** (Expertenmodus Package-ID) und `docs/FRONTEND-API-MODULARITY.md`.
