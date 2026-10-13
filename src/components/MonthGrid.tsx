import { useMemo } from "react";
import { addDays, endOfMonth, format, isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Booking, PublicProfile } from "@/hooks/useBookings";
import type { OfficeSettingsRow } from "@/integrations/supabase/types";
import { formatTime, monthRange } from "@/lib/calendar";
import { cn } from "@/lib/utils";

interface MonthGridProps {
  date: Date;
  bookings: Booking[];
  profiles: Map<string, PublicProfile> | undefined;
  office: Pick<OfficeSettingsRow, "gray_weekends">;
  onOpenDay: (day: Date) => void;
  onOpenBooking: (booking: Booking) => void;
}

const MAX_CHIPS = 3;

const MonthGrid = ({ date, bookings, office, onOpenDay, onOpenBooking }: MonthGridProps) => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const { gridStart, gridEnd } = monthRange(date);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let d = gridStart; d < gridEnd; d = addDays(d, 1)) out.push(d);
    return out;
  }, [gridStart.getTime(), gridEnd.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      // bókun sem nær yfir miðnætti birtist á báðum dögum
      for (let d = startOfDay(new Date(b.start_time)); d < new Date(b.end_time); d = addDays(d, 1)) {
        const key = format(d, "yyyy-MM-dd");
        map.set(key, [...(map.get(key) ?? []), b]);
      }
    }
    return map;
  }, [bookings]);

  const weekdayLabels = days.slice(0, 7).map((d) => format(d, "EEE", { locale }));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="grid grid-cols-7 border-b">
        {weekdayLabels.map((label, i) => (
          <div key={i} className="py-2 text-center text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 overflow-y-auto" style={{ gridAutoRows: "minmax(5.5rem, 1fr)" }}>
        {days.map((day) => {
          const list = byDay.get(format(day, "yyyy-MM-dd")) ?? [];
          const inMonth = isSameMonth(day, date);
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onOpenDay(day)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpenDay(day)}
              className={cn(
                "flex min-w-0 cursor-pointer flex-col gap-0.5 border-b border-l p-1 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                !inMonth && "bg-muted/40 text-muted-foreground",
                inMonth && office.gray_weekends && weekend && "bg-muted/50",
              )}
            >
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-medium tabular-nums",
                  isToday(day) && "bg-primary text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </div>
              {list.slice(0, MAX_CHIPS).map((b) => {
                const mine = b.user_id === user?.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenBooking(b);
                    }}
                    className={cn(
                      "truncate rounded border-l-2 px-1 py-0.5 text-left text-[0.7rem] leading-tight",
                      mine
                        ? "border-l-brand bg-primary text-primary-foreground"
                        : "border-l-[hsl(214_45%_48%)] bg-[hsl(214_32%_90%)] text-[hsl(214_45%_18%)]",
                    )}
                  >
                    <span className="tabular-nums opacity-75">{formatTime(new Date(b.start_time))}</span> {b.title}
                  </button>
                );
              })}
              {list.length > MAX_CHIPS && <div className="px-1 text-[0.7rem] text-muted-foreground">{t.calendar.more(list.length - MAX_CHIPS)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthGrid;
