/**
 * Ticket tiers with live availability (FR-8). Server-rendered with the last
 * known status, then refreshed from the ticketing API every 60 seconds while
 * the tab is visible. Status changes are announced politely.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { STATUS_LABEL, type TicketStatus, type Tier } from '../data/tickets';
import { CHECKOUT_PARTNER, POLL_MS, fetchTicketStatus } from '../lib/ticketsApi';
import '../styles/tickets.css';

interface Props {
  tiers: Tier[];
  baseline: Record<string, TicketStatus>;
  variant?: 'home' | 'page';
}

type Conn = 'idle' | 'live' | 'error' | 'offline';

const hhmm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function TicketTiers({ tiers, baseline, variant = 'home' }: Props) {
  const [status, setStatus] = useState(baseline);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [conn, setConn] = useState<Conn>('idle');
  const [announce, setAnnounce] = useState('');
  const [checkout, setCheckout] = useState<Tier | null>(null);
  const [qty, setQty] = useState(1);
  const known = useRef(baseline);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let last = 0;
    let ctrl: AbortController | null = null;

    const poll = async () => {
      if (document.hidden) return;
      if (!navigator.onLine) {
        setConn('offline');
        return;
      }
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const next = await fetchTicketStatus(ctrl.signal);
        last = Date.now();
        const changed = tiers
          .filter((t) => next[t.id] && next[t.id] !== known.current[t.id])
          .map((t) => `${t.name}: ${STATUS_LABEL[next[t.id]]}`);
        if (changed.length) setAnnounce(`Ticket update. ${changed.join('. ')}.`);
        known.current = { ...known.current, ...next };
        setStatus(known.current);
        setUpdated(new Date());
        setConn('live');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setConn('error');
      }
    };

    const onVisible = () => {
      if (!document.hidden && Date.now() - last >= POLL_MS) poll();
    };
    const onOffline = () => setConn('offline');

    poll();
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    addEventListener('online', poll);
    addEventListener('offline', onOffline);
    return () => {
      clearInterval(timer);
      ctrl?.abort();
      document.removeEventListener('visibilitychange', onVisible);
      removeEventListener('online', poll);
      removeEventListener('offline', onOffline);
    };
  }, []);

  // Deep link from the home page: /tickets/?tier=weekend opens checkout.
  useEffect(() => {
    if (variant !== 'page') return;
    const id = new URLSearchParams(location.search).get('tier');
    const tier = tiers.find((t) => t.id === id);
    if (tier && baseline[tier.id] !== 'sold_out') {
      const card = document.getElementById(`tier-${tier.id}`);
      card?.scrollIntoView({ block: 'center' });
      opener.current = card?.querySelector('button') ?? null;
      setCheckout(tier);
    }
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (checkout && !d.open) d.showModal();
    if (!checkout && d.open) d.close();
  }, [checkout]);

  const open = (t: Tier, e: Event) => {
    opener.current = e.currentTarget as HTMLElement;
    setQty(1);
    setCheckout(t);
    (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({ event: 'checkout_open', tier: t.id });
  };

  const liveText =
    conn === 'live' && updated
      ? `Live availability · updated ${hhmm(updated)}`
      : conn === 'offline'
        ? 'Offline · availability may be out of date'
        : conn === 'error'
          ? 'Could not reach ticketing · showing last known availability'
          : 'Checking availability…';

  return (
    <div class={`tiers tiers--${variant}`}>
      <ul role="list" class="tiers__list">
        {tiers.map((t) => {
          const s = status[t.id] ?? 'on_sale';
          const sold = s === 'sold_out';
          return (
            <li class={`tier tier--${t.day ?? 'pass'} is-${s}`} id={`tier-${t.id}`} key={t.id}>
              <div class="tier__top">
                <h3 class="tier__name">{t.name}</h3>
                <p class={`tier__status status--${s}`}>
                  <span class="status__icon" aria-hidden="true" />
                  {STATUS_LABEL[s]}
                </p>
              </div>
              <p class="tier__price">
                <span class="sr-only">Price </span>£{t.price}
              </p>
              <ul role="list" class="tier__inc">
                {t.includes.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              {sold ? (
                <span class="btn tier__cta" aria-disabled="true">
                  Sold out
                </span>
              ) : variant === 'home' ? (
                <a class="btn btn--accent tier__cta" href={`/tickets/?tier=${t.id}`}>
                  Buy {t.name}
                  <span class="sr-only"> ticket</span>
                </a>
              ) : (
                <button class="btn btn--accent tier__cta" type="button" onClick={(e) => open(t, e)}>
                  Buy {t.name}
                  <span class="sr-only"> ticket</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p class={`tiers__live mono is-${conn}`}>
        <span class="tiers__dot" aria-hidden="true" />
        {liveText}
      </p>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>

      {variant === 'page' && (
        <dialog
          ref={dialog}
          class="checkout"
          aria-labelledby="checkout-h"
          onClose={() => {
            setCheckout(null);
            opener.current?.focus();
          }}
        >
          {checkout && (
            <div class="checkout__body">
              <div class="checkout__head">
                <h2 id="checkout-h" class="checkout__title">
                  {checkout.name}
                </h2>
                <button class="chip" type="button" onClick={() => setCheckout(null)}>
                  Close
                </button>
              </div>
              <div class="field">
                <label for="qty">Tickets</label>
                <select
                  id="qty"
                  class="select"
                  value={qty}
                  onChange={(e) => setQty(Number((e.target as HTMLSelectElement).value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option value={n} key={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <p class="checkout__total mono">
                Total £{checkout.price * qty} · inc. booking fee
              </p>
              <div class="checkout__widget" data-partner-widget data-tier={checkout.id} data-qty={qty}>
                <p class="mono">Secure checkout by {CHECKOUT_PARTNER}</p>
                <p>
                  The partner's embedded checkout loads here and takes payment. PULSE 27 never handles card details.
                  This prototype has no live checkout connected.
                </p>
              </div>
            </div>
          )}
        </dialog>
      )}
    </div>
  );
}
