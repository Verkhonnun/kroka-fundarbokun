import { corsHeaders, json, requireAdmin, serviceClient } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = serviceClient();
    const auth = await requireAdmin(req, admin);
    if ("error" in auth) return auth.error;

    const { email, password, fullName } = await req.json();
    if (typeof email !== "string" || typeof password !== "string" || password.length < 6) {
      return json({ error: "Invalid email or password" }, 400);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName ?? "" },
    });
    if (error) return json({ error: error.message }, 400);

    // Prófíll verður til með trigger; stjórnandi stofnar notanda svo hann er samþykktur strax.
    const { error: approveError } = await admin
      .from("profiles")
      .update({ approved: true })
      .eq("id", data.user.id);
    if (approveError) console.error("Failed to approve new user:", approveError);

    return json({ success: true, userId: data.user.id });
  } catch (e) {
    console.error("create-user failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
