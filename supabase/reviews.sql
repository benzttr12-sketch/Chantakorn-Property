-- Additive support for installations explicitly using the Supabase backend.
-- Run in the SQL Editor as the project owner after schema.sql.
-- Firebase production uses firestore.rules instead; do not run this there.
-- Keep this optional setup outside migrations so GitHub integration does not
-- apply it to an unrelated linked Supabase database during app deployment.
begin;
create table if not exists public.reviews (
  id text primary key,
  published boolean not null default false,
  data jsonb not null,
  constraint review_identity check (data ->> 'id' = id),
  constraint review_visibility check ((data ->> 'published')::boolean = published)
);
alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
drop policy if exists reviews_published_read on public.reviews;
create policy reviews_published_read on public.reviews for select to anon, authenticated using (published = true);
drop policy if exists reviews_staff_manage on public.reviews;
create policy reviews_staff_manage on public.reviews for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));
commit;
