import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

export const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => (typeof window !== "undefined" ? window.matchMedia(QUERY).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
};
