import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-6xl font-bold tracking-tight">404</div>
      <p className="text-muted-foreground">{t.notFound.title}</p>
      <Button asChild>
        <Link to="/">{t.notFound.back}</Link>
      </Button>
    </div>
  );
};

export default NotFound;
