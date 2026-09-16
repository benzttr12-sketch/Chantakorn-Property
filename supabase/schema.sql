-- Chantakorn Property: run in the Supabase SQL Editor as the project owner.
-- Intended for a new project; rerunning this file preserves existing app data.
-- Then run seed.sql to add the agents used by the property editor.
-- Never put a service_role key in NEXT_PUBLIC_* environment variables.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  avatar_url text,
  role text not null default 'USER' check (role in ('ADMIN', 'AGENT', 'USER')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agents (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  title text not null default '',
  phone text not null default '',
  line_id text not null default '',
  facebook text,
  email text not null default '',
  photo_url text not null default '',
  bio text not null default ''
);

create table if not exists public.properties (
  id text primary key default gen_random_uuid()::text,
  title text not null check (length(btrim(title)) > 0),
  slug text not null unique check (length(btrim(slug)) > 0),
  description text not null default '',
  property_type text not null check (property_type in ('house', 'land', 'condo', 'commercial', 'investment', 'consignment')),
  status text not null check (status in ('sale', 'rent')),
  price numeric not null check (price >= 0),
  province text not null,
  district text not null,
  subdistrict text,
  address text,
  latitude double precision not null default 7.0084 check (latitude between -90 and 90),
  longitude double precision not null default 100.4705 check (longitude between -180 and 180),
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  parking integer not null default 0 check (parking >= 0),
  land_size numeric not null default 0 check (land_size >= 0),
  usable_area numeric not null default 0 check (usable_area >= 0),
  year_built integer check (year_built between 1000 and 9999),
  furniture text not null default '',
  features text[] not null default '{}',
  cover_image text not null default '',
  featured boolean not null default false,
  published boolean not null default false,
  agent_id text references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_images (
  id text primary key default gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  image_url text not null check (length(btrim(image_url)) > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  unique (property_id, sort_order)
);

create table if not exists public.inquiries (
  id text primary key default gen_random_uuid()::text,
  property_id text references public.properties(id) on delete set null,
  property_title text,
  name text not null check (length(btrim(name)) between 1 and 200),
  phone text not null check (length(btrim(phone)) between 1 and 100),
  line_id text,
  message text not null default '',
  inquiry_type text not null check (inquiry_type in ('inquiry', 'viewing', 'consignment_sell')),
  status text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'closed')),
  consignment_details jsonb check (consignment_details is null or jsonb_typeof(consignment_details) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists properties_published_created_idx on public.properties (published, created_at desc);
create index if not exists properties_agent_idx on public.properties (agent_id);
create index if not exists inquiries_created_idx on public.inquiries (created_at desc);
create index if not exists inquiries_property_idx on public.inquiries (property_id);

-- Keep these SECURITY DEFINER helpers outside the exposed public API schema.
-- They read only the caller's database role; user-editable auth metadata is ignored.
create or replace function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('ADMIN', 'AGENT')
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'ADMIN'
  );
$$;

revoke all on function private.is_staff(), private.is_admin() from public, anon;
grant execute on function private.is_staff(), private.is_admin() to authenticated;

create or replace function private.handle_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, full_name, phone, email, role)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      new.raw_user_meta_data ->> 'phone', new.email, 'USER')
    on conflict (id) do nothing;
  else
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.handle_auth_user() from public, anon, authenticated;

drop trigger if exists chantakorn_auth_user_created on auth.users;
create trigger chantakorn_auth_user_created after insert on auth.users
for each row execute function private.handle_auth_user();
drop trigger if exists chantakorn_auth_email_changed on auth.users;
create trigger chantakorn_auth_email_changed after update of email on auth.users
for each row execute function private.handle_auth_user();

-- Backfill accounts created before the schema. Never infer privileges from metadata.
insert into public.profiles (id, full_name, phone, email, role)
select id, coalesce(raw_user_meta_data ->> 'full_name', ''),
  raw_user_meta_data ->> 'phone', email, 'USER'
from auth.users on conflict (id) do nothing;

create or replace function private.guard_profile_update()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  -- SQL Editor/service_role maintenance is allowed. Browser clients cannot change
  -- roles unless the caller already has ADMIN in the database.
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id or new.email is distinct from old.email
       or new.created_at is distinct from old.created_at then
      raise exception 'Account identity must be managed through Supabase Auth' using errcode = '42501';
    end if;
    if new.role is distinct from old.role and not private.is_admin() then
      raise exception 'Only an administrator may change account roles' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.guard_profile_update() from public, anon, authenticated;
drop trigger if exists chantakorn_profile_updated on public.profiles;
create trigger chantakorn_profile_updated before update on public.profiles
for each row execute function private.guard_profile_update();

create or replace function private.touch_property()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_property() from public, anon, authenticated;
drop trigger if exists chantakorn_property_updated on public.properties;
create trigger chantakorn_property_updated before update on public.properties
for each row execute function private.touch_property();

alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.inquiries enable row level security;

-- Supabase projects may grant new public tables broad privileges by default.
revoke all on public.profiles, public.agents, public.properties,
  public.property_images, public.inquiries from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.agents, public.properties, public.property_images to anon, authenticated;
grant insert, update, delete on public.agents, public.properties, public.property_images to authenticated;
grant select on public.profiles, public.inquiries to authenticated;
grant update (full_name, phone, avatar_url, role) on public.profiles to authenticated;
grant insert (id, property_id, property_title, name, phone, line_id, message,
  inquiry_type, status, consignment_details, created_at) on public.inquiries to anon, authenticated;
grant update (status) on public.inquiries to authenticated;
grant all on public.profiles, public.agents, public.properties,
  public.property_images, public.inquiries to service_role;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists agents_public_read on public.agents;
create policy agents_public_read on public.agents for select to anon, authenticated using (true);
drop policy if exists agents_staff_write on public.agents;
create policy agents_staff_write on public.agents for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

drop policy if exists properties_public_read on public.properties;
create policy properties_public_read on public.properties for select to anon, authenticated using (published);
drop policy if exists properties_staff_all on public.properties;
create policy properties_staff_all on public.properties for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

drop policy if exists images_public_read on public.property_images;
create policy images_public_read on public.property_images for select to anon, authenticated
using (exists (select 1 from public.properties p where p.id = property_id and p.published));
drop policy if exists images_staff_all on public.property_images;
create policy images_staff_all on public.property_images for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

-- Public submissions use INSERT without .select(): customer contact data stays private.
drop policy if exists inquiries_public_submit on public.inquiries;
create policy inquiries_public_submit on public.inquiries for insert to anon, authenticated
with check (status = 'new' and (property_id is null or exists (
  select 1 from public.properties p where p.id = property_id and p.published
)));
drop policy if exists inquiries_staff_read on public.inquiries;
create policy inquiries_staff_read on public.inquiries for select to authenticated
using ((select private.is_staff()));
drop policy if exists inquiries_staff_update on public.inquiries;
create policy inquiries_staff_update on public.inquiries for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

-- One database transaction saves the listing and replaces its gallery. A failure
-- in any image rolls back the listing too. Omit p_images to preserve the gallery;
-- pass an empty array to remove all gallery images. RLS remains active in this RPC.
create or replace function public.save_property(p_property jsonb, p_images text[] default null)
returns public.properties
language plpgsql security invoker set search_path = ''
as $$
declare
  property_row public.properties;
  is_update boolean := p_property ? 'id';
begin
  if not private.is_staff() then
    raise exception 'Only staff may save properties' using errcode = '42501';
  end if;
  if p_property is null or jsonb_typeof(p_property) <> 'object' then
    raise exception 'p_property must be a JSON object' using errcode = '22023';
  end if;

  if is_update then
    select * into property_row from public.properties
    where id = p_property ->> 'id' for update;
    if not found then
      raise exception 'Property not found or not permitted' using errcode = 'P0002';
    end if;
  else
    -- Match the table defaults before applying the supplied fields.
    property_row.id := gen_random_uuid()::text;
    property_row.description := '';
    property_row.latitude := 7.0084;
    property_row.longitude := 100.4705;
    property_row.bedrooms := 0;
    property_row.bathrooms := 0;
    property_row.parking := 0;
    property_row.land_size := 0;
    property_row.usable_area := 0;
    property_row.furniture := '';
    property_row.features := '{}';
    property_row.cover_image := '';
    property_row.featured := false;
    property_row.published := false;
    property_row.created_at := now();
    property_row.updated_at := now();
  end if;

  property_row := jsonb_populate_record(property_row,
    p_property - array['id', 'created_at', 'updated_at']);

  if is_update then
    update public.properties set
      title = property_row.title, slug = property_row.slug,
      description = property_row.description, property_type = property_row.property_type,
      status = property_row.status, price = property_row.price,
      province = property_row.province, district = property_row.district,
      subdistrict = property_row.subdistrict, address = property_row.address,
      latitude = property_row.latitude, longitude = property_row.longitude,
      bedrooms = property_row.bedrooms, bathrooms = property_row.bathrooms,
      parking = property_row.parking, land_size = property_row.land_size,
      usable_area = property_row.usable_area, year_built = property_row.year_built,
      furniture = property_row.furniture, features = property_row.features,
      cover_image = property_row.cover_image, featured = property_row.featured,
      published = property_row.published, agent_id = property_row.agent_id
    where id = property_row.id returning * into property_row;
  else
    insert into public.properties select (property_row).* returning * into property_row;
  end if;

  if p_images is not null then
    delete from public.property_images where property_id = property_row.id;
    insert into public.property_images (property_id, image_url, sort_order)
    select property_row.id, image_url, (position - 1)::integer
    from unnest(p_images) with ordinality as image_list(image_url, position);
  end if;
  return property_row;
end;
$$;
revoke all on function public.save_property(jsonb, text[]) from public, anon;
grant execute on function public.save_property(jsonb, text[]) to authenticated;

-- FIRST ADMIN: sign up through the site, verify the email if enabled, then the
-- project owner runs the following with that account's real email:
-- update public.profiles set role = 'ADMIN' where id = (
--   select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
-- );
-- Creating accounts, deleting accounts, and changing Auth email/password remain
-- Supabase Auth operations. No browser role can insert or delete profiles.

notify pgrst, 'reload schema';
commit;
