/**
 * Ältere Node-Versionen: `globalThis.crypto` ohne `subtle`. Shared-Crypto (morgendrot-crypto, emergency-binary)
 * brauchen Web Crypto — einmalig vor jedem Import dieser Module setzen.
 */
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
