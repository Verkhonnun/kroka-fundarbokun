// Handskrifaðar týpur fyrir schemað í supabase/migrations.
// Hægt að endurgera með: supabase gen types typescript --project-id <ref>
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Row<T> = { [K in keyof T]: T[K] };

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  approved: boolean;
  avatar_url: string | null;
  avatar_choice: "system" | "custom";
  system_avatar_id: number | null;
  language: "is" | "en";
  created_at: string;
  updated_at: string;
}

export interface BookingRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

export interface OfficeSettingsRow {
  id: boolean;
  office_start_hour: number;
  office_end_hour: number;
  gray_weekends: boolean;
  updated_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: "admin" | "user";
  created_at: string;
}

type Table<R, Insert = Partial<R>, Update = Partial<R>> = {
  Row: Row<R>;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      bookings: Table<
        BookingRow,
        Pick<BookingRow, "user_id" | "title" | "start_time" | "end_time"> & { description?: string | null },
        Partial<Omit<BookingRow, "id" | "user_id">>
      >;
      office_settings: Table<OfficeSettingsRow>;
      user_roles: Table<UserRoleRow>;
    };
    Views: Record<string, never>;
    Functions: {
      has_role: { Args: { _user_id: string; _role: "admin" | "user" }; Returns: boolean };
      is_approved: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: { app_role: "admin" | "user" };
    CompositeTypes: Record<string, never>;
  };
}
