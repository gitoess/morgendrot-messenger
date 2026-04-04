/**
 * USB-Serial HAL (Pfad B: PC ↔ Heltec). Rohbytes/Latin1 – kein Meshtastic-Protobuf-Framing.
 * Für echte Meshtastic-Geräte später Protobuf/API-Schicht vorschalten.
 */
import type { ILoraDriver } from './lora-driver.js';

export class SerialLoraDriver implements ILoraDriver {
    private callbacks: Array<(payload: string, senderId?: string) => void> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private port: any = null;

    constructor(
        private readonly path: string,
        private readonly baudRate: number
    ) {}

    async open(): Promise<void> {
        const { SerialPort } = await import('serialport');
        await new Promise<void>((resolve, reject) => {
            this.port = new SerialPort(
                { path: this.path, baudRate: this.baudRate },
                (err: Error | null) => (err ? reject(err) : resolve())
            );
        });
        this.port.on('data', (chunk: Buffer) => {
            const s = chunk.toString('latin1');
            for (const cb of this.callbacks) {
                try {
                    cb(s, 'serial');
                } catch {
                    /* ignore */
                }
            }
        });
    }

    async send(payload: string | Uint8Array): Promise<void> {
        if (!this.port) throw new Error('Serial port not open');
        const buf = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload);
        await new Promise<void>((resolve, reject) => {
            this.port.write(buf, (err: Error | null) => (err ? reject(err) : resolve()));
        });
    }

    onReceive(callback: (payload: string, senderId?: string) => void): void {
        this.callbacks.push(callback);
    }

    async close(): Promise<void> {
        this.callbacks = [];
        if (this.port && typeof this.port.close === 'function') {
            await new Promise<void>((resolve) => this.port.close(() => resolve()));
            this.port = null;
        }
    }
}
