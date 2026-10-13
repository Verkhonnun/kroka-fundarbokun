-- Króka fundarbókun – upphafsschema
-- Sameinar og lagar fyrri Lovable-migrations.
-- Breytingar frá gamla schemanu:
--  * notandi getur ekki lengur breytt `approved` á eigin prófíl
--  * samþykktir notendur sjá nöfn og myndir annarra (þarf fyrir dagatalið)
--  * útilokunarskilyrði (exclusion constraint) kemur í veg fyrir tvíbókun í gagnagrunni
--  * stjórnendur geta breytt og eytt öllum bókunum

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------- Tegundir
create type public.app_role as enum ('admin', 'user');

-- ---------------------------------------------------------------- Töflur
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  approved boolean not null default false,
  avatar_url text,
  avatar_choice text not null default 'system' check (avatar_choice in ('system', 'custom')),
  system_avatar_id integer check (system_avatar_id between 1 and 10),
  language text not null default 'is' check (language in ('is', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_booking_time check (end_time > start_time),
  constraint max_booking_length check (end_time - start_time <= interval '12 hours'),
  constraint no_overlapping_bookings
    exclude using gist (tstzrange(start_time, end_time, '[)') with &&)
);

create index bookings_start_time_idx on public.bookings (start_time);
create index bookings_user_id_idx on public.bookings (user_id);

-- Ein röð með stillingum skrifstofunnar
create table public.office_settings (
  id boolean primary key default true check (id),
  office_start_hour integer not null default 8 check (office_start_hour between 0 and 23),
  office_end_hour integer not null default 17 check (office_end_hour between 1 and 24),
  gray_weekends boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint valid_office_hours check (office_end_hour > office_start_hour)
);
insert into public.office_settings default values;

-- ---------------------------------------------------------------- Hjálparföll
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_approved(_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select approved from public.profiles where id = _user_id), false)
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Stofnar prófíl við nýskráningu. Netfang stofnanda fær stjórnandahlutverk
-- og er samþykkt sjálfkrafa (netfang þarf að vera staðfest í Supabase Auth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  is_owner boolean := lower(new.email) = 'magnus@verkhonnun.is';
begin
  insert into public.profiles (id, email, full_name, approved, system_avatar_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    is_owner,
    floor(random() * 10)::int + 1
  );
  if is_owner then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kemur í veg fyrir að venjulegur notandi breyti `approved`, `email` eða `id`.
-- auth.uid() er null þegar service role (edge functions) á í hlut.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    if new.approved is distinct from old.approved
       or new.email is distinct from old.email
       or new.id is distinct from old.id then
      raise exception 'Not allowed to change protected profile columns';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
create trigger office_settings_updated_at before update on public.office_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.bookings enable row level security;
alter table public.office_settings enable row level security;

-- profiles
create policy "Own, approved-peer or admin can view profiles" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_approved(auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "Users can update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admins can update all profiles" on public.profiles
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete profiles" on public.profiles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- user_roles
create policy "Users can view own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins can manage roles" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- bookings
create policy "Approved users can view bookings" on public.bookings
  for select to authenticated using (public.is_approved(auth.uid()));
create policy "Approved users can create own bookings" on public.bookings
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_approved(auth.uid()));
create policy "Owners and admins can update bookings" on public.bookings
  for update to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Owners and admins can delete bookings" on public.bookings
  for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- office_settings
create policy "Approved users and admins can view office settings" on public.office_settings
  for select to authenticated
  using (public.is_approved(auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "Admins can update office settings" on public.office_settings
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------- Realtime
alter publication supabase_realtime add table public.bookings;

-- ---------------------------------------------------------------- Myndir (storage)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "Avatars are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "Users can upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
