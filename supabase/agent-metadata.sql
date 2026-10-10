-- Additive migration for Supabase installations using the featured-agent editor.
-- Run as the project owner after schema.sql. Existing agent records are preserved.
begin;
alter table public.agents
  add column if not exists metadata jsonb not null default '{}'::jsonb;
commit;
