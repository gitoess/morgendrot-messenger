declare module 'pdfkit' {
    import { Readable } from 'node:stream';
    export default class PDFDocument extends Readable {
        constructor(options?: { margin?: number });
        fontSize(size: number): this;
        font(name: string): this;
        text(text: string, options?: { align?: string; continued?: boolean }): this;
        moveDown(n?: number): this;
        addPage(): this;
        end(): void;
        y: number;
    }
}
