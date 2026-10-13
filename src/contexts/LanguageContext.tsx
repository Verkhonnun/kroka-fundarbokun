import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { enUS, is as isLocale } from "date-fns/locale";
import type { Locale } from "date-fns";
import { translations, type Language, type Translation } from "@/lib/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translation;
  locale: Locale;
}

const STORAGE_KEY = "kroka.language";
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const initialLanguage = (): Language => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "is" || stored === "en") return stored;
  } catch {
    /* localStorage ekki aðgengilegt */
  }
  return "is";
};

/** Tungumálið er geymt í localStorage; AuthContext samstillir það við prófíl notanda. */
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t: translations[language], locale: language === "is" ? isLocale : enUS }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
