import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import krokaLogo from "@/assets/kroka-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitch from "@/components/LanguageSwitch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Auth = () => {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const schema = z.object({
    email: z.string().trim().email(t.auth.invalidEmail),
    password: z.string().min(6, t.auth.passwordShort),
  });

  useEffect(() => {
    setPassword("");
  }, [tab]);

  if (!authLoading && user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    setLoading(false);
    if (error) toast.error(error.message.includes("Invalid login") ? t.auth.invalidCredentials : error.message);
    // Árangur: AuthContext uppfærist og leiðarvísir fer með notanda á rétta síðu
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message.toLowerCase().includes("already") ? t.auth.alreadyRegistered : error.message);
      return;
    }
    // Tilkynning til stjórnanda; mistekst hún er aðgangurinn samt til
    supabase.functions.invoke("notify-registration", { body: { email: parsed.data.email } }).catch(() => undefined);
    toast.success(t.auth.signupDone, { duration: 8000 });
    if (!data.session) setTab("login");
  };

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      {/* Merkjaflötur */}
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <img src={krokaLogo} alt="Króka skrifstofur" className="h-16 w-16 rounded-lg object-cover" />
        <div>
          <div className="mb-4 h-1 w-14 rounded bg-brand" />
          <h2 className="text-4xl font-bold leading-tight tracking-tight">Fundarherbergi</h2>
          <p className="mt-3 max-w-sm text-lg text-primary-foreground/70">{t.auth.tagline}</p>
        </div>
        <p className="text-sm text-primary-foreground/50">{t.company}</p>
      </div>

      <div className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <img src={krokaLogo} alt="Króka skrifstofur" className="h-10 w-10 rounded-md object-cover lg:hidden" />
          <LanguageSwitch />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          <h1 className="text-2xl font-bold tracking-tight">{tab === "login" ? t.auth.login : t.auth.signup}</h1>
          <p className="mt-1 text-sm text-muted-foreground lg:hidden">{t.auth.tagline}</p>

          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t.auth.login}</TabsTrigger>
              <TabsTrigger value="signup">{t.auth.signup}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">{t.auth.email}</Label>
                  <Input id="login-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">{t.auth.password}</Label>
                  <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? t.auth.loggingIn : t.auth.loginButton}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">{t.auth.fullName}</Label>
                  <Input id="signup-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">{t.auth.email}</Label>
                  <Input id="signup-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">{t.auth.password}</Label>
                  <Input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-11" />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? t.auth.signingUp : t.auth.signupButton}
                </Button>
                <p className="text-center text-xs text-muted-foreground">{t.auth.signupNote}</p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;
