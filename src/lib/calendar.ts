import { addDays, addMinutes, differenceInMinutes, endOfMonth, setHours, setMinutes, startOfDay, startOfMonth, startOfWeek } from "date-fns";

export const HOUR_HEIGHT = 60; // px á klukkustund í tímaskjá
export const SNAP_MINUTES = 15;
export const MAX_BOOKING_MINUTES = 12 * 60;

export type CalendarView = "day" | "week" | "month";

export const minutesIntoDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
export const minutesToPx = (min: number) => (min / 60) * HOUR_HEIGHT;
export const pxToMinutes = (px: number) => Math.round(((px / HOUR_HEIGHT) * 60) / SNAP_MINUTES) * SNAP_MINUTES;

/** Dagsetning + mínútur frá miðnætti → Date */
export const atMinutes = (day: Date, minutes: number) => addMinutes(startOfDay(day), minutes);

export const timeAt = (day: Date, hour: number, minute = 0) => setMinutes(setHours(startOfDay(day), hour), minute);

export const pad = (n: number) => String(n).padStart(2, "0");
export const formatClock = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
export const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const formatDuration = (minutes: number, lang: "is" | "en") => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === "is") {
    if (h === 0) return `${m} mín.`;
    if (m === 0) return `${h} klst.`;
    return `${h} klst. ${m} mín.`;
  }
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
};

export const durationMinutes = (start: Date, end: Date) => differenceInMinutes(end, start);

/** Tímar í boði í veljara: 00:00 … 23:45 (og 24:00 sem lokatími) */
export const timeOptions = (includeMidnightEnd = false) => {
  const out: number[] = [];
  for (let m = 0; m < 24 * 60; m += SNAP_MINUTES) out.push(m);
  if (includeMidnightEnd) out.push(24 * 60);
  return out;
};

export const roundUpToSnap = (d: Date) => {
  const m = minutesIntoDay(d);
  return Math.ceil(m / SNAP_MINUTES) * SNAP_MINUTES;
};

export const monthRange = (date: Date) => {
  const gridStart = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const gridEnd = addDays(lastWeekStart, 7);
  return { gridStart, gridEnd };
};

export const ucfirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
