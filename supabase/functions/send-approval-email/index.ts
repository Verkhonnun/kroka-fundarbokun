import { APP_URL, corsHeaders, escapeHtml, json, requireAdmin, sendMail, serviceClient } from "../_shared/common.ts";

// Aðeins stjórnendur geta kallað á þetta, og póstur fer aðeins á netfang sem er til í profiles.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = serviceClient();
    const auth = await requireAdmin(req, admin);
    if ("error" in auth) return auth.error;

    const { userId } = await req.json();
    if (typeof userId !== "string") return json({ error: "userId is required" }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name, approved")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.approved) return json({ error: "User not found or not approved" }, 404);

    const name = escapeHtml(profile.full_name || "");
    await sendMail(
      [profile.email],
      "Aðgangur samþykktur – Króka fundarbókun",
      `<h2>Aðgangurinn þinn hefur verið samþykktur</h2>
       <p>Sæl/l ${name},</p>
       <p>Þú getur nú skráð þig inn og bókað fundarherbergið hjá Króka fasteignum.</p>
       ${APP_URL ? `<p><a href="${escapeHtml(APP_URL)}">Opna fundarbókun</a></p>` : ""}
       <hr>
       <h2>Your account has been approved</h2>
       <p>You can now sign in and book the meeting room at Króka fasteignir.</p>`,
    );

    return json({ success: true });
  } catch (e) {
    console.error("send-approval-email failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
