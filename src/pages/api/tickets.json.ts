/**
 * Stand-in for the partner ticketing status endpoint, prerendered to a static
 * file. Point PUBLIC_TICKETING_API at the real endpoint in production.
 */
import type { APIRoute } from 'astro';
import { BASELINE_STATUS } from '../../data/tickets';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      tiers: Object.entries(BASELINE_STATUS).map(([id, status]) => ({ id, status })),
    }),
    { headers: { 'content-type': 'application/json' } },
  );
