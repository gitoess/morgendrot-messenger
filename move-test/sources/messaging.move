module messaging::messaging { // Named address via Move.toml
    use 0x2::event;
    use 0x2::object::{Self, ID, UID};
    use 0x2::table::{Self, Table};
    use 0x2::transfer;
    use 0x2::tx_context::{Self, TxContext};
    use 0x2::dynamic_object_field as dof;
    use std::vector;

    /// ----------------------------------------------------------------
    /// Legacy events (NOT purgeable)
    /// ----------------------------------------------------------------
    struct EcdhInit has copy, drop {
        sender: address,
        recipient: address,
        pub_key: vector<u8>,
        nonce: u64,
    }

    struct EncryptedMessage has copy, drop {
        sender: address,
        recipient: address,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        nonce: u64,
    }

    /// Optional: Klartext-Event für Test/Demo (öffentlich im Explorer). Per Flag ein-/ausschaltbar.
    struct PlaintextMessage has copy, drop {
        sender: address,
        recipient: address,
        text: vector<u8>,
        nonce: u64,
    }

    /// Geheimnis-Peering (optional): öffentlich nur nonce + ciphertext + Ablauf. Klartext (Adresse, Anzeigename) nur mit gemeinsamem Geheimnis (App-seitig AES-GCM).
    struct PairingOffer has copy, drop {
        nonce: vector<u8>,
        ciphertext: vector<u8>,
        expires_at_ms: u64,
    }

    public entry fun emit_pairing_offer(nonce: vector<u8>, ciphertext: vector<u8>, expires_at_ms: u64, _ctx: &mut TxContext) {
        event::emit(PairingOffer { nonce, ciphertext, expires_at_ms });
    }

    public entry fun emit_ecdh_init(recipient: address, pub_key: vector<u8>, nonce: u64, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        event::emit(EcdhInit { sender, recipient, pub_key, nonce });
    }

    public entry fun send_encrypted_message(
        recipient: address,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        event::emit(EncryptedMessage { sender, recipient, ciphertext, iv, tag, nonce });
    }

    /// Optional: Klartext-Event emittieren (Legacy, nur Event – für Test/Demo, Explorer zeigt Klartext).
    public entry fun send_plaintext_message(recipient: address, text: vector<u8>, nonce: u64, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        event::emit(PlaintextMessage { sender, recipient, text, nonce });
    }

    /// ----------------------------------------------------------------
    /// Rebased globals (shared objects)
    /// ----------------------------------------------------------------
    struct VaultRegistry has key {
        id: UID,
    }

    struct Mailbox has key {
        id: UID,
    }

    /// Pro lock_id eine Liste erlaubter „Öffnen“-Wörter (kommagetrennt als vector<u8>). Lock liest on-chain.
    struct CommandRegistry has key {
        id: UID,
    }

    struct LockId has copy, drop, store {
        lock_id: address,
    }

    struct OpenWords has key, store {
        id: UID,
        words: vector<u8>,
    }

    struct GlobalsCreated has copy, drop {
        vault_registry_id: ID,
        mailbox_id: ID,
        command_registry_id: ID,
        by: address,
    }

    struct TeamMailboxCreated has copy, drop {
        mailbox_id: ID,
        by: address,
    }

    /// Zusätzliches Shared-Postfach (THW, Feuerwehr, Stab, …) — gleiche `Mailbox`-Struct wie Server-Einsatz.
    public entry fun create_team_mailbox(ctx: &mut TxContext) {
        let by = tx_context::sender(ctx);
        let mb = Mailbox { id: object::new(ctx) };
        event::emit(TeamMailboxCreated {
            mailbox_id: object::id(&mb),
            by,
        });
        transfer::share_object(mb);
    }

    /// Create the shared objects once (store their IDs off-chain).
    public entry fun create_globals(ctx: &mut TxContext) {
        let by = tx_context::sender(ctx);
        let vr = VaultRegistry { id: object::new(ctx) };
        let mb = Mailbox { id: object::new(ctx) };
        let cr = CommandRegistry { id: object::new(ctx) };
        event::emit(GlobalsCreated {
            vault_registry_id: object::id(&vr),
            mailbox_id: object::id(&mb),
            command_registry_id: object::id(&cr),
            by,
        });
        transfer::share_object(vr);
        transfer::share_object(mb);
        transfer::share_object(cr);
    }

    /// Nur die Lock-Adresse selbst kann die Öffnen-Wörter für ihr lock_id setzen (oder ersetzen). words = kommagetrennt, z. B. b"open,öffnen,unlock".
    public entry fun set_open_words(registry: &mut CommandRegistry, lock_id: address, words: vector<u8>, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == lock_id, 1);
        let key = LockId { lock_id };
        if (dof::exists_<LockId>(&registry.id, key)) {
            let old = dof::remove<LockId, OpenWords>(&mut registry.id, key);
            let OpenWords { id, words: _ } = old;
            object::delete(id);
        };
        dof::add(&mut registry.id, key, OpenWords { id: object::new(ctx), words });
    }

    struct CommandRegistryCreated has copy, drop {
        command_registry_id: ID,
        by: address,
    }

    /// Für bestehende Deployments: erzeugt nur das CommandRegistry (falls create_globals vor dem Update ausgeführt wurde).
    public entry fun create_command_registry(ctx: &mut TxContext) {
        let by = tx_context::sender(ctx);
        let cr = CommandRegistry { id: object::new(ctx) };
        event::emit(CommandRegistryCreated {
            command_registry_id: object::id(&cr),
            by,
        });
        transfer::share_object(cr);
    }

    /// ----------------------------------------------------------------
    /// § H.33 — Einsatz-Manifest-Anker (Rollup-Referenz on-chain)
    /// ----------------------------------------------------------------
    const E_MANIFEST_NOT_AUTHORIZED: u64 = 80;
    const E_BAD_MANIFEST_HASH_LEN: u64 = 81;
    const E_BAD_MERKLE_ROOT_LEN: u64 = 82;
    const E_MANIFEST_SEQUENCE_EXISTS: u64 = 83;

    const SOURCE_NETWORK_TESTNET: u8 = 0;
    const SOURCE_NETWORK_MAINNET: u8 = 1;
    const MANIFEST_HASH_BYTES: u64 = 32;
    const MERKLE_ROOT_BYTES: u64 = 32;

    struct EinsatzManifestRegistry has key {
        id: UID,
        authorized_anchorer: address,
    }

    struct EinsatzManifestKey has copy, drop, store {
        einsatz_id: address,
        sequence: u64,
    }

    struct EinsatzManifestAnchor has key, store {
        id: UID,
        einsatz_id: address,
        sequence: u64,
        manifest_hash: vector<u8>,
        merkle_root: vector<u8>,
        source_network: u8,
        source_package_id: vector<u8>,
        period_start_ms: u64,
        period_end_ms: u64,
        message_count: u64,
        manifest_uri_hash: vector<u8>,
        anchored_by: address,
        anchored_at_ms: u64,
    }

    struct EinsatzManifestStored has copy, drop {
        registry_id: ID,
        einsatz_id: address,
        sequence: u64,
        manifest_hash: vector<u8>,
        merkle_root: vector<u8>,
        source_network: u8,
        message_count: u64,
        anchored_by: address,
        anchored_at_ms: u64,
    }

    struct EinsatzManifestRegistryCreated has copy, drop {
        registry_id: ID,
        authorized_anchorer: address,
    }

    public entry fun create_einsatz_manifest_registry(
        authorized_anchorer: address,
        ctx: &mut TxContext,
    ) {
        let reg = EinsatzManifestRegistry {
            id: object::new(ctx),
            authorized_anchorer,
        };
        let rid = object::id(&reg);
        event::emit(EinsatzManifestRegistryCreated {
            registry_id: rid,
            authorized_anchorer,
        });
        transfer::share_object(reg);
    }

    fun assert_manifest_bytes(hash: &vector<u8>, root: &vector<u8>) {
        assert!(vector::length(hash) == MANIFEST_HASH_BYTES, E_BAD_MANIFEST_HASH_LEN);
        assert!(vector::length(root) == MERKLE_ROOT_BYTES, E_BAD_MERKLE_ROOT_LEN);
    }

    public entry fun store_einsatz_manifest(
        registry: &mut EinsatzManifestRegistry,
        einsatz_id: address,
        sequence: u64,
        manifest_hash: vector<u8>,
        merkle_root: vector<u8>,
        source_network: u8,
        source_package_id: vector<u8>,
        period_start_ms: u64,
        period_end_ms: u64,
        message_count: u64,
        manifest_uri_hash: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == registry.authorized_anchorer, E_MANIFEST_NOT_AUTHORIZED);
        assert!(
            source_network == SOURCE_NETWORK_TESTNET || source_network == SOURCE_NETWORK_MAINNET,
            E_MANIFEST_NOT_AUTHORIZED,
        );
        assert_manifest_bytes(&manifest_hash, &merkle_root);

        let key = EinsatzManifestKey { einsatz_id, sequence };
        assert!(!dof::exists_<EinsatzManifestKey>(&registry.id, key), E_MANIFEST_SEQUENCE_EXISTS);

        let now = tx_context::epoch_timestamp_ms(ctx);
        let mh = manifest_hash;
        let mr = merkle_root;
        let anchor = EinsatzManifestAnchor {
            id: object::new(ctx),
            einsatz_id,
            sequence,
            manifest_hash: mh,
            merkle_root: mr,
            source_network,
            source_package_id,
            period_start_ms,
            period_end_ms,
            message_count,
            manifest_uri_hash,
            anchored_by: sender,
            anchored_at_ms: now,
        };

        dof::add(&mut registry.id, key, anchor);

        event::emit(EinsatzManifestStored {
            registry_id: object::id(registry),
            einsatz_id,
            sequence,
            manifest_hash: mh,
            merkle_root: mr,
            source_network,
            message_count,
            anchored_by: sender,
            anchored_at_ms: now,
        });
    }

    public entry fun set_manifest_authorized_anchorer(
        registry: &mut EinsatzManifestRegistry,
        new_anchorer: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == registry.authorized_anchorer, E_MANIFEST_NOT_AUTHORIZED);
        registry.authorized_anchorer = new_anchorer;
    }

    public fun manifest_exists(
        registry: &EinsatzManifestRegistry,
        einsatz_id: address,
        sequence: u64,
    ): bool {
        let key = EinsatzManifestKey { einsatz_id, sequence };
        dof::exists_<EinsatzManifestKey>(&registry.id, key)
    }

    /// ----------------------------------------------------------------
    /// Vault (stored under VaultRegistry as dynamic child object)
    /// ----------------------------------------------------------------
    const E_NOT_OWNER: u64 = 1;
    const E_VAULT_MISSING: u64 = 2;
    const E_PURGE_NOT_ALLOWED_YET: u64 = 3;

    struct VaultKey has copy, drop, store {
        owner: address,
    }

    struct Vault has key, store {
        id: UID,
        owner: address,
        encrypted_data: vector<u8>,
        purge_allowed: bool,
        auto_purge_after_ms: u64,
        created_at_ms: u64,
        updated_at_ms: u64,
    }

    struct VaultCreated has copy, drop {
        vault_id: ID,
        owner: address,
    }

    struct VaultUpdated has copy, drop {
        vault_id: ID,
        owner: address,
    }

    struct VaultPurged has copy, drop {
        vault_id: ID,
        owner: address,
        by: address,
        emergency: bool,
    }

    /// Erwartet 4 Argumente: registry, owner, encrypted_data, auto_purge_after_days (Backend sendet signingAddress als owner).
    public entry fun create_vault(
        registry: &mut VaultRegistry,
        owner: address,
        encrypted_data: vector<u8>,
        auto_purge_after_days: u64,
        ctx: &mut TxContext,
    ) {
        assert!(owner == tx_context::sender(ctx), E_NOT_OWNER);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let key = VaultKey { owner };

        // If an old vault exists, remove & delete it first (rotate / reset).
        if (dof::exists_<VaultKey>(&registry.id, key)) {
            let old = dof::remove<VaultKey, Vault>(&mut registry.id, key);
            let Vault {
                id,
                owner: _,
                encrypted_data: _,
                purge_allowed: _,
                auto_purge_after_ms: _,
                created_at_ms: _,
                updated_at_ms: _,
            } = old;
            object::delete(id);
        };

        let vault = Vault {
            id: object::new(ctx),
            owner,
            encrypted_data,
            purge_allowed: false,
            auto_purge_after_ms: now + auto_purge_after_days * 86400000,
            created_at_ms: now,
            updated_at_ms: now,
        };

        event::emit(VaultCreated { vault_id: object::id(&vault), owner });
        dof::add<VaultKey, Vault>(&mut registry.id, key, vault);
    }

    /// Erwartet 4 Argumente: registry, owner, encrypted_data, auto_purge_after_days.
    public entry fun update_vault(
        registry: &mut VaultRegistry,
        owner: address,
        encrypted_data: vector<u8>,
        auto_purge_after_days: u64,
        ctx: &mut TxContext,
    ) {
        assert!(owner == tx_context::sender(ctx), E_NOT_OWNER);
        let key = VaultKey { owner };
        assert!(dof::exists_<VaultKey>(&registry.id, key), E_VAULT_MISSING);
        let v = dof::borrow_mut<VaultKey, Vault>(&mut registry.id, key);
        assert!(v.owner == owner, E_NOT_OWNER);
        let now = tx_context::epoch_timestamp_ms(ctx);
        v.encrypted_data = encrypted_data;
        v.auto_purge_after_ms = now + auto_purge_after_days * 86400000;
        v.updated_at_ms = now;
        event::emit(VaultUpdated { vault_id: object::id(v), owner });
    }

    public entry fun enable_emergency_purge(registry: &mut VaultRegistry, ctx: &mut TxContext) {
        let owner = tx_context::sender(ctx);
        let key = VaultKey { owner };
        assert!(dof::exists_<VaultKey>(&registry.id, key), E_VAULT_MISSING);
        let v = dof::borrow_mut<VaultKey, Vault>(&mut registry.id, key);
        assert!(v.owner == owner, E_NOT_OWNER);
        v.purge_allowed = true;
        v.updated_at_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    /// Purge rules:
    /// - Owner can always purge if emergency is enabled.
    /// - Otherwise owner can purge only after auto_purge_after_ms.
    /// - Anyone else can purge only if emergency is enabled (kill-switch) AND after it has been enabled by owner.
    public entry fun purge_vault(registry: &mut VaultRegistry, owner: address, ctx: &mut TxContext) {
        let by = tx_context::sender(ctx);
        let key = VaultKey { owner };
        assert!(dof::exists_<VaultKey>(&registry.id, key), E_VAULT_MISSING);
        let vref = dof::borrow<VaultKey, Vault>(&registry.id, key);
        let emergency = vref.purge_allowed;
        let now = tx_context::epoch_timestamp_ms(ctx);

        if (!emergency) {
            assert!(by == owner, E_NOT_OWNER);
            assert!(now >= vref.auto_purge_after_ms, E_PURGE_NOT_ALLOWED_YET);
        } else {
            // emergency enabled: allow owner or anyone to purge
        };

        let v = dof::remove<VaultKey, Vault>(&mut registry.id, key);
        event::emit(VaultPurged { vault_id: object::id(&v), owner: v.owner, by, emergency });
        let Vault {
            id,
            owner: _,
            encrypted_data: _,
            purge_allowed: _,
            auto_purge_after_ms: _,
            created_at_ms: _,
            updated_at_ms: _,
        } = v;
        object::delete(id);
    }

    /// ----------------------------------------------------------------
    /// Purgeable handshake + messages (stored under shared Mailbox)
    /// ----------------------------------------------------------------
    const E_MSG_MISSING: u64 = 10;
    const E_HS_MISSING: u64 = 11;

    struct HsKey has copy, drop, store {
        recipient: address,
        sender: address,
    }

    struct MsgKey has copy, drop, store {
        recipient: address,
        sender: address,
        nonce: u64,
    }

    struct Handshake has key, store {
        id: UID,
        sender: address,
        recipient: address,
        pub_key: vector<u8>,
        nonce: u64,
        created_at_ms: u64,
        expires_at_ms: u64,
    }

    struct Message has key, store {
        id: UID,
        sender: address,
        recipient: address,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        nonce: u64,
        created_at_ms: u64,
        expires_at_ms: u64,
    }

    struct HandshakeStored has copy, drop {
        sender: address,
        recipient: address,
        nonce: u64,
        expires_at_ms: u64,
    }

    struct MessageStored has copy, drop {
        sender: address,
        recipient: address,
        nonce: u64,
        expires_at_ms: u64,
    }

    /// Klartext unter Mailbox (purgebar / Rebate) – eigener Key-Typ, kein Konflikt mit verschlüsselter Message.
    struct PlainMsgKey has copy, drop, store {
        recipient: address,
        sender: address,
        nonce: u64,
    }

    struct PlaintextMailboxEntry has key, store {
        id: UID,
        sender: address,
        recipient: address,
        text: vector<u8>,
        nonce: u64,
        created_at_ms: u64,
        expires_at_ms: u64,
    }

    struct PlaintextMailboxStored has copy, drop {
        sender: address,
        recipient: address,
        nonce: u64,
        expires_at_ms: u64,
    }

    /// Team-Broadcast: ein DF pro Nachricht, kein Empfänger im Key (Shared Team-Mailbox).
    struct TeamPlainBroadcastKey has copy, drop, store {
        sender: address,
        nonce: u64,
    }

    struct TeamPlainBroadcastEntry has key, store {
        id: UID,
        sender: address,
        text: vector<u8>,
        nonce: u64,
        created_at_ms: u64,
        expires_at_ms: u64,
    }

    struct TeamPlainBroadcastStored has copy, drop {
        mailbox_id: ID,
        sender: address,
        nonce: u64,
        expires_at_ms: u64,
    }

    /// Team-Broadcast verschlüsselt (§ H.23 B1): AEAD-Blob + key_epoch, Team-Key nur off-chain.
    struct TeamEncBroadcastKey has copy, drop, store {
        sender: address,
        nonce: u64,
    }

    struct TeamEncBroadcastEntry has key, store {
        id: UID,
        sender: address,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        key_epoch: u64,
        nonce: u64,
        created_at_ms: u64,
        expires_at_ms: u64,
    }

    struct TeamEncBroadcastStored has copy, drop {
        mailbox_id: ID,
        sender: address,
        nonce: u64,
        key_epoch: u64,
        expires_at_ms: u64,
    }

    fun store_ecdh_init_on_uid(
        mailbox_uid: &mut UID,
        recipient: address,
        pub_key: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let key = HsKey { recipient, sender };

        if (dof::exists_<HsKey>(mailbox_uid, key)) {
            let old = dof::remove<HsKey, Handshake>(mailbox_uid, key);
            let Handshake {
                id,
                sender: _,
                recipient: _,
                pub_key: _,
                nonce: _,
                created_at_ms: _,
                expires_at_ms: _,
            } = old;
            object::delete(id);
        };

        let hs = Handshake {
            id: object::new(ctx),
            sender,
            recipient,
            pub_key,
            nonce,
            created_at_ms: now,
            expires_at_ms: now + ttl_days * 86400000,
        };

        dof::add<HsKey, Handshake>(mailbox_uid, key, hs);
        event::emit(HandshakeStored { sender, recipient, nonce, expires_at_ms: now + ttl_days * 86400000 });
    }

    fun store_ecdh_init_impl(
        mailbox: &mut Mailbox,
        recipient: address,
        pub_key: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_ecdh_init_on_uid(&mut mailbox.id, recipient, pub_key, nonce, ttl_days, ctx);
    }

    public entry fun store_ecdh_init(
        mailbox: &mut Mailbox,
        recipient: address,
        pub_key: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_ecdh_init_impl(mailbox, recipient, pub_key, nonce, ttl_days, ctx);
    }

    fun purge_handshake_on_uid(
        mailbox_uid: &mut UID,
        recipient: address,
        sender: address,
        ctx: &mut TxContext,
    ) {
        let by = tx_context::sender(ctx);
        let key = HsKey { recipient, sender };
        assert!(dof::exists_<HsKey>(mailbox_uid, key), E_HS_MISSING);
        let hsref = dof::borrow<HsKey, Handshake>(mailbox_uid, key);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let allowed = by == hsref.sender || by == hsref.recipient || now >= hsref.expires_at_ms;
        assert!(allowed, E_NOT_OWNER);
        let hs = dof::remove<HsKey, Handshake>(mailbox_uid, key);
        let Handshake {
            id,
            sender: _,
            recipient: _,
            pub_key: _,
            nonce: _,
            created_at_ms: _,
            expires_at_ms: _,
        } = hs;
        object::delete(id);
    }

    /// Manual purge: sender or recipient can purge anytime.
    /// Auto purge: anyone can purge after expiry.
    public entry fun purge_handshake(mailbox: &mut Mailbox, recipient: address, sender: address, ctx: &mut TxContext) {
        purge_handshake_on_uid(&mut mailbox.id, recipient, sender, ctx);
    }

    fun store_encrypted_message_on_uid(
        mailbox_uid: &mut UID,
        recipient: address,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let key = MsgKey { recipient, sender, nonce };

        if (dof::exists_<MsgKey>(mailbox_uid, key)) {
            let old = dof::remove<MsgKey, Message>(mailbox_uid, key);
            let Message {
                id,
                sender: _,
                recipient: _,
                ciphertext: _,
                iv: _,
                tag: _,
                nonce: _,
                created_at_ms: _,
                expires_at_ms: _,
            } = old;
            object::delete(id);
        };

        let msg = Message {
            id: object::new(ctx),
            sender,
            recipient,
            ciphertext,
            iv,
            tag,
            nonce,
            created_at_ms: now,
            expires_at_ms: now + ttl_days * 86400000,
        };

        dof::add<MsgKey, Message>(mailbox_uid, key, msg);
        event::emit(MessageStored { sender, recipient, nonce, expires_at_ms: now + ttl_days * 86400000 });
    }

    fun store_encrypted_message_impl(
        mailbox: &mut Mailbox,
        recipient: address,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_encrypted_message_on_uid(
            &mut mailbox.id,
            recipient,
            ciphertext,
            iv,
            tag,
            nonce,
            ttl_days,
            ctx,
        );
    }

    public entry fun store_encrypted_message(
        mailbox: &mut Mailbox,
        recipient: address,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_encrypted_message_impl(mailbox, recipient, ciphertext, iv, tag, nonce, ttl_days, ctx);
    }

    /// ----------------------------------------------------------------
    /// Messenger prepaid credits (owned object; Boss mintet, Messenger hält & verbraucht bei Mailbox-Aktionen)
    /// ----------------------------------------------------------------
    const E_CREDITS_INSUFFICIENT: u64 = 40;
    const E_CREDITS_NOT_BOSS: u64 = 41;
    const E_CREDITS_BAD_BOUNDS: u64 = 42;

    struct MessengerCredits has key, store {
        id: UID,
        balance: u64,
        max_balance: u64,
        last_refill_at_ms: u64,
        refill_interval_ms: u64,
        refill_amount: u64,
        cost_ecdh_init: u64,
        cost_store_message: u64,
    }

    struct MessengerCreditsMinted has copy, drop {
        recipient: address,
        credits_id: ID,
    }

    fun apply_messenger_refill(credits: &mut MessengerCredits, now: u64) {
        if (credits.refill_interval_ms == 0u64 || credits.refill_amount == 0u64) {
            return
        };
        let elapsed = now - credits.last_refill_at_ms;
        if (elapsed < credits.refill_interval_ms) {
            return
        };
        let periods = elapsed / credits.refill_interval_ms;
        credits.last_refill_at_ms = credits.last_refill_at_ms + periods * credits.refill_interval_ms;
        if (credits.balance >= credits.max_balance) {
            return
        };
        let to_add = periods * credits.refill_amount;
        let new_bal = credits.balance + to_add;
        if (new_bal > credits.max_balance) {
            credits.balance = credits.max_balance;
        } else {
            credits.balance = new_bal;
        };
    }

    fun debit_messenger_credits(credits: &mut MessengerCredits, now: u64, cost: u64) {
        apply_messenger_refill(credits, now);
        if (cost == 0u64) {
            return
        };
        assert!(credits.balance >= cost, E_CREDITS_INSUFFICIENT);
        credits.balance = credits.balance - cost;
    }

    fun mint_one_messenger_credits(
        recipient: address,
        initial_balance: u64,
        max_balance: u64,
        refill_interval_ms: u64,
        refill_amount: u64,
        cost_ecdh_init: u64,
        cost_store_message: u64,
        ctx: &mut TxContext,
    ) {
        let now = tx_context::epoch_timestamp_ms(ctx);
        let mc = MessengerCredits {
            id: object::new(ctx),
            balance: initial_balance,
            max_balance,
            last_refill_at_ms: now,
            refill_interval_ms,
            refill_amount,
            cost_ecdh_init,
            cost_store_message,
        };
        let credits_id = object::id(&mc);
        event::emit(MessengerCreditsMinted { recipient, credits_id });
        transfer::transfer(mc, recipient);
    }

    /// Nur Boss-Adresse (sender == boss): mintet ein Credits-Objekt für recipient.
    public entry fun mint_messenger_credits(
        boss: address,
        recipient: address,
        initial_balance: u64,
        max_balance: u64,
        refill_interval_ms: u64,
        refill_amount: u64,
        cost_ecdh_init: u64,
        cost_store_message: u64,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == boss, E_CREDITS_NOT_BOSS);
        assert!(initial_balance <= max_balance, E_CREDITS_BAD_BOUNDS);
        mint_one_messenger_credits(
            recipient,
            initial_balance,
            max_balance,
            refill_interval_ms,
            refill_amount,
            cost_ecdh_init,
            cost_store_message,
            ctx,
        );
    }

    fun mint_messenger_credits_batch_inner(
        recipients: &vector<address>,
        i: u64,
        initial_balance: u64,
        max_balance: u64,
        refill_interval_ms: u64,
        refill_amount: u64,
        cost_ecdh_init: u64,
        cost_store_message: u64,
        ctx: &mut TxContext,
    ) {
        let len = vector::length(recipients);
        if (i >= len) {
            return
        };
        let recipient = *vector::borrow(recipients, i);
        mint_one_messenger_credits(
            recipient,
            initial_balance,
            max_balance,
            refill_interval_ms,
            refill_amount,
            cost_ecdh_init,
            cost_store_message,
            ctx,
        );
        mint_messenger_credits_batch_inner(
            recipients,
            i + 1,
            initial_balance,
            max_balance,
            refill_interval_ms,
            refill_amount,
            cost_ecdh_init,
            cost_store_message,
            ctx,
        );
    }

    /// Batch-Mint (eine TX): gleiche Parameter für alle Empfänger; sender muss boss sein.
    public entry fun mint_messenger_credits_batch(
        boss: address,
        recipients: vector<address>,
        initial_balance: u64,
        max_balance: u64,
        refill_interval_ms: u64,
        refill_amount: u64,
        cost_ecdh_init: u64,
        cost_store_message: u64,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == boss, E_CREDITS_NOT_BOSS);
        assert!(initial_balance <= max_balance, E_CREDITS_BAD_BOUNDS);
        mint_messenger_credits_batch_inner(
            &recipients,
            0,
            initial_balance,
            max_balance,
            refill_interval_ms,
            refill_amount,
            cost_ecdh_init,
            cost_store_message,
            ctx,
        );
    }

    public entry fun store_ecdh_init_with_credits(
        mailbox: &mut Mailbox,
        credits: &mut MessengerCredits,
        recipient: address,
        pub_key: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        let now = tx_context::epoch_timestamp_ms(ctx);
        let cost = credits.cost_ecdh_init;
        debit_messenger_credits(credits, now, cost);
        store_ecdh_init_impl(mailbox, recipient, pub_key, nonce, ttl_days, ctx);
    }

    public entry fun store_encrypted_message_with_credits(
        mailbox: &mut Mailbox,
        credits: &mut MessengerCredits,
        recipient: address,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        let now = tx_context::epoch_timestamp_ms(ctx);
        let cost = credits.cost_store_message;
        debit_messenger_credits(credits, now, cost);
        store_encrypted_message_impl(mailbox, recipient, ciphertext, iv, tag, nonce, ttl_days, ctx);
    }

    fun store_plaintext_mailbox_emit(
        recipient: address,
        text: vector<u8>,
        nonce: u64,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        event::emit(PlaintextMessage { sender, recipient, text, nonce });
    }

    fun store_plaintext_to_mailbox_stored_on_uid(
        mailbox_uid: &mut UID,
        recipient: address,
        text: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let exp = now + ttl_days * 86400000;
        let key = PlainMsgKey { recipient, sender, nonce };
        if (dof::exists_<PlainMsgKey>(mailbox_uid, key)) {
            let old = dof::remove<PlainMsgKey, PlaintextMailboxEntry>(mailbox_uid, key);
            let PlaintextMailboxEntry {
                id,
                sender: _,
                recipient: _,
                text: _,
                nonce: _,
                created_at_ms: _,
                expires_at_ms: _,
            } = old;
            object::delete(id);
        };
        let entry = PlaintextMailboxEntry {
            id: object::new(ctx),
            sender,
            recipient,
            text,
            nonce,
            created_at_ms: now,
            expires_at_ms: exp,
        };
        event::emit(PlaintextMailboxStored { sender, recipient, nonce, expires_at_ms: exp });
        dof::add<PlainMsgKey, PlaintextMailboxEntry>(mailbox_uid, key, entry);
    }

    fun store_plaintext_to_mailbox_stored_impl(
        mailbox: &mut Mailbox,
        recipient: address,
        text: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_plaintext_to_mailbox_stored_on_uid(&mut mailbox.id, recipient, text, nonce, ttl_days, ctx);
    }

    /// Klartext in Mailbox speichern (purgebar) + PlaintextMessage-Event (Kompatibilität mit Fetch/UI).
    public entry fun store_plaintext_message_stored(
        mailbox: &mut Mailbox,
        recipient: address,
        text: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_plaintext_to_mailbox_stored_impl(mailbox, recipient, text, nonce, ttl_days, ctx);
        store_plaintext_mailbox_emit(recipient, text, nonce, ctx);
    }

    fun store_team_plaintext_broadcast_on_uid(
        mailbox_uid: &mut UID,
        text: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let exp = now + ttl_days * 86400000;
        let key = TeamPlainBroadcastKey { sender, nonce };
        if (dof::exists_<TeamPlainBroadcastKey>(mailbox_uid, key)) {
            let old = dof::remove<TeamPlainBroadcastKey, TeamPlainBroadcastEntry>(mailbox_uid, key);
            let TeamPlainBroadcastEntry {
                id,
                sender: _,
                text: _,
                nonce: _,
                created_at_ms: _,
                expires_at_ms: _,
            } = old;
            object::delete(id);
        };
        let entry = TeamPlainBroadcastEntry {
            id: object::new(ctx),
            sender,
            text,
            nonce,
            created_at_ms: now,
            expires_at_ms: exp,
        };
        let mailbox_id = object::uid_to_inner(mailbox_uid);
        event::emit(TeamPlainBroadcastStored { mailbox_id, sender, nonce, expires_at_ms: exp });
        dof::add<TeamPlainBroadcastKey, TeamPlainBroadcastEntry>(mailbox_uid, key, entry);
    }

    fun store_team_plaintext_broadcast_impl(
        mailbox: &mut Mailbox,
        text: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_team_plaintext_broadcast_on_uid(&mut mailbox.id, text, nonce, ttl_days, ctx);
    }

    /// Klartext Team-Broadcast: 1× TX pro Gruppennachricht (Shared Team-Mailbox, kein recipient im Key).
    public entry fun store_team_plaintext_broadcast(
        mailbox: &mut Mailbox,
        text: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_team_plaintext_broadcast_impl(mailbox, text, nonce, ttl_days, ctx);
    }

    const E_TEAM_BROADCAST_MISSING: u64 = 44;

    fun purge_team_plaintext_broadcast_on_uid(
        mailbox_uid: &mut UID,
        broadcast_sender: address,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        let by = tx_context::sender(ctx);
        let key = TeamPlainBroadcastKey { sender: broadcast_sender, nonce };
        assert!(dof::exists_<TeamPlainBroadcastKey>(mailbox_uid, key), E_TEAM_BROADCAST_MISSING);
        let pref = dof::borrow<TeamPlainBroadcastKey, TeamPlainBroadcastEntry>(mailbox_uid, key);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let allowed = by == pref.sender || now >= pref.expires_at_ms;
        assert!(allowed, E_NOT_OWNER);
        let p = dof::remove<TeamPlainBroadcastKey, TeamPlainBroadcastEntry>(mailbox_uid, key);
        let TeamPlainBroadcastEntry {
            id,
            sender: _,
            text: _,
            nonce: _,
            created_at_ms: _,
            expires_at_ms: _,
        } = p;
        object::delete(id);
    }

    /// Purge Team-Broadcast (Rebate): Original-Sender jederzeit; nach TTL jeder.
    public entry fun purge_team_plaintext_broadcast(
        mailbox: &mut Mailbox,
        broadcast_sender: address,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        purge_team_plaintext_broadcast_on_uid(&mut mailbox.id, broadcast_sender, nonce, ctx);
    }

    fun store_team_encrypted_broadcast_on_uid(
        mailbox_uid: &mut UID,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        key_epoch: u64,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let exp = now + ttl_days * 86400000;
        let key = TeamEncBroadcastKey { sender, nonce };
        if (dof::exists_<TeamEncBroadcastKey>(mailbox_uid, key)) {
            let old = dof::remove<TeamEncBroadcastKey, TeamEncBroadcastEntry>(mailbox_uid, key);
            let TeamEncBroadcastEntry {
                id,
                sender: _,
                ciphertext: _,
                iv: _,
                tag: _,
                key_epoch: _,
                nonce: _,
                created_at_ms: _,
                expires_at_ms: _,
            } = old;
            object::delete(id);
        };
        let entry = TeamEncBroadcastEntry {
            id: object::new(ctx),
            sender,
            ciphertext,
            iv,
            tag,
            key_epoch,
            nonce,
            created_at_ms: now,
            expires_at_ms: exp,
        };
        let mailbox_id = object::uid_to_inner(mailbox_uid);
        event::emit(TeamEncBroadcastStored { mailbox_id, sender, nonce, key_epoch, expires_at_ms: exp });
        dof::add<TeamEncBroadcastKey, TeamEncBroadcastEntry>(mailbox_uid, key, entry);
    }

    fun store_team_encrypted_broadcast_impl(
        mailbox: &mut Mailbox,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        key_epoch: u64,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_team_encrypted_broadcast_on_uid(
            &mut mailbox.id,
            ciphertext,
            iv,
            tag,
            key_epoch,
            nonce,
            ttl_days,
            ctx,
        );
    }

    /// Verschlüsselter Team-Broadcast: 1× TX pro Gruppennachricht (symmetrischer Team-Key off-chain).
    public entry fun store_team_encrypted_broadcast(
        mailbox: &mut Mailbox,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        key_epoch: u64,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_team_encrypted_broadcast_impl(mailbox, ciphertext, iv, tag, key_epoch, nonce, ttl_days, ctx);
    }

    fun purge_team_encrypted_broadcast_on_uid(
        mailbox_uid: &mut UID,
        broadcast_sender: address,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        let by = tx_context::sender(ctx);
        let key = TeamEncBroadcastKey { sender: broadcast_sender, nonce };
        assert!(dof::exists_<TeamEncBroadcastKey>(mailbox_uid, key), E_TEAM_BROADCAST_MISSING);
        let pref = dof::borrow<TeamEncBroadcastKey, TeamEncBroadcastEntry>(mailbox_uid, key);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let allowed = by == pref.sender || now >= pref.expires_at_ms;
        assert!(allowed, E_NOT_OWNER);
        let p = dof::remove<TeamEncBroadcastKey, TeamEncBroadcastEntry>(mailbox_uid, key);
        let TeamEncBroadcastEntry {
            id,
            sender: _,
            ciphertext: _,
            iv: _,
            tag: _,
            key_epoch: _,
            nonce: _,
            created_at_ms: _,
            expires_at_ms: _,
        } = p;
        object::delete(id);
    }

    /// Purge verschlüsselter Team-Broadcast (Rebate): Original-Sender jederzeit; nach TTL jeder.
    public entry fun purge_team_encrypted_broadcast(
        mailbox: &mut Mailbox,
        broadcast_sender: address,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        purge_team_encrypted_broadcast_on_uid(&mut mailbox.id, broadcast_sender, nonce, ctx);
    }

    public entry fun store_plaintext_message_with_credits(
        _mailbox: &mut Mailbox,
        credits: &mut MessengerCredits,
        recipient: address,
        text: vector<u8>,
        nonce: u64,
        _ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        let now = tx_context::epoch_timestamp_ms(ctx);
        let cost = credits.cost_store_message;
        debit_messenger_credits(credits, now, cost);
        store_plaintext_mailbox_emit(recipient, text, nonce, ctx);
    }

    public entry fun store_plaintext_message_with_credits_stored(
        mailbox: &mut Mailbox,
        credits: &mut MessengerCredits,
        recipient: address,
        text: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        let now = tx_context::epoch_timestamp_ms(ctx);
        let cost = credits.cost_store_message;
        debit_messenger_credits(credits, now, cost);
        store_plaintext_to_mailbox_stored_impl(mailbox, recipient, text, nonce, ttl_days, ctx);
        store_plaintext_mailbox_emit(recipient, text, nonce, ctx);
    }

    /// Optional: Klartext-Event emittieren (nur Event, keine Speicherung – für Test/Demo, Explorer zeigt Klartext).
    public entry fun store_plaintext_message(
        _mailbox: &mut Mailbox,
        recipient: address,
        text: vector<u8>,
        nonce: u64,
        _ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        store_plaintext_mailbox_emit(recipient, text, nonce, ctx);
    }

    fun purge_message_on_uid(
        mailbox_uid: &mut UID,
        recipient: address,
        sender: address,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        let by = tx_context::sender(ctx);
        let key = MsgKey { recipient, sender, nonce };
        assert!(dof::exists_<MsgKey>(mailbox_uid, key), E_MSG_MISSING);
        let mref = dof::borrow<MsgKey, Message>(mailbox_uid, key);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let allowed = by == mref.sender || by == mref.recipient || now >= mref.expires_at_ms;
        assert!(allowed, E_NOT_OWNER);
        let m = dof::remove<MsgKey, Message>(mailbox_uid, key);
        let Message {
            id,
            sender: _,
            recipient: _,
            ciphertext: _,
            iv: _,
            tag: _,
            nonce: _,
            created_at_ms: _,
            expires_at_ms: _,
        } = m;
        object::delete(id);
    }

    /// Manual purge: sender or recipient can purge anytime.
    /// Auto purge: anyone can purge after expiry.
    public entry fun purge_message(
        mailbox: &mut Mailbox,
        recipient: address,
        sender: address,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        purge_message_on_uid(&mut mailbox.id, recipient, sender, nonce, ctx);
    }

    const E_PLAIN_MSG_MISSING: u64 = 43;

    fun purge_plaintext_mail_entry_on_uid(
        mailbox_uid: &mut UID,
        recipient: address,
        sender: address,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        let by = tx_context::sender(ctx);
        let key = PlainMsgKey { recipient, sender, nonce };
        assert!(dof::exists_<PlainMsgKey>(mailbox_uid, key), E_PLAIN_MSG_MISSING);
        let pref = dof::borrow<PlainMsgKey, PlaintextMailboxEntry>(mailbox_uid, key);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let allowed = by == pref.sender || by == pref.recipient || now >= pref.expires_at_ms;
        assert!(allowed, E_NOT_OWNER);
        let p = dof::remove<PlainMsgKey, PlaintextMailboxEntry>(mailbox_uid, key);
        let PlaintextMailboxEntry {
            id,
            sender: _,
            recipient: _,
            text: _,
            nonce: _,
            created_at_ms: _,
            expires_at_ms: _,
        } = p;
        object::delete(id);
    }

    /// Purge gespeicherten Klartext (gleiche Rechte wie purge_message).
    public entry fun purge_plaintext_mail_entry(
        mailbox: &mut Mailbox,
        recipient: address,
        sender: address,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        purge_plaintext_mail_entry_on_uid(&mut mailbox.id, recipient, sender, nonce, ctx);
    }

    /// ----------------------------------------------------------------
    /// M2M: AccessKey = Zutritts-Berechtigung für GÄSTE (Airbnb, Spind, Tür).
    /// Kein "Dauer-Abo" oder Geräte-Infrastruktur: Owner = Gast (recipient);
    /// nach Checkout purgen. Geräte-Identität = Adresse + Streams/Heartbeat, kein Key.
    /// ----------------------------------------------------------------
    const E_KEY_NOT_PURGEABLE: u64 = 21;

    struct AccessKey has key, store {
        id: UID,
        lock_id: address,       // Adresse des Schlosses (Tür / Gerät)
        issuer: address,       // Wer den Schlüssel ausgestellt hat
        expires_at_ms: u64,
        purge_allowed: bool,
        created_at_ms: u64,
    }

    struct AccessKeyCreated has copy, drop {
        key_id: ID,
        lock_id: address,
        issuer: address,
        recipient: address,
        expires_at_ms: u64,
    }

    struct AccessKeyPurged has copy, drop {
        key_id: ID,
        lock_id: address,
        by: address,
        emergency: bool,
    }

    /// LOGIK: Erzeugt AccessKey-Objekt. Owner wird der Gast (recipient). Säule 3 erzeugt, Säule 4 kann rebaten (purge_key).
    /// Schlüssel ausstellen und an recipient übertragen (Issuer = sender).
    public entry fun create_access_key(
        lock_id: address,
        recipient: address,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        let issuer = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let key = AccessKey {
            id: object::new(ctx),
            lock_id,
            issuer,
            expires_at_ms: now + ttl_days * 86400000,
            purge_allowed: false,
            created_at_ms: now,
        };
        event::emit(AccessKeyCreated {
            key_id: object::id(&key),
            lock_id,
            issuer,
            recipient,
            expires_at_ms: key.expires_at_ms,
        });
        transfer::transfer(key, recipient);
    }

    /// Notfall-Kill-Switch: Besitzer aktiviert sofortige Purge-Möglichkeit.
    public entry fun enable_emergency_purge_key(key: &mut AccessKey, _ctx: &mut TxContext) {
        // Nur Besitzer (Holder des Objekts) kann das – wird durch Objekt-Zugriff erzwungen
        key.purge_allowed = true;
    }

    /// Schlüssel an neue Adresse übertragen (Weitergabe). Nur Besitzer kann das (Objekt-Zugriff).
    public entry fun transfer_access_key(key: AccessKey, new_owner: address, _ctx: &mut TxContext) {
        transfer::transfer(key, new_owner);
    }

    /// LOGIK: Löscht AccessKey → Storage Rebate an den Signer (wer die TX signiert). Nur wer das Objekt besitzt, kann es übergeben (Owner = Gast nach transfer). Issuer darf laut Regel nach Ablauf, hat aber das Objekt nicht mehr.
    public entry fun purge_key(key: AccessKey, ctx: &mut TxContext) {
        let by = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let emergency = key.purge_allowed;
        let allowed = emergency
            || now >= key.expires_at_ms
            || by == key.issuer;
        assert!(allowed, E_KEY_NOT_PURGEABLE);
        event::emit(AccessKeyPurged {
            key_id: object::id(&key),
            lock_id: key.lock_id,
            by,
            emergency,
        });
        let AccessKey { id, lock_id: _, issuer: _, expires_at_ms: _, purge_allowed: _, created_at_ms: _ } = key;
        object::delete(id);
    }

    /// ----------------------------------------------------------------
    /// Tickets (purgebare, zeitgebundene NFTs für Einlass/Veranstaltung)
    /// Issuer = Veranstalter/Gate; event_id = Tür/Event; used = nach Einlass true.
    /// ----------------------------------------------------------------
    const E_TICKET_WRONG_EVENT: u64 = 30;
    const E_TICKET_NOT_VALID_YET: u64 = 31;
    const E_TICKET_EXPIRED: u64 = 32;
    const E_TICKET_ALREADY_USED: u64 = 33;
    const E_TICKET_NOT_PURGEABLE: u64 = 34;
    const E_TICKET_NOT_RECIPIENT: u64 = 35;

    struct Ticket has key, store {
        id: UID,
        event_id: address,       // Gate/Veranstaltung (z. B. Tür-Adresse)
        issuer: address,         // Wer das Ticket ausgestellt hat (Veranstalter)
        recipient: address,      // Empfänger (bei Registry: wer use_ticket_from_registry aufrufen darf)
        valid_from_ms: u64,
        valid_until_ms: u64,
        used: bool,
        purge_allowed: bool,
        created_at_ms: u64,
        metadata: vector<u8>,    // z. B. Sitzplatz, Kategorie (optional)
    }

    struct TicketCreated has copy, drop {
        ticket_id: ID,
        event_id: address,
        issuer: address,
        recipient: address,
        valid_from_ms: u64,
        valid_until_ms: u64,
    }

    struct TicketUsed has copy, drop {
        ticket_id: ID,
        event_id: address,
        by: address,
        /// Physisches Gerät (z. B. Tiny/ESP32), wenn Gateway als Bürge signiert. Leer = normaler Sender.
        device_origin_id: vector<u8>,
    }

    struct TicketPurged has copy, drop {
        ticket_id: ID,
        event_id: address,
        by: address,
        reason: u8, // 0 = owner refund (!used), 1 = issuer recall, 2 = expired (anyone), 3 = emergency
    }

    /// LOGIK: Erzeugt Ticket-NFT. Owner = recipient. Säule 3 erzeugt; Säule 4 rebatet mit purge_ticket.
    /// Ticket ausstellen und an recipient übertragen (Issuer = sender).
    public entry fun create_ticket(
        event_id: address,
        valid_from_ms: u64,
        valid_until_ms: u64,
        metadata: vector<u8>,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let issuer = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let t = Ticket {
            id: object::new(ctx),
            event_id,
            issuer,
            recipient,
            valid_from_ms,
            valid_until_ms,
            used: false,
            purge_allowed: false,
            created_at_ms: now,
            metadata,
        };
        event::emit(TicketCreated {
            ticket_id: object::id(&t),
            event_id,
            issuer,
            recipient,
            valid_from_ms,
            valid_until_ms,
        });
        transfer::transfer(t, recipient);
    }

    /// Einlass: Besitzer präsentiert Ticket (nur Owner kann Objekt übergeben). Ticket wird verbraucht (Burn-on-Use):
    /// Objekt wird gelöscht, Storage-Rebate geht an den Sender der TX (z. B. Gast am Gate).
    public entry fun use_ticket(ticket: Ticket, event_id: address, ctx: &mut TxContext) {
        assert!(ticket.event_id == event_id, E_TICKET_WRONG_EVENT);
        let now = tx_context::epoch_timestamp_ms(ctx);
        assert!(now >= ticket.valid_from_ms, E_TICKET_NOT_VALID_YET);
        assert!(now <= ticket.valid_until_ms, E_TICKET_EXPIRED);
        assert!(!ticket.used, E_TICKET_ALREADY_USED);
        let ticket_id = object::id(&ticket);
        event::emit(TicketUsed {
            ticket_id,
            event_id,
            by: tx_context::sender(ctx),
            device_origin_id: vector::empty(),
        });
        let Ticket { id: uid, event_id: _, issuer: _, recipient: _, valid_from_ms: _, valid_until_ms: _, used: _, purge_allowed: _, created_at_ms: _, metadata: _ } = ticket;
        object::delete(uid);
    }

    /// Wie use_ticket, aber mit device_origin_id (Tiny/Gateway: Gateway signiert, Herkunftsgerät wird on-chain festgehalten).
    public entry fun use_ticket_with_origin(ticket: Ticket, event_id: address, device_origin_id: vector<u8>, ctx: &mut TxContext) {
        assert!(ticket.event_id == event_id, E_TICKET_WRONG_EVENT);
        let now = tx_context::epoch_timestamp_ms(ctx);
        assert!(now >= ticket.valid_from_ms, E_TICKET_NOT_VALID_YET);
        assert!(now <= ticket.valid_until_ms, E_TICKET_EXPIRED);
        assert!(!ticket.used, E_TICKET_ALREADY_USED);
        let ticket_id = object::id(&ticket);
        event::emit(TicketUsed {
            ticket_id,
            event_id,
            by: tx_context::sender(ctx),
            device_origin_id,
        });
        let Ticket { id: uid, event_id: _, issuer: _, recipient: _, valid_from_ms: _, valid_until_ms: _, used: _, purge_allowed: _, created_at_ms: _, metadata: _ } = ticket;
        object::delete(uid);
    }

    /// Notfall: Besitzer aktiviert sofortige Purge-Möglichkeit (z. B. Rückgabe).
    public entry fun enable_emergency_purge_ticket(ticket: &mut Ticket, _ctx: &mut TxContext) {
        // Nur Besitzer kann das (Objekt-Zugriff)
        ticket.purge_allowed = true;
    }

    /// Ticket an neue Adresse übertragen (Weitergabe, Weiterverkauf). Nur Besitzer kann das (Objekt-Zugriff).
    public entry fun transfer_ticket(ticket: Ticket, new_owner: address, _ctx: &mut TxContext) {
        transfer::transfer(ticket, new_owner);
    }

    /// Ticket löschen: Nur Owner kann Objekt übergeben. Erlaubt bei !used (Refund), purge_allowed (Emergency) oder nach Ablauf (Rebate).
    /// Issuer-Rückruf: würde Registry + revoke_ticket(registry, ticket_id) erfordern (optional später).
    public entry fun purge_ticket(ticket: Ticket, ctx: &mut TxContext) {
        let by = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let id = object::id(&ticket);
        let event_id = ticket.event_id;
        let allowed = !ticket.used || ticket.purge_allowed || now > ticket.valid_until_ms;
        assert!(allowed, E_TICKET_NOT_PURGEABLE);
        let reason = if (now > ticket.valid_until_ms) { 2u8 } else if (ticket.purge_allowed) { 3u8 } else { 0u8 };
        event::emit(TicketPurged { ticket_id: id, event_id, by, reason });
        let Ticket { id: uid, event_id: _, issuer: _, recipient: _, valid_from_ms: _, valid_until_ms: _, used: _, purge_allowed: _, created_at_ms: _, metadata: _ } = ticket;
        object::delete(uid);
    }

    /// ----------------------------------------------------------------
    /// Weg 1: Boss-Batch – abgelaufene Tickets in einer Registry löschen (Rebate an Boss).
    /// Registry ist ein vom Boss (Veranstalter) owned Objekt; Tickets werden dort abgelegt.
    /// ----------------------------------------------------------------
    struct EventTicketRegistry has key {
        id: UID,
        event_id: address,
        tickets: Table<ID, Ticket>,
        ticket_ids: vector<ID>,
    }

    /// Boss erstellt eine Registry für ein Event (einmalig). Boss = Owner der Registry.
    public entry fun create_event_registry(event_id: address, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let registry = EventTicketRegistry {
            id: object::new(ctx),
            event_id,
            tickets: table::new(ctx),
            ticket_ids: vector::empty(),
        };
        transfer::transfer(registry, sender);
    }

    /// Boss legt ein Ticket in der Registry ab (recipient = wer es am Gate einlösen darf). Rebate bei Purge geht an Boss.
    public entry fun create_ticket_to_registry(
        registry: &mut EventTicketRegistry,
        event_id: address,
        valid_from_ms: u64,
        valid_until_ms: u64,
        metadata: vector<u8>,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(registry.event_id == event_id, E_TICKET_WRONG_EVENT);
        let issuer = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let t = Ticket {
            id: object::new(ctx),
            event_id,
            issuer,
            recipient,
            valid_from_ms,
            valid_until_ms,
            used: false,
            purge_allowed: false,
            created_at_ms: now,
            metadata,
        };
        let ticket_id = object::id(&t);
        event::emit(TicketCreated {
            ticket_id,
            event_id,
            issuer,
            recipient,
            valid_from_ms,
            valid_until_ms,
        });
        table::add(&mut registry.tickets, ticket_id, t);
        vector::push_back(&mut registry.ticket_ids, ticket_id);
    }

    /// Gast löst Ticket aus der Registry ein (nur recipient). Burn-on-Use: Rebate an Sender (Gast).
    public entry fun use_ticket_from_registry(
        registry: &mut EventTicketRegistry,
        ticket_id: ID,
        event_id: address,
        ctx: &mut TxContext,
    ) {
        assert!(registry.event_id == event_id, E_TICKET_WRONG_EVENT);
        assert!(table::contains(&registry.tickets, ticket_id), E_TICKET_NOT_PURGEABLE);
        let sender = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let ticket = table::borrow(&registry.tickets, ticket_id);
        assert!(ticket.event_id == event_id, E_TICKET_WRONG_EVENT);
        assert!(now >= ticket.valid_from_ms, E_TICKET_NOT_VALID_YET);
        assert!(now <= ticket.valid_until_ms, E_TICKET_EXPIRED);
        assert!(!ticket.used, E_TICKET_ALREADY_USED);
        assert!(ticket.recipient == sender, E_TICKET_NOT_RECIPIENT);
        let ticket = table::remove(&mut registry.tickets, ticket_id);
        event::emit(TicketUsed { ticket_id, event_id, by: sender, device_origin_id: vector::empty() });
        let Ticket { id: uid, event_id: _, issuer: _, recipient: _, valid_from_ms: _, valid_until_ms: _, used: _, purge_allowed: _, created_at_ms: _, metadata: _ } = ticket;
        object::delete(uid);
    }

    /// Boss löscht alle abgelaufenen Tickets in der Registry. Rebate fließt an Boss (Sender der TX).
    public entry fun purge_expired_tickets(registry: &mut EventTicketRegistry, ctx: &mut TxContext) {
        let now = tx_context::epoch_timestamp_ms(ctx);
        purge_expired_tickets_loop(registry, now, tx_context::sender(ctx), 0u64);
    }

    fun purge_expired_tickets_loop(registry: &mut EventTicketRegistry, now: u64, by: address, i: u64) {
        if (i >= vector::length(&registry.ticket_ids)) return;
        let id = *vector::borrow(&registry.ticket_ids, i);
        if (table::contains(&registry.tickets, id)) {
            let ticket = table::borrow(&registry.tickets, id);
            if (now > ticket.valid_until_ms) {
                let ticket = table::remove(&mut registry.tickets, id);
                let ticket_id = object::id(&ticket);
                event::emit(TicketPurged { ticket_id, event_id: ticket.event_id, by, reason: 2u8 });
                let Ticket { id: uid, event_id: _, issuer: _, recipient: _, valid_from_ms: _, valid_until_ms: _, used: _, purge_allowed: _, created_at_ms: _, metadata: _ } = ticket;
                object::delete(uid);
                vector::remove(&mut registry.ticket_ids, i);
                purge_expired_tickets_loop(registry, now, by, i);
            } else {
                purge_expired_tickets_loop(registry, now, by, i + 1);
            }
        } else {
            purge_expired_tickets_loop(registry, now, by, i + 1);
        }
    }

    /// ----------------------------------------------------------------
    /// PrivateMailbox (M4d) – pro Nutzer, shared für eingehende Nachrichten an `owner`
    /// ----------------------------------------------------------------
    const E_PRIVATE_MB_RECIPIENT: u64 = 44;

    struct PrivateMailbox has key {
        id: UID,
        owner: address,
    }

    struct PrivateMailboxCreated has copy, drop {
        mailbox_id: ID,
        owner: address,
    }

    struct PrivateMailboxPurged has copy, drop {
        mailbox_id: ID,
        owner: address,
    }

    /// Erzeugt eine private Mailbox (shared). Object-ID in Profil-QR / Telefonbuch (M4b).
    public entry fun create_private_mailbox(ctx: &mut TxContext) {
        let owner = tx_context::sender(ctx);
        let mb = PrivateMailbox {
            id: object::new(ctx),
            owner,
        };
        event::emit(PrivateMailboxCreated {
            mailbox_id: object::id(&mb),
            owner,
        });
        transfer::share_object(mb);
    }

    /// Owner löscht leere PrivateMailbox (Storage-Rebate). Shared-Objekt per PTB (mutable) übergeben.
    /// Bei Dynamic Fields zuerst Einträge in der Mailbox purgen.
    public entry fun purge_private_mailbox(mailbox: PrivateMailbox, ctx: &mut TxContext) {
        let owner = tx_context::sender(ctx);
        assert!(owner == mailbox.owner, E_NOT_OWNER);
        let mailbox_id = object::id(&mailbox);
        event::emit(PrivateMailboxPurged { mailbox_id, owner });
        let PrivateMailbox { id, owner: _ } = mailbox;
        object::delete(id);
    }

    fun assert_private_mb_recipient(mailbox: &PrivateMailbox, recipient: address) {
        assert!(recipient == mailbox.owner, E_PRIVATE_MB_RECIPIENT);
    }

    public entry fun store_ecdh_init_private(
        mailbox: &mut PrivateMailbox,
        recipient: address,
        pub_key: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        assert_private_mb_recipient(mailbox, recipient);
        store_ecdh_init_on_uid(&mut mailbox.id, recipient, pub_key, nonce, ttl_days, ctx);
    }

    public entry fun store_encrypted_message_private(
        mailbox: &mut PrivateMailbox,
        recipient: address,
        ciphertext: vector<u8>,
        iv: vector<u8>,
        tag: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        assert_private_mb_recipient(mailbox, recipient);
        store_encrypted_message_on_uid(
            &mut mailbox.id,
            recipient,
            ciphertext,
            iv,
            tag,
            nonce,
            ttl_days,
            ctx,
        );
    }

    public entry fun store_plaintext_message_stored_private(
        mailbox: &mut PrivateMailbox,
        recipient: address,
        text: vector<u8>,
        nonce: u64,
        ttl_days: u64,
        ctx: &mut TxContext,
    ) {
        assert_private_mb_recipient(mailbox, recipient);
        store_plaintext_to_mailbox_stored_on_uid(&mut mailbox.id, recipient, text, nonce, ttl_days, ctx);
        store_plaintext_mailbox_emit(recipient, text, nonce, ctx);
    }

    public entry fun purge_handshake_private(
        mailbox: &mut PrivateMailbox,
        recipient: address,
        sender: address,
        ctx: &mut TxContext,
    ) {
        purge_handshake_on_uid(&mut mailbox.id, recipient, sender, ctx);
    }

    public entry fun purge_message_private(
        mailbox: &mut PrivateMailbox,
        recipient: address,
        sender: address,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        purge_message_on_uid(&mut mailbox.id, recipient, sender, nonce, ctx);
    }

    public entry fun purge_plaintext_mail_entry_private(
        mailbox: &mut PrivateMailbox,
        recipient: address,
        sender: address,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        purge_plaintext_mail_entry_on_uid(&mut mailbox.id, recipient, sender, nonce, ctx);
    }

    /// ----------------------------------------------------------------
    /// PhysicalAsset – neutrales Objekt für Inventar/Logistik (Asset-Twin)
    /// Kein Key/Ticket, sondern einfaches Produkt/Palette mit name + metadata (Seriennummer, Hersteller, Wartung).
    /// streams_anchor_id = optionaler Streams-Kanal (Industrie-Brücke: Sensor/Heartbeat dem Asset zugeordnet).
    /// nfc_uid = optional, einmalig setzbar: Hardware-UID des NFC-Chips (Kopierschutz, Sicherheitssiegel Grün).
    /// creator_address = Erzeuger (Sender bei create); bleibt bei Besitzwechsel erhalten („Geburtszertifikat“).
    /// creator_signature = Ed25519-Signatur über message = object_id || creator_address (64 Bytes); nur Ersteller kann setzen (attest_physical_asset). Echtheits-Check: Signatur zur Boss-Adresse passt → „Verifiziert“.
    /// Purge = Rebate an Besitzer (wie Key/Ticket).
    /// ----------------------------------------------------------------
    struct PhysicalAsset has key, store {
        id: UID,
        name: vector<u8>,
        metadata: vector<u8>,
        streams_anchor_id: vector<u8>,
        nfc_uid: vector<u8>,
        created_at_ms: u64,
        creator_address: address,
        creator_signature: vector<u8>,
    }

    struct PhysicalAssetCreated has copy, drop {
        asset_id: ID,
        name: vector<u8>,
        by: address,
    }

    struct PhysicalAssetPurged has copy, drop {
        asset_id: ID,
        by: address,
    }

    /// Erstellt ein PhysicalAsset und überträgt es an den Sender (Owner). Name, Metadaten, optional Streams-Anchor-ID; nfc_uid leer (später per link_nfc_uid setzbar).
    /// creator_address = Sender; creator_signature leer (nach Create per attest_physical_asset setzbar).
    public entry fun create_physical_asset(name: vector<u8>, metadata: vector<u8>, streams_anchor_id: vector<u8>, ctx: &mut TxContext) {
        let by = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);
        let asset = PhysicalAsset {
            id: object::new(ctx),
            name,
            metadata,
            streams_anchor_id,
            nfc_uid: vector::empty(),
            created_at_ms: now,
            creator_address: by,
            creator_signature: vector::empty(),
        };
        event::emit(PhysicalAssetCreated {
            asset_id: object::id(&asset),
            name: asset.name,
            by,
        });
        transfer::transfer(asset, by);
    }

    /// Setzt die Ersteller-Signatur („Geburtszertifikat“). Nur der Ersteller (creator_address) kann aufrufen; nur einmal (creator_signature bisher leer).
    /// Signatur muss über message = object_id (32 B) || creator_address (32 B) erzeugt sein (off-chain, z. B. Ed25519 signPersonalMessage).
    public entry fun attest_physical_asset(asset: &mut PhysicalAsset, signature: vector<u8>, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == asset.creator_address, 41); // Nur Ersteller darf attestieren
        assert!(vector::length(&asset.creator_signature) == 0, 42); // Nur einmal setzbar
        asset.creator_signature = signature;
    }

    /// Verknüpft die Hardware-UID eines NFC-Chips einmalig mit dem Asset (nur Besitzer kann Objekt übergeben; nur wenn nfc_uid noch leer). Kopierschutz / Sicherheitssiegel Grün.
    public entry fun link_nfc_uid(asset: &mut PhysicalAsset, nfc_uid: vector<u8>, _ctx: &mut TxContext) {
        assert!(vector::length(&asset.nfc_uid) == 0, 40); // Nur einmalige Kopplung
        asset.nfc_uid = nfc_uid;
    }

    /// Besitzer überträgt das Asset an eine neue Adresse (z. B. Verkauf, Besitzwechsel). Nur Owner kann übertragen.
    public entry fun transfer_physical_asset(asset: PhysicalAsset, new_owner: address, _ctx: &mut TxContext) {
        transfer::transfer(asset, new_owner);
    }

    /// Besitzer löscht Asset (z. B. bei Verschrottung). Storage-Rebate geht an den Signer (Besitzer).
    public entry fun purge_physical_asset(asset: PhysicalAsset, ctx: &mut TxContext) {
        let by = tx_context::sender(ctx);
        let asset_id = object::id(&asset);
        event::emit(PhysicalAssetPurged { asset_id, by });
        let PhysicalAsset { id, name: _, metadata: _, streams_anchor_id: _, nfc_uid: _, created_at_ms: _, creator_address: _, creator_signature: _ } = asset;
        object::delete(id);
    }
}