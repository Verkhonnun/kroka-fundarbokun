import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const LanguageSwitch = ({ className }: { className?: string }) => {
  const { language, setLanguage } = useLanguage();
  return (
    <div className={cn("inline-flex rounded-md border bg-card p-0.5 text-xs font-medium", className)} role="group" aria-label="Language">
      {(["is", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLanguage(l)}
          className={cn("rounded px-2 py-1 uppercase transition-colors", language === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          aria-pressed={language === l}
        >
          {l}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitch;
