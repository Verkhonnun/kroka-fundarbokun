import {
  ADMIN_NOTIFY_EMAIL,
  APP_URL,
  corsHeaders,
  escapeHtml,
  json,
  sendMail,
  serviceClient,
} from "../_shared/common.ts";

// Kallað frá nýskráningarsíðunni án innskráningar. Til að koma í veg fyrir misnotkun:
//  * netfang og nafn eru sótt úr profiles, ekki úr beiðninni
//  * aðeins ósamþykktir prófílar sem stofnaðir voru síðustu 15 mínútur fá póst
//  * hver prófíll fær aðeins einn póst (merkt með notify_sent í user metadata)
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (typeof email !== "string") return json({ error: "email is required" }, 400);

    const admin = serviceClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, full_name, approved, created_at")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    const fresh = profile && Date.now() - new Date(profile.created_at).getTime() < 15 * 60 * 1000;
    if (!profile || profile.approved || !fresh) return json({ success: true }); // gefum ekkert upp

    const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
    if (authUser?.user?.app_metadata?.notify_sent) return json({ success: true });
    await admin.auth.admin.updateUserById(profile.id, {
      app_metadata: { ...authUser?.user?.app_metadata, notify_sent: true },
    });

    const name = escapeHtml(profile.full_name || "—");
    const mail = escapeHtml(profile.email);

    await sendMail(
      [ADMIN_NOTIFY_EMAIL],
      "Ný nýskráning – Króka fundarbókun",
      `<h2>Ný nýskráning</h2>
       <p><strong>Nafn:</strong> ${name}<br><strong>Netfang:</strong> ${mail}</p>
       <p>Samþykktu notandann í stjórnendasíðunni.${APP_URL ? ` <a href="${escapeHtml(APP_URL)}/admin">Opna</a>` : ""}</p>`,
    );
    await sendMail(
      [profile.email],
      "Skráning móttekin – Króka fundarbókun",
      `<h2>Takk fyrir skráninguna</h2>
       <p>Sæl/l ${name},</p>
       <p>Beiðnin þín er í yfirferð hjá stjórnanda. Þú færð annan póst þegar aðgangurinn hefur verið samþykktur.</p>
       <hr>
       <p>Thank you for registering. An administrator will review your request and you will receive an email once approved.</p>`,
    );

    return json({ success: true });
  } catch (e) {
    console.error("notify-registration failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
