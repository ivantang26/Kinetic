export type TicketStatus = 'on_sale' | 'few_left' | 'sold_out';

export interface Tier {
  id: string;
  name: string;
  day?: 'fri' | 'sat' | 'sun';
  price: number; // GBP, inc. booking fee
  allocation: number;
  includes: string[];
}

/** 18,000 tickets across three day types and two weekend passes. */
export const TIERS: Tier[] = [
  { id: 'fri', name: 'Friday', day: 'fri', price: 79, allocation: 3000, includes: ['Friday entry, 12:00–23:30', 'All stages and Forum talks'] },
  { id: 'sat', name: 'Saturday', day: 'sat', price: 89, allocation: 3000, includes: ['Saturday entry, 12:00–23:30', 'All stages and Forum talks'] },
  { id: 'sun', name: 'Sunday', day: 'sun', price: 79, allocation: 3000, includes: ['Sunday entry, 12:00–23:30', 'All stages and Forum talks'] },
  { id: 'weekend', name: 'Weekend', price: 199, allocation: 7500, includes: ['All three days', 'Priority workshop booking'] },
  { id: 'weekend-plus', name: 'Weekend Plus', price: 269, allocation: 1500, includes: ['All three days', 'Fast-track entry lane', 'Main Stage viewing deck'] },
];

/** Last known status baked in at build time; the island refreshes it every 60s. */
export const BASELINE_STATUS: Record<string, TicketStatus> = {
  fri: 'on_sale',
  sat: 'few_left',
  sun: 'on_sale',
  weekend: 'on_sale',
  'weekend-plus': 'sold_out',
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  on_sale: 'On sale',
  few_left: 'Few left',
  sold_out: 'Sold out',
};
