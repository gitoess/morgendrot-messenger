/**
 * Test: Gleiche Logik wie die Lite-UI beim Verarbeiten von /inbox-/fetch-Antworten.
 * Läuft ohne API-Server. Prüft, dass die UI mit der Backend-Antwortstruktur klarkommt.
 */
const tests: { name: string; response: unknown; expectLength: number; expectFirstText?: string }[] = [
  {
    name: 'ok:true, data-Array mit 1 Nachricht',
    response: { ok: true, message: '1 Nachricht(en) geladen.', data: [{ sender: '0xabc', text: 'Hallo' }], messages: [] },
    expectLength: 1,
    expectFirstText: 'Hallo',
  },
  {
    name: 'ok:true, messages-Array (ohne data)',
    response: { ok: true, message: '2 Nachricht(en) geladen.', messages: [{ sender: '0xdef', text: 'Test' }, { from: '0x999', content: 'Zwei' }] },
    expectLength: 2,
    expectFirstText: 'Test',
  },
  {
    name: 'ok:false, data/messages leer – UI setzt trotzdem Liste',
    response: { ok: false, message: 'Keine neuen Nachrichten.', data: [], messages: [] },
    expectLength: 0,
  },
  {
    name: 'ok:true, data mit isPlain (Backend-Format)',
    response: { ok: true, data: [{ sender: '0x123', text: 'Plain', isPlain: true }] },
    expectLength: 1,
    expectFirstText: 'Plain',
  },
];

// Exakt die gleiche Extraktion wie in ui/index.html runCmd
function parseInboxResponse(d: Record<string, unknown>): { id: string; sender: string; from: string; text: string; content: string }[] {
  const raw = d.data ?? d.messages ?? (d.result as Record<string, unknown>)?.data ?? (d.result as Record<string, unknown>)?.messages ?? [];
  const list = Array.isArray(raw) ? raw : [];
  return list.map((m: Record<string, unknown>, i: number) => ({
    id: ((m.sender ?? m.from) || 'msg') + '_' + i,
    sender: String(m.sender ?? m.from ?? ''),
    from: String(m.sender ?? m.from ?? ''),
    text: m.text != null ? String(m.text) : (m.content != null ? String(m.content) : ''),
    content: m.text != null ? String(m.text) : (m.content != null ? String(m.content) : ''),
  }));
}

let passed = 0;
let failed = 0;
for (const t of tests) {
  const res = t.response as Record<string, unknown>;
  const list = parseInboxResponse(res);
  const okLength = list.length === t.expectLength;
  const okFirst = t.expectFirstText == null || list[0]?.text === t.expectFirstText;
  if (okLength && okFirst) {
    passed++;
    console.log('  ✓ ' + t.name);
  } else {
    failed++;
    console.log('  ✗ ' + t.name + ' (length=' + list.length + ' expected ' + t.expectLength + (t.expectFirstText ? ', firstText=' + list[0]?.text : '') + ')');
  }
}
console.log('\nErgebnis: ' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
process.exit(failed > 0 ? 1 : 0);
