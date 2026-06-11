/** Plain text for GET /api/help (Next „?“-Dialog) — prepended before CLI command lists. Roadmap H.0 / ONBOARDING L2. */
export const HELP_UI_INTRO = `--- Next-Messenger (Kurz) ---
• Entsperren: Backend-Sitzung (Vault-Passwort); bei SIGNER=sdk ggf. Mnemonic/Bech32 einmalig, wenn noch nicht in der Vault-Datei.
• Adresse, Package-ID, RPC: typischerweise in der Server-.env (Boss/Bundle) — nicht alles in dieser App änderbar; Setup-Icon oben oder Lite-UI am API-Port.
• Handbuch in der PWA: Menü „Buch“-Symbol → /handbook (nach erstem Laden oft offline).
• Chat: Nachrichten öffnen → Partner/Handshake wie in der Einrichtung — siehe Handbuch (Boss → Helfer, Lieferwege).

`;

export const HELP_START = `
\x1b[90m--- BEFEHLE (vor /connect) ---
/handshake <Adresse>     Handshake an Partner senden (ECDH-Key austauschen). Partner in .morgendrot-partner gespeichert.
/pairing-offer <Geheimnis> [Anzeigename] [Sek]   Optional: Geheimnis-Peering – Angebot on-chain (nach Move-Upgrade). TTL default 60s, min 15. Geheimnis stark wählen (hohe Entropie), nicht nur ein kurzes Wort.
/pairing-find <Geheimnis>   Letzte Offers laden (paginiert), Trial-Decrypt bis Match – Handshake an Partner. Budget: PAIRING_FIND_MAX_DECRYPT_ATTEMPTS (Default 80). Danach /connect.
/pairing-wait               Nach /pairing-offer: auf eingehenden Handshake warten (Timeout PAIRING_WAIT_TIMEOUT_MS).
/cancel-connect             „Connect läuft bereits“ / „Warte läuft bereits“: Warte-Flag zurücksetzen (ohne peerMap zu löschen).
/connect [Adresse]       Auf Handshake warten, dann Chat starten. Ohne Adresse: PARTNER_ADDRESS/KOMMANDANT_ADDRESSES aus .env.
/send-plain <Adresse> <Text>  Klartext senden (kein Handshake nötig, z.B. an sich selbst). Im Explorer sichtbar.
/set-package-id <id>     Package-ID setzen und in .morgendrot-package-id speichieren.
/publish-package [move-test]   Move-Paket publizieren (IOTA-CLI); PACKAGE_ID in .env/.morgendrot-package-id. Enthält create_private_mailbox (M4d).
/create-team-mailbox      Team-Shared-Mailbox on-chain (THW, Feuerwehr, Stab, …); Object-ID teilen/beitreten.
/create-private-mailbox   Eigene PrivateMailbox on-chain erstellen (M4d); Object-ID lokal für Profil-QR.
/purge-private-mailbox <0x…>   Eigene PrivateMailbox löschen (Rebate). Nur Owner; leer oder Einträge vorher purgen.
/cleanup-private-mailbox <0x…>  PrivateMailbox leeren (Handshakes + Nachrichten on-chain purgen).
/private-mailbox-contents <0x…>  Zählt Dynamic Fields (Handshakes/Nachrichten) vor Aufräumen/Rebate.
/shadow-sweep <Wort1> …   Schatten-Mnemonic (12+ Wörter): alles nach dem Befehl = Phrase. Oder API shadowMnemonic. Erzeugt Main-Wallet + sweep; Secret Key nur einmal in der Antwort.
/rpc-rotate              Nächsten Eintrag aus RPC_URL + RPC_URLS nutzen (öffentliche Rotation).
/resolve-iota-name <name.iota>   Indexer: Ziel-Adresse + Registrierungs-NFT-ID (iotax_iotaNamesLookup). Mit VERIFIED_IOTA_NAME_PACKAGE_IDS optional NFT-Paket prüfen.
Hinweis: UI Setup → „Transparenz & Schutz“ (Chain-Metadaten vs. E2EE-Inhalt). NFT nicht nötig für Chat.
Hinweis Editionen: MESSENGER_EDITION=standalone (klassisch) vs sales (Verkaufs-Bundle; UI mit Sweep-Hinweisen). /shadow-sweep und Setup-Sweep gelten für beide.
Hinweis SIGNER=cli: IOTA-CLI muss zur RPC passen (gleiche API-Version), sonst Client/Server api version mismatch. SIGNER=sdk signiert ohne CLI.
/vault-load <passwort> [pfad]   Bestehende .morgendrot-vault entschlüsseln (ohne /connect). Antwort enthält notes + personalSecrets (Mein Safe, KeePass-ähnlich).
/vault-load-from-chain <passwort>   Vault aus VAULT_REGISTRY_ID laden (wenn konfiguriert). Ebenfalls personalSecrets.
/vault-show-signer-import <passwort> [pfad]   Nur SIGNER=sdk: gespeicherten Mnemonic/Bech32-Import aus der Vault-Datei anzeigen (Backup prüfen). Erfordert denselben Import wie bei „Signer-Import mit speichern“.
/vault-save [passwort] [notizen] [pfad] [includeIotaMnemonic]   Keys + Notizen + personalSecrets in lokaler Vault-Datei speichern (Keys müssen im RAM sein). Optional letztes Argument includeIotaMnemonic (oder 1/true): SIGNER=sdk — Session-Mnemonic/Bech32 verschlüsselt in die Datei; ohne Pfad z. B. [passwort, notizen, includeIotaMnemonic].
/vault-lock              Keys + Wallet-Passwort aus RAM; lokaler Klartext-Inbox-Cache (.inbox.enc) wird geschreddert. Vault-Datei bleibt.
/vault-change-password <alt> <neu>   Vault-Datei neu verschlüsseln (min. 8 Zeichen); Sitzung muss entsperrt sein, aktuelles Passwort wird geprüft.
Hinweis UI/API: GET/POST /api/vault-personal-secrets – Safe-Einträge nur bei entsperrtem Tresor; persistLocal=true schreibt sofort die Vault-Datei.
/exit                    Programm beenden.
/help                    Diese Hilfe anzeigen.
\x1b[0m`;

export const HELP_CHAT = `
\x1b[90m--- BEFEHLE (im Chat) ---
<Text>                    Verschlüsselte Nachricht an alle Partner senden (nur Terminal).
/send <Text>             Verschlüsselte Nachricht senden (auch aus der UI). Optional: erster Block [[MORG_MAILBOX_NONCE_V1:{"n":"<dezimal u64>"}]] dann Zeilenumbruch — explizite Mailbox-Nonce (PWA/Offline); sonst Zeitstempel.
/transfer-coins <0x…> <IOTA>   Native Coins (IOTA) an Adresse senden (z.B. /transfer-coins 0x… 0.1).
/exit                    Chat beenden, Programm beenden.
/fetch <n> [sender]      Letzte N Nachrichten laden (z.B. /fetch 15). Optional: nur von sender (z.B. /fetch 10 0x…). Ohne /connect: Handshakes von der Chain.
hole letzten <n>         Wie /fetch – natürliche Eingabe (z.B. hole letzten 10).
/vault-save              Messaging-Keys + Notizen + Mein Safe (personalSecrets) lokal speichern (VAULT_FILE). Erfordert Passwort.
/vault-onchain [passwort] [notizen] [includeIotaMnemonic]   Tresor inkl. personalSecrets on-chain im VaultRegistry speichern. Erfordert VAULT_REGISTRY_ID. Optional letztes Argument includeIotaMnemonic wie bei /vault-save.
/purge-handshake         Handshake aus Mailbox löschen (ENABLE_PURGE, MAILBOX_ID).
   /purge-msg <nonce> [sender]  Nachricht aus Mailbox löschen. Nonce aus Event/Explorer. Verschlüsselt (MsgKey) und gespeicherter Klartext (PlainMsgKey) sind verschiedene Einträge — der Client versucht ggf. zwei TX (purge_message, dann purge_plaintext_mail_entry).
   /purge-msg <teamMailboxId> <sender> <nonce> team-broadcast  Team-Gruppenbroadcast purgen (Rebate). Alias: /purge-team-broadcast …
   /purge-team-broadcast <teamMailboxId> <broadcastSender> <nonce>  Team-Gruppenbroadcast purgen (Rebate). Sender = Original-0x der Nachricht; vor TTL nur dieser Sender.
   /purge-handshake-cache Lokalen Handshake-Tresor leeren (immer purgable).
   /purge-local-inbox [shred]  Lokale Inbox-Cache leeren. Optional: shred → Datei überschreiben vor Löschen.
   /clear-local-history [0]    Nuclear: wie Inbox purge, Standard mit Shred. „0“ = nur unlink.
/emergency-purge         Vault Notfall-Purge (enable + purge). Erfordert VAULT_REGISTRY_ID.
/create-key <lock> <recipient> [ttl]   AccessKey = Zutritt für Gast (Tür/Spind/Airbnb). ttl = Tage.
/create-keys <lock> <recipient> [ttl] [anzahl]   Mehrere AccessKeys ausstellen.
/emergency-purge-key <keyId>   AccessKey Notfall-Purge aktivieren. Danach /purge-key.
/purge-key <keyId>       AccessKey löschen (Rebate). Nach Gäst-Checkout sinnvoll.
/transfer-key <keyId> <new_owner>   AccessKey an neue Adresse übertragen.
/list-keys [owner]       AccessKeys auflisten (lock_id, expires_at).
/create-asset <name> [metadata] [streams_anchor_id]   PhysicalAsset erstellen. Optional: Streams-Anchor-ID für Industrie-Brücke.
/link-nfc-asset <assetObjectId> <nfc_uid>   NFC-Hardware-UID einmalig mit Asset verknüpfen (Kopierschutz, Sicherheitssiegel).
/transfer-asset <objectId> <newOwner>  PhysicalAsset an neue Adresse übertragen (Besitzwechsel).
/transfer-asset-key-package <assetId> <keyId> <newOwner>  Asset + Key in einer Transaktion übertragen (z. B. Verkauf Pumpe).
/purge-asset <objectId>  PhysicalAsset löschen (Rebate). Nur Besitzer.
/list-assets [owner]     PhysicalAssets auflisten (name, metadata, objectId, nfcUid).
/create-team-mailbox      Team-Shared-Mailbox on-chain (THW, Feuerwehr, Stab, …); Object-ID teilen/beitreten.
/create-private-mailbox   Eigene PrivateMailbox on-chain erstellen (M4d); Object-ID lokal für Profil-QR.
/purge-private-mailbox <0x…>   Eigene PrivateMailbox löschen (Rebate). Nur Owner; leer oder Einträge vorher purgen.
/cleanup-private-mailbox <0x…>  PrivateMailbox leeren (Handshakes + Nachrichten on-chain purgen).
/private-mailbox-contents <0x…>  Zählt Dynamic Fields (Handshakes/Nachrichten) vor Aufräumen/Rebate.
/pairing-offer <Geheimnis> [Name] [Sek]   Geheimnis-Peering (nach Move-Upgrade). Wie in HELP_START.
/pairing-find <Geheimnis>
/pairing-wait
/morg-pkg-export <0xEmpfänger> <Text>   Sneakernet: ECDH+AES-GCM wie /send (Klartext = ein Wire oder JSON-Bundle morgendrot.morgpkg.bundle.v1).
/morg-pkg-import         Nur per API: JSON-Body-Feld morgPkg – UI „.morg-pkg importieren“.
/help                    Diese Hilfe anzeigen.
\x1b[0m`;
