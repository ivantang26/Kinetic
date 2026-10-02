/**
 * Schedule + "My PULSE" (FR-6, FR-7).
 *
 * Static, high-contrast and kinetic-free: this is the page people use on site
 * in sunlight with weak signal. Data is bundled with the island and starred
 * sets live in localStorage, so after one visit it all works offline (the
 * service worker caches the page and this script).
 *
 * Layouts: wide = all stages on a horizontal time axis; tablet = two stages
 * side by side, times down the page; mobile = one stage with a switcher.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { ALL_SETS, DAYS, STAGES, dayById, stageById, toMin, type Act, type DayId } from '../data/festival';
import { downloadIcs } from '../lib/ics';
import { clashPairs, findClashes, loadStarred, onStarredChange, saveStarred } from '../lib/myPulse';
import { track } from '../lib/motion';
import { getDay, isDay, setDay } from '../lib/theme';
import '../styles/schedule.css';

type Layout = 'mobile' | 'tablet' | 'wide';
type View = 'grid' | 'mine';

const OPEN = 12 * 60;
const CLOSE = 24 * 60;
const SPAN = CLOSE - OPEN;
const HOURS = Array.from({ length: SPAN / 60 + 1 }, (_, i) => 12 + i);
const PX_WIDE = 2.4; // px per minute, horizontal
const PX_TALL = 2; // px per minute, vertical

const hourLabel = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
const byTime = (a: Act, b: Act) => toMin(a.start) - toMin(b.start) || a.stage.localeCompare(b.stage);

function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>('mobile'); // SSR = phone first
  useEffect(() => {
    const wide = matchMedia('(min-width: 1100px)');
    const tablet = matchMedia('(min-width: 700px)');
    const update = () => setLayout(wide.matches ? 'wide' : tablet.matches ? 'tablet' : 'mobile');
    update();
    wide.addEventListener('change', update);
    tablet.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      tablet.removeEventListener('change', update);
    };
  }, []);
  return layout;
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
    </svg>
  );
}

interface CardProps {
  act: Act;
  starred: boolean;
  clashWith?: Act[];
  onToggle: (id: string) => void;
}

function SetCard({ act, starred, clashWith, onToggle }: CardProps) {
  const clash = starred && clashWith && clashWith.length > 0;
  return (
    <article
      id={`set-${act.id}`}
      class={`set set--${act.kind}${starred ? ' is-starred' : ''}${clash ? ' is-clash' : ''}${act.headliner ? ' is-headliner' : ''}`}
    >
      <p class="set__time mono">
        {act.start}–{act.end}
        {clash && <span class="set__flag">Clash</span>}
      </p>
      <h4 class="set__name">{act.name}</h4>
      <p class="set__sub">{act.kind === 'music' ? act.genre : `${act.genre} · ${act.host}`}</p>
      <button
        type="button"
        class="set__star"
        aria-pressed={starred}
        aria-label={`Save ${act.name}, ${act.start}, to My PULSE`}
        onClick={() => onToggle(act.id)}
      >
        <Star filled={starred} />
      </button>
    </article>
  );
}

export default function Schedule() {
  const layout = useLayout();
  const [day, setDayState] = useState<DayId>('fri');
  const [view, setView] = useState<View>('grid');
  const [stageIdx, setStageIdx] = useState(0);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [online, setOnline] = useState(true);

  // Hydrate client-only state.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const qd = q.get('day');
    const themed = getDay();
    const initial = isDay(qd) && qd !== 'all' ? qd : themed !== 'all' ? themed : 'fri';
    setDayState(initial);
    setDay(initial);
    if (q.get('view') === 'mine' || location.hash === '#my-pulse') setView('mine');
    setStarred(loadStarred());
    setOnline(navigator.onLine);
    const off = onStarredChange(() => setStarred(loadStarred()));
    const on = () => setOnline(true);
    const no = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', no);
    return () => {
      off();
      removeEventListener('online', on);
      removeEventListener('offline', no);
    };
  }, []);

  const chooseDay = (d: DayId) => {
    setDayState(d);
    setDay(d); // FR-5: whole site shifts theme
    const url = new URL(location.href);
    url.searchParams.set('day', d);
    history.replaceState(null, '', url);
  };

  const toggle = (id: string) => {
    const next = new Set(starred);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      if (starred.size === 0) track('my_pulse_created');
    }
    setStarred(next);
    saveStarred(next);
  };

  // Festival day order, then start time.
  const mine = useMemo(() => {
    const order = (d: DayId) => DAYS.findIndex((x) => x.id === d);
    return ALL_SETS.filter((a) => starred.has(a.id)).sort((a, b) => order(a.day) - order(b.day) || byTime(a, b));
  }, [starred]);
  const clashes = useMemo(() => findClashes(mine), [mine]);
  const pairs = useMemo(() => clashPairs(mine), [mine]);

  const daySets = useMemo(() => ALL_SETS.filter((a) => a.day === day), [day]);
  const perStage = STAGES.length;
  const visibleStages =
    layout === 'wide'
      ? STAGES
      : layout === 'tablet'
        ? STAGES.slice(Math.min(stageIdx, perStage - 2), Math.min(stageIdx, perStage - 2) + 2)
        : STAGES.slice(stageIdx, stageIdx + 1);

  const exportIcs = () => {
    downloadIcs(mine);
    track('calendar_export', { count: mine.length });
  };

  const card = (a: Act) => (
    <SetCard act={a} starred={starred.has(a.id)} clashWith={clashes.get(a.id)} onToggle={toggle} />
  );

  return (
    <div class={`sched sched--${layout}`}>
      {/* Controls */}
      <div class="sched__controls">
        <div class="chips" role="group" aria-label="Day">
          {DAYS.map((d) => (
            <button type="button" class="chip" aria-pressed={day === d.id} onClick={() => chooseDay(d.id)} key={d.id}>
              {d.short} {d.label}
            </button>
          ))}
        </div>
        <div class="chips" role="group" aria-label="View">
          <button type="button" class="chip" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
            Timetable
          </button>
          <button type="button" class="chip" aria-pressed={view === 'mine'} onClick={() => setView('mine')}>
            My PULSE <span class="sched__count">{starred.size}</span>
          </button>
        </div>
      </div>

      {!online && (
        <p class="sched__offline mono" role="status">
          Offline. Your schedule and My PULSE still work.
        </p>
      )}

      {/* Clash warnings */}
      <div class="sched__clashes" aria-live="polite">
        {pairs.length > 0 && (
          <div class="clash-banner">
            <p class="clash-banner__title mono">
              {pairs.length === 1 ? '1 clash' : `${pairs.length} clashes`} in My PULSE
            </p>
            <ul role="list">
              {pairs.map(([a, b]) => (
                <li key={a.id + b.id}>
                  <strong>{a.name}</strong> ({stageById[a.stage].short} {a.start}–{a.end}) overlaps{' '}
                  <strong>{b.name}</strong> ({stageById[b.stage].short} {b.start}–{b.end}), {dayById[a.day].name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {view === 'grid' ? (
        <div class="sched__grid">
          <h2 class="sr-only">
            {dayById[day].name} {dayById[day].label} timetable
          </h2>

          {layout !== 'wide' && (
            <div class="chips sched__stages" role="group" aria-label="Stage">
              {layout === 'mobile'
                ? STAGES.map((s, i) => (
                    <button type="button" class="chip" aria-pressed={stageIdx === i} onClick={() => setStageIdx(i)} key={s.id}>
                      {s.short}
                    </button>
                  ))
                : [0, 2].map((i) => (
                    <button
                      type="button"
                      class="chip"
                      aria-pressed={Math.min(stageIdx, perStage - 2) === i}
                      onClick={() => setStageIdx(i)}
                      key={i}
                    >
                      {STAGES[i].short} + {STAGES[i + 1].short}
                    </button>
                  ))}
            </div>
          )}

          {layout === 'wide' ? (
            <div class="tt-wide" role="region" aria-label="Timetable, scrolls sideways" tabIndex={0}>
              <div class="tt-wide__canvas" style={{ width: `calc(var(--stage-col) + ${SPAN * PX_WIDE}px)` }}>
                <div class="tt-wide__ruler" aria-hidden="true">
                  {HOURS.map((h) => (
                    <span class="mono" style={{ left: `${(h * 60 - OPEN) * PX_WIDE}px` }} key={h}>
                      {hourLabel(h)}
                    </span>
                  ))}
                </div>
                {STAGES.map((s) => (
                  <section class="tt-wide__row" aria-labelledby={`st-${s.id}`} key={s.id}>
                    <h3 id={`st-${s.id}`} class="tt-stage">
                      {s.name}
                    </h3>
                    <ul role="list" class="tt-wide__lane">
                      {daySets
                        .filter((a) => a.stage === s.id)
                        .sort(byTime)
                        .map((a) => (
                          <li
                            key={a.id}
                            style={{
                              left: `${(toMin(a.start) - OPEN) * PX_WIDE}px`,
                              width: `${(toMin(a.end) - toMin(a.start)) * PX_WIDE - 6}px`,
                            }}
                          >
                            {card(a)}
                          </li>
                        ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <div class="tt-tall" style={`--cols:${visibleStages.length}`}>
              <div class="tt-tall__times" aria-hidden="true" style={{ height: `${SPAN * PX_TALL}px` }}>
                {HOURS.map((h) => (
                  <span class="mono" style={{ top: `${(h * 60 - OPEN) * PX_TALL}px` }} key={h}>
                    {hourLabel(h)}
                  </span>
                ))}
              </div>
              {visibleStages.map((s) => (
                <section class="tt-tall__col" aria-labelledby={`st-${s.id}`} key={s.id}>
                  <h3 id={`st-${s.id}`} class="tt-stage">
                    {s.name}
                  </h3>
                  <ul role="list" class="tt-tall__lane" style={{ height: `${SPAN * PX_TALL}px` }}>
                    {daySets
                      .filter((a) => a.stage === s.id)
                      .sort(byTime)
                      .map((a) => (
                        <li
                          key={a.id}
                          style={{
                            top: `${(toMin(a.start) - OPEN) * PX_TALL}px`,
                            height: `${(toMin(a.end) - toMin(a.start)) * PX_TALL - 6}px`,
                          }}
                        >
                          {card(a)}
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : (
        <section class="mine" id="my-pulse" aria-labelledby="mine-h">
          <div class="mine__head">
            <h2 id="mine-h" class="mine__title">
              My PULSE
            </h2>
            <button type="button" class="btn btn--accent" onClick={exportIcs} disabled={mine.length === 0}>
              Export to calendar (.ics)
            </button>
          </div>
          {mine.length === 0 ? (
            <p class="mine__empty lede">
              Nothing starred yet. Open the timetable and tap the star on any set to build your own schedule. It's
              saved on this device and works offline.
            </p>
          ) : (
            DAYS.filter((d) => mine.some((a) => a.day === d.id)).map((d) => (
              <div class="mine__day" key={d.id}>
                <h3 class="mine__dayname mono">
                  {d.name} {d.label}
                </h3>
                <ol role="list">
                  {mine
                    .filter((a) => a.day === d.id)
                    .map((a) => {
                      const c = clashes.get(a.id);
                      return (
                        <li class={`mine__item${c ? ' is-clash' : ''}`} key={a.id}>
                          <p class="mine__time mono">
                            {a.start}–{a.end}
                          </p>
                          <div>
                            <p class="mine__name">{a.name}</p>
                            <p class="mine__stage mono">
                              {stageById[a.stage].name}
                              {a.host ? ` · ${a.host}` : ''}
                            </p>
                            {c && (
                              <p class="mine__clash mono">
                                Clashes with {c.map((x) => x.name).join(', ')}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            class="chip"
                            onClick={() => toggle(a.id)}
                            aria-label={`Remove ${a.name} from My PULSE`}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                </ol>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
