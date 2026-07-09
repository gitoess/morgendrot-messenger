import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storeEncryptedMessage } = vi.hoisted(() => ({
    storeEncryptedMessage: vi.fn(async () => ({ digest: '0xtest', status: 'success' })),
}));

vi.mock('../chain-access.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../chain-access.js')>();
    return {
        ...actual,
        storeEncryptedMessage,
    };
});

vi.mock('../config.js', () => ({
    CFG: {
        MY_ADDRESS: '0x' + '11'.repeat(32),
        ENABLE_PLAINTEXT_CHANNEL: true,
        MESSENGER_AUTO_SPONSOR: false,
    },
}));

vi.mock('../messenger-session-password.js', () => ({
    getWalletPassword: () => 'pw',
}));

vi.mock('../messenger-session-keys-state.js', () => ({
    getSendKeyEpochForPeer: () => 0,
}));

vi.mock('../shared/morgendrot-crypto-session-wire.js', () => ({
    encryptIotaPeerSessionMessage: async () => ({
        ciphertext: new Uint8Array([1]),
        iv: new Uint8Array([2]),
        tag: new Uint8Array([3]),
    }),
}));

import { sendEncryptedMessage } from './messenger-chain-wrap.js';

describe('sendEncryptedMessage plaintext policy (P1)', () => {
    beforeEach(() => {
        storeEncryptedMessage.mockClear();
    });

    it('übergibt keinen Klartext-Spiegel an storeEncryptedMessage auch bei ENABLE_PLAINTEXT_CHANNEL', async () => {
        const peerPub = new Uint8Array(65);
        const priv = {} as CryptoKey;
        await sendEncryptedMessage(
            '0x' + 'aa'.repeat(32),
            '[[MORG_MAILBOX_NONCE_V1:1]]geheim',
            peerPub,
            priv
        );
        expect(storeEncryptedMessage).toHaveBeenCalledTimes(1);
        const plaintextArg = storeEncryptedMessage.mock.calls[0]?.[6];
        expect(plaintextArg).toBeUndefined();
    });
});
