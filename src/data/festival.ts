/**
 * Single source of truth for PULSE 27 content.
 * Every date string on the site is derived from FESTIVAL.start, so moving the
 * festival is a one-line change.
 */

export const FESTIVAL = {
  name: 'PULSE 27',
  start: '2027-06-12', // first day (Friday in the programme)
  venue: 'Victoria Park',
  city: 'London',
  /** London is on BST (UTC+1) in June. Used for calendar export. */
  utcOffsetHours: 1,
  onSale: '2027-02-04T10:00:00Z',
} as const;

export type DayId = 'fri' | 'sat' | 'sun';
export type Kind = 'music' | 'talk' | 'workshop';
export type Genre =
  | 'Electronic' | 'Techno' | 'Indie' | 'Pop' | 'Hip-hop' | 'Soul'
  | 'Jazz' | 'Folk' | 'Punk' | 'Ambient' | 'Afrobeats';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUNE', 'JULY', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface Day {
  id: DayId;
  name: string;
  short: string;
  date: string; // YYYY-MM-DD
  label: string; // "12 JUNE"
}

export const DAYS: Day[] = (['fri', 'sat', 'sun'] as const).map((id, i) => {
  const date = addDays(FESTIVAL.start, i);
  const [, m, d] = date.split('-').map(Number);
  return {
    id,
    name: ['Friday', 'Saturday', 'Sunday'][i],
    short: id.toUpperCase(),
    date,
    label: `${d} ${MONTHS[m - 1]}`,
  };
});

export const dayById = Object.fromEntries(DAYS.map((d) => [d.id, d])) as Record<DayId, Day>;

/** "12–14 JUNE 2027" */
export const DATE_RANGE = (() => {
  const [y, m, d0] = DAYS[0].date.split('-').map(Number);
  const d2 = Number(DAYS[2].date.split('-')[2]);
  return `${d0}–${d2} ${MONTHS[m - 1]} ${y}`;
})();

export const STAGES = [
  { id: 'main', name: 'Main Stage', short: 'MAIN' },
  { id: 'hangar', name: 'The Hangar', short: 'HANGAR' },
  { id: 'lowend', name: 'Low End', short: 'LOW END' },
  { id: 'forum', name: 'Forum', short: 'FORUM' },
] as const;
export type StageId = (typeof STAGES)[number]['id'];
export const stageById = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<
  StageId,
  (typeof STAGES)[number]
>;

export interface Act {
  id: string;
  name: string;
  day: DayId;
  stage: StageId;
  start: string; // "HH:MM"
  end: string;
  genre: Genre | 'Talk' | 'Workshop';
  kind: Kind;
  headliner?: boolean;
  /** Billing weight: higher = bigger on the poster. */
  billing: number;
  host?: string;
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

type Slot = [name: string, genre: Genre, minutes: number];

/** Build a stage running order from a start time, changeover gap and set list. */
function runningOrder(
  day: DayId,
  stage: StageId,
  start: string,
  gap: number,
  slots: Slot[],
  billingBase: number,
): Act[] {
  let t = toMin(start);
  return slots.map(([name, genre, minutes], i) => {
    const act: Act = {
      id: `${day}-${slug(name)}`,
      name,
      day,
      stage,
      start: toHHMM(t),
      end: toHHMM(t + minutes),
      genre,
      kind: 'music',
      billing: billingBase + i,
    };
    t += minutes + gap;
    return act;
  });
}

// Main Stage: 14:00, 30 min changeovers, headliner closes 21:45–23:30.
// The Hangar: 13:00, 15 min changeovers. Low End: 14:30, 15 min changeovers.
const MAIN: Record<DayId, Slot[]> = {
  fri: [['Ossie Marr', 'Folk', 45], ['Velvet Static', 'Indie', 60], ['Mira Oduya', 'Soul', 60], ['Hotline Saints', 'Hip-hop', 75], ['Juno Vale', 'Pop', 75], ['Nova Kline', 'Electronic', 105]],
  sat: [['Quiet Arsonist', 'Folk', 45], ['Soft Concrete', 'Indie', 60], ['Selah Grey', 'Soul', 60], ['Grit Opera', 'Hip-hop', 75], ['Hana Ishikawa', 'Pop', 75], ['Kairo Sun', 'Hip-hop', 105]],
  sun: [['Juniper Crane', 'Folk', 45], ['Harbour Lights', 'Indie', 60], ['Bea Solano', 'Soul', 60], ['Zola Kent', 'Hip-hop', 75], ['Static Bloom', 'Pop', 75], ['Lola Zenith', 'Pop', 105]],
};
const HANGAR: Record<DayId, Slot[]> = {
  fri: [['Pale Lagoon', 'Ambient', 45], ['Brutal Garden', 'Punk', 45], ['Sable & Finch', 'Indie', 60], ['Ivy Mercado', 'Pop', 60], ['Dr. Okonkwo', 'Afrobeats', 60], ['Cold Brew Choir', 'Soul', 75], ['Paper Tigress', 'Punk', 75]],
  sat: [['Delta Moth', 'Ambient', 45], ['Anvil Hearts', 'Punk', 45], ['Wren & The Wires', 'Indie', 60], ['Frida Lux', 'Pop', 60], ['Temi Adeyemi', 'Afrobeats', 60], ['Neon Psalms', 'Soul', 75], ['Magenta Riot', 'Punk', 75]],
  sun: [['Oren Blume', 'Ambient', 45], ['Kinetic Youth', 'Punk', 45], ['Polar Motel', 'Indie', 60], ['Carmine Waves', 'Indie', 60], ['Ama Serwaa', 'Afrobeats', 60], ['Salt Vesper', 'Soul', 75], ['Concrete Choir', 'Hip-hop', 75]],
};
const LOWEND: Record<DayId, Slot[]> = {
  fri: [['Tessellate', 'Ambient', 45], ['Ferro', 'Hip-hop', 60], ['Rue Delacroix', 'Jazz', 60], ['The Understudies', 'Indie', 60], ['Sister Signal', 'Techno', 60], ['Lumen Drive', 'Electronic', 75], ['Kilo Hertz Club', 'Techno', 90]],
  sat: [['Cleo Marchetti', 'Jazz', 45], ['The Hollow Brass', 'Jazz', 60], ['Yuki Tanabe', 'Electronic', 60], ['Mono Mantra', 'Ambient', 60], ['Bassline Parish', 'Electronic', 60], ['Sub Rosa Unit', 'Techno', 75], ['Low Orbit', 'Techno', 90]],
  sun: [['Tomas Arriaga', 'Folk', 45], ['Idris Faye', 'Jazz', 60], ['Afterglow Assembly', 'Ambient', 60], ['Night Swimmer', 'Electronic', 60], ['Blue Hour Club', 'Electronic', 60], ['Deep Field Radio', 'Techno', 75], ['Vanta', 'Techno', 90]],
};

type Session = [title: string, host: string, kind: 'talk' | 'workshop', start: string, end: string];
const FORUM: Record<DayId, Session[]> = {
  fri: [
    ['Type That Moves', 'Ines Carvalho', 'talk', '12:00', '13:00'],
    ['Variable Fonts, Live', 'Studio Hallmark', 'workshop', '13:30', '15:00'],
    ['Posters for Loud Rooms', 'Dele Martins', 'talk', '15:30', '16:30'],
    ['Designing for Sunlight', 'Priya Anand', 'talk', '17:00', '18:00'],
  ],
  sat: [
    ['The Line-up Is the Artwork', 'Marta Kowalska', 'talk', '12:00', '13:00'],
    ['Risograph Flyer Lab', 'Inkwell Collective', 'workshop', '13:30', '15:00'],
    ['Sound You Can See', 'Theo Brandt', 'talk', '15:30', '16:30'],
    ['Brands at Volume', 'Yemi Ogunleye', 'talk', '17:00', '18:00'],
  ],
  sun: [
    ['Kinetic Type on a Budget', 'Lucía Ferrer', 'talk', '12:00', '13:00'],
    ['Build a Marquee', 'Code & Colour', 'workshop', '13:30', '15:00'],
    ['Accessible Motion', 'Sam Reid', 'talk', '15:30', '16:30'],
    ['What Festivals Remember', 'Hollis Park', 'talk', '17:00', '18:00'],
  ],
};

const days: DayId[] = ['fri', 'sat', 'sun'];

export const MUSIC: Act[] = days.flatMap((day) => {
  const main = runningOrder(day, 'main', '14:00', 30, MAIN[day], 200);
  main[main.length - 1].headliner = true;
  main[main.length - 1].billing = 1000;
  return [
    ...main,
    ...runningOrder(day, 'hangar', '13:00', 15, HANGAR[day], 100),
    ...runningOrder(day, 'lowend', '14:30', 15, LOWEND[day], 100),
  ];
});

export const TALKS: Act[] = days.flatMap((day) =>
  FORUM[day].map(([title, host, kind, start, end], i) => ({
    id: `${day}-${slug(title)}`,
    name: title,
    host,
    day,
    stage: 'forum' as const,
    start,
    end,
    genre: kind === 'talk' ? ('Talk' as const) : ('Workshop' as const),
    kind,
    billing: i,
  })),
);

export const ALL_SETS: Act[] = [...MUSIC, ...TALKS];

/** Line-up order: by day, then billing (headliner first), later slots first. */
export const LINEUP: Act[] = days.flatMap((day) =>
  MUSIC.filter((a) => a.day === day).sort(
    (a, b) => b.billing - a.billing || toMin(b.start) - toMin(a.start),
  ),
);

export const HEADLINERS = LINEUP.filter((a) => a.headliner);

export const topActs = (day: DayId, n = 6) => LINEUP.filter((a) => a.day === day).slice(0, n);

export const GENRES: Genre[] = [...new Set(MUSIC.map((a) => a.genre as Genre))].sort();

/** "FRI 12 JUNE · MAIN STAGE · 21:45–23:30" */
export const actMeta = (a: Act) =>
  `${a.day.toUpperCase()} ${dayById[a.day].label} · ${stageById[a.stage].name.toUpperCase()} · ${a.start}–${a.end}`;

/** Pages that get a mega-type sweep on navigation. */
export const PAGE_TITLES: Record<string, string> = {
  '/': 'PULSE',
  '/lineup/': 'LINE-UP',
  '/schedule/': 'SCHEDULE',
  '/tickets/': 'TICKETS',
  '/venue/': 'VENUE',
  '/faq/': 'FAQ',
  '/press/': 'PRESS',
};
