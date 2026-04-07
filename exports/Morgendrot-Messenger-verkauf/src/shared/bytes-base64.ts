/**
 * Base64 für Uint8Array ohne Node-Buffer-Pflicht (Browser + Node mit btoa/atob).
 */

function chunkCharCodes(u8: Uint8Array, start: number, len: number): string {
  const end = Math.min(start + len, u8.length);
  const slice = u8.subarray(start, end);
  return String.fromCharCode.apply(null, slice as unknown as number[]);
}

export function uint8ToBase64(u8: Uint8Array): string {
  const step = 0x8000;
  let bin = '';
  for (let i = 0; i < u8.length; i += step) {
    bin += chunkCharCodes(u8, i, step);
  }
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('btoa nicht verfügbar (Web Crypto Umgebung prüfen).');
  }
  return globalThis.btoa(bin);
}

export function base64ToUint8(b64: string): Uint8Array {
  if (typeof globalThis.atob !== 'function') {
    throw new Error('atob nicht verfügbar.');
  }
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function uint8ToHex(u8: Uint8Array): string {
  return Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
}
