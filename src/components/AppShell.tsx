import { Link, NavLink, useNavigate } from "react-router-dom";
import { CalendarDays, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { ReactNode } from "react";
import krokaLogo from "@/assets/kroka-logo.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import UserAvatar from "@/components/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
  );

const AppShell = ({ children, wide = false }: { children: ReactNode; wide?: boolean }) => {
  const { profile, isAdmin, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-3 sm:px-5">
          <Link to="/" className="flex items-center gap-3" aria-label={t.appName}>
            <img src={krokaLogo} alt="Króka skrifstofur" className="h-9 w-9 rounded-md object-cover" />
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-semibold">{t.appName}</div>
              <div className="text-xs text-muted-foreground">{t.company}</div>
            </div>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navClass}>
              <CalendarDays className="h-4 w-4" />
              {t.nav.calendar}
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                <ShieldCheck className="h-4 w-4" />
                {t.nav.admin}
              </NavLink>
            )}
          </nav>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-2 rounded-full p-0.5 pr-2 outline-none ring-offset-background transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={t.nav.profile}
              >
                <UserAvatar profile={profile} className="h-8 w-8" />
                <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">
                  {profile?.full_name || profile?.email}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate text-sm font-medium">{profile?.full_name || "—"}</div>
                  <div className="truncate text-xs text-muted-foreground">{profile?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/")} className="md:hidden">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {t.nav.calendar}
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onSelect={() => navigate("/admin")} className="md:hidden">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {t.nav.admin}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => navigate("/profile")}>
                  <UserRound className="mr-2 h-4 w-4" />
                  {t.nav.profile}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t.nav.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className={cn("mx-auto w-full flex-1 px-3 py-4 sm:px-5 sm:py-6", wide ? "max-w-[1400px]" : "max-w-3xl")}>
        {children}
      </main>
    </div>
  );
};

export default AppShell;
