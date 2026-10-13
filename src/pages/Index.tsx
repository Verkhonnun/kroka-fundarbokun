import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { addDays, addMonths, addWeeks, endOfDay, format, isSameDay, isToday, parse, startOfDay, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import AppShell from "@/components/AppShell";
import AvailabilityBadge from "@/components/AvailabilityBadge";
import BookingDialog, { type BookingDraft } from "@/components/BookingDialog";
import MonthGrid from "@/components/MonthGrid";
import TimeGrid from "@/components/TimeGrid";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DEFAULT_OFFICE,
  useBookings,
  useBookingsRealtime,
  useNow,
  useOfficeSettings,
  useProfilesMap,
  type Booking,
} from "@/hooks/useBookings";
import { monthRange, roundUpToSnap, ucfirst, type CalendarView } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const DATE_FMT = "yyyy-MM-dd";

const Index = () => {
  const { t, locale } = useLanguage();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const now = useNow();

  useBookingsRealtime();

  const rawView = params.get("v") as CalendarView | null;
  const requestedView: CalendarView = rawView === "day" || rawView === "week" || rawView === "month" ? rawView : isMobile ? "day" : "week";
  // Vikuyfirlit er of þröngt í síma → sýnum dagsyfirlit
  const view: CalendarView = isMobile && requestedView === "week" ? "day" : requestedView;

  const date = useMemo(() => {
    const raw = params.get("d");
    const parsed = raw ? parse(raw, DATE_FMT, new Date()) : null;
    return parsed && !isNaN(parsed.getTime()) ? parsed : startOfDay(new Date());
  }, [params]);

  const setState = useCallback(
    (next: { view?: CalendarView; date?: Date }) => {
      const p = new URLSearchParams(params);
      p.set("v", next.view ?? view);
      p.set("d", format(next.date ?? date, DATE_FMT));
      setParams(p, { replace: true });
    },
    [params, setParams, view, date],
  );

  const days = useMemo(() => {
    if (view === "day") return [date];
    const start = startOfWeek(date, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [view, date]);

  const range = useMemo(() => {
    if (view === "month") {
      const { gridStart, gridEnd } = monthRange(date);
      return { from: gridStart, to: gridEnd };
    }
    return { from: startOfDay(days[0]), to: addDays(startOfDay(days[days.length - 1]), 1) };
  }, [view, date, days]);

  const { data: bookings = [], isError } = useBookings(range.from, range.to);
  const todayStart = startOfDay(now);
  const { data: todaysBookings = [] } = useBookings(todayStart, addDays(todayStart, 2));
  const { data: profiles } = useProfilesMap();
  const { data: officeData } = useOfficeSettings();
  const office = officeData ?? { id: true, ...DEFAULT_OFFICE, updated_at: "" };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);

  const openNew = useCallback(
    (d?: BookingDraft) => {
      setSelected(null);
      if (d) setDraft(d);
      else {
        // Næsta lausi tími: núna (upp á 15 mín.) eða opnunartími ef utan hans
        const day = isSameDay(date, now) ? now : date;
        const start = isSameDay(date, now) ? roundUpToSnap(now) : office.office_start_hour * 60;
        setDraft({ date: startOfDay(day), startMinutes: Math.min(start, 23 * 60), endMinutes: Math.min(start + 60, 24 * 60) });
      }
      setDialogOpen(true);
    },
    [date, now, office.office_start_hour],
  );

  const openBooking = (b: Booking) => {
    setSelected(b);
    setDraft(null);
    setDialogOpen(true);
  };

  const step = (dir: 1 | -1) => {
    const next = view === "day" ? addDays(date, dir) : view === "week" ? addWeeks(date, dir) : addMonths(date, dir);
    setState({ date: next });
  };

  // Flýtilyklar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (dialogOpen || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === "t") setState({ date: startOfDay(new Date()) });
      else if (k === "arrowleft" || k === "j") step(-1);
      else if (k === "arrowright" || k === "k") step(1);
      else if (k === "n") {
        e.preventDefault();
        openNew();
      } else if (k === "d") setState({ view: "day" });
      else if (k === "w" && !isMobile) setState({ view: "week" });
      else if (k === "m") setState({ view: "month" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title = ucfirst(((): string => {
    if (view === "month") return format(date, "LLLL yyyy", { locale });
    if (view === "day") return format(date, isMobile ? "EEE d. MMM" : "EEEE d. MMMM yyyy", { locale });
    const first = days[0];
    const last = days[6];
    const sameMonth = first.getMonth() === last.getMonth();
    return sameMonth
      ? `${format(first, "d.", { locale })} – ${format(last, "d. MMMM yyyy", { locale })}`
      : `${format(first, "d. MMM", { locale })} – ${format(last, "d. MMM yyyy", { locale })}`;
  })());

  const weekStrip = view === "day" && isMobile ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date, { weekStartsOn: 1 }), i)) : null;
  const selectedOwner = selected ? profiles?.get(selected.user_id) : undefined;

  return (
    <AppShell wide>
      <div className="flex h-[calc(100dvh-8.5rem)] min-h-[28rem] flex-col gap-3 sm:h-[calc(100dvh-9.5rem)]">
        {/* Tækjastika */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setState({ date: startOfDay(new Date()) })} disabled={view !== "month" && days.some(isToday) && isSameDay(date, now) && view === "day"}>
              {t.calendar.today}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => step(-1)} aria-label={t.calendar.prev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => step(1)} aria-label={t.calendar.next}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold sm:text-xl">{title}</h1>

          <div className="hidden lg:block">
            <AvailabilityBadge bookings={todaysBookings} now={now} />
          </div>

          <Tabs value={view} onValueChange={(v) => setState({ view: v as CalendarView })}>
            <TabsList className="h-9">
              <TabsTrigger value="day">{t.calendar.day}</TabsTrigger>
              {!isMobile && <TabsTrigger value="week">{t.calendar.week}</TabsTrigger>}
              <TabsTrigger value="month">{t.calendar.month}</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button size="sm" className="hidden sm:inline-flex" onClick={() => openNew()}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t.calendar.newBooking}
          </Button>
        </div>

        <div className="lg:hidden">
          <AvailabilityBadge bookings={todaysBookings} now={now} />
        </div>

        {weekStrip && (
          <div className="grid grid-cols-7 gap-1">
            {weekStrip.map((d) => {
              const active = isSameDay(d, date);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setState({ date: d })}
                  className={cn(
                    "flex flex-col items-center rounded-lg py-1.5 text-xs transition-colors",
                    active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary",
                    !active && isToday(d) && "ring-1 ring-brand",
                  )}
                >
                  <span className="uppercase">{format(d, "EEEEEE", { locale })}</span>
                  <span className="text-base font-semibold tabular-nums">{format(d, "d")}</span>
                </button>
              );
            })}
          </div>
        )}

        {isError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{t.errorGeneric}</div>}

        {view === "month" ? (
          <MonthGrid
            date={date}
            bookings={bookings}
            profiles={profiles}
            office={office}
            onOpenDay={(d) => setState({ view: "day", date: d })}
            onOpenBooking={openBooking}
          />
        ) : (
          <TimeGrid
            days={days}
            bookings={bookings}
            profiles={profiles}
            office={office}
            now={now}
            onSelectRange={(d) => {
              setSelected(null);
              setDraft(d);
              setDialogOpen(true);
            }}
            onOpenBooking={openBooking}
          />
        )}

        <p className="hidden text-xs text-muted-foreground lg:block">{t.calendar.shortcuts}</p>
      </div>

      {/* Fljótandi hnappur í síma */}
      <Button
        size="lg"
        className="fixed bottom-5 right-5 z-20 h-14 rounded-full px-5 shadow-lg sm:hidden"
        onClick={() => openNew()}
        aria-label={t.calendar.newBooking}
      >
        <Plus className="mr-1.5 h-5 w-5" />
        {t.calendar.newBooking}
      </Button>

      <BookingDialog open={dialogOpen} onOpenChange={setDialogOpen} booking={selected} draft={draft} owner={selectedOwner} />
    </AppShell>
  );
};

export default Index;
