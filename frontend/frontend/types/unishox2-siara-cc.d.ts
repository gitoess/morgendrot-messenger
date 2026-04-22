declare module 'unishox2.siara.cc' {
  export function unishox2_decompress_simple(buf: Uint8Array, len: number): string
  export function unishox2_compress_simple(
    input: string | Uint8Array,
    len: number,
    out: Uint8Array
  ): number
}
