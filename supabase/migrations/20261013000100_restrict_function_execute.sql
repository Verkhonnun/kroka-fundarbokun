-- Trigger-föll eiga ekki að vera kallanleg gegnum REST API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_columns() from public, anon, authenticated;

-- Hjálparföll sem RLS-reglur nota: aðeins innskráðir notendur þurfa að geta keyrt þau
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_approved(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_approved(uuid) to authenticated;
