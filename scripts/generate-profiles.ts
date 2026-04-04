/**
 * Erzeugt die physische Bibliothek aller 64 Rollen-Kombinationen (id-00 bis id-63)
 * unter profiles/ mit je einer template.json in jedem Unterordner.
 * ROLE_BITS: D=32, LW=16, BW=8, L=4, S=2, P=1 (Bit-Reihenfolge für BIT_MASK: D,LW,BW,L,S,P).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROFILES_DIR = path.join(ROOT, 'profiles');

const ROLE_BITS = { D: 32, LW: 16, BW: 8, L: 4, S: 2, P: 1 } as const;
const BIT_NAMES = ['D', 'LW', 'BW', 'L', 'S', 'P'] as const;

function bitMask(id: number): string {
    let s = '';
    for (const name of BIT_NAMES) {
        s += (id & ROLE_BITS[name]) ? '1' : '0';
    }
    return s;
}

function activeBits(id: number): string[] {
    return BIT_NAMES.filter((name) => (id & ROLE_BITS[name]) !== 0);
}

function description(id: number): string {
    const bits = activeBits(id);
    const labels: Record<string, string> = {
        D: 'Delegation (Rollen ändern)',
        LW: 'Listen-Worker (von oben hören)',
        BW: 'Boss-Worker (Hierarchie)',
        L: 'Lock (Schloss/Befehle)',
        S: 'Send (senden/heartbeat)',
        P: 'Purge (löschen/widerrufen)',
    };
    if (bits.length === 0) return 'Keine Berechtigungen (nur lesen/verbunden).';
    return bits.map((b) => labels[b] || b).join('; ');
}

/** Welche Dashboard-Menüs für dieses Profil sichtbar sein sollen. */
function uiHints(id: number): string[] {
    const bits = activeBits(id);
    const hints: string[] = ['config', 'setup'];
    if (bits.includes('S')) hints.push('chat', 'steuerung');
    if (bits.includes('L')) hints.push('lock');
    if (bits.includes('BW') || bits.includes('LW')) hints.push('boss', 'monitor');
    if (bits.includes('P')) hints.push('vault');
    return [...new Set(hints)];
}

/** Vorschlag für ROLE (arbeiter/kommandant/lock/monitor/waerter) anhand der Bits. */
function suggestedRole(id: number): 'kommandant' | 'arbeiter' | 'lock' | 'monitor' | 'waerter' | 'user' {
    const has = (b: keyof typeof ROLE_BITS) => (id & ROLE_BITS[b]) !== 0;
    if (id === 0) return 'arbeiter';
    if (has('D') && has('BW') && has('L') && has('S')) return 'kommandant'; // typisch Boss/Komm
    if (has('L') && has('S') && !has('BW')) return 'lock'; // Schloss
    if (has('BW') && has('L') && !has('S')) return 'monitor'; // nur lesen/überwachen
    if (has('P') && !has('L') && !has('S')) return 'user'; // nur Purge/User
    return 'arbeiter';
}

/** Basis-Template mit allen Parametern, die frei setzbar sein sollen. */
function templateFor(id: number): Record<string, unknown> {
    const bits = activeBits(id);
    const role = suggestedRole(id);
    return {
        ROLE_ID: id,
        BIT_MASK: bitMask(id),
        DESCRIPTION: description(id),
        UI_HINTS: uiHints(id),
        role,
        roleId: id,
        deviceName: '',
        address: '',
        bossAddress: '',
        kommandantAddresses: [] as string[],
        workerAddresses: [] as string[],
        packageId: '',
        rpcUrl: 'https://fullnode.testnet.iota.cafe:443',
        lockId: '',
        openCommand: '',
        closeCommand: '',
        heartbeatIntervalMs: 30000,
        enableHeartbeat: bits.includes('S'),
        signer: 'cli',
        remoteSigner: '',
        streamsAnchorId: '',
        streamsBridgeUrl: '',
        monitorDevices: [] as string[],
        mailboxId: '',
        commandRegistryId: '',
        sponsorGasOwner: '',
        enableUi: true,
        hardwareType: 'desktop',
        gatewayUrl: '',
        deviceSecret: '',
        ticketOrKeyObjectId: '',
        listenerPollMs: 5000,
        handshakeRefreshMs: 5000,
        lockPeerRefreshMs: 15000,
        lockCommandPollMs: 3000,
        paymentTriggerPollMs: 15000,
        defaultKeyTtlDays: 30,
        defaultTtlDays: 30,
        openCommandWords: 'open,öffnen',
        openUrl: '',
        openCommandListFile: '',
        openCommandListKey: '',
        enableListener: true,
        enableAutoExecute: true,
        authorizedSenders: [] as string[],
        replayStateFile: '',
        paymentTriggerEnabled: false,
        paymentTriggerMinIota: '',
        paymentTriggerStateFile: '',
        paymentTriggerRequireMemo: '',
        enableReplayProtection: true,
        enableHardwareOpen: false,
        enablePurge: bits.includes('P'),
        enablePlaintextChannel: false,
        useMailbox: false,
        vaultFile: '.morgendrot-vault',
        monitorOfflineTimeoutMs: 1800000,
        monitorCheckIntervalMs: 300000,
        monitorAlarmWebhookUrl: '',
        monitorStateFile: '',
        monitorSensorMaxTemp: '',
        monitorSensorMinTemp: '',
        monitorSensorStateFile: '',
        monitorEscalationDelayMs: 300000,
        monitorEscalationWebhook2: '',
        monitorEscalationWebhook3: '',
        monitorPurgeAfterDays: 0,
        offlineOpenEnabled: false,
        offlineCacheTtlMs: 86400000,
        offlineQueueFile: '',
        streamsListenEnabled: false,
        streamsTopic: '',
        openStreamsEnabled: false,
        enableHeartbeatEnv: bits.includes('S'),
        heartbeatIntervalMsEnv: 600000,
        maxSendAmountIota: '',
        fetchLastOnStart: 0,
        enableFetchCommand: true,
        logVerbose: false,
        enableFileLogging: true,
        useEncryptedDiscovery: false,
    };
}

function main() {
    if (!fs.existsSync(PROFILES_DIR)) {
        fs.mkdirSync(PROFILES_DIR, { recursive: true });
        console.log('Erstellt: ' + PROFILES_DIR);
    }
    for (let id = 0; id < 64; id++) {
        const dir = path.join(PROFILES_DIR, `id-${String(id).padStart(2, '0')}`);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const template = templateFor(id);
        const file = path.join(dir, 'template.json');
        fs.writeFileSync(file, JSON.stringify(template, null, 2), 'utf8');
    }
    console.log('64 Profile geschrieben: profiles/id-00 … profiles/id-63 (je template.json)');
}

main();
