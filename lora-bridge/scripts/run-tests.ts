/**
 * Tests für LoRa-Bridge (Simulation, Config, HTTP-API).
 */
process.env.LORA_BRIDGE_PORT = '19342';
process.env.LORA_BRIDGE_SIMULATION = 'true';
process.env.LORA_BRIDGE_TEST = '1';

import { strict as assert } from 'node:assert';

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

async function testSimDriver() {
    console.log('\n--- lora-driver (Simulation) ---');
    const { SimLoraDriver } = await import('../src/lora-driver.js');
    const driver = new SimLoraDriver();
    const received: string[] = [];
    driver.onReceive((p) => received.push(p));
    await driver.send('hello');
    assert(received.includes('hello'), 'send triggers onReceive');
    driver.simulateIncoming('from-remote', 'dev1');
    assert(received.includes('from-remote'), 'simulateIncoming');
    assert(driver.getSentPayloads().includes('hello'), 'getSentPayloads');
    await driver.close();
    ok('SimLoraDriver send/receive/close');
}

async function testConfig() {
    console.log('\n--- config ---');
    const { CFG } = await import('../src/config.js');
    assert(CFG.PORT > 0, 'PORT');
    assert(typeof CFG.SIMULATION_MODE === 'boolean', 'SIMULATION_MODE');
    assert(CFG.MAX_PAYLOAD_BYTES <= 256, 'MAX_PAYLOAD_BYTES LoRa limit');
    ok('config values valid');
}

async function testEmergencyEnvelope() {
    console.log('\n--- emergency-envelope ---');
    const { validateEmergencyEnvelope, tryParseEmergencyWire } = await import('../src/emergency-envelope.js');
    const max = 240;
    const b64 = Buffer.from('not-secret-cipher').toString('base64');
    const good = validateEmergencyEnvelope({ v: 1, t: 'text', f: '0xabc123', n: 42, b: b64 }, max);
    assert(good.ok === true, 'valid text envelope');
    assert(good.ok && good.wire.includes('"v":1'), 'wire is JSON');

    const badV = validateEmergencyEnvelope({ v: 2, t: 'text', f: '0x1', n: 1, b: b64 }, max);
    assert(badV.ok === false, 'reject wrong v');

    const pay = validateEmergencyEnvelope(
        {
            v: 1,
            t: 'pay',
            f: '0xdead',
            n: 7,
            b: b64,
            pay: { to: '0x' + 'a'.repeat(64), amount: '1.5' },
        },
        max
    );
    assert(pay.ok === true, 'valid pay envelope');

    const payMissing = validateEmergencyEnvelope({ v: 1, t: 'pay', f: '0x1', n: 1, b: b64 }, max);
    assert(payMissing.ok === false, 'pay requires pay object');

    const huge = Buffer.alloc(200).toString('base64');
    const tooBig = validateEmergencyEnvelope({ v: 1, t: 'text', f: '0x1', n: 1, b: huge }, max);
    assert(tooBig.ok === false, 'reject oversized b');

    const parsed = tryParseEmergencyWire(
        '{"v":1,"t":"text","f":"0xz","n":99,"b":"QQ=="}',
        max
    );
    assert(parsed !== null && parsed.n === 99, 'tryParseEmergencyWire');
    ok('emergency-envelope validation');
}

async function testEmergencyBinaryV2() {
    console.log('\n--- emergency-binary v2 ---');
    const { buildEmergencyBinaryV2, tryParseEmergencyBinaryV2 } = await import('../src/emergency-binary.js');
    const addr = '0x' + 'a'.repeat(64);
    const ct = new Uint8Array([1, 2, 3, 4]);
    const max = 240;
    const built = buildEmergencyBinaryV2(addr, 0x01020304, ct, max);
    assert(built.ok === true, 'build v2');
    const parsed = tryParseEmergencyBinaryV2(built.ok ? built.wire : new Uint8Array(), max);
    assert(parsed !== null && parsed.nonce === 0x01020304 && parsed.ciphertext.length === 4, 'parse v2 roundtrip');
    ok('emergency-binary v2');
}

async function testEmergencyBinaryV2Stress() {
    console.log('\n--- emergency-binary v2 (stress) ---');
    const { buildEmergencyBinaryV2, tryParseEmergencyBinaryV2, senderFingerprint32 } = await import(
        '../src/emergency-binary.js'
    );
    const addr = '0x' + 'f'.repeat(64);
    const max = 240;
    const maxCt = max - 37;
    const ctMax = new Uint8Array(maxCt).fill(0xab);
    const atLimit = buildEmergencyBinaryV2(addr, 0xffffffff, ctMax, max);
    assert(atLimit.ok === true, 'exactly at MTU limit');
    assert(atLimit.ok && atLimit.wire.length === max, 'wire length equals max');
    const pMax = tryParseEmergencyBinaryV2(atLimit.wire, max);
    assert(pMax !== null && pMax.ciphertext.length === maxCt, 'parse at limit');

    const tooBig = buildEmergencyBinaryV2(addr, 1, new Uint8Array(maxCt + 1), max);
    assert(tooBig.ok === false, 'reject over limit');

    const badAddr = buildEmergencyBinaryV2('0xbad', 0, new Uint8Array([1]), max);
    assert(badAddr.ok === false, 'reject bad iota address');

    const wire = atLimit.ok ? atLimit.wire : new Uint8Array();
    const tampered = Uint8Array.from(wire);
    tampered[0] = 3;
    assert(tryParseEmergencyBinaryV2(tampered, max) === null, 'reject wrong version byte');

    const fp = senderFingerprint32(addr);
    const p0 = tryParseEmergencyBinaryV2(wire, max);
    assert(p0 !== null && Buffer.from(fp).toString('hex') === p0.fingerprintHex, 'fingerprint matches sha256(addr)');

    ok('emergency-binary v2 stress');
}

async function testHttpApi() {
    console.log('\n--- HTTP-API (Integration) ---');
    process.env.LORA_BRIDGE_PORT = '19342';
    const { startServer } = await import('../src/index.js');
    const server = await startServer();
    const base = 'http://127.0.0.1:19342';
    try {
        const getRes = await fetch(base + '/?anchor=test');
        assert(getRes.ok, 'GET ok');
        const getData = (await getRes.json()) as { messages?: unknown[] };
        assert(Array.isArray(getData.messages), 'GET returns messages array');

        const postRes = await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anchor: 'a1', payload: 'open' }),
        });
        assert(postRes.ok, 'POST ok');

        const b64 = Buffer.from('cipher').toString('base64');
        const postEm = await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                anchor: 'em1',
                emergency: { v: 1, t: 'text', f: '0xfunktest', n: 1001, b: b64 },
            }),
        });
        assert(postEm.ok, 'POST emergency ok');
        const postEmJson = (await postEm.json()) as { ok?: boolean; emergency?: boolean };
        assert(postEmJson.ok === true && postEmJson.emergency === true, 'POST emergency response');

        const getRes2 = await fetch(base + '/');
        const getData2 = (await getRes2.json()) as { messages?: { payload: string; sender?: string; nonce?: number }[] };
        assert(getData2.messages && getData2.messages.some((m) => m.payload.includes('open')), 'POST payload in messages');
        const emMsg = getData2.messages?.find((m) => m.sender === '0xfunktest' && m.nonce === 1001);
        assert(emMsg && emMsg.payload.includes('"t":"text"'), 'emergency message normalized');

        const addr64 = '0x' + 'b'.repeat(64);
        const postV2 = await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                anchor: 'v2',
                emergencyV2: {
                    senderAddress: addr64,
                    nonce: 42,
                    ciphertext: Buffer.from([9, 9, 9]).toString('base64'),
                },
            }),
        });
        assert(postV2.ok, 'POST emergencyV2 ok');
        const v2json = (await postV2.json()) as { emergencyV2?: boolean };
        assert(v2json.emergencyV2 === true, 'emergencyV2 flag');
        const getV2 = (await fetch(base + '/')).json() as Promise<{
            messages?: { sender?: string; nonce?: number }[];
        }>;
        const gv2 = await getV2;
        const v2m = gv2.messages?.find((m) => m.nonce === 42 && (m.sender || '').startsWith('v2:'));
        assert(!!v2m, 'v2 message in list');

        ok('GET/POST Morgendrot-kompatibel + emergency + v2');
    } finally {
        server.close();
        await new Promise((r) => setTimeout(r, 100));
    }
}

async function main() {
    console.log('LoRa-Bridge – Modultests');
    await testSimDriver();
    await testConfig();
    await testEmergencyEnvelope();
    await testEmergencyBinaryV2();
    await testEmergencyBinaryV2Stress();
    await testHttpApi();

    console.log('\n--- Ergebnis ---');
    console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
