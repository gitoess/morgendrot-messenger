/** Empfänger-0x für .morg-pkg-Export (Pubkey muss in peerMap / connectedAddresses liegen). */
export function resolveMorgPkgRecipientAddress(opts: {
  locked?: boolean
  connectedAddresses?: string[]
  partner: string
  recipient: string
  /** Explizite Eingabe/Auswahl im Pakete-Dialog (hat Vorrang). */
  exportRecipient?: string
  myAddress?: string
}): { recipient: string | null; error: string | null } {
  if (opts.locked) {
    return { recipient: null, error: 'Tresor entsperren – .morg-pkg braucht Messaging-Keys.' }
  }
  const addrs = (opts.connectedAddresses ?? []).map((a) => a.trim()).filter(Boolean)
  if (!addrs.length) {
    return {
      recipient: null,
      error:
        'Zuerst verbinden (/connect): .morg-pkg braucht den öffentlichen Schlüssel des Empfängers (peerMap). Auch „an mich“ = Self-Handshake.',
    }
  }

  const picked = (opts.exportRecipient ?? '').trim()
  if (picked) {
    if (!/^0x[a-fA-F0-9]{64}$/i.test(picked)) {
      return {
        recipient: null,
        error: 'Empfänger: volle Adresse 0x + 64 Hex (kein Kurzform 0x…abcd).',
      }
    }
    const rec = addrs.find((a) => a.toLowerCase() === picked.toLowerCase()) ?? null
    if (rec) return { recipient: rec, error: null }
    const my = (opts.myAddress ?? '').trim().toLowerCase()
    if (my && picked.toLowerCase() === my) {
      return {
        recipient: null,
        error:
          '„An mich“: zuerst mit der eigenen Adresse verbinden (Handshake/Connect) — wie bei verschlüsselter Nachricht an dich.',
      }
    }
    return {
      recipient: null,
      error:
        'Diese 0x-Adresse ist nicht in der peerMap. Handshake/Connect mit dem Empfänger, dann erneut — Adresse muss verbunden sein (nicht nur im Telefonbuch).',
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
      error: 'Empfänger-0x eintragen oder verbundenen Partner wählen.',
    }
  }
  return { recipient: null, error: 'Adresse entspricht keinem verbundenen Partner.' }
}
