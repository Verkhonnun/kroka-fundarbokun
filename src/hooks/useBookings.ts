import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BookingRow, OfficeSettingsRow, ProfileRow } from "@/integrations/supabase/types";

export type Booking = BookingRow;
export type PublicProfile = Pick<
  ProfileRow,
  "id" | "full_name" | "email" | "avatar_url" | "avatar_choice" | "system_avatar_id"
>;

/** Bókanir sem skarast við [from, to). */
export const useBookings = (from: Date, to: Date) => {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery({
    queryKey: ["bookings", fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .lt("start_time", toIso)
        .gt("end_time", fromIso)
        .order("start_time");
      if (error) throw error;
      return data as Booking[];
    },
    placeholderData: (prev) => prev,
  });
};

/** Allir samþykktir prófílar (lítið fyrirtæki) – notað til að sýna nöfn og myndir. */
export const useProfilesMap = () =>
  useQuery({
    queryKey: ["profiles-public"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, avatar_choice, system_avatar_id")
        .eq("approved", true);
      if (error) throw error;
      return new Map((data as PublicProfile[]).map((p) => [p.id, p]));
    },
  });

export const DEFAULT_OFFICE: Omit<OfficeSettingsRow, "id" | "updated_at"> = {
  office_start_hour: 8,
  office_end_hour: 17,
  gray_weekends: true,
};

export const useOfficeSettings = () =>
  useQuery({
    queryKey: ["office-settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("office_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data as OfficeSettingsRow | null) ?? { id: true, ...DEFAULT_OFFICE, updated_at: "" };
    },
  });

/** Endurhleður bókanir þegar einhver breytir þeim (Supabase Realtime). */
export const useBookingsRealtime = () => {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("bookings-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["bookings"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
};

export const useNow = (intervalMs = 30_000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, setNow]);
  return now;
};
