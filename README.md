# Króka fundarbókun

Bókunarkerfi fyrir fundarherbergið hjá Króka fasteignum. Aðeins skráðir og samþykktir notendur sjá og bóka herbergið.

## Helstu eiginleikar

- Dagatal með dags-, viku- og mánaðaryfirliti (í síma: dagur + mánuður)
- Dragðu yfir tímabil í dagatalinu til að bóka, eða smelltu til að bóka klukkustund
- „Laust núna / Upptekið til …" efst í dagatalinu
- Rauntímauppfærslur (Supabase Realtime) – bókanir birtast strax hjá öllum
- Tvíbókun er ómöguleg: gagnagrunnurinn hafnar bókunum sem skarast
- Nýskráning þarf samþykki stjórnanda; stjórnendur geta samþykkt, afturkallað, gert aðra að stjórnendum, stofnað notendur, endurstillt lykilorð og eytt notendum
- Stjórnendur geta breytt og eytt öllum bókunum; aðrir aðeins sínum eigin
- Opnunartími og grá helgi stillt í stjórnendaviðmóti
- Íslenska og enska, prófílmynd (kerfismynd eða eigin mynd)

## Tækni

Vite + React + TypeScript, Tailwind + shadcn/ui, TanStack Query, Supabase (Postgres, Auth, Realtime, Storage, Edge Functions).

## Uppsetning

```sh
npm install
cp .env.example .env   # fylltu út VITE_SUPABASE_URL og VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:8080
npm run build          # tsc + vite build
```

### Supabase

1. Stofnaðu Supabase-verkefni og settu `project_id` í `supabase/config.toml`.
2. Keyrðu schemað: `supabase db push` (eða límdu `supabase/migrations/20261013000000_initial_schema.sql` í SQL editor).
3. Settu inn edge functions: `supabase functions deploy` og leyndarmál:

   ```sh
   supabase secrets set RESEND_API_KEY=... \
     APP_URL=https://<slóð á vefinn> \
     MAIL_FROM="Króka fasteignir <noreply@verkhonnun.is>" \
     ADMIN_NOTIFY_EMAIL=magnus@verkhonnun.is
   ```

4. Í Authentication → URL Configuration: settu Site URL og Redirect URLs á slóð vefsins.
5. Netfangið `magnus@verkhonnun.is` fær sjálfkrafa stjórnandahlutverk og er samþykkt við nýskráningu
   (sjá `handle_new_user` í migration). Breyttu netfanginu þar ef annar á að vera fyrsti stjórnandi.
   Aðra stjórnendur má gera í Stjórnun → Notendur.

### Breytingar frá Lovable-útgáfunni

- `approved` á prófíl er varið – notandi getur ekki samþykkt sjálfan sig (var hægt í gamla schemanu).
- Samþykktir notendur sjá nöfn og myndir annarra (nauðsynlegt til að sýna hver á bókun).
- `send-approval-email` og `notify-registration` taka ekki lengur við netfangi úr beiðni sem hver sem er gat sent.
- Bókanir geta verið allt að 12 klst. og með valfrjálsri athugasemd.

## Hýsing á GitHub Pages

`.github/workflows/deploy.yml` byggir og birtir vefinn við hvern push á `main`. Vefurinn er á **https://kroka.verkhonnun.is**.

- **DNS (Cloudflare):** `kroka` CNAME → `verkhonnun.github.io`, *DNS only* (grár skýjahnappur).
- **GitHub:** Settings → Pages → Source: GitHub Actions, Custom domain: `kroka.verkhonnun.is`, Enforce HTTPS.
- **Supabase:** Site URL og Redirect URLs (`https://kroka.verkhonnun.is/**`) í Authentication → URL Configuration,
  og `APP_URL` í Edge Functions → Secrets.
- Án eigin léns er slóðin `https://verkhonnun.github.io/kroka-fundarbokun/` – þá þarf repo-breytuna `PAGES_BASE` = `/kroka-fundarbokun/`.

GitHub Pages úr **private** repo krefst GitHub Pro/Team/Enterprise, því repo-ið er public. Engin leyndarmál eru í kóðanum –
`.env` er ekki í git og publishable lykillinn er hannaður til að vera opinber.
