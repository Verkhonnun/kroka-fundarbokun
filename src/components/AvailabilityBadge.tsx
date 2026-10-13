import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Booking } from "@/hooks/useBookings";
import { formatTime } from "@/lib/calendar";

/** Sýnir hvort herbergið er laust núna og hvenær næsta bókun hefst. */
const AvailabilityBadge = ({ bookings, now }: { bookings: Booking[]; now: Date }) => {
  const { t } = useLanguage();

  const state = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const current = sorted.find((b) => new Date(b.start_time) <= now && new Date(b.end_time) > now);
    if (current) {
      // Sameina bókanir sem koma strax hver á eftir annarri
      let end = new Date(current.end_time);
      for (const b of sorted) if (new Date(b.start_time).getTime() === end.getTime()) end = new Date(b.end_time);
      return { busy: true, label: t.calendar.busyUntil(formatTime(end)) };
    }
    const next = sorted.find((b) => new Date(b.start_time) > now);
    const sameDay = next && new Date(next.start_time).toDateString() === now.toDateString();
    return {
      busy: false,
      label: sameDay ? t.calendar.freeNowUntil(formatTime(new Date(next.start_time))) : t.calendar.freeNowAllDay,
    };
  }, [bookings, now, t]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
        state.busy ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-success/30 bg-success/10 text-success",
      )}
      role="status"
    >
      <span className="relative flex h-2 w-2">
        {!state.busy && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", state.busy ? "bg-destructive" : "bg-success")} />
      </span>
      {state.label}
    </div>
  );
};

export default AvailabilityBadge;
