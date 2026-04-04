/**
 * LoRa-Treiber – abstrakte Schnittstelle.
 * Implementierungen: Simulation (ohne Hardware), Serial (Heltec / Roh-UART, siehe serial-lora-driver.ts).
 */
export interface ILoraDriver {
    /** Sendet Payload ins Mesh (UTF-8-String oder Rohbytes als Uint8Array). */
    send(payload: string | Uint8Array): Promise<void>;
    /** Registriert Callback für empfangene Nachrichten (Latin1-codierter Binärstrom in string). */
    onReceive(callback: (payload: string, senderId?: string) => void): void;
    /** Schließt Verbindung. */
    close(): Promise<void>;
}

/** Simulationsmodus: In-Memory-Queue, keine Hardware. Für Tests. */
export class SimLoraDriver implements ILoraDriver {
    private callbacks: Array<(payload: string, senderId?: string) => void> = [];
    private broadcastQueue: Array<{ payload: string; ts: number }> = [];

    async send(payload: string | Uint8Array): Promise<void> {
        const s =
            typeof payload === 'string'
                ? payload
                : Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).toString('latin1');
        this.broadcastQueue.push({ payload: s, ts: Date.now() });
        for (const cb of this.callbacks) {
            try {
                cb(s, 'sim');
            } catch {
                /* ignore */
            }
        }
    }

    onReceive(callback: (payload: string, senderId?: string) => void): void {
        this.callbacks.push(callback);
    }

    /** Für Tests: Gibt alle gesendeten Payloads zurück. */
    getSentPayloads(): string[] {
        return this.broadcastQueue.map((p) => p.payload);
    }

    /** Für Tests: Simuliert eingehende Nachricht. */
    simulateIncoming(payload: string, senderId = 'sim-remote'): void {
        for (const cb of this.callbacks) {
            try {
                cb(payload, senderId);
            } catch {
                /* ignore */
            }
        }
    }

    async close(): Promise<void> {
        this.callbacks = [];
    }
}
