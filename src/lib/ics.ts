/**
 * In-browser .ics generation for "My PULSE" (FR-6). RFC 5545: CRLF line
 * endings, 75-octet folding, escaped text, UTC times.
 */
import { FESTIVAL, dayById, stageById, type Act } from '../data/festival';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local festival time -> UTC basic format (20270612T204500Z). */
function toUtc(date: string, hhmm: string) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h - FESTIVAL.utcOffsetHours, mi));
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Fold lines longer than 75 octets (UTF-8 aware). */
function fold(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (enc.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs(sets: Act[], now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PULSE 27//My PULSE//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:My PULSE 27',
  ];
  for (const s of sets) {
    const day = dayById[s.day];
    const stage = stageById[s.stage].name;
    const what = s.kind === 'music' ? s.genre : `${s.genre} with ${s.host}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@pulse27.example`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toUtc(day.date, s.start)}`,
      `DTEND:${toUtc(day.date, s.end)}`,
      `SUMMARY:${esc(`${s.name} — PULSE 27`)}`,
      `LOCATION:${esc(`${stage}, ${FESTIVAL.venue}, ${FESTIVAL.city}`)}`,
      `DESCRIPTION:${esc(`${stage} · ${s.start}–${s.end} · ${what}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(sets: Act[], filename = 'my-pulse-27.ics') {
  const blob = new Blob([buildIcs(sets)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.dataset.noSweep = '';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
