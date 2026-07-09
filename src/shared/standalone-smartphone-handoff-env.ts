/**
 * Isomorpher Handoff-.env-Builder (Boss → Helfer-Standalone, § H.7).
 * Keine Secrets, keine process.env-Abhängigkeit — Node + Browser.
 */

export type HandoffTransportProfile = 'mesh-first' | 'iota-anchored' | 'iota-full'

/** Öffentliche Parameter für „Wanderer“-Bundle (Next+PWA); keine Secrets (Roadmap § H.7). */
export interface StandaloneSmartphoneHandoffParams {
    rpcUrl: string;
    packageId: string;
    bossAddress: string;
    /** Komma/Leerzeichen/Semikolon-getrennte 0x-Adressen. */
    partnerAddresses?: string;
    mailboxId?: string;
    /** Weitere Team-Mailbox-IDs (Komma); erste ID = primäre MAILBOX_ID wenn mailboxId leer. */
    teamMailboxIds?: string;
    commandRegistryId?: string;
    vaultRegistryId?: string;
    nextPublicDirectIotaRpcUrl?: string;
    helperRole?: 'messenger' | 'arbeiter' | 'kommandant';
    roleId?: number;
    deploymentProfile?: string;
    uiVariant?: 'full' | 'messenger';
    transportProfile?: HandoffTransportProfile;
    simpleMode?: boolean;
    handoffLabel?: string;
    /** Lagebild — aus Boss-.env übernommen (kein Secret). */
    broadcastPinnwandEnabled?: boolean;
    broadcastPinnwandAddress?: string;
    /** Kompaktes JSON — Gruppe + Team-Mailbox für Helfer (M2c). */
    messengerGroupHandoff?: string;
    /** Nachrichten-/Handshake-TTL in Tagen → DEFAULT_TTL_DAYS im Handoff. */
    exportTtlDays?: number;
    /** Purge über API/UI erlauben → ENABLE_PURGE im Handoff (Standard: true). */
    exportEnablePurge?: boolean;
    /** § H.33 — Kettenmodus im Handoff. */
    einsatzChainMode?: string;
    /** § H.33 Modus A — Boss Mainnet-RPC für Anker (nicht im Helfer-Handoff). */
    mainnetRpcUrl?: string;
    /** LAN-API-Token (öffentlich im Team — kein Seed); Helfer speichert in PWA localStorage. */
    apiAuthToken?: string;
}

const ADDR_64_HEX = /^0x[a-fA-F0-9]{64}$/;
const PACKAGE_ID_REGEX = /^0x[a-fA-F0-9]{64}$/;

export function normalizeHandoffAddress(addr: string | undefined): string {
    return (addr || '').trim().toLowerCase();
}

function normalizeHandoffId(id: string): string {
    return (id || '').trim().toLowerCase();
}

/** Rollen-Default ohne process.env (Handoff-Export offline). */
export function resolveHandoffSimpleMode(helperRole?: string, explicit?: boolean): boolean {
    if (explicit !== undefined) return explicit;
    const r = String(helperRole ?? 'messenger')
        .trim()
        .toLowerCase();
    if (r === 'boss' || r === 'kommandant') return false;
    if (r === 'arbeiter') return true;
    return true;
}

function parseHandoffObjectIdList(raw: string | undefined): string[] {
    if (!raw?.trim()) return [];
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
        const a = normalizeHandoffAddress(p);
        if (!ADDR_64_HEX.test(a)) continue;
        if (seen.has(a)) continue;
        seen.add(a);
        out.push(a);
    }
    return out;
}

function parseHandoffAddressList(raw: string | undefined, bossNorm: string): string[] {
    if (!raw?.trim()) return [];
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
        const a = normalizeHandoffAddress(p);
        if (!ADDR_64_HEX.test(a)) continue;
        if (a === bossNorm) continue;
        if (seen.has(a)) continue;
        seen.add(a);
        out.push(a);
    }
    return out;
}

/**
 * Vorgefüllte `.env` für exports/morgendrot-standalone-smartphone (nach `npm run bundle:standalone-smartphone`).
 * MY_ADDRESS bleibt leer — Helfer richtet Wallet/Tresor nur auf dem Gerät ein.
 */
export function buildStandaloneSmartphoneHandoffEnv(p: StandaloneSmartphoneHandoffParams): string {
    const pkg = normalizeHandoffId(String(p.packageId || '').trim());
    if (!PACKAGE_ID_REGEX.test(pkg)) throw new Error('PACKAGE_ID ungültig (0x + 64 Hex).');
    const boss = normalizeHandoffAddress(String(p.bossAddress || '').trim());
    if (!ADDR_64_HEX.test(boss)) throw new Error('BOSS_ADDRESS muss 0x + 64 Hex sein.');
    const rpc = String(p.rpcUrl || '').trim() || 'https://api.testnet.iota.cafe';
    const teamMbList = parseHandoffObjectIdList(p.teamMailboxIds);
    const mbRaw = String(p.mailboxId || '').trim();
    let mb = mbRaw && ADDR_64_HEX.test(normalizeHandoffAddress(mbRaw)) ? normalizeHandoffAddress(mbRaw) : '';
    if (!mb && teamMbList.length) mb = teamMbList[0]!;
    const helperRoleRaw = String(p.helperRole || 'messenger').trim().toLowerCase();
    const helperRole =
        helperRoleRaw === 'arbeiter' || helperRoleRaw === 'kommandant' ? helperRoleRaw : 'messenger';
    const roleId =
        p.roleId != null && Number.isFinite(p.roleId)
            ? Math.max(0, Math.min(63, Math.floor(Number(p.roleId))))
            : 14;
    const deploymentProfile = String(p.deploymentProfile || 'einsatz').trim() || 'einsatz';
    const uiVariant = String(p.uiVariant || 'full').trim().toLowerCase() === 'messenger' ? 'messenger' : 'full';
    const transportProfileRaw = String(p.transportProfile || 'mesh-first').trim().toLowerCase();
    const transportProfile: HandoffTransportProfile =
        transportProfileRaw === 'iota-anchored' || transportProfileRaw === 'iota-full'
            ? transportProfileRaw
            : 'mesh-first';
    const simpleMode = resolveHandoffSimpleMode(helperRole, p.simpleMode);
    const handoffLabel = String(p.handoffLabel || '').trim();
    const crRaw = String(p.commandRegistryId || '').trim();
    const cr = crRaw && ADDR_64_HEX.test(normalizeHandoffAddress(crRaw)) ? normalizeHandoffAddress(crRaw) : '';
    const vrRaw = String(p.vaultRegistryId || '').trim();
    const vr = vrRaw && ADDR_64_HEX.test(normalizeHandoffAddress(vrRaw)) ? normalizeHandoffAddress(vrRaw) : '';
    const direct = String(p.nextPublicDirectIotaRpcUrl || '').trim();
    const partners = parseHandoffAddressList(p.partnerAddresses, boss);
    const iso = new Date().toISOString();

    const lines: string[] = [
        '# =============================================================================',
        '# Morgendrot – Standalone Smartphone / PWA (Boss-Handoff, § H.7)',
        `# Erzeugt: ${iso}`,
        '# Nur öffentliche Werte — kein Seed, kein Vault-Passwort, keine .morgendrot-vault-Dateien.',
        '# =============================================================================',
        '',
        '# --- Netz & Package ---',
        `RPC_URL=${rpc}`,
        `PACKAGE_ID=${pkg}`,
    ];
    const chainModeRaw = String(p.einsatzChainMode || 'mainnet-direct').trim().toLowerCase();
    const chainMode =
        chainModeRaw === 'testnet-with-mainnet-anchor' || chainModeRaw === 'mainnet-direct-no-rollup'
            ? chainModeRaw
            : 'mainnet-direct';
    lines.push(`EINSATZ_CHAIN_MODE=${chainMode}`);
    const mainnetRpc = String(p.mainnetRpcUrl || '').trim();
    if (chainMode === 'testnet-with-mainnet-anchor' && mainnetRpc) {
        lines.push(`# Boss-only (nicht für Helfer-PWA): Mainnet für store_einsatz_manifest`);
        lines.push(`${'MAINNET_RPC_URL'}=${mainnetRpc}`);
    }
    if (mb) {
        lines.push(`MAILBOX_ID=${mb}`, 'USE_MAILBOX=true');
    } else {
        lines.push('# MAILBOX_ID=', '# USE_MAILBOX=true');
    }
    if (teamMbList.length > 1) {
        lines.push(`TEAM_MAILBOX_IDS=${teamMbList.join(',')}`);
    } else {
        lines.push('# TEAM_MAILBOX_IDS=');
    }
    if (cr) lines.push(`COMMAND_REGISTRY_ID=${cr}`);
    else lines.push('# COMMAND_REGISTRY_ID=');
    if (vr) lines.push(`VAULT_REGISTRY_ID=${vr}`);
    else lines.push('# VAULT_REGISTRY_ID=');
    if (handoffLabel) {
        lines.push(`HANDOFF_LABEL=${handoffLabel}`, `# Einsatz-Bezeichnung: ${handoffLabel}`);
    }
    lines.push(
        '',
        '# --- Identität Helfer-Gerät (leer bis Tresor/Wallet auf dem Telefon) ---',
        'MY_ADDRESS=',
        `ROLE=${helperRole}`,
        `ROLE_ID=${roleId}`,
        '',
        `BOSS_ADDRESS=${boss}`,
        ''
    );
    if (partners.length === 1) {
        lines.push(`PARTNER_ADDRESS=${partners[0]}`, '# PARTNER_ADDRESSES=');
    } else if (partners.length > 1) {
        lines.push(`PARTNER_ADDRESSES=${partners.join(',')}`, '# PARTNER_ADDRESS=');
    } else {
        lines.push(
            '# PARTNER_ADDRESS=',
            '# PARTNER_ADDRESSES=',
            '# Mindestens eine Partner-Adresse setzen (z. B. BOSS_ADDRESS hierher kopieren), sonst kein verschlüsselter Chat.'
        );
    }
    const ttlRaw =
        typeof p.exportTtlDays === 'number' && Number.isFinite(p.exportTtlDays)
            ? Math.max(0, Math.min(3650, Math.floor(p.exportTtlDays)))
            : undefined;
    lines.push(
        '',
        '# =============================================================================',
        '# PWA / Next + API — wie bundle-standalone-smartphone Overrides',
        '# =============================================================================',
        'ENABLE_UI=true',
        `UI_VARIANT=${uiVariant}`,
        `DEPLOYMENT_PROFILE=${deploymentProfile}`,
        `TRANSPORT_PROFILE=${transportProfile}`,
        `SIMPLE_MODE=${simpleMode ? 'true' : 'false'}`,
        'API_PORT=3342',
        'API_KILL_PREVIOUS_INSTANCE=true',
        'SIGNER=sdk',
        'NETWORK_TRUST_TIER=1',
        `ENABLE_PURGE=${p.exportEnablePurge === false ? 'false' : 'true'}`,
        'ENABLE_REPLAY_PROTECTION=true',
        ...(ttlRaw != null ? [`DEFAULT_TTL_DAYS=${ttlRaw}`] : []),
        'ENABLE_PLAINTEXT_CHANNEL=false',
        ''
    );
    const broadcastEnabled = Boolean(p.broadcastPinnwandEnabled);
    const broadcastRaw = String(p.broadcastPinnwandAddress || '').trim();
    const broadcastAddr =
        broadcastRaw && ADDR_64_HEX.test(normalizeHandoffAddress(broadcastRaw))
            ? normalizeHandoffAddress(broadcastRaw)
            : '';
    if (broadcastEnabled && broadcastAddr) {
        lines.push(
            '# --- Lagebild (Pinnwand) — automatisch mit Handoff; Helfer konfiguriert nichts ---',
            'ENABLE_BROADCAST_PINNWAND=true',
            `BROADCAST_PINNWAND_ADDRESS=${broadcastAddr}`,
            'ENABLE_PLAINTEXT_CHANNEL=true',
            ''
        );
    }
    if (transportProfile === 'mesh-first') {
        lines.push(
            '# --- LoRa / Meshtastic (§ TRANSPORT-AND-IOTA-LAYERS) ---',
            '# Verschlüsselung: Kanal-PSK in der Meshtastic-App — nicht Morgendrot-Mesh-v2.',
            '# IOTA-Archiv: optional Pfad 4 (eigene Mailbox nach Netz); Delayed Upload = Phase B.',
            ''
        );
    }
    if (direct) {
        lines.push(`NEXT_PUBLIC_DIRECT_IOTA_RPC_URL=${direct}`, '');
    } else {
        lines.push(`NEXT_PUBLIC_DIRECT_IOTA_RPC_URL=${rpc}`, '');
    }
    const groupHandoff = String(p.messengerGroupHandoff || '').trim();
    if (groupHandoff) {
        lines.push(
            '',
            '# --- Gruppenchat (M2c) — Team-Mailbox + Mitglieder automatisch nach Import ---',
            `# Klartext-Teamkanal heute; verschlüsselt folgt mit Team-Key im Handoff (Phase 3).`,
            `MESSENGER_GROUP_HANDOFF=${groupHandoff}`,
            ''
        );
    }
    const apiAuthToken = String(p.apiAuthToken || '').trim();
    if (apiAuthToken) {
        lines.push(
            '',
            '# --- LAN-API (Vault-Secrets / Operator) — Team-Token, kein Seed ---',
            `API_AUTH_TOKEN=${apiAuthToken}`,
            ''
        );
    }
    return lines.join('\n');
}

export function buildStandaloneSmartphoneHandoffReadme(p: {
    handoffLabel?: string;
    createdAtIso: string;
    packageId: string;
    rpcUrl: string;
    bossAddress: string;
    helperRole?: string;
    teamMailboxIds?: string;
    /** Zusätzlicher Block (z. B. LoRa-PSK + IOTA-Archiv). */
    readmeExtra?: string;
}): string {
    const label = (p.handoffLabel || '').trim() || '(ohne Bezeichnung)';
    return [
        'Morgendrot – Standalone-Smartphone-Handoff (Boss)',
        '================================================',
        '',
        `Bezeichnung: ${label}`,
        `Erzeugt: ${p.createdAtIso}`,
        '',
        'Inhalt dieses ZIP:',
        '  • morgendrot-standalone-handoff.env  – öffentliche .env-Zeilen',
        '  • README-HANDOFF.txt                 – diese Datei',
        '',
        'Voraussetzung: Im Haupt-Repository das Smartphone-Bundle gebaut haben:',
        '  npm run bundle:standalone-smartphone',
        '  → Ordner exports/morgendrot-standalone-smartphone/',
        '',
        'Ablauf für den Helfer (Medium ohne Geheimnisse):',
        '  1) Bundle-Ordner auf den PC des Helfers kopieren (oder als ZIP vom Boss).',
        '  2) Datei morgendrot-standalone-handoff.env aus diesem ZIP in das Bundle-Wurzelverzeichnis legen',
        '     und in .env umbenennen (vorher vorhandene .env aus npm install sichern, falls nötig).',
        '  3) Im Bundle-Root: npm install --omit=dev, dann cd frontend && npm install --omit=dev',
        '  4) npm run build:next && npm run start:prod:lan (oder dev:lan) — Details im Bundle-README.',
        '  5) Seed/Mnemonic und Vault-Passwort nur auf dem Telefon eingeben — nie auf dem USB mitliefern.',
        '',
        'Parameter in dieser Auslieferung (Kurz):',
        `  PACKAGE_ID=${p.packageId}`,
        `  RPC_URL=${p.rpcUrl}`,
        `  BOSS_ADDRESS=${p.bossAddress}`,
        p.helperRole ? `  ROLE=${p.helperRole}` : '',
        p.teamMailboxIds ? `  TEAM_MAILBOX_IDS=${p.teamMailboxIds}` : '',
        '',
        'Kanonische Doku: docs/WANDERER-STANDALONE-BUNDLE.md und docs/ROADMAP-FAHRPLAN.md § H.7.',
        '',
        p.readmeExtra ? ['---', '', p.readmeExtra.trim(), ''].join('\n') : '',
    ]
        .filter(Boolean)
        .join('\n');
}

/** Client/Server: PACKAGE_ID aus Body + lokalem Boss-Kontext. */
export function resolveHandoffExportPackageId(opts: {
    source: 'boss' | 'custom' | 'history';
    customPackageId?: string;
    /** Boss-.env / Direct-Chain snapshot */
    bossPackageId?: string;
}): { ok: true; packageId: string } | { ok: false; error: string } {
    if (opts.source === 'custom') {
        const id = String(opts.customPackageId || '').trim();
        if (!PACKAGE_ID_REGEX.test(id)) return { ok: false, error: 'PACKAGE_ID: 0x + 64 Hex erforderlich.' };
        return { ok: true, packageId: normalizeHandoffId(id) };
    }
    if (opts.source === 'history') {
        return {
            ok: false,
            error: 'Package-Verlauf nur mit Boss-Server verfügbar — „Boss-.env“ oder eigene ID wählen.',
        };
    }
    const id = String(opts.bossPackageId || '').trim();
    if (!PACKAGE_ID_REGEX.test(id)) {
        return { ok: false, error: 'Boss PACKAGE_ID leer oder ungültig — zuerst Netzwerk/Deploy einrichten.' };
    }
    return { ok: true, packageId: normalizeHandoffId(id) };
}

export type ResolvedPackageGlobals = {
    mailboxId: string;
    vaultRegistryId: string;
    commandRegistryId: string;
};

/**
 * Handoff-Export: MAILBOX_ID / Registries gegen GlobalsCreated auf der Ziel-RPC prüfen.
 * autoCorrect=true → Chain-Werte übernehmen; false → 400 bei Mismatch.
 */
export function reconcileHandoffExportGlobals(opts: {
    packageId: string;
    mailboxId?: string;
    commandRegistryId?: string;
    vaultRegistryId?: string;
    resolved: ResolvedPackageGlobals | null;
    autoCorrect?: boolean;
}):
    | {
          ok: true;
          mailboxId: string;
          commandRegistryId: string;
          vaultRegistryId: string;
          corrected: boolean;
          warnings: string[];
      }
    | { ok: false; error: string } {
    const pkg = normalizeHandoffId(opts.packageId);
    const mbIn = opts.mailboxId?.trim() ? normalizeHandoffAddress(opts.mailboxId) : '';
    const crIn = opts.commandRegistryId?.trim() ? normalizeHandoffAddress(opts.commandRegistryId) : '';
    const vrIn = opts.vaultRegistryId?.trim() ? normalizeHandoffAddress(opts.vaultRegistryId) : '';
    const hasAny = Boolean(mbIn || crIn || vrIn);

    if (!opts.resolved) {
        if (hasAny) {
            return {
                ok: false,
                error: `Kein GlobalsCreated für Package ${pkg.slice(0, 14)}… auf der Ziel-RPC — create_globals ausführen oder MAILBOX_ID leer lassen.`,
            };
        }
        return {
            ok: true,
            mailboxId: '',
            commandRegistryId: '',
            vaultRegistryId: '',
            corrected: false,
            warnings: [],
        };
    }

    const resolved = {
        mailboxId: normalizeHandoffAddress(opts.resolved.mailboxId),
        commandRegistryId: normalizeHandoffAddress(opts.resolved.commandRegistryId),
        vaultRegistryId: normalizeHandoffAddress(opts.resolved.vaultRegistryId),
    };
    const warnings: string[] = [];
    let corrected = false;
    const autoCorrect = opts.autoCorrect !== false;

    const pick = (label: string, input: string, chain: string): string | { ok: false; error: string } => {
        if (!input) {
            if (chain) {
                corrected = true;
                warnings.push(`${label} aus GlobalsCreated übernommen (${chain.slice(0, 14)}…).`);
            }
            return chain;
        }
        if (input === chain) return input;
        if (autoCorrect) {
            corrected = true;
            warnings.push(
                `${label} ${input.slice(0, 14)}… passt nicht zu Package ${pkg.slice(0, 14)}… — Chain-Wert ${chain.slice(0, 14)}… übernommen.`
            );
            return chain;
        }
        return {
            ok: false as const,
            error: `${label} ${input.slice(0, 14)}… gehört nicht zu Package ${pkg.slice(0, 14)}… (Chain: ${chain.slice(0, 14)}…).`,
        };
    };

    const mb = pick('MAILBOX_ID', mbIn, resolved.mailboxId);
    if (typeof mb === 'object') return mb;
    const cr = pick('COMMAND_REGISTRY_ID', crIn, resolved.commandRegistryId);
    if (typeof cr === 'object') return cr;
    const vr = pick('VAULT_REGISTRY_ID', vrIn, resolved.vaultRegistryId);
    if (typeof vr === 'object') return vr;

    return {
        ok: true,
        mailboxId: mb,
        commandRegistryId: cr,
        vaultRegistryId: vr,
        corrected,
        warnings,
    };
}
