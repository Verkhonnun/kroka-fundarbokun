import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import UserAvatar from "@/components/UserAvatar";
import LanguageSwitch from "@/components/LanguageSwitch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { systemAvatars } from "@/lib/avatars";
import { cn } from "@/lib/utils";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const Profile = () => {
  const { t, language, setLanguage } = useLanguage();
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [choice, setChoice] = useState<"system" | "custom">("system");
  const [systemId, setSystemId] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setChoice(profile.avatar_choice === "custom" && profile.avatar_url ? "custom" : "system");
    setSystemId(profile.system_avatar_id ?? 1);
  }, [profile]);

  // Kerfismyndir sem aðrir nota eru ekki í boði
  const { data: takenIds = [] } = useQuery({
    queryKey: ["taken-avatars", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, system_avatar_id")
        .eq("avatar_choice", "system")
        .neq("id", user!.id)
        .not("system_avatar_id", "is", null);
      return (data ?? []).map((p) => p.system_avatar_id as number);
    },
  });

  const previewProfile = { full_name: fullName, email: profile?.email, avatar_choice: choice, system_avatar_id: systemId, avatar_url: profile?.avatar_url };

  const saveProfile = async () => {
    if (!user) return;
    if (choice === "system" && takenIds.includes(systemId)) return toast.error(t.profile.avatarTaken);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), avatar_choice: choice, system_avatar_id: choice === "system" ? systemId : profile?.system_avatar_id ?? systemId, language })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(t.profile.saveFailed);
    await refreshProfile();
    qc.invalidateQueries({ queryKey: ["profiles-public"] });
    qc.invalidateQueries({ queryKey: ["taken-avatars"] });
    toast.success(t.profile.saved);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > MAX_AVATAR_BYTES) return toast.error(t.profile.fileTooLarge);
    if (!ALLOWED_TYPES.includes(file.type)) return toast.error(t.profile.invalidFile);

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);

      // Eyða fyrri sérsniðinni mynd (best effort)
      const old = profile?.avatar_url?.split("/avatars/")[1];
      if (old && old !== path) supabase.storage.from("avatars").remove([old]).catch(() => undefined);

      const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl, avatar_choice: "custom" }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["profiles-public"] });
      toast.success(t.profile.saved);
    } catch (err) {
      console.error(err);
      toast.error(t.profile.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("Lykilorð þarf að vera að minnsta kosti 6 stafir / Password must be at least 6 characters");
    if (newPassword !== confirmPassword) return toast.error(t.profile.passwordMismatch);
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) return toast.error(error.message);
    setNewPassword("");
    setConfirmPassword("");
    toast.success(t.profile.passwordChanged);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.profile.title}</h1>
          <p className="text-sm text-muted-foreground">{t.profile.subtitle}</p>
        </div>

        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center gap-4">
              <UserAvatar profile={previewProfile} className="h-20 w-20 text-2xl" />
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{fullName || profile?.email}</div>
                <div className="truncate text-sm text-muted-foreground">{profile?.email}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="full-name">{t.profile.fullName}</Label>
              <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">{t.profile.email}</Label>
              <Input id="email" value={profile?.email ?? ""} disabled />
              <p className="text-xs text-muted-foreground">{t.profile.emailNote}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t.profile.language}</Label>
              <div>
                <LanguageSwitch />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t.profile.photo}</Label>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {systemAvatars.map((a) => {
                  const taken = takenIds.includes(a.id);
                  const active = choice === "system" && systemId === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={taken}
                      onClick={() => {
                        setChoice("system");
                        setSystemId(a.id);
                      }}
                      title={taken ? t.profile.taken : a.alt}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-full ring-offset-2 ring-offset-card transition",
                        active ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-border",
                        taken && "cursor-not-allowed opacity-30",
                      )}
                    >
                      <img src={a.src} alt={a.alt} className="h-full w-full object-cover" />
                      {active && (
                        <span className="absolute inset-0 flex items-center justify-center bg-primary/40 text-primary-foreground">
                          <Check className="h-5 w-5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div>
                <Button asChild variant="outline" size="sm" disabled={uploading}>
                  <label className="cursor-pointer">
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {uploading ? t.profile.uploading : t.profile.upload}
                    <input type="file" accept={ALLOWED_TYPES.join(",")} className="sr-only" onChange={uploadAvatar} disabled={uploading} />
                  </label>
                </Button>
              </div>
            </div>

            <Button onClick={saveProfile} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.save}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.profile.password}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">{t.profile.newPassword}</Label>
                  <Input id="new-password" type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">{t.profile.confirmPassword}</Label>
                  <Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <Button type="submit" variant="outline" disabled={changingPassword || !newPassword}>
                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.profile.changePassword}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default Profile;
