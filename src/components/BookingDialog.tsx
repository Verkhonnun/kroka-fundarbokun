import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Booking, PublicProfile } from "@/hooks/useBookings";
import {
  atMinutes,
  durationMinutes,
  formatClock,
  formatDuration,
  MAX_BOOKING_MINUTES,
  minutesIntoDay,
  timeOptions,
  ucfirst,
} from "@/lib/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import UserAvatar from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface BookingDraft {
  date: Date;
  startMinutes: number;
  endMinutes: number;
}

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Núverandi bókun (breyta/skoða) eða drög að nýrri */
  booking?: Booking | null;
  draft?: BookingDraft | null;
  owner?: PublicProfile | null;
}

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

const toDateInput = (d: Date) => format(d, "yyyy-MM-dd");
const fromDateInput = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const BookingDialog = ({ open, onOpenChange, booking, draft, owner }: BookingDialogProps) => {
  const { user, isAdmin } = useAuth();
  const { t, language, locale } = useLanguage();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateStr, setDateStr] = useState(toDateInput(new Date()));
  const [startMin, setStartMin] = useState(9 * 60);
  const [endMin, setEndMin] = useState(10 * 60);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = !!booking;
  const canEdit = !booking || booking.user_id === user?.id || isAdmin;
  const editingAsAdmin = !!booking && booking.user_id !== user?.id && isAdmin;

  useEffect(() => {
    if (!open) return;
    if (booking) {
      const s = new Date(booking.start_time);
      const e = new Date(booking.end_time);
      setTitle(booking.title);
      setDescription(booking.description ?? "");
      setDateStr(toDateInput(s));
      setStartMin(minutesIntoDay(s));
      // Bókun sem nær yfir miðnætti er klippt við 24:00 í forminu
      setEndMin(e.getDate() === s.getDate() ? minutesIntoDay(e) : 24 * 60);
    } else if (draft) {
      setTitle("");
      setDescription("");
      setDateStr(toDateInput(draft.date));
      setStartMin(draft.startMinutes);
      setEndMin(draft.endMinutes);
    }
  }, [open, booking, draft]);

  const startOptions = useMemo(() => timeOptions(false), []);
  const endOptions = useMemo(() => timeOptions(true).filter((m) => m > startMin), [startMin]);

  const onStartChange = (value: number) => {
    // Haltu lengd bókunar óbreyttri þegar upphafstíma er breytt
    const length = Math.max(15, endMin - startMin);
    setStartMin(value);
    setEndMin(Math.min(24 * 60, value + length));
  };

  const validate = (): string | null => {
    if (!title.trim()) return t.booking.titleRequired;
    if (endMin <= startMin) return t.booking.endBeforeStart;
    if (endMin - startMin > MAX_BOOKING_MINUTES) return t.booking.tooLong;
    return null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }

    const day = fromDateInput(dateStr);
    const start = atMinutes(day, startMin);
    const end = atMinutes(day, endMin);

    const timesChanged =
      !booking || new Date(booking.start_time).getTime() !== start.getTime() || new Date(booking.end_time).getTime() !== end.getTime();
    if (timesChanged && end <= new Date()) {
      toast.error(t.booking.inPast);
      return;
    }

    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    };

    const { error } = booking
      ? await supabase.from("bookings").update(payload).eq("id", booking.id)
      : await supabase.from("bookings").insert({ ...payload, user_id: user.id });
    setSaving(false);

    if (error) {
      // 23P01 = exclusion_violation (tvíbókun)
      toast.error(error.code === "23P01" ? t.booking.conflict : t.booking.failed);
      if (error.code === "23P01") qc.invalidateQueries({ queryKey: ["bookings"] });
      return;
    }

    toast.success(booking ? t.booking.updated : t.booking.created);
    qc.invalidateQueries({ queryKey: ["bookings"] });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!booking) return;
    setSaving(true);
    const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
    setSaving(false);
    setConfirmDelete(false);
    if (error) {
      toast.error(t.booking.failed);
      return;
    }
    toast.success(t.booking.deleted);
    qc.invalidateQueries({ queryKey: ["bookings"] });
    onOpenChange(false);
  };

  const dayLabel = ucfirst(format(fromDateInput(dateStr), "EEEE d. MMMM yyyy", { locale }));
  const length = endMin - startMin;

  // Skoðunarhamur fyrir bókanir annarra
  if (isEdit && !canEdit) {
    const s = new Date(booking!.start_time);
    const e = new Date(booking!.end_time);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-6">{booking!.title}</DialogTitle>
            <DialogDescription>{ucfirst(format(s, "EEEE d. MMMM yyyy", { locale }))}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="text-lg font-medium tabular-nums">
              {format(s, "HH:mm")} – {format(e, "HH:mm")}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {formatDuration(durationMinutes(s, e), language)}
              </span>
            </div>
            {booking!.description && <p className="whitespace-pre-wrap text-muted-foreground">{booking!.description}</p>}
            <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-3">
              <UserAvatar profile={owner} className="h-10 w-10" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{t.booking.bookedBy}</div>
                <div className="truncate font-medium">{owner?.full_name || owner?.email || "—"}</div>
                {owner?.full_name && <div className="truncate text-xs text-muted-foreground">{owner.email}</div>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEdit ? t.booking.editTitle : t.booking.newTitle}</DialogTitle>
              <DialogDescription>{dayLabel}</DialogDescription>
            </DialogHeader>

            {editingAsAdmin && (
              <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-3 text-sm">
                <UserAvatar profile={owner} className="h-8 w-8" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{owner?.full_name || owner?.email}</div>
                  <div className="text-xs text-muted-foreground">{t.booking.adminEdit}</div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="booking-title">{t.booking.title}</Label>
              <Input
                id="booking-title"
                autoFocus={!isEdit}
                value={title}
                maxLength={100}
                placeholder={t.booking.titlePlaceholder}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="booking-date">{t.booking.date}</Label>
              <Input id="booking-date" type="date" value={dateStr} onChange={(e) => e.target.value && setDateStr(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="booking-start">{t.booking.start}</Label>
                <select id="booking-start" className={selectClass} value={startMin} onChange={(e) => onStartChange(Number(e.target.value))}>
                  {startOptions.map((m) => (
                    <option key={m} value={m}>
                      {formatClock(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="booking-end">{t.booking.end}</Label>
                <select id="booking-end" className={selectClass} value={endMin} onChange={(e) => setEndMin(Number(e.target.value))}>
                  {endOptions.map((m) => (
                    <option key={m} value={m}>
                      {m === 24 * 60 ? "24:00" : formatClock(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">{t.booking.duration(formatDuration(Math.max(0, length), language))}</p>

            <div className="space-y-1.5">
              <Label htmlFor="booking-description">{t.booking.description}</Label>
              <Textarea
                id="booking-description"
                rows={2}
                maxLength={500}
                value={description}
                placeholder={t.booking.descriptionPlaceholder}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {isEdit ? (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t.delete}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t.cancel}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saving ? t.booking.saving : isEdit ? t.booking.update : t.booking.book}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.booking.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {booking?.title} – {t.booking.deleteMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BookingDialog;
