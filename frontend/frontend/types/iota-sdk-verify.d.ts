/** Subpath types missing from @iota/iota-sdk exports map (CI tsc). */
declare module '@iota/iota-sdk/verify' {
  export function verifyPersonalMessageSignature(
    message: Uint8Array,
    signature: string
  ): Promise<unknown>
}
