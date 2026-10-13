import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.81.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const serviceClient = (): SupabaseClient =>
  createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });

/** Sannreynir að kallandi sé innskráður stjórnandi. Skilar notanda eða Response með villu. */
export async function requireAdmin(
  req: Request,
  admin: SupabaseClient,
): Promise<{ user: User } | { error: Response }> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return { error: json({ error: "Unauthorized" }, 401) };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: json({ error: "Unauthorized" }, 401) };

  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return { error: json({ error: "Admin privileges required" }, 403) };

  return { user: data.user };
}

export const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "Króka fasteignir <noreply@verkhonnun.is>";
export const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "magnus@verkhonnun.is";
export const APP_URL = Deno.env.get("APP_URL") ?? "";

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendMail(to: string[], subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Failed to send email");
  return data;
}
