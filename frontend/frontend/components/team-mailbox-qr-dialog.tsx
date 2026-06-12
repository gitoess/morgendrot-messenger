'use client'

import { useCallback, useEffect, useState } from 'react'
import { QrCode, UserRoundPlus } from 'lucide-react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { useMeshQrCameraScan } from '@/frontend/hooks/use-mesh-qr-camera-scan'
import {
    buildTeamMailboxQrPayload,
    parseTeamMailboxQrPayload,
} from '@/frontend/lib/team-mailbox-qr'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type TeamMailboxJoinDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onJoined: (objectId: string, label?: string) => void
    onStatus?: (msg: string, tone?: 'success' | 'error') => void
}

export function TeamMailboxJoinDialog(p: TeamMailboxJoinDialogProps) {
    const [objectId, setObjectId] = useState('')
    const [label, setLabel] = useState('')
    const [pasteOpen, setPasteOpen] = useState(false)
    const [pasteText, setPasteText] = useState('')

    const { startScan, cameraDialog } = useMeshQrCameraScan({
        title: 'Team-Mailbox-QR scannen',
        description: 'QR der Leitung in den Rahmen halten (Object-ID).',
    })

    useEffect(() => {
        if (!p.open) {
            setObjectId('')
            setLabel('')
            setPasteText('')
            setPasteOpen(false)
        }
    }, [p.open])

    const applyParsed = useCallback(
        (parsed: ReturnType<typeof parseTeamMailboxQrPayload>) => {
            if (!parsed) {
                p.onStatus?.('Kein Team-Mailbox-QR erkannt.', 'error')
                return
            }
            setObjectId(parsed.objectId)
            if (parsed.label && !label.trim()) setLabel(parsed.label)
            p.onStatus?.('Team-Mailbox-ID aus QR übernommen.', 'success')
        },
        [label, p]
    )

    const handleScan = async () => {
        const s = await startScan()
        if ('error' in s) {
            if (s.error !== 'Scan abgebrochen.') {
                setPasteOpen(true)
                p.onStatus?.(s.error, 'error')
            }
            return
        }
        applyParsed(parseTeamMailboxQrPayload(s.bundleJson))
    }

    const submitJoin = () => {
        const id = objectId.trim()
        if (!HEX64.test(id)) {
            p.onStatus?.('Object-ID muss 0x + 64 Hex sein.', 'error')
            return
        }
        p.onJoined(id, label.trim() || undefined)
        p.onOpenChange(false)
    }

    return (
        <>
            <Dialog open={p.open} onOpenChange={p.onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Team-Mailbox beitreten</DialogTitle>
                        <DialogDescription>
                            ID von der Einsatzleitung einfügen oder QR scannen — kein On-chain-„Beitritt“, nur lokale
                            Liste + Posteingang.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Object-ID (0x…)</label>
                            <input
                                value={objectId}
                                onChange={(e) => setObjectId(e.target.value)}
                                placeholder="0x…64 Hex"
                                className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Anzeigename (optional)</label>
                            <input
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="z. B. Team Einsatz"
                                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => void handleScan()}>
                                <QrCode className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                QR scannen
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setPasteOpen(true)}>
                                Text einfügen
                            </Button>
                            <Button type="button" size="sm" onClick={submitJoin}>
                                <UserRoundPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                Beitreten
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Team-Mailbox-QR-Text</DialogTitle>
                    </DialogHeader>
                    <textarea
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
                        placeholder='JSON {"v":1,"k":"tm","id":"0x…"} oder nur 0x…'
                    />
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                            applyParsed(parseTeamMailboxQrPayload(pasteText))
                            setPasteOpen(false)
                        }}
                    >
                        Übernehmen
                    </Button>
                </DialogContent>
            </Dialog>

            {cameraDialog}
        </>
    )
}

export type TeamMailboxShareQrDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    objectId: string
    label?: string
}

/** Boss/Leitung: Team-Mailbox-ID als QR teilen. */
export function TeamMailboxShareQrDialog(p: TeamMailboxShareQrDialogProps) {
    const [qrDataUrl, setQrDataUrl] = useState('')
    const [err, setErr] = useState('')

    useEffect(() => {
        if (!p.open) return
        setErr('')
        setQrDataUrl('')
        if (!HEX64.test(p.objectId.trim())) {
            setErr('Ungültige Object-ID.')
            return
        }
        const payload = buildTeamMailboxQrPayload(p.objectId, p.label)
        void QRCode.toDataURL(payload, { width: 280, margin: 2 })
            .then(setQrDataUrl)
            .catch(() => setErr('QR konnte nicht erzeugt werden.'))
    }, [p.open, p.objectId, p.label])

    return (
        <Dialog open={p.open} onOpenChange={p.onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Team-Mailbox-QR</DialogTitle>
                    <DialogDescription>
                        Helfer scannen unter Kanäle → Team-Mailboxen → Beitreten (ID/QR).
                    </DialogDescription>
                </DialogHeader>
                {err ? <p className="text-sm text-destructive">{err}</p> : null}
                {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Team-Mailbox QR" className="mx-auto rounded border border-border" />
                ) : null}
                <code className="block break-all text-[10px] text-muted-foreground">{p.objectId}</code>
            </DialogContent>
        </Dialog>
    )
}
