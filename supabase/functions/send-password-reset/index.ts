import { APP_URL, corsHeaders, escapeHtml, json, requireAdmin, sendMail, serviceClient } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = serviceClient();
    const auth = await requireAdmin(req, admin);
    if ("error" in auth) return auth.error;

    const { email } = await req.json();
    if (typeof email !== "string") return json({ error: "email is required" }, 400);

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: APP_URL ? { redirectTo: APP_URL } : undefined,
    });
    if (error) return json({ error: error.message }, 400);

    const link = data.properties?.action_link;
    if (!link) return json({ error: "Could not generate link" }, 500);

    await sendMail(
      [email],
      "Endurstilling lykilorðs / Password reset – Króka fundarbókun",
      `<p>Smelltu á tengilinn til að velja nýtt lykilorð:</p>
       <p><a href="${escapeHtml(link)}">Endurstilla lykilorð</a></p>
       <hr><p>Click the link to choose a new password:</p>
       <p><a href="${escapeHtml(link)}">Reset password</a></p>`,
    );

    return json({ success: true });
  } catch (e) {
    console.error("send-password-reset failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
