/** Empfänger-0x für .morg-pkg-Export (muss in connectedAddresses / peerMap sein). */
export function resolveMorgPkgRecipientAddress(opts: {
  locked?: boolean
  connectedAddresses?: string[]
  partner: string
  recipient: string
}): { recipient: string | null; error: string | null } {
  if (opts.locked) {
    return { recipient: null, error: 'Tresor entsperren – .morg-pkg braucht Messaging-Keys.' }
  }
  const addrs = opts.connectedAddresses?.filter(Boolean) ?? []
  if (!addrs.length) {
    return {
      recipient: null,
      error: 'Zuerst verbinden (/connect): .morg-pkg braucht den öffentlichen Schlüssel des Empfängers.',
    }
  }
  if (addrs.length === 1) return { recipient: addrs[0]!, error: null }

  const candidates = [opts.partner.trim(), opts.recipient.trim()]
    .map((s) => s.toLowerCase())
    .filter((s) => s.startsWith('0x') && s.length > 2)
  const unique = [...new Set(candidates)]

  for (const pt of unique) {
    const rec = addrs.find((a) => a.toLowerCase() === pt) ?? null
    if (rec) return { recipient: rec, error: null }
  }

  if (!unique.length) {
    return {
      recipient: null,
      error:
        'Mehrere Partner: im Feld „Partner (Handshake)“ oder „Empfänger“ die Zieladresse (0x…) eintragen, dann erneut exportieren.',
    }
  }
  return { recipient: null, error: 'Adresse entspricht keinem verbundenen Partner.' }
}
