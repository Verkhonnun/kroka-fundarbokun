import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, KeyRound, Loader2, MoreHorizontal, Search, ShieldCheck, ShieldOff, Trash2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import UserAvatar from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRow } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DEFAULT_OFFICE, useOfficeSettings } from "@/hooks/useBookings";
import { formatClock } from "@/lib/calendar";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Nær í villuboð úr edge function (supabase-js felur þau í context). */
const functionError = async (error: unknown): Promise<string | null> => {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      return (await ctx.json())?.error ?? null;
    } catch {
      return null;
    }
  }
  return (error as Error)?.message ?? null;
};

const Admin = () => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<ProfileRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProfileRow[];
    },
  });

  const { data: adminIds = new Set<string>() } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id as string));
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
    qc.invalidateQueries({ queryKey: ["profiles-public"] });
  };

  const setApproved = useMutation({
    mutationFn: async ({ p, approved }: { p: ProfileRow; approved: boolean }) => {
      const { error } = await supabase.from("profiles").update({ approved }).eq("id", p.id);
      if (error) throw error;
      if (approved) {
        // Tölvupóstur er aukaatriði; mistakist hann er aðgangurinn samt samþykktur
        const { error: mailError } = await supabase.functions.invoke("send-approval-email", { body: { userId: p.id } });
        if (mailError) console.warn("Approval email failed:", await functionError(mailError));
      }
      return approved;
    },
    onSuccess: (approved) => {
      toast.success(approved ? t.admin.approvedToast : t.admin.revokedToast);
      refresh();
    },
    onError: () => toast.error(t.admin.failed),
  });

  const setAdmin = useMutation({
    mutationFn: async ({ p, makeAdmin }: { p: ProfileRow; makeAdmin: boolean }) => {
      const q = makeAdmin
        ? supabase.from("user_roles").insert({ user_id: p.id, role: "admin" })
        : supabase.from("user_roles").delete().eq("user_id", p.id).eq("role", "admin");
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.admin.roleUpdated);
      refresh();
    },
    onError: () => toast.error(t.admin.failed),
  });

  const sendReset = useMutation({
    mutationFn: async (p: ProfileRow) => {
      const { error } = await supabase.functions.invoke("send-password-reset", { body: { email: p.email } });
      if (error) throw new Error((await functionError(error)) ?? t.admin.failed);
    },
    onSuccess: () => toast.success(t.admin.resetSent),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (p: ProfileRow) => {
      const { error } = await supabase.functions.invoke("delete-user", { body: { userId: p.id } });
      if (error) throw new Error((await functionError(error)) ?? t.admin.failed);
    },
    onSuccess: () => {
      toast.success(t.admin.deleted);
      qc.invalidateQueries({ queryKey: ["bookings"] });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setDeleting(null),
  });

  const { pending, approved } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (profiles ?? []).filter((p) => !q || p.email.toLowerCase().includes(q) || (p.full_name ?? "").toLowerCase().includes(q));
    return { pending: list.filter((p) => !p.approved), approved: list.filter((p) => p.approved) };
  }, [profiles, search]);

  const row = (p: ProfileRow) => {
    const isSelf = p.id === user?.id;
    const isAdminUser = adminIds.has(p.id);
    return (
      <li key={p.id} className="flex items-center gap-3 py-3">
        <UserAvatar profile={p} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{p.full_name || "—"}</span>
            {isAdminUser && (
              <Badge variant="secondary" className="shrink-0">
                <ShieldCheck className="mr-1 h-3 w-3" />
                {t.admin.admin}
              </Badge>
            )}
          </div>
          <div className="truncate text-sm text-muted-foreground">{p.email}</div>
          <div className="text-xs text-muted-foreground">{t.admin.registered(format(new Date(p.created_at), "d. MMM yyyy", { locale }))}</div>
        </div>

        {!p.approved && (
          <Button size="sm" onClick={() => setApproved.mutate({ p, approved: true })} disabled={setApproved.isPending}>
            <Check className="mr-1.5 h-4 w-4" />
            {t.admin.approve}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Meira">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {p.approved && !isSelf && (
              <DropdownMenuItem onSelect={() => setApproved.mutate({ p, approved: false })}>
                <UserMinus className="mr-2 h-4 w-4" />
                {t.admin.revoke}
              </DropdownMenuItem>
            )}
            {p.approved && !isSelf && (
              <DropdownMenuItem onSelect={() => setAdmin.mutate({ p, makeAdmin: !isAdminUser })}>
                {isAdminUser ? <ShieldOff className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {isAdminUser ? t.admin.removeAdmin : t.admin.makeAdmin}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => sendReset.mutate(p)}>
              <KeyRound className="mr-2 h-4 w-4" />
              {t.admin.resetLink}
            </DropdownMenuItem>
            {!isSelf && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleting(p)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t.admin.deleteUser}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.admin.title}</h1>
            <p className="text-sm text-muted-foreground">{t.admin.subtitle}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{t.admin.createUser}</span>
            <span className="sm:hidden">+</span>
          </Button>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">
              {t.admin.users}
              {(profiles?.filter((p) => !p.approved).length ?? 0) > 0 && (
                <span className="ml-2 rounded-full bg-brand px-1.5 text-xs font-semibold text-brand-foreground">{profiles!.filter((p) => !p.approved).length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings">{t.admin.settings}</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.admin.searchPlaceholder} className="pl-9" />
            </div>

            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                {pending.length > 0 && (
                  <Card className="border-brand/60">
                    <CardHeader className="pb-0">
                      <CardTitle className="text-base">
                        {t.admin.pending} <span className="text-muted-foreground">({pending.length})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="divide-y">{pending.map(row)}</ul>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardHeader className="pb-0">
                    <CardTitle className="text-base">
                      {t.admin.approved} <span className="text-muted-foreground">({approved.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>{approved.length ? <ul className="divide-y">{approved.map(row)}</ul> : <p className="py-6 text-center text-sm text-muted-foreground">{t.admin.none}</p>}</CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="settings">
            <OfficeSettingsCard />
          </TabsContent>
        </Tabs>
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.admin.deleteMessage(deleting?.full_name || deleting?.email || "")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteUser.mutate(deleting);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

const OfficeSettingsCard = () => {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { data } = useOfficeSettings();
  const [start, setStart] = useState(DEFAULT_OFFICE.office_start_hour);
  const [end, setEnd] = useState(DEFAULT_OFFICE.office_end_hour);
  const [gray, setGray] = useState(DEFAULT_OFFICE.gray_weekends);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setStart(data.office_start_hour);
    setEnd(data.office_end_hour);
    setGray(data.gray_weekends);
  }, [data]);

  const save = async () => {
    if (end <= start) return toast.error(t.admin.invalidHours);
    setSaving(true);
    const { error } = await supabase.from("office_settings").update({ office_start_hour: start, office_end_hour: end, gray_weekends: gray }).eq("id", true);
    setSaving(false);
    if (error) return toast.error(t.admin.failed);
    qc.invalidateQueries({ queryKey: ["office-settings"] });
    toast.success(t.admin.settingsSaved);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.admin.officeHours}</CardTitle>
        <CardDescription>{t.admin.officeHoursHelp}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="office-start">{t.admin.startHour}</Label>
            <select id="office-start" className={selectClass} value={start} onChange={(e) => setStart(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {formatClock(h * 60)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="office-end">{t.admin.endHour}</Label>
            <select id="office-end" className={selectClass} value={end} onChange={(e) => setEnd(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                <option key={h} value={h}>
                  {h === 24 ? "24:00" : formatClock(h * 60)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <Label htmlFor="gray-weekends">{t.admin.grayWeekends}</Label>
            <p className="text-xs text-muted-foreground">{t.admin.grayWeekendsHelp}</p>
          </div>
          <Switch id="gray-weekends" checked={gray} onCheckedChange={setGray} />
        </div>

        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t.save}
        </Button>
      </CardContent>
    </Card>
  );
};

const CreateUserDialog = ({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) => {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirm("");
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error(t.admin.passwordsMismatch);
    setSaving(true);
    const { error } = await supabase.functions.invoke("create-user", { body: { email: email.trim(), password, fullName: fullName.trim() } });
    setSaving(false);
    if (error) return toast.error((await functionError(error)) ?? t.admin.failed);
    toast.success(t.admin.created);
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t.admin.createUser}</DialogTitle>
            <DialogDescription>{t.admin.createDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">{t.auth.fullName}</Label>
            <Input id="new-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-email">{t.auth.email}</Label>
            <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-pass">{t.auth.password}</Label>
              <Input id="new-pass" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pass2">{t.profile.confirmPassword}</Label>
              <Input id="new-pass2" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? t.admin.creating : t.admin.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Admin;
