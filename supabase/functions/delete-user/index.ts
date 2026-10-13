import { corsHeaders, json, requireAdmin, serviceClient } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = serviceClient();
    const auth = await requireAdmin(req, admin);
    if ("error" in auth) return auth.error;

    const { userId } = await req.json();
    if (typeof userId !== "string") return json({ error: "userId is required" }, 400);
    if (userId === auth.user.id) return json({ error: "You cannot delete your own account" }, 400);

    // Aðeins komandi bókunum er eytt; liðnar bókanir haldast fyrir sögu.
    const { error: bookingsError } = await admin
      .from("bookings")
      .delete()
      .eq("user_id", userId)
      .gte("start_time", new Date().toISOString());
    if (bookingsError) return json({ error: "Failed to delete future bookings" }, 500);

    // Eyðir notanda í auth; prófíll, hlutverk og liðnar bókanir eyðast með ON DELETE CASCADE.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: "Failed to delete user" }, 500);

    return json({ success: true });
  } catch (e) {
    console.error("delete-user failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
