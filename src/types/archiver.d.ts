/** Minimaltyp für archiver (kein @types-Paket nötig). */
declare module 'archiver' {
    import type { Writable } from 'node:stream';
    function archiver(format: string, options?: Record<string, unknown>): Archiver;
    interface Archiver extends NodeJS.ReadWriteStream {
        append(source: string | Buffer | NodeJS.ReadableStream, options?: { name?: string }): this;
        finalize(): Promise<void>;
        pipe(destination: Writable): Writable;
    }
    export default archiver;
}
