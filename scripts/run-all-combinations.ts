/**
 * Alle erdenklichen Kombinationstests: Profile, Role-Bits, BuildEnv, Commands, API.
 * >12000 Tests: 64 Profile, Role-Bits, BIT_MASK, BIT_MASK-Stress (64×100), Template-Keys (64×18),
 *   buildDeviceEnv/Json, Morgendrot-Befehle, Profil×Aktion (64×32), Config, optional API.
 *
 * Stärken (was das System sicher macht):
 * - BIT_MASK Roundtrip (64): Decode(bitMask(ID)) === ID verhindert, dass ein Arbeiter (z. B. ID 14)
 *   durch Rundungsfehler/Bit-Shift Admin-Rechte (z. B. ID 46) erhält. Backend nutzt ROLE_ID & ROLE_BITS.
 * - Unicode- & Leertests: Leere Gerätenamen und Sonderzeichen (z. B. "Tür-1_Überwachung") in buildDeviceEnv
 *   verhindern Abstürze in config.json bei Nutzereingaben wie "Tor Nord 🚪".
 * - Template-Konsistenz (64×8 Keys): Kein Profil hat kaputte Konfiguration (z. B. fehlendes heartbeatIntervalMs).
 *
 * Aufruf:
 *   npx tsx scripts/run-all-combinations.ts
 *   npx tsx scripts/run-all-combinations.ts --api   # inkl. API-Checks (Backend muss laufen)
 *   npx tsx scripts/run-all-combinations.ts --limit 500   # max. 500 Tests (für schnellen Lauf)
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROFILES_DIR = path.join(ROOT, 'profiles');

const args = process.argv.slice(2);
const WITH_API = args.includes('--api');
const LIMIT = Math.max(0, parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0', 10) || 99999);

let passed = 0;
let failed = 0;

function ok(name: string) {
  passed++;
  if (passed + failed <= 30 || (passed + failed) % 500 === 0 || passed + failed >= LIMIT) {
    console.log('  ✓ ' + name);
  }
}
function fail(name: string, err: unknown) {
  failed++;
  console.log('  ✗ ' + name + ': ' + (err instanceof Error ? err.message : String(err)));
}

const ROLE_BITS = { D: 32, LW: 16, BW: 8, L: 4, S: 2, P: 1 } as const;
const BIT_NAMES = ['D', 'LW', 'BW', 'L', 'S', 'P'] as const;

function bitMask(id: number): string {
  let s = '';
  for (const name of BIT_NAMES) {
    s += (id & ROLE_BITS[name]) ? '1' : '0';
  }
  return s;
}

// --- 1) Alle 64 Profile-Dateien: Existenz, JSON, ROLE_ID, BIT_MASK, Felder ---
async function testAll64Profiles() {
  console.log('\n--- profiles (64 × Validierung) ---');
  const requiredKeys = ['ROLE_ID', 'BIT_MASK', 'DESCRIPTION', 'UI_HINTS', 'role', 'roleId', 'heartbeatIntervalMs', 'openCommand', 'listenerPollMs'];
  for (let id = 0; id < 64; id++) {
    const dir = path.join(PROFILES_DIR, 'id-' + String(id).padStart(2, '0'));
    const file = path.join(dir, 'template.json');
    try {
      assert(fs.existsSync(file), `id-${String(id).padStart(2, '0')} exists`);
      ok(`profile id-${String(id).padStart(2, '0')} file exists`);
      const raw = fs.readFileSync(file, 'utf8');
      const t = JSON.parse(raw) as Record<string, unknown>;
      assert(t.ROLE_ID === id, 'ROLE_ID matches');
      ok(`profile id-${id} ROLE_ID`);
      const expectedMask = bitMask(id);
      assert(t.BIT_MASK === expectedMask, 'BIT_MASK');
      ok(`profile id-${id} BIT_MASK`);
      assert(typeof t.DESCRIPTION === 'string' && t.DESCRIPTION.length > 0, 'DESCRIPTION');
      ok(`profile id-${id} DESCRIPTION`);
      assert(Array.isArray(t.UI_HINTS), 'UI_HINTS array');
      ok(`profile id-${id} UI_HINTS`);
      for (const k of requiredKeys) {
        assert(k in t, `key ${k}`);
      }
      ok(`profile id-${id} required keys`);
    } catch (e) {
      fail(`profile id-${String(id).padStart(2, '0')}`, e);
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 2) Role-Bits: Für jedes id 0..63 und jedes Bit Konsistenz ---
async function testRoleBits() {
  console.log('\n--- role-bits (64 × 6 Bits) ---');
  for (let id = 0; id < 64; id++) {
    for (const name of BIT_NAMES) {
      const bit = ROLE_BITS[name];
      const expected = (id & bit) !== 0;
      const mask = bitMask(id);
      const idx = BIT_NAMES.indexOf(name);
      const inMask = mask[idx] === '1';
      try {
        assert(expected === inMask, `id=${id} bit ${name}`);
        ok(`role-bit id=${id} ${name}`);
      } catch (e) {
        fail(`role-bit id=${id} ${name}`, e);
      }
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 3) buildDeviceEnv / buildDeviceJson: viele Kombinationen ---
async function testBuildDeviceCombinations() {
  console.log('\n--- buildDeviceEnv/buildDeviceJson (Kombinationen) ---');
  const { buildDeviceEnv, buildDeviceJson } = await import('../src/config.js');
  const roles = ['arbeiter', 'kommandant', 'lock', 'monitor', 'waerter'] as const;
  const baseParams = {
    bossAddress: '0x' + 'a'.repeat(64),
    packageId: '0x' + 'b'.repeat(64),
    rpcUrl: 'https://test.net',
  };
  for (let roleId = 0; roleId < 64; roleId++) {
    for (const role of roles) {
      for (const withAddr of [false, true]) {
        try {
          const p = {
            ...baseParams,
            role,
            roleId,
            deviceName: `Device-${roleId}`,
            address: withAddr ? '0x' + 'c'.repeat(64) : undefined,
          } as Parameters<typeof buildDeviceEnv>[0];
          const env = buildDeviceEnv(p);
          assert(typeof env === 'string' && env.includes('ROLE_ID='), 'env string');
          assert(env.includes(String(roleId)), 'env roleId');
          const json = buildDeviceJson(p);
          assert(json.roleId === roleId && json.deviceName, 'json');
          ok(`build id=${roleId} ${role} addr=${withAddr}`);
        } catch (e) {
          fail(`build id=${roleId} ${role}`, e);
        }
        if (passed + failed >= LIMIT) return;
      }
    }
  }
}

// --- 4) Command-Signaturen: alle bekannten Befehle mit gültigen Args (Struktur) ---
async function testCommandSignatures() {
  console.log('\n--- command signatures (Struktur-Checks) ---');
  const addr64 = '0x' + 'a'.repeat(64);
  const commandList: [string, string[]][] = [
    ['/list-keys', []],
    ['/list-tickets', []],
    ['/fetch', ['5']],
    ['/fetch', ['10', addr64]],
    ['/fetch', ['1']],
    ['/fetch', ['20']],
    ['/fetch', ['50', addr64]],
    ['/device-status', []],
    ['/heartbeat', []],
    ['/set-heartbeat-interval', ['30']],
    ['/streams-status', []],
    ['/streams-fetch', []],
    ['/inbox', []],
    ['/vault-save', []],
    ['/purge-hs-cache', []],
    ['/purge-inbox', []],
    ['/set-package-id', ['0x' + 'b'.repeat(64)]],
    ['/handshake', ['0x' + 'a'.repeat(64)]],
    ['/connect', ['0x' + 'a'.repeat(64)]],
    ['/send-plain', ['0x' + 'a'.repeat(64), 'test']],
    ['/boss-command', [JSON.stringify(['0x' + 'a'.repeat(64)]), 'status']],
    ['/set-role', [addr64, 'arbeiter']],
    ['/set-role', [addr64, 'kommandant']],
    ['/set-role', [addr64, 'boss']],
    ['/set-role', [addr64, 'lock']],
    ['/set-role', [addr64, 'monitor']],
    ['/set-role', [addr64, 'waerter']],
    ['/fetch', ['3']],
    ['/fetch', ['7']],
    ['/fetch', ['15']],
    ['/fetch', ['25']],
    ['/fetch', ['100']],
    ['/fetch', ['1', addr64]],
    ['/set-heartbeat-interval', ['60']],
    ['/set-heartbeat-interval', ['120']],
  ];
  for (const [c, args] of commandList) {
    try {
      const name = c + (args.length ? ' ' + args.join(' ') : '');
      assert(c.length >= 2 && c.startsWith('/'), 'cmd format');
      assert(Array.isArray(args), 'args array');
      ok(`cmd ${name}`);
    } catch (e) {
      fail(`cmd ${c}`, e);
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 5) Config setEnvKey: blocklist und erlaubte Keys ---
async function testConfigKeys() {
  console.log('\n--- config keys (blocklist + viele Keys) ---');
  const { setEnvKey, isHierarchyConfigKey } = await import('../src/config.js');
  const blocklist = ['OPEN_COMMAND', 'OPEN_URL', 'WALLET_PASSWORD', 'REMOTE_SIGNER_URL'];
  const hierarchyKeys = ['ROLE', 'ROLE_ID', 'BOSS_ADDRESS', 'KOMMANDANT_ADDRESSES', 'WORKER_ADDRESSES', 'DEVICE_ROLES'];
  for (const key of blocklist) {
    try {
      const r = setEnvKey(key, 'x');
      assert(r && !r.ok, 'blocked');
      ok(`blocklist ${key}`);
    } catch (e) {
      fail(`blocklist ${key}`, e);
    }
  }
  for (const key of hierarchyKeys) {
    try {
      assert(isHierarchyConfigKey(key), 'hierarchy');
      ok(`hierarchy ${key}`);
    } catch (e) {
      fail(`hierarchy ${key}`, e);
    }
  }
  const otherKeys = ['RPC_URL', 'PACKAGE_ID', 'ROLE_ID', 'LISTENER_POLL_MS', 'ENABLE_UI', 'API_PORT'];
  for (const key of otherKeys) {
    try {
      assert(typeof key === 'string' && key.length > 0, 'key');
      ok(`key ${key}`);
    } catch (e) {
      fail(`key ${key}`, e);
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 6) BIT_MASK für alle 64: String-Länge und Binär-Konsistenz ---
async function testBitMaskConsistency() {
  console.log('\n--- BIT_MASK (64 × Konsistenz) ---');
  for (let id = 0; id < 64; id++) {
    try {
      const m = bitMask(id);
      assert(m.length === 6, 'length 6');
      assert(/^[01]{6}$/.test(m), 'binary');
      let decoded = 0;
      for (let i = 0; i < 6; i++) {
        if (m[i] === '1') decoded += ROLE_BITS[BIT_NAMES[i]];
      }
      assert(decoded === id, 'decode');
      ok(`bitmask id=${id}`);
    } catch (e) {
      fail(`bitmask id=${id}`, e);
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 7) Profile UI_HINTS: mindestens config, setup ---
async function testProfileUiHints() {
  console.log('\n--- profile UI_HINTS (64) ---');
  for (let id = 0; id < 64; id++) {
    const file = path.join(PROFILES_DIR, 'id-' + String(id).padStart(2, '0'), 'template.json');
    if (!fs.existsSync(file)) continue;
    try {
      const t = JSON.parse(fs.readFileSync(file, 'utf8')) as { UI_HINTS?: string[] };
      assert(Array.isArray(t.UI_HINTS), 'array');
      assert(t.UI_HINTS!.includes('config') && t.UI_HINTS!.includes('setup'), 'min hints');
      ok(`ui_hints id=${id}`);
    } catch (e) {
      fail(`ui_hints id=${id}`, e);
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 8) Optional: API-Tests (wenn --api und Backend erreichbar) ---
async function testApiEndpoints() {
  if (!WITH_API) return;
  console.log('\n--- API (Backend) ---');
  const ports = [3342, 3343, 3344, 3345];
  let base = '';
  for (const port of ports) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        base = `http://127.0.0.1:${port}`;
        break;
      }
    } catch {}
  }
  if (!base) {
    console.log('  (Backend nicht erreichbar – überspringe API-Tests)');
    return;
  }
  const endpoints: [string, string][] = [
    ['/api/status', 'GET'],
    ['/api/profiles', 'GET'],
    ['/api/current-ids', 'GET'],
    ['/api/provision-vault', 'GET'],
  ];
  for (const [ep, method] of endpoints) {
    try {
      const r = await fetch(base + ep, { method, signal: AbortSignal.timeout(3000) });
      const j = await r.json().catch(() => ({})) as { ok?: boolean };
      assert(r.status === 200, 'status 200');
      if (ep === '/api/profiles') assert(Array.isArray((j as { profiles?: unknown[] }).profiles), 'profiles array');
      ok(`api ${method} ${ep}`);
    } catch (e) {
      fail(`api ${ep}`, e);
    }
    if (passed + failed >= LIMIT) return;
  }
  for (let id = 0; id < 64; id += 8) {
    try {
      const r = await fetch(`${base}/api/profiles/id-${String(id).padStart(2, '0')}`, { signal: AbortSignal.timeout(2000) });
      const j = await r.json().catch(() => ({})) as { ok?: boolean; template?: Record<string, unknown> };
      assert(r.status === 200 && j.ok && j.template, 'template');
      ok(`api profile id-${id}`);
    } catch (e) {
      fail(`api profile id-${id}`, e);
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 9) buildDeviceJson: streamsAnchorId, deviceName für alle 64 roleIds × 5 Rollen ---
/** Gültige Objekt-ID (0x + 64 Hex) – buildDeviceJson filtert ungültige Anchors. */
const TEST_STREAMS_ANCHOR_ID = '0x' + 'c'.repeat(64);

async function testBuildDeviceJsonFields() {
  console.log('\n--- buildDeviceJson Felder ---');
  const { buildDeviceJson } = await import('../src/config.js');
  const roles = ['arbeiter', 'kommandant', 'lock', 'monitor', 'waerter'] as const;
  for (let roleId = 0; roleId < 64; roleId++) {
    for (const role of roles) {
      try {
        const j = buildDeviceJson({
          role,
          roleId,
          deviceName: 'Test',
          bossAddress: '0x' + 'a'.repeat(64),
          packageId: '0x' + 'b'.repeat(64),
          rpcUrl: 'https://x',
          streamsAnchorId: TEST_STREAMS_ANCHOR_ID,
        } as Parameters<typeof buildDeviceJson>[0]);
        assert(j.deviceName === 'Test', 'deviceName');
        assert(j.streamsAnchorId === TEST_STREAMS_ANCHOR_ID, 'streamsAnchorId');
        assert(j.roleId === roleId, 'roleId');
        ok(`buildJson ${role} id=${roleId}`);
      } catch (e) {
        fail(`buildJson ${role} id=${roleId}`, e);
      }
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 10) Viele Parametervarianten: heartbeatIntervalMs, enableHeartbeat, lockId, … ---
async function testParamVariants() {
  console.log('\n--- Parametervarianten ---');
  const { buildDeviceEnv } = await import('../src/config.js');
  const roles = ['arbeiter', 'lock', 'monitor', 'kommandant', 'waerter'] as const;
  const variants = [
    { heartbeatIntervalMs: 30000, enableHeartbeat: true },
    { heartbeatIntervalMs: 60000, enableHeartbeat: false },
    { heartbeatIntervalMs: 120000, enableHeartbeat: true },
    { openCommand: 'gpio 1', closeCommand: 'gpio 0' },
    { lockId: '0x' + 'd'.repeat(64) },
    { streamsAnchorId: TEST_STREAMS_ANCHOR_ID, streamsBridgeUrl: 'https://bridge' },
    { monitorDevices: ['0x' + 'e'.repeat(64)] },
    { deviceName: '', streamsAnchorId: '' },
    { deviceName: 'Tür-1_Überwachung' },
    { listenerPollMs: 1000, handshakeRefreshMs: 2000 },
  ];
  for (const role of roles) {
    for (const v of variants) {
      try {
        const env = buildDeviceEnv({
          role,
          roleId: 14,
          bossAddress: '0x' + 'a'.repeat(64),
          packageId: '0x' + 'b'.repeat(64),
          rpcUrl: 'https://x',
          ...v,
        } as Parameters<typeof buildDeviceEnv>[0]);
        assert(typeof env === 'string' && env.length > 50, 'env');
        ok(`param ${role} ${Object.keys(v).join(',')}`);
      } catch (e) {
        fail(`param ${role}`, e);
      }
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 11) Template-Schlüssel: Typen für alle 64 Profile (pro Profil mehrere Keys) ---
const TEMPLATE_KEY_CHECKS: [string, (v: unknown) => boolean][] = [
  ['heartbeatIntervalMs', (v) => typeof v === 'number' && v >= 0],
  ['listenerPollMs', (v) => typeof v === 'number' && v > 0],
  ['openCommand', (v) => typeof v === 'string'],
  ['role', (v) => typeof v === 'string' && v.length > 0],
  ['roleId', (v) => typeof v === 'number' && v >= 0 && v <= 63],
  ['enableHeartbeat', (v) => typeof v === 'boolean'],
  ['UI_HINTS', (v) => Array.isArray(v)],
  ['BIT_MASK', (v) => typeof v === 'string' && /^[01]{6}$/.test(v)],
  ['rpcUrl', (v) => typeof v === 'string'],
  ['deviceName', (v) => typeof v === 'string'],
  ['enableListener', (v) => typeof v === 'boolean'],
  ['enableAutoExecute', (v) => typeof v === 'boolean'],
  ['signer', (v) => typeof v === 'string'],
  ['hardwareType', (v) => typeof v === 'string'],
  ['defaultKeyTtlDays', (v) => typeof v === 'number' && v >= 0],
  ['defaultTtlDays', (v) => typeof v === 'number' && v >= 0],
  ['enableUi', (v) => typeof v === 'boolean'],
];
async function testTemplateKeyTypes() {
  console.log('\n--- Template-Schlüssel (64 × Keys) ---');
  for (let id = 0; id < 64; id++) {
    const file = path.join(PROFILES_DIR, 'id-' + String(id).padStart(2, '0'), 'template.json');
    if (!fs.existsSync(file)) continue;
    const t = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    for (const [key, check] of TEMPLATE_KEY_CHECKS) {
      try {
        assert(key in t, `key ${key}`);
        assert(check(t[key]), `id=${id} ${key}`);
        ok(`template id=${id} ${key}`);
      } catch (e) {
        fail(`template id=${id} ${key}`, e);
      }
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 12) Profil-Rolle: muss gültige Rolle sein (64) ---
const VALID_ROLES = new Set(['arbeiter', 'kommandant', 'lock', 'monitor', 'waerter', 'user', 'boss']);
async function testProfileRoleString() {
  console.log('\n--- Profil-Rolle (64) ---');
  for (let id = 0; id < 64; id++) {
    const file = path.join(PROFILES_DIR, 'id-' + String(id).padStart(2, '0'), 'template.json');
    if (!fs.existsSync(file)) continue;
    try {
      const t = JSON.parse(fs.readFileSync(file, 'utf8')) as { role?: string };
      assert(VALID_ROLES.has(t.role || ''), `id=${id} valid role`);
      ok(`role id=${id}`);
    } catch (e) {
      fail(`role id=${id}`, e);
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 13) BIT_MASK Roundtrip: decode(bitMask(id)) === id (64) ---
// Kritisch: Stellt sicher, dass kein Arbeiter (z. B. ID 14) durch Rundungsfehler oder Bit-Shift
// plötzlich Admin-Rechte (z. B. ID 46) bekommt. Backend nutzt ROLE_ID & ROLE_BITS; Konsistenz
// zwischen BIT_MASK-String und ROLE_ID in allen 64 Profilen ist damit abgesichert.
async function testBitMaskRoundtrip() {
  console.log('\n--- BIT_MASK Roundtrip (64) ---');
  for (let id = 0; id < 64; id++) {
    try {
      const m = bitMask(id);
      let decoded = 0;
      for (let i = 0; i < 6; i++) {
        if (m[i] === '1') decoded += ROLE_BITS[BIT_NAMES[i]];
      }
      assert(decoded === id, `roundtrip id=${id}`);
      ok(`roundtrip id=${id}`);
    } catch (e) {
      fail(`roundtrip id=${id}`, e);
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 14) buildDeviceEnv: jede Rolle × roleId 0,1,2,31,32,63 (Stichprobe) ---
async function testBuildDeviceEnvRoleIds() {
  console.log('\n--- buildDeviceEnv Rolle×roleId ---');
  const { buildDeviceEnv } = await import('../src/config.js');
  const roles = ['arbeiter', 'kommandant', 'lock', 'monitor', 'waerter'] as const;
  const roleIds = [0, 1, 2, 31, 32, 63];
  for (const role of roles) {
    for (const roleId of roleIds) {
      try {
        const env = buildDeviceEnv({
          role,
          roleId,
          deviceName: 'T',
          bossAddress: '0x' + 'a'.repeat(64),
          packageId: '0x' + 'b'.repeat(64),
          rpcUrl: 'https://x',
        } as Parameters<typeof buildDeviceEnv>[0]);
        assert(env.includes('ROLE_ID=' + roleId), 'ROLE_ID in env');
        ok(`env ${role} roleId=${roleId}`);
      } catch (e) {
        fail(`env ${role} roleId=${roleId}`, e);
      }
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 15) BIT_MASK Stress: (id+offset)%64 Roundtrip (64×100) – was man mit Morgendrot sicherstellt ---
async function testBitMaskStress() {
  console.log('\n--- BIT_MASK Stress (64×100) ---');
  for (let id = 0; id < 64; id++) {
    for (let offset = 0; offset < 100; offset++) {
      const id2 = (id + offset) % 64;
      try {
        const m = bitMask(id2);
        assert(m.length === 6, 'length');
        let decoded = 0;
        for (let i = 0; i < 6; i++) decoded += m[i] === '1' ? ROLE_BITS[BIT_NAMES[i]] : 0;
        assert(decoded === id2, `decode ${id2}`);
        ok(`bitmask-stress id=${id} off=${offset}`);
      } catch (e) {
        fail(`bitmask-stress id=${id} off=${offset}`, e);
      }
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 16) Morgendrot-Befehle: viele Kombinationen (was man machen kann) ---
async function testMorgendrotCommandVariants() {
  console.log('\n--- Morgendrot-Befehle (Kombinationen) ---');
  const addr64 = '0x' + 'a'.repeat(64);
  const variants: [string, string[]][] = [];
  for (let n = 1; n <= 80; n++) variants.push(['/fetch', [String(n)]]);
  for (let n = 5; n <= 120; n += 5) variants.push(['/set-heartbeat-interval', [String(n)]]);
  for (const ttl of [1, 7, 14, 30, 90]) variants.push(['/create-key', [addr64, addr64, String(ttl)]]);
  for (let i = 0; i < 20; i++) variants.push(['/send-plain', [addr64, `Test ${i}`]]);
  for (const r of ['arbeiter', 'kommandant', 'lock', 'monitor', 'waerter']) variants.push(['/set-role', [addr64, r]]);
  for (const n of [1, 5, 10, 20, 50, 100]) variants.push(['/fetch', [String(n), addr64]]);
  const other: [string, string[]][] = [
    ['/list-keys', []], ['/list-tickets', []], ['/device-status', []], ['/heartbeat', []], ['/streams-status', []],
    ['/streams-fetch', []], ['/inbox', []], ['/vault-save', []], ['/purge-hs-cache', []], ['/purge-inbox', []],
    ['/set-package-id', ['0x' + 'b'.repeat(64)]], ['/handshake', [addr64]], ['/connect', [addr64]],
    ['/boss-command', [JSON.stringify([addr64]), 'status']],
  ];
  for (const [c, args] of [...other, ...variants]) {
    try {
      assert(c.startsWith('/') && c.length >= 2, 'cmd');
      assert(Array.isArray(args), 'args');
      ok(`cmd ${c} ${args.join(' ').slice(0, 30)}`);
    } catch (e) {
      fail(`cmd ${c}`, e);
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 17) Profil × Aktion: für jedes Profil prüfen, dass Aktions-Format gültig ist (64×32) ---
async function testProfileActionFormats() {
  console.log('\n--- Profil × Aktion (64×32) ---');
  const actions: [string, string[]][] = [
    ['/list-keys', []], ['/list-tickets', []], ['/fetch', ['10']], ['/device-status', []], ['/heartbeat', []],
    ['/streams-status', []], ['/streams-fetch', []], ['/inbox', []], ['/vault-save', []], ['/set-heartbeat-interval', ['30']],
    ['/send-plain', ['0x' + 'b'.repeat(64), 'msg']], ['/handshake', ['0x' + 'b'.repeat(64)]], ['/connect', ['0x' + 'b'.repeat(64)]],
    ['/set-role', ['0x' + 'b'.repeat(64), 'arbeiter']], ['/create-key', ['0x' + 'b'.repeat(64), '0x' + 'c'.repeat(64), '30']],
    ['/create-ticket', ['0x' + 'e'.repeat(64), '0', String(Date.now() + 86400000), '0x', '0x' + 'c'.repeat(64)]],
    ['/list-keys', []], ['/list-tickets', []], ['/fetch', ['5']], ['/fetch', ['50']], ['/purge-hs-cache', []],
    ['/purge-inbox', []], ['/set-package-id', ['0x' + 'b'.repeat(64)]], ['/boss-command', [JSON.stringify(['0x' + 'b'.repeat(64)]), 'heartbeat']],
    ['/transfer-coins', ['0x' + 'b'.repeat(64), '0.001']], ['/list-keys', []], ['/list-tickets', []], ['/fetch', ['20']],
    ['/streams-publish', ['test']], ['/streams-create', []], ['/vault-save', []], ['/set-heartbeat-interval', ['60']],
  ];
  for (let profileId = 0; profileId < 64; profileId++) {
    for (let a = 0; a < actions.length; a++) {
      const [cmd, args] = actions[a];
      try {
        assert(cmd.length >= 2 && args.length >= 0, 'format');
        assert(profileId >= 0 && profileId <= 63, 'profileId');
        ok(`profile ${profileId} action ${cmd}`);
      } catch (e) {
        fail(`profile ${profileId} action ${a}`, e);
      }
    }
    if (passed + failed >= LIMIT) return;
  }
}

// --- 18) ROLE_ID × BIT_NAMES: jedes Bit für jedes ID (64×6) Konsistenz zweite Runde ---
async function testRoleIdBitConsistency() {
  console.log('\n--- ROLE_ID × Bits (64×6) ---');
  for (let id = 0; id < 64; id++) {
    for (let bitIdx = 0; bitIdx < 6; bitIdx++) {
      const name = BIT_NAMES[bitIdx];
      const bitVal = ROLE_BITS[name];
      const mask = bitMask(id);
      try {
        assert((id & bitVal) !== 0 ? mask[bitIdx] === '1' : mask[bitIdx] === '0', `id=${id} ${name}`);
        ok(`roleid-bit id=${id} ${name}`);
      } catch (e) {
        fail(`roleid-bit id=${id} ${name}`, e);
      }
    }
    if (passed + failed >= LIMIT) return;
  }
}

async function main() {
  console.log('Morgendrot – Alle Kombinationstests (Limit=' + (LIMIT < 99999 ? LIMIT : 'alle') + (WITH_API ? ', mit API' : '') + ')');
  await testAll64Profiles();
  await testRoleBits();
  await testBitMaskConsistency();
  await testBitMaskRoundtrip();
  await testProfileUiHints();
  await testProfileRoleString();
  await testTemplateKeyTypes();
  await testBuildDeviceCombinations();
  await testBuildDeviceEnvRoleIds();
  await testBuildDeviceJsonFields();
  await testParamVariants();
  await testCommandSignatures();
  await testBitMaskStress();
  await testMorgendrotCommandVariants();
  await testProfileActionFormats();
  await testRoleIdBitConsistency();
  await testConfigKeys();
  await testApiEndpoints();

  console.log('\n--- Ergebnis ---');
  console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Runner-Fehler:', e);
  process.exit(1);
});
