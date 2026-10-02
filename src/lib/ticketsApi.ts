/**
 * Ticket availability (FR-8). Reads the partner ticketing API; set
 * PUBLIC_TICKETING_API to the partner's status endpoint in production.
 * Without it, the site reads its own static /api/tickets.json so the
 * prototype works end to end.
 *
 * Expected response: { updatedAt: ISO string, tiers: [{ id, status }] }
 */
import type { TicketStatus } from '../data/tickets';

export const POLL_MS = 60_000;

const ENDPOINT: string = import.meta.env.PUBLIC_TICKETING_API || '/api/tickets.json';

export interface StatusPayload {
  updatedAt: string;
  tiers: { id: string; status: TicketStatus }[];
}

const VALID = new Set<TicketStatus>(['on_sale', 'few_left', 'sold_out']);

export async function fetchTicketStatus(signal?: AbortSignal): Promise<Record<string, TicketStatus>> {
  const res = await fetch(ENDPOINT, { cache: 'no-store', signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Ticket status ${res.status}`);
  const data = (await res.json()) as StatusPayload;
  const out: Record<string, TicketStatus> = {};
  for (const t of data.tiers ?? []) if (VALID.has(t.status)) out[t.id] = t.status;
  return out;
}

/** Partner checkout widget. Swap the body for the partner's embed call. */
export const CHECKOUT_PARTNER = 'TicketPartner';
