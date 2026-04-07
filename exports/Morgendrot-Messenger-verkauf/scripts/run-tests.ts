/**
 * Tests für alle testbaren Module (ohne echte Chain/CLI).
 * Ausführung: npx tsx scripts/run-tests.ts
 */
import { strict as assert } from 'node:assert';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import '../src/install-webcrypto-node.js';

let passed = 0;
let failed = 0;

function ok(name: string) {
    passed++;
    console.log('  ✓ ' + name);
}
function fail(name: string, err: unknown) {
    failed++;
    console.log('  ✗ ' + name + ': ' + (err instanceof Error ? err.message : String(err)));
}

// --- Crypto Layer ---
async function testCryptoLayer() {
    console.log('\n--- crypto-layer ---');
    const { generateKeyPair, deriveSharedSecret, deriveAesGcmKey, encryptMessage, decryptMessage } = await import('../src/crypto-layer.js');

    try {
        const a = await generateKeyPair(true);
        const b = await generateKeyPair(true);
        assert(a.privateKey && a.pubRaw && a.pubRaw.length > 0, 'keypair A');
        assert(b.privateKey && b.pubRaw && b.pubRaw.length > 0, 'keypair B');

        const secretA = await deriveSharedSecret(a.privateKey, b.pubRaw);
        const secretB = await deriveSharedSecret(b.privateKey, a.pubRaw);
        assert(secretA.length === 32 && secretB.length === 32, 'shared secret length');
        assert(Buffer.from(secretA).equals(Buffer.from(secretB)), 'ECDH symmetry');

        const aesA = await deriveAesGcmKey(secretA);
        const aesB = await deriveAesGcmKey(secretB);
        assert(aesA && aesB, 'AES keys');

        const plain = 'Hello, World!';
        const { iv, ciphertext } = await encryptMessage(aesA, plain);
        assert(iv && ciphertext && iv.length > 0 && ciphertext.length > 0, 'encrypt output');
        const dec = await decryptMessage(aesB, iv, ciphertext);
        assert(dec === plain, 'roundtrip decrypt');
        ok('ECDH + AES-GCM roundtrip');
    } catch (e) {
        fail('crypto-layer', e);
    }
}

// --- Mesh v2 wire (shared: inner blob + emergency binary) ---
async function testMeshPeerWireRoundtrip() {
    console.log('\n--- mesh-peer-wire (shared) ---');
    try {
        const { generateKeyPair } = await import('../src/crypto-layer.js');
        const {
            buildMeshPeerInnerBlob,
            packMeshEmergencyV2Wire,
            decryptMeshEmergencyV2Wire,
        } = await import('../src/shared/mesh-peer-wire.js');

        const alice = await generateKeyPair(true);
        const bob = await generateKeyPair(true);
        const msg = 'mesh roundtrip test';
        const inner = await buildMeshPeerInnerBlob(msg, bob.pubRaw, alice.privateKey);
        const packed = await packMeshEmergencyV2Wire('0x' + 'a'.repeat(64), 0x12345678, inner);
        assert(packed.ok === true && packed.wire.length > 0, 'pack ok');
        const dec = await decryptMeshEmergencyV2Wire(packed.wire, alice.pubRaw, bob.privateKey);
        assert(dec === msg, 'decrypt roundtrip');
        ok('inner blob → emergency v2 wire → decrypt');
    } catch (e) {
        fail('mesh-peer-wire', e);
    }
}

// --- Vault Local (encrypt/decrypt UTF-8 payload) ---
async function testVaultLocal() {
    console.log('\n--- vault-local ---');
    const { encryptUtf8ToPayload, decryptPayloadToUtf8 } = await import('../src/vault-local.js');

    try {
        const text = 'KEY1=value1\nKEY2=value2';
        const pwd = 'test-password-123';
        const payload = await encryptUtf8ToPayload(text, pwd);
        assert(payload.length >= 16 + 12 + 16, 'payload min length (salt+iv+tag)');
        const dec = await decryptPayloadToUtf8(payload, pwd);
        assert(dec === text, 'roundtrip UTF-8 payload');
        ok('encryptUtf8ToPayload / decryptPayloadToUtf8 roundtrip');

        await assert.rejects(
            async () => decryptPayloadToUtf8(new Uint8Array(10), pwd),
            /Payload zu kurz|zu kurz/
        );
        ok('decryptPayloadToUtf8 rejects short payload');

        await assert.rejects(
            async () => decryptPayloadToUtf8(payload, 'falsches-passwort'),
            /decrypt|Authentication|Tag|ungültig|invalid|OperationError|operation failed/i
        );
        ok('decryptPayloadToUtf8 rejects wrong password');

        const { sanitizePersonalSecrets } = await import('../src/vault-local.js');
        const bad = sanitizePersonalSecrets(null);
        assert(Array.isArray(bad) && bad.length === 0, 'sanitize null → []');
        const two = sanitizePersonalSecrets([
            { id: 'a', title: '  T1  ', username: 'u', secret: 's', note: 'n' },
            { title: 'x'.repeat(400), secret: 'only-title-truncated' },
        ]);
        assert(two.length === 2, 'two entries');
        assert(two[0]!.title === 'T1' && two[0]!.username === 'u', 'trim fields');
        assert(two[1]!.title.length <= 256, 'title capped');
        ok('sanitizePersonalSecrets');
    } catch (e) {
        fail('vault-local', e);
    }
}

// --- Replay State ---
async function testReplayState() {
    console.log('\n--- replay-state ---');
    const { acceptAndUpdate } = await import('../src/replay-state.js');

    try {
        const empty: Record<string, string> = {};
        const r1 = acceptAndUpdate(empty, '0xabc', 100n);
        assert(r1.accepted === true && r1.newState['0xabc'] === '100', 'first nonce accepted');
        const r2 = acceptAndUpdate(r1.newState, '0xabc', 101n);
        assert(r2.accepted === true && r2.newState['0xabc'] === '101', 'higher nonce accepted');
        const r3 = acceptAndUpdate(r2.newState, '0xabc', 101n);
        assert(r3.accepted === false && r3.newState['0xabc'] === '101', 'same nonce rejected');
        const r4 = acceptAndUpdate(r2.newState, '0xabc', 99n);
        assert(r4.accepted === false, 'lower nonce rejected');
        const r5 = acceptAndUpdate(r2.newState, '0xdef', 50n);
        assert(r5.accepted === true && r5.newState['0xdef'] === '50', 'different sender accepted');
        ok('acceptAndUpdate monotonic + per-sender');
    } catch (e) {
        fail('replay-state', e);
    }
}

// --- parseEnvText (load-secrets) ---
async function testParseEnvText() {
    console.log('\n--- load-secrets (parseEnvText) ---');
    const { parseEnvText } = await import('../src/load-secrets.js');

    try {
        const out1 = parseEnvText('A=1\nB=2');
        assert(out1.A === '1' && out1.B === '2', 'simple KEY=VALUE');
        const out2 = parseEnvText('A=1\n# comment\n\nB=2');
        assert(out2.A === '1' && out2.B === '2', 'comment and empty line');
        const out3 = parseEnvText('K="v with spaces"');
        assert(out3.K === 'v with spaces', 'quoted value');
        const out4 = parseEnvText('K=\'single\'');
        assert(out4.K === 'single', 'single-quoted value');
        const out5 = parseEnvText('ONLY_KEY=');
        assert(out5.ONLY_KEY === '', 'empty value');
        const out6 = parseEnvText('=no_key');
        assert(Object.keys(out6).length === 0, 'no key skipped');
        ok('parseEnvText cases');
    } catch (e) {
        fail('parseEnvText', e);
    }
}

// --- read-command-list (IV + AES-256-GCM, keyHex 64 chars) ---
async function testReadCommandList() {
    console.log('\n--- read-command-list ---');
    const crypto = await import('crypto');
    const { loadOpenWordsFromFile } = await import('../src/read-command-list.js');

    const dir = path.join(tmpdir(), 'morgendrot-test-' + Date.now());
    fs.mkdirSync(dir, { recursive: true });
    const keyHex = '00'.repeat(32);
    const key = Buffer.from(keyHex, 'hex');
    const filePath = path.join(dir, 'words.enc');

    try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const enc = Buffer.concat([cipher.update('open,öffnen,unlock', 'utf-8'), cipher.final(), cipher.getAuthTag()]);
        fs.writeFileSync(filePath, Buffer.concat([iv, enc]));
        const words = loadOpenWordsFromFile(filePath, keyHex);
        assert(Array.isArray(words) && words.includes('open') && words.includes('öffnen') && words.includes('unlock'), 'decrypt open words');
        ok('loadOpenWordsFromFile (IV + AES-GCM)');

        assert.throws(() => loadOpenWordsFromFile(filePath, 'ab'), /64 Hex|32 Bytes/);
        ok('loadOpenWordsFromFile rejects short key');
    } catch (e) {
        fail('read-command-list', e);
    } finally {
        try { fs.unlinkSync(filePath); fs.rmdirSync(dir); } catch {}
    }
}

// --- chain-access: assertSafeAddress (via buildHandshakeTransaction) ---
async function testChainAccessValidation() {
    console.log('\n--- chain-access (validation) ---');
    const prev = process.env.PACKAGE_ID;
    process.env.PACKAGE_ID = process.env.PACKAGE_ID || '0x' + 'a'.repeat(64);
    try {
        const { buildHandshakeTransaction } = await import('../src/chain-access.js');
        const pubKey = new Uint8Array(65).fill(1);
        buildHandshakeTransaction(
            '0x' + 'a'.repeat(64),
            '0x' + 'b'.repeat(64),
            pubKey
        );
        ok('buildHandshakeTransaction accepts 0x64 hex');

        assert.throws(
            () => buildHandshakeTransaction('invalid', '0x' + 'b'.repeat(64), pubKey),
            /Ungültige|unsichere|Adresse/
        );
        ok('buildHandshakeTransaction rejects invalid address');
    } catch (e) {
        fail('chain-access validation', e);
    } finally {
        if (prev !== undefined) process.env.PACKAGE_ID = prev;
    }
}

// --- Utils (normalizeAddress, toEventBytes) ---
async function testUtils() {
    console.log('\n--- utils ---');
    const { normalizeAddress, toEventBytes } = await import('../src/utils.js');

    try {
        assert(normalizeAddress('0xABC') === '0xabc', 'normalizeAddress lowercase');
        assert(normalizeAddress(' 0x123 ') === '0x123', 'normalizeAddress trim');
        assert(normalizeAddress(undefined) === '', 'normalizeAddress undefined');
        assert(toEventBytes([1, 2, 3]).length === 3, 'toEventBytes array');
        assert(toEventBytes(null).length === 0, 'toEventBytes null');
        ok('normalizeAddress + toEventBytes');
    } catch (e) {
        fail('utils', e);
    }
}

// --- Config display (no secrets in output) ---
async function testConfigDisplay() {
    console.log('\n--- config (getConfigDisplay) ---');
    const { getConfigDisplay } = await import('../src/config.js');

    try {
        const rows = getConfigDisplay();
        assert(Array.isArray(rows) && rows.length > 0, 'has rows');
        const key = rows.find((r: { key: string }) => r.key === 'REMOTE_SIGNER_TOKEN');
        assert(key && (key.value === '(leer)' || key.value === '***'), 'token masked');
        const newKeys = [
            'ENABLE_HEARTBEAT',
            'ENABLE_CHAIN_ANCHOR',
            'LOG_MAX_FILES',
            'PAYMENT_TRIGGER_REQUIRE_MEMO',
            'MESSENGER_AUTO_SPONSOR',
            'MESSENGER_LICENSE_NFT_OBJECT_ID',
            'MESSENGER_CREDITS_OBJECT_ID',
            'VERIFIED_IOTA_NAME_PACKAGE_IDS',
            'MESSENGER_GAS_STATE_FILE',
        ];
        for (const k of newKeys) {
            assert(rows.some((r: { key: string }) => r.key === k), `getConfigDisplay has ${k}`);
        }
        ok('getConfigDisplay masks secrets + new options');
    } catch (e) {
        fail('config display', e);
    }
}

// --- Messenger-Export-.env (ohne Arbeiter-Felder) ---
async function testMessengerExportEnv() {
    console.log('\n--- config (buildMessengerExportEnv) ---');
    const { buildMessengerExportEnv, buildMessengerExportJson } = await import('../src/config.js');

    try {
        const addr = '0x' + 'a'.repeat(64);
        const boss = '0x' + 'b'.repeat(64);
        const pkg = '0x' + 'c'.repeat(64);
        const env = buildMessengerExportEnv({
            deviceName: 'Unit-Test',
            address: addr,
            packageId: pkg,
            rpcUrl: 'https://api.testnet.iota.cafe',
            bossAddress: boss,
            edition: 'sales',
            signer: 'sdk',
            roleId: 14,
        });
        assert(env.includes('ROLE=messenger'), 'ROLE=messenger');
        assert(env.includes('MESSENGER_EDITION=sales'), 'sales edition');
        assert(env.includes('UI_VARIANT=messenger'), 'UI messenger');
        assert(!env.includes('ENABLE_LISTENER=true'), 'kein Listener-Default');
        const cred = '0x' + 'd'.repeat(64);
        const envCred = buildMessengerExportEnv({
            deviceName: 'C',
            address: addr,
            packageId: pkg,
            rpcUrl: 'https://api.testnet.iota.cafe',
            bossAddress: boss,
            edition: 'standalone',
            signer: 'sdk',
            creditsObjectId: cred,
        });
        assert(envCred.includes('MESSENGER_CREDITS_OBJECT_ID=' + cred.toLowerCase()), 'credits in env');
        const j = buildMessengerExportJson({
            address: addr,
            packageId: pkg,
            rpcUrl: 'https://api.testnet.iota.cafe',
            bossAddress: boss,
            edition: 'standalone',
            signer: 'cli',
        });
        assert(j.kind === 'messenger' && j.messengerEdition === 'standalone', 'json kind');
        const jCred = buildMessengerExportJson({
            address: addr,
            packageId: pkg,
            rpcUrl: 'https://api.testnet.iota.cafe',
            bossAddress: boss,
            edition: 'standalone',
            signer: 'cli',
            creditsObjectId: cred,
        });
        assert((jCred as { messengerCreditsObjectId?: string }).messengerCreditsObjectId === cred.toLowerCase(), 'credits in json');
        ok('buildMessengerExportEnv / buildMessengerExportJson');
    } catch (e) {
        fail('buildMessengerExportEnv', e);
    }
}

// --- Config setEnvKey blocklist (OPEN_COMMAND etc. nicht per API setzbar) ---
async function testSetEnvKeyBlocklist() {
    console.log('\n--- config (setEnvKey blocklist) ---');
    const { setEnvKey } = await import('../src/config.js');

    try {
        const blocked = [
            'OPEN_COMMAND',
            'OPEN_URL',
            'REMOTE_SIGNER_URL',
            'REMOTE_SIGNER_TOKEN',
            'WALLET_PASSWORD',
            'STRIPE_SECRET_KEY',
            'STRIPE_WEBHOOK_SECRET',
            'SHOP_CLAIM_NOTIFY_SECRET',
            'SHOP_MINT_BOSS_WALLET_PASSWORD',
            'BOSS_WALLET_PASSWORD',
        ];
        for (const k of blocked) {
            const r = setEnvKey(k, 'malicious');
            assert(!r.ok && r.error && r.error.includes('nicht per API'), `setEnvKey blocks ${k}`);
        }
        ok('setEnvKey blocklist (OPEN_COMMAND, OPEN_URL, etc.)');
    } catch (e) {
        fail('setEnvKey blocklist', e);
    }
}

// --- Monitoring: Heartbeat-State load/save (env muss vor Config-Load gesetzt sein) ---
async function testMonitoringState(monitorStatePath: string) {
    console.log('\n--- monitoring (heartbeat state) ---');
    const deviceA = '0x' + 'a'.repeat(62);
    const deviceB = '0x' + 'b'.repeat(62);
    const deviceC = '0x' + 'c'.repeat(62);

    try {
        const { recordHeartbeat } = await import('../src/monitoring.js');
        recordHeartbeat(deviceA);
        recordHeartbeat(deviceB);
        recordHeartbeat(deviceC); // nicht in MONITOR_DEVICES → ignoriert
        assert(fs.existsSync(monitorStatePath), 'state file created');
        const raw = JSON.parse(fs.readFileSync(monitorStatePath, 'utf-8'));
        assert(raw[deviceA] && raw[deviceB], 'monitored devices recorded');
        assert(!raw[deviceC], 'unmonitored device not recorded');
        ok('recordHeartbeat only for MONITOR_DEVICES');

        recordHeartbeat('');
        recordHeartbeat('x');
        ok('recordHeartbeat ignores invalid deviceId');
    } catch (e) {
        fail('monitoring state', e);
    }
}

// --- chain-access: iotaToMist, minIotaToMist, mistToDisplayIota (Dezimalformat DE/EN) ---
async function testChainAccessAmounts() {
    console.log('\n--- chain-access (IOTA/MIST + Anzeige) ---');
    try {
        const { iotaToMist, minIotaToMist, mistToDisplayIota } = await import('../src/chain-access.js');

        assert(iotaToMist('1') === 1_000_000_000n, '1 IOTA = 10^9 MIST');
        assert(iotaToMist('0.001') === 1_000_000n, '0.001 IOTA');
        assert(iotaToMist('1.000') === 1_000_000_000_000n, '1.000 (DE Tausender) = 1000 IOTA => 10^12 MIST');
        assert(iotaToMist('0.000001') === 1000n, '0.000001 IOTA (kein Tausender-Strip bei 0.xxx)');
        assert(iotaToMist('1,5') === 1_500_000_000n, '1,5 (DE Komma) = 1.5 IOTA');
        assert(iotaToMist('') === 0n && iotaToMist('0') === 0n, 'leer/0 => 0n');
        assert(iotaToMist('-1') === 0n, 'negativ => 0n');
        ok('iotaToMist (DE/EN, 0.xxx)');

        assert(minIotaToMist('0.001') === 1_000_000n, 'minIotaToMist 0.001');
        assert(minIotaToMist('') === 0n, 'minIotaToMist leer');
        ok('minIotaToMist');

        assert(mistToDisplayIota(1_000_000_000n) === '100.00', '1e9 MIST => 100 (Anzeige Faktor 100)');
        assert(mistToDisplayIota('1000000000') === '100.00', 'mistToDisplayIota string');
        assert(mistToDisplayIota(10_000_000n) === '1.00', '0.01 IOTA => 1.00 Anzeige');
        assert(mistToDisplayIota(0n) === '0', '0 MIST => 0');
        ok('mistToDisplayIota (Komma 2 rechts)');
    } catch (e) {
        fail('chain-access amounts', e);
    }
}

// --- Messenger-Gas-Milestone (State-Datei über MESSENGER_GAS_STATE_FILE, ohne chdir) ---
async function testMessengerGasMilestone() {
    console.log('\n--- messenger-gas-milestone ---');
    const dir = path.join(tmpdir(), 'morgendrot-gas-' + Date.now());
    const stateFile = path.join(dir, 'gas-state.json');
    const prevGas = process.env.MESSENGER_GAS_STATE_FILE;
    try {
        fs.mkdirSync(dir, { recursive: true });
        process.env.MESSENGER_GAS_STATE_FILE = stateFile;
        const { getSelfPaidMessengerTxCount, recordSelfPaidMessengerTxSuccess } = await import('../src/messenger-gas-milestone.js');
        const addr = '0x' + 'a'.repeat(64);
        const addrUpper = '0x' + 'A'.repeat(64);
        assert(getSelfPaidMessengerTxCount(addr) === 0, 'initial count 0');
        recordSelfPaidMessengerTxSuccess(addr);
        assert(getSelfPaidMessengerTxCount(addr) === 1, 'after one success');
        recordSelfPaidMessengerTxSuccess(addrUpper);
        assert(getSelfPaidMessengerTxCount(addr) === 2, 'same address different hex case => one counter');
        assert(fs.existsSync(stateFile), 'custom state file written');
        ok('messenger-gas-milestone count + address normalization');
    } catch (e) {
        fail('messenger-gas-milestone', e);
    } finally {
        if (prevGas !== undefined) process.env.MESSENGER_GAS_STATE_FILE = prevGas;
        else delete process.env.MESSENGER_GAS_STATE_FILE;
        try {
            fs.unlinkSync(stateFile);
            fs.rmdirSync(dir);
        } catch {
            /* ignore */
        }
    }
}

// --- IOTA Names Lookup (JSON-RPC-Aufbau, Mock-Fetch) ---
async function testIotaNamesLookup() {
    console.log('\n--- iota-names-lookup ---');
    const { iotaNamesLookup } = await import('../src/iota-names-lookup.js');
    try {
        let called = false;
        const mockFetch = async (_url: string, init?: RequestInit): Promise<Response> => {
            called = true;
            const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string; params?: { name?: string } };
            assert(body.method === 'iotax_iotaNamesLookup', 'JSON-RPC method');
            assert(body.params?.name === 'foo.iota', 'params.name');
            return new Response(
                JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    result: { nftId: '0x' + 'f'.repeat(64), targetAddress: '0x' + 'e'.repeat(64) },
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        };
        const r = await iotaNamesLookup('https://rpc.example/', 'foo.iota', mockFetch as typeof fetch);
        assert(called, 'fetch invoked');
        assert(r.nftId === '0x' + 'f'.repeat(64) && r.targetAddress === '0x' + 'e'.repeat(64), 'parsed result');

        await assert.rejects(
            () =>
                iotaNamesLookup(
                    'https://rpc.example/',
                    'x',
                    async () =>
                        new Response(
                            JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -1, message: 'not found' } }),
                            { status: 200, headers: { 'Content-Type': 'application/json' } }
                        )
                ),
            /not found/
        );

        const { parseVerifiedIotaNamePackageIds } = await import('../src/config.js');
        const two = parseVerifiedIotaNamePackageIds(`0x${'a'.repeat(64)}, 0x${'b'.repeat(64)}`);
        assert(two.length === 2 && two[0]!.startsWith('0x'), 'parse two package ids');
        ok('iotaNamesLookup + parseVerifiedIotaNamePackageIds');
    } catch (e) {
        fail('iota-names-lookup', e);
    }
}

// --- Chain-Anchor: hashState (via export or indirect) ---
async function testChainAnchor() {
    console.log('\n--- chain-anchor ---');
    const prev = process.env.ENABLE_CHAIN_ANCHOR;
    process.env.ENABLE_CHAIN_ANCHOR = 'false';
    try {
        const { anchorState } = await import('../src/chain-anchor.js');
        const r = await anchorState('0x' + 'a'.repeat(64), undefined, undefined);
        assert(r === null, 'anchorState returns null when disabled');
        ok('anchorState disabled when ENABLE_CHAIN_ANCHOR=false');
    } catch (e) {
        fail('chain-anchor', e);
    } finally {
        if (prev !== undefined) process.env.ENABLE_CHAIN_ANCHOR = prev;
    }
}

// --- Replay load/save (temp file) ---
async function testReplayStateFile() {
    console.log('\n--- replay-state (load/save) ---');
    const { loadReplayState, saveReplayState, acceptAndUpdate } = await import('../src/replay-state.js');
    const dir = path.join(tmpdir(), 'morgendrot-replay-' + Date.now());
    const filePath = path.join(dir, 'state.json');

    try {
        fs.mkdirSync(dir, { recursive: true });
        const empty = await loadReplayState(filePath);
        assert(typeof empty === 'object' && Object.keys(empty).length === 0, 'load missing file => empty');

        const state = acceptAndUpdate(empty, '0xaa', 1n).newState;
        await saveReplayState(filePath, state);
        const loaded = await loadReplayState(filePath);
        assert(loaded['0xaa'] === '1', 'saved state roundtrip');
        ok('loadReplayState / saveReplayState roundtrip');
    } catch (e) {
        fail('replay-state file', e);
    } finally {
        try { fs.unlinkSync(filePath); fs.rmdirSync(dir); } catch {}
    }
}

async function testVaultImagePipeline() {
    console.log('\n--- vault-image-pipeline ---');
    try {
        const sharp = (await import('sharp')).default;
        const { VaultImagePipeline, VAULT_IMAGE_MAGIC } = await import('../src/vault-image-pipeline.js');
        const png1x1 = await sharp({
            create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 100, b: 50 } },
        })
            .png()
            .toBuffer();
        const { plaintext, lumaWebpBytes, chromaPngBytes, originalSha256 } =
            await VaultImagePipeline.encodeToPlaintextBlob(png1x1);
        assert(plaintext.subarray(0, 4).equals(VAULT_IMAGE_MAGIC), 'magic');
        assert(lumaWebpBytes > 0 && chromaPngBytes > 0, 'non-empty layers');
        assert(originalSha256.length === 32, 'sha256');
        const parsed = VaultImagePipeline.parsePlaintextHeader(plaintext);
        assert(parsed.luma.length === lumaWebpBytes, 'parse luma len');
        assert(parsed.chroma.length === chromaPngBytes, 'parse chroma len');
        assert(parsed.originalSha256.equals(originalSha256), 'parse hash');
        const { MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES } = await import('../src/messenger-media-limits.js');
        const { MESSAGING_MAX_PLAINTEXT_UTF8_BYTES } = await import('../src/chain-access.js');
        const chainFit = await VaultImagePipeline.encodeToPlaintextBlobFitChain(
            png1x1,
            MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES
        );
        assert(chainFit.plaintext.length <= MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES, 'fitChain blob');
        const w = '[[MORG_COMPACT_IMG_V1:' + chainFit.plaintext.toString('base64') + ']]';
        assert(Buffer.byteLength(w, 'utf8') <= MESSAGING_MAX_PLAINTEXT_UTF8_BYTES, 'fitChain wire under messenger UTF-8 limit');
        ok('encode + parsePlaintextHeader roundtrip');
    } catch (e) {
        fail('vault-image-pipeline', e);
    }
}

async function testPackageIdCompareFrontend() {
    console.log('\n--- package-id-compare (frontend) ---');
    try {
        const { shouldShowPackageIdMismatchBanner, normalizePackageIdHex } = await import(
            '../frontend/frontend/lib/package-id-compare.ts'
        );
        const idA = '0x' + 'a'.repeat(64);
        const idB = '0x' + 'b'.repeat(64);
        assert(!shouldShowPackageIdMismatchBanner('', idA, false), 'empty local → no banner');
        assert(!shouldShowPackageIdMismatchBanner('  ', idA, false), 'whitespace local → no banner');
        assert(!shouldShowPackageIdMismatchBanner(idA, idA, false), 'match → no banner');
        assert(shouldShowPackageIdMismatchBanner(idA, idB, false), 'diff → banner');
        assert(!shouldShowPackageIdMismatchBanner(idA, idB, true), 'offline → no banner');
        assert(normalizePackageIdHex('bogus') === null, 'invalid → null');
        assert(normalizePackageIdHex(idA.toUpperCase()) === idA, 'normalize lowercases');
        ok('shouldShowPackageIdMismatchBanner + normalizePackageIdHex');
    } catch (e) {
        fail('package-id-compare', e);
    }
}

async function testShopCatalog() {
    console.log('\n--- shop catalog ---');
    try {
        const { getShopProductById, getPublicShopProducts, resolveStripePriceId } = await import('../src/api/shop/catalog.js');
        const p = getShopProductById('messenger-messages-500');
        assert(p && p.id === 'messenger-messages-500', 'product by id');
        const pub = getPublicShopProducts();
        assert(pub.length >= 1 && pub[0].id === 'messenger-messages-500', 'public list');
        const price = resolveStripePriceId(p!);
        assert(typeof price === 'string', 'price string');
        ok('getShopProductById + getPublicShopProducts');
    } catch (e) {
        fail('shop catalog', e);
    }
}

async function testChatWaldConnection() {
    console.log('\n--- chat-wald-connection (frontend) ---');
    try {
        const { computeWaldConnectionTier } = await import('../frontend/frontend/lib/chat-wald-connection.ts');
        assert(computeWaldConnectionTier(false, false) === 'green', 'basis ok');
        assert(computeWaldConnectionTier(true, true) === 'blue', 'basis weg, mesh da');
        assert(computeWaldConnectionTier(true, false) === 'red', 'alles weg');
        ok('computeWaldConnectionTier');
    } catch (e) {
        fail('chat-wald-connection', e);
    }
}

async function testChatForwardText() {
    console.log('\n--- chat-forward-text (frontend) ---');
    try {
        const { buildForwardComposerPayload } = await import('../frontend/frontend/lib/chat-forward-text.ts');
        const base = {
            id: '1',
            from: '0x' + 'a'.repeat(64),
            content: 'Hallo Welt',
            timestamp: 1_700_000_000_000,
            recipient: '0x' + 'b'.repeat(64),
        };
        const withSender = buildForwardComposerPayload(base, true);
        assert(withSender.includes('Von ' + base.from), 'header has from');
        assert(withSender.includes('An ' + base.recipient), 'header has recipient');
        assert(withSender.includes('Hallo Welt'), 'body text');
        const noSender = buildForwardComposerPayload(base, false);
        assert(!noSender.includes('Von '), 'no from when omitted');
        assert(noSender.includes('Hallo Welt'), 'body without sender');
        ok('buildForwardComposerPayload');
    } catch (e) {
        fail('chat-forward-text', e);
    }
}

async function main() {
    console.log('Morgendrot – Modultests (ohne Chain/CLI)');
    /** Vor jedem Import, der logger → config zieht (z. B. replay-state). Sonst bleibt CFG.PACKAGE_ID leer ohne .env. */
    if (!process.env.PACKAGE_ID?.trim()) {
        process.env.PACKAGE_ID = '0x' + 'a'.repeat(64);
    }
    const monitorDir = path.join(tmpdir(), 'morgendrot-monitor-' + Date.now());
    fs.mkdirSync(monitorDir, { recursive: true });
    const monitorStatePath = path.join(monitorDir, 'heartbeat.json');
    process.env.MONITOR_DEVICES = '0x' + 'a'.repeat(62) + ',0x' + 'b'.repeat(62);
    process.env.MONITOR_STATE_FILE = monitorStatePath;

    await testCryptoLayer();
    await testMeshPeerWireRoundtrip();
    await testPackageIdCompareFrontend();
    await testShopCatalog();
    await testChatWaldConnection();
    await testChatForwardText();
    await testVaultLocal();
    await testVaultImagePipeline();
    await testReplayState();
    await testUtils();
    await testParseEnvText();
    await testReadCommandList();
    await testChainAccessValidation();
    await testChainAccessAmounts();
    await testConfigDisplay();
    await testMessengerExportEnv();
    await testSetEnvKeyBlocklist();
    await testMessengerGasMilestone();
    await testIotaNamesLookup();
    await testReplayStateFile();
    await testMonitoringState(monitorStatePath);
    await testChainAnchor();

    try { fs.unlinkSync(monitorStatePath); fs.rmdirSync(monitorDir); } catch {}

    console.log('\n--- Ergebnis ---');
    console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error('Runner-Fehler:', e);
    process.exit(1);
});
