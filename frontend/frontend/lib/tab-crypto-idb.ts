'use client'

/**
 * Tab-Session: nicht exportierbarer AES-GCM-Schlüssel in IndexedDB (kein Klartext-Tab-Key in sessionStorage).
 */
const IDB_NAME = 'morgendrot-tab-crypto-v1'
const IDB_STORE = 'keys'
const TAB_AES_KEY_ID = 'tab-aes-gcm-v1'

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB nicht verfügbar.'))
      return
    }
    const req = indexedDB.open(IDB_NAME, 1)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onerror = () => reject(req.error ?? new Error('idb get failed'))
    req.onsuccess = () => resolve(req.result)
  })
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const req = tx.objectStore(IDB_STORE).put(value, key)
    req.onerror = () => reject(req.error ?? new Error('idb put failed'))
    req.onsuccess = () => resolve()
  })
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const req = tx.objectStore(IDB_STORE).delete(key)
    req.onerror = () => reject(req.error ?? new Error('idb delete failed'))
    req.onsuccess = () => resolve()
  })
}

export async function getOrCreateTabAesKey(): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !globalThis.crypto?.subtle) return null
  try {
    const db = await openIdb()
    const existing = await idbGet(db, TAB_AES_KEY_ID)
    if (existing instanceof CryptoKey) return existing
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    await idbPut(db, TAB_AES_KEY_ID, key)
    return key
  } catch {
    return null
  }
}

export async function clearTabAesKey(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await openIdb()
    await idbDelete(db, TAB_AES_KEY_ID)
  } catch {
    /* ignore */
  }
}

export async function tabAesEncrypt(plainUtf8: string): Promise<{ ivB64: string; ciphertextB64: string } | null> {
  const key = await getOrCreateTabAesKey()
  if (!key) return null
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainUtf8))
  )
  return { ivB64: bytesToB64(iv), ciphertextB64: bytesToB64(ciphertext) }
}

export async function tabAesDecrypt(ivB64: string, ciphertextB64: string): Promise<string | null> {
  const key = await getOrCreateTabAesKey()
  if (!key) return null
  try {
    const iv = b64ToBytes(ivB64)
    const ciphertext = b64ToBytes(ciphertextB64)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

function bytesToB64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
