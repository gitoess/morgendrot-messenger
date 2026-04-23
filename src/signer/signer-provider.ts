export type IotaSignerMode = 'sdk' | 'cli' | 'remote';

export type SignatureResult = {
    signature: string;
};

/**
 * Schlanker Provider-Vertrag fuer alle Signer-Adapter.
 * Der Rest des Codes kennt nur `sign(...)` und muss keinen Backend-Typ unterscheiden.
 */
export interface SignerProvider {
    sign(data: Uint8Array): Promise<SignatureResult>;
}

type SignerAdapterOptions = {
    mode: 'cli' | 'remote';
    cliSignBase64?: (txBytesBase64: string) => Promise<string>;
    remoteSignBase64?: (txBytesBase64: string) => Promise<string>;
};

export function resolveSignerMode(rawMode: string): IotaSignerMode {
    const raw = String(rawMode || '').trim().toLowerCase();
    if (raw === 'sdk' || raw === 'cli' || raw === 'remote') return raw;
    throw new Error(
        `Signer-Factory: ungueltiger SIGNER-Modus "${raw || '(leer)'}". Erlaubt: sdk | cli | remote.`
    );
}

export function createSignerProvider(opts: SignerAdapterOptions): SignerProvider {
    if (opts.mode === 'cli') {
        if (typeof opts.cliSignBase64 !== 'function') {
            throw new Error('Signer-Factory (cli): Adapter fehlt (cliSignBase64).');
        }
        return {
            async sign(data: Uint8Array): Promise<SignatureResult> {
                const signature = await opts.cliSignBase64!(Buffer.from(data).toString('base64'));
                return { signature };
            },
        };
    }
    if (typeof opts.remoteSignBase64 !== 'function') {
        throw new Error('Signer-Factory (remote): Adapter fehlt (remoteSignBase64).');
    }
    return {
        async sign(data: Uint8Array): Promise<SignatureResult> {
            const signature = await opts.remoteSignBase64!(Buffer.from(data).toString('base64'));
            return { signature };
        },
    };
}
