import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitch from "@/components/LanguageSwitch";
import { Button } from "@/components/ui/button";

const PendingApproval = () => {
  const { t } = useLanguage();
  const { loading, user, profile, isAdmin, refreshProfile, signOut } = useAuth();

  // Athugar á 20 sekúndna fresti hvort aðgangur hafi verið samþykktur
  useEffect(() => {
    const id = setInterval(refreshProfile, 20_000);
    return () => clearInterval(id);
  }, [refreshProfile]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && (profile?.approved || isAdmin)) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-[100dvh] flex-col px-4 py-6">
      <div className="flex justify-end">
        <LanguageSwitch />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand/25">
          <Clock className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t.pending.title}</h1>
        <p className="mt-3 text-muted-foreground">{t.pending.message}</p>
        <Button variant="outline" className="mt-6" onClick={() => signOut()}>
          {t.pending.logout}
        </Button>
      </div>
    </div>
  );
};

export default PendingApproval;
