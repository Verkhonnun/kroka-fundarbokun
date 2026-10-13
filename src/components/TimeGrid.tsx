import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, endOfDay, format, isSameDay, isToday, startOfDay } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Booking, PublicProfile } from "@/hooks/useBookings";
import type { OfficeSettingsRow } from "@/integrations/supabase/types";
import {
  atMinutes,
  formatClock,
  formatTime,
  HOUR_HEIGHT,
  minutesIntoDay,
  minutesToPx,
  pxToMinutes,
  SNAP_MINUTES,
} from "@/lib/calendar";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import type { BookingDraft } from "@/components/BookingDialog";

interface TimeGridProps {
  days: Date[];
  bookings: Booking[];
  profiles: Map<string, PublicProfile> | undefined;
  office: Pick<OfficeSettingsRow, "office_start_hour" | "office_end_hour" | "gray_weekends">;
  now: Date;
  onSelectRange: (draft: BookingDraft) => void;
  onOpenBooking: (booking: Booking) => void;
}

interface Segment {
  booking: Booking;
  startMin: number;
  endMin: number;
}

const GUTTER = "3.25rem";
const DAY_MINUTES = 24 * 60;

const TimeGrid = ({ days, bookings, profiles, office, now, onSelectRange, onOpenBooking }: TimeGridProps) => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ dayIndex: number; anchor: number; current: number } | null>(null);

  // Bókanir klipptar niður í hluta fyrir hvern dag
  const segmentsByDay = useMemo(
    () =>
      days.map((day) => {
        const dayStart = startOfDay(day).getTime();
        const dayEnd = endOfDay(day).getTime() + 1;
        return bookings
          .filter((b) => new Date(b.start_time).getTime() < dayEnd && new Date(b.end_time).getTime() > dayStart)
          .map<Segment>((b) => {
            const s = Math.max(new Date(b.start_time).getTime(), dayStart);
            const e = Math.min(new Date(b.end_time).getTime(), dayEnd);
            return { booking: b, startMin: (s - dayStart) / 60000, endMin: (e - dayStart) / 60000 };
          })
          .sort((a, b) => a.startMin - b.startMin);
      }),
    [days, bookings],
  );

  // Skrunaðu að opnunartíma (eða núverandi tíma ef í dag) þegar yfirlit breytist
  const firstDayKey = days[0]?.toDateString();
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasToday = days.some(isToday);
    const targetHour = hasToday ? Math.max(0, now.getHours() - 1) : Math.max(0, office.office_start_hour - 1);
    el.scrollTop = targetHour * HOUR_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDayKey, days.length, office.office_start_hour]);

  const minutesFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(DAY_MINUTES, Math.max(0, pxToMinutes(e.clientY - rect.top)));
  };

  /** Takmarkar dregið svæði við lausan tíma (rekst ekki á bókanir). */
  const clampToFree = (dayIndex: number, anchor: number, pointer: number) => {
    const segs = segmentsByDay[dayIndex];
    if (pointer >= anchor) {
      const limit = segs.find((s) => s.startMin >= anchor)?.startMin ?? DAY_MINUTES;
      return Math.min(pointer, limit);
    }
    const prev = [...segs].reverse().find((s) => s.endMin <= anchor)?.endMin ?? 0;
    return Math.max(pointer, prev);
  };

  const onPointerDown = (dayIndex: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-booking]")) return;
    const m = Math.min(minutesFromEvent(e), DAY_MINUTES - SNAP_MINUTES);
    // Snertitæki: aðeins "tap" (dráttur er notaður til að skruna)
    if (e.pointerType !== "touch") e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ dayIndex, anchor: m, current: m });
  };

  const onPointerMove = (dayIndex: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.dayIndex !== dayIndex || e.pointerType === "touch") return;
    setDrag({ ...drag, current: clampToFree(dayIndex, drag.anchor, minutesFromEvent(e)) });
  };

  const finishDrag = (dayIndex: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.dayIndex !== dayIndex) return;
    const start = Math.min(drag.anchor, drag.current);
    let end = Math.max(drag.anchor, drag.current);
    // Smellur án þess að draga → 1 klst. bókun (eða 30 mín. ef rekst á næstu bókun)
    if (end - start < SNAP_MINUTES) {
      const next = segmentsByDay[dayIndex].find((s) => s.startMin >= start)?.startMin ?? DAY_MINUTES;
      end = Math.min(start + 60, next);
      if (end - start < SNAP_MINUTES) {
        setDrag(null);
        return;
      }
    }
    setDrag(null);
    onSelectRange({ date: days[dayIndex], startMinutes: start, endMinutes: end });
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const nowMin = minutesIntoDay(now);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Dagahaus */}
      <div className="grid border-b bg-card" style={{ gridTemplateColumns: `${GUTTER} repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className="border-l py-2 text-center">
              <div className={cn("text-[0.7rem] font-medium uppercase tracking-wide", today ? "text-foreground" : "text-muted-foreground")}>
                {format(day, "EEE", { locale })}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-lg font-medium tabular-nums",
                  today && "bg-primary text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tímaskjár */}
      <div ref={scrollRef} className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative grid" style={{ gridTemplateColumns: `${GUTTER} repeat(${days.length}, minmax(0, 1fr))`, height: HOUR_HEIGHT * 24 }}>
          {/* Tímagutter */}
          <div className="relative">
            {hours.slice(1).map((h) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 text-[0.7rem] tabular-nums text-muted-foreground" style={{ top: h * HOUR_HEIGHT }}>
                {formatClock(h * 60)}
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            const dayIsToday = isToday(day);
            const dayIsPast = !dayIsToday && day < startOfDay(now);
            const dragSel = drag && drag.dayIndex === dayIndex ? { start: Math.min(drag.anchor, drag.current), end: Math.max(drag.anchor, drag.current) } : null;
            const selEnd = dragSel ? Math.max(dragSel.end, dragSel.start + SNAP_MINUTES) : 0;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative cursor-cell touch-pan-y-only select-none border-l",
                  office.gray_weekends && weekend && "bg-muted/50",
                )}
                onPointerDown={onPointerDown(dayIndex)}
                onPointerMove={onPointerMove(dayIndex)}
                onPointerUp={finishDrag(dayIndex)}
                onPointerCancel={() => setDrag(null)}
              >
                {/* Utan opnunartíma */}
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-muted/60" style={{ height: minutesToPx(office.office_start_hour * 60) }} />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 bg-muted/60"
                  style={{ height: minutesToPx((24 - office.office_end_hour) * 60) }}
                />

                {/* Klukkustundalínur */}
                {hours.slice(1).map((h) => (
                  <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-border/70" style={{ top: h * HOUR_HEIGHT }} />
                ))}
                {hours.map((h) => (
                  <div key={`half-${h}`} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/40" style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}

                {/* Liðinn tími */}
                {(dayIsPast || dayIsToday) && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 bg-background/55"
                    style={{ height: dayIsPast ? "100%" : minutesToPx(nowMin) }}
                  />
                )}

                {/* Valið svæði */}
                {dragSel && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-10 rounded-md border-2 border-brand bg-brand/30 px-2 py-1 text-xs font-medium"
                    style={{ top: minutesToPx(dragSel.start), height: minutesToPx(selEnd - dragSel.start) }}
                  >
                    {formatClock(dragSel.start)} – {formatClock(selEnd)}
                  </div>
                )}

                {/* Bókanir */}
                {segmentsByDay[dayIndex].map(({ booking, startMin, endMin }) => {
                  const mine = booking.user_id === user?.id;
                  const owner = profiles?.get(booking.user_id);
                  const height = Math.max(minutesToPx(endMin - startMin) - 2, 18);
                  const tall = height >= 52;
                  const wide = days.length <= 2;
                  return (
                    <button
                      type="button"
                      key={booking.id}
                      data-booking
                      onClick={() => onOpenBooking(booking)}
                      className={cn(
                        "absolute inset-x-1 z-10 flex cursor-pointer flex-col overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-xs shadow-sm outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring",
                        mine
                          ? "border-l-brand bg-primary text-primary-foreground"
                          : "border-l-[hsl(214_45%_48%)] bg-[hsl(214_32%_90%)] text-[hsl(214_45%_18%)]",
                      )}
                      style={{ top: minutesToPx(startMin) + 1, height }}
                      aria-label={`${booking.title}, ${formatTime(atMinutes(day, startMin))}–${formatTime(atMinutes(day, endMin))}`}
                    >
                      <div className="flex items-start gap-1.5">
                        {(tall || wide) && <UserAvatar profile={owner} className="mt-0.5 h-5 w-5 shrink-0 text-[0.55rem]" />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold leading-tight">{booking.title}</div>
                          {height >= 34 && (
                            <div className={cn("truncate leading-tight tabular-nums", mine ? "text-primary-foreground/75" : "opacity-75")}>
                              {formatTime(new Date(booking.start_time))}–{formatTime(new Date(booking.end_time))}
                            </div>
                          )}
                          {tall && !mine && (days.length <= 3 || tall) && (
                            <div className="mt-0.5 hidden truncate opacity-75 sm:block">{owner?.full_name || owner?.email}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Núverandi tími */}
                {dayIsToday && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: minutesToPx(nowMin) }}>
                    <div className="relative h-0 border-t-2 border-brand">
                      <span className="absolute -left-1.5 -top-[7px] h-3 w-3 rounded-full bg-brand ring-2 ring-card" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimeGrid;
