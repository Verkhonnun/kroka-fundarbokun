import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import Admin from "@/pages/Admin";
import Profile from "@/pages/Profile";
import PendingApproval from "@/pages/PendingApproval";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 } },
});

const FullScreenSpinner = () => (
  <div className="flex min-h-[100dvh] items-center justify-center text-muted-foreground">
    <Loader2 className="h-6 w-6 animate-spin" />
  </div>
);

/** Aðeins innskráðir og samþykktir notendur (og stjórnendur). */
const RequireApproved = ({ children, admin = false }: { children: ReactNode; admin?: boolean }) => {
  const { loading, user, profile, isAdmin } = useAuth();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile?.approved && !isAdmin) return <Navigate to="/pending-approval" replace />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Routes>
              <Route path="/" element={<RequireApproved><Index /></RequireApproved>} />
              <Route path="/profile" element={<RequireApproved><Profile /></RequireApproved>} />
              <Route path="/admin" element={<RequireApproved admin><Admin /></RequireApproved>} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
