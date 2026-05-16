/**
 * Optionen für `/api/command` und `createMessengerCommandHandler` (geteilt mit `api-server.ts`).
 */

export type CommandApiOptions = {
    sponsorForSender?: string;
    silentFetch?: boolean;
    shadowMnemonic?: string;
    /** Body-Feld für /morg-pkg-import (vollständiges JSON-Objekt). */
    morgPkg?: unknown;
    /** `/send-plain`: `mailbox` = optional Mailbox-Store; sonst/fehlend = Event-Pfad (Legacy). */
    messagingPersistenceMode?: 'event' | 'mailbox';
    /** M4b: Ziel-Mailbox-Object-ID statt Server-MAILBOX_ID (0x+64 Hex). */
    mailboxObjectId?: string;
};
