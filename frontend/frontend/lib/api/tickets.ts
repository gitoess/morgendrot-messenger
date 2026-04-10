import type { ApiResponse, TicketData } from '../types'
import { executeCommand } from '@/frontend/lib/api/execute-command'

export const createTicket = (eventId: string, validFrom: number, validUntil: number, recipient: string, metadata?: string) =>
  executeCommand('/create-ticket', metadata ? [eventId, validFrom, validUntil, metadata, recipient] : [eventId, validFrom, validUntil, '', recipient])

/** Mehrere Tickets in einer TX (PTB) an denselben Empfänger. Max 50. */
export const createTickets = (
  eventId: string,
  validFrom: number,
  validUntil: number,
  recipient: string,
  count: number,
  metadata?: string
) =>
  executeCommand('/create-tickets', metadata
    ? [eventId, validFrom, validUntil, metadata, recipient, count]
    : [eventId, validFrom, validUntil, '', recipient, count])

export const useTicket = (ticketId: string, eventId: string) =>
  executeCommand('/use-ticket', [ticketId, eventId])

export const transferTicket = (ticketId: string, newOwner: string) =>
  executeCommand('/transfer-ticket', [ticketId, newOwner])

export const purgeTicket = (ticketId: string) => executeCommand('/purge-ticket', [ticketId])

export async function listTickets(): Promise<ApiResponse<TicketData[]>> {
  const res = await executeCommand<TicketData[]>('/list-tickets', [])
  const raw = (res as { tickets?: unknown[] }).tickets ?? (res as { data?: unknown[] }).data
  if (res.ok && Array.isArray(raw)) {
    return {
      ...res,
      data: raw.map((t) => {
        const x = t as Record<string, unknown>
        return {
          id: String(x.objectId ?? x.id ?? ''),
          eventId: x.eventId as string | undefined,
          validFrom: Number(x.validFromMs ?? x.validFrom ?? 0),
          validUntil: Number(x.validUntilMs ?? x.validUntil ?? 0),
          used: Boolean(x.used),
        }
      }),
    }
  }
  return res
}
