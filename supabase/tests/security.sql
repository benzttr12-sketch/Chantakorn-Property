-- Run after schema.sql and seed.sql in the SQL Editor as the project owner.
-- The assertions use real anon/authenticated database roles. Fixtures and writes
-- are rolled back, including successful assertions. Any failure aborts the test.
begin;

select set_config('test.admin_id', gen_random_uuid()::text, true);
select set_config('test.agent_id', gen_random_uuid()::text, true);
select set_config('test.member_id', gen_random_uuid()::text, true);
select set_config('test.public_id', gen_random_uuid()::text, true);
select set_config('test.draft_id', gen_random_uuid()::text, true);
select set_config('test.inquiry_id', gen_random_uuid()::text, true);

insert into auth.users (id, email, raw_user_meta_data) values
  (current_setting('test.admin_id')::uuid, current_setting('test.admin_id') || '@example.invalid', '{"full_name":"Admin fixture"}'),
  (current_setting('test.agent_id')::uuid, current_setting('test.agent_id') || '@example.invalid', '{"full_name":"Agent fixture"}'),
  (current_setting('test.member_id')::uuid, current_setting('test.member_id') || '@example.invalid', '{"full_name":"Member fixture","role":"ADMIN"}');

do $$ begin
  if (select role from public.profiles where id = current_setting('test.member_id')::uuid) <> 'USER' then
    raise exception 'FAIL: signup metadata escalated a role';
  end if;
end $$;

update public.profiles set role = 'ADMIN' where id = current_setting('test.admin_id')::uuid;
update public.profiles set role = 'AGENT' where id = current_setting('test.agent_id')::uuid;
insert into public.properties (id, title, slug, property_type, status, price, province, district, published) values
  (current_setting('test.public_id'), 'Published fixture', current_setting('test.public_id'), 'house', 'sale', 100, 'Songkhla', 'Hat Yai', true),
  (current_setting('test.draft_id'), 'Draft fixture', current_setting('test.draft_id'), 'land', 'sale', 200, 'Songkhla', 'Hat Yai', false);
insert into public.property_images (property_id, image_url) values
  (current_setting('test.public_id'), 'https://example.invalid/public.jpg'),
  (current_setting('test.draft_id'), 'https://example.invalid/private.jpg');

set local role anon;
do $$ begin
  if (select count(*) from public.properties where id in (current_setting('test.public_id'), current_setting('test.draft_id'))) <> 1 then
    raise exception 'FAIL: public listing visibility';
  end if;
  if (select count(*) from public.property_images where property_id in (current_setting('test.public_id'), current_setting('test.draft_id'))) <> 1 then
    raise exception 'FAIL: draft image leaked';
  end if;
  begin
    perform * from public.inquiries;
    raise exception 'FAIL: anonymous inbox read allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.profiles;
    raise exception 'FAIL: anonymous profiles read allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.properties set price = 0 where id = current_setting('test.public_id');
    raise exception 'FAIL: anonymous listing update allowed';
  exception when insufficient_privilege then null; end;
end $$;

insert into public.inquiries (id, property_id, name, phone, message, inquiry_type, status)
values (current_setting('test.inquiry_id'), current_setting('test.public_id'), 'Visitor fixture', '0000000000', 'Test', 'viewing', 'new');
do $$ begin
  begin
    insert into public.inquiries (property_id, name, phone, inquiry_type, status)
    values (current_setting('test.draft_id'), 'Visitor', '0', 'inquiry', 'new');
    raise exception 'FAIL: inquiry accepted for a draft';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.inquiries (name, phone, inquiry_type, status)
    values ('Visitor', '0', 'inquiry', 'closed');
    raise exception 'FAIL: public inquiry status spoofing allowed';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('test.member_id'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.member_id'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FAIL: a member can read other account profiles';
  end if;
  if (select count(*) from public.inquiries) <> 0 then
    raise exception 'FAIL: a member can read the inquiry inbox';
  end if;
  update public.profiles set full_name = 'Updated member fixture' where id = current_setting('test.member_id')::uuid;
  if not found then raise exception 'FAIL: own profile update denied'; end if;
  begin
    update public.profiles set role = 'ADMIN' where id = current_setting('test.member_id')::uuid;
    raise exception 'FAIL: member self-promotion allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set email = 'changed@example.invalid' where id = current_setting('test.member_id')::uuid;
    raise exception 'FAIL: member changed auth email via profiles';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_property(jsonb_build_object('id', current_setting('test.public_id'), 'price', 0));
    raise exception 'FAIL: member property RPC allowed';
  exception when insufficient_privilege then null; end;
  update public.properties set price = 0 where id = current_setting('test.public_id');
  if found then raise exception 'FAIL: member direct property update allowed'; end if;
  delete from public.properties where id = current_setting('test.public_id');
  if found then raise exception 'FAIL: member property deletion allowed'; end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('test.agent_id'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.agent_id'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare saved public.properties;
begin
  if (select count(*) from public.properties where id in (current_setting('test.public_id'), current_setting('test.draft_id'))) <> 2 then
    raise exception 'FAIL: agent cannot read drafts';
  end if;
  if not exists (select 1 from public.inquiries where id = current_setting('test.inquiry_id')) then
    raise exception 'FAIL: agent cannot read inquiries';
  end if;
  update public.inquiries set status = 'contacted' where id = current_setting('test.inquiry_id');
  if not found then raise exception 'FAIL: agent cannot update inquiry status'; end if;
  begin
    update public.profiles set role = 'ADMIN' where id = current_setting('test.agent_id')::uuid;
    raise exception 'FAIL: agent self-promotion allowed';
  exception when insufficient_privilege then null; end;

  saved := public.save_property(jsonb_build_object('title', 'RPC fixture', 'slug', gen_random_uuid()::text,
    'property_type', 'house', 'status', 'sale', 'price', 123, 'province', 'Songkhla', 'district', 'Hat Yai'),
    array['https://example.invalid/one.jpg', 'https://example.invalid/two.jpg']);
  if saved.published or (select count(*) from public.property_images where property_id = saved.id) <> 2 then
    raise exception 'FAIL: create defaults or gallery creation';
  end if;
  saved := public.save_property(jsonb_build_object('id', saved.id, 'title', 'Updated RPC fixture'));
  if saved.price <> 123 or saved.title <> 'Updated RPC fixture'
    or (select count(*) from public.property_images where property_id = saved.id) <> 2 then
    raise exception 'FAIL: partial update did not preserve fields/images';
  end if;
  begin
    perform public.save_property(jsonb_build_object('id', saved.id, 'price', 999), array['']);
    raise exception 'FAIL: invalid gallery accepted';
  exception when check_violation then null; end;
  if (select price from public.properties where id = saved.id) <> 123
    or (select count(*) from public.property_images where property_id = saved.id) <> 2 then
    raise exception 'FAIL: gallery failure did not roll back listing changes';
  end if;
  perform public.save_property(jsonb_build_object('id', saved.id, 'published', true), array[]::text[]);
  if exists (select 1 from public.property_images where property_id = saved.id) then
    raise exception 'FAIL: empty gallery did not remove images';
  end if;
  delete from public.properties where id = saved.id;
  if not found then raise exception 'FAIL: agent cannot delete listing'; end if;
  delete from public.properties where id = current_setting('test.public_id');
  if (select property_id from public.inquiries where id = current_setting('test.inquiry_id')) is not null then
    raise exception 'FAIL: listing delete did not preserve inquiry';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('test.admin_id'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.admin_id'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.profiles where id in (
    current_setting('test.admin_id')::uuid, current_setting('test.agent_id')::uuid, current_setting('test.member_id')::uuid)) <> 3 then
    raise exception 'FAIL: admin cannot list profiles';
  end if;
  update public.profiles set role = 'AGENT' where id = current_setting('test.member_id')::uuid;
  if not found then raise exception 'FAIL: admin cannot change roles'; end if;
  begin
    delete from public.profiles where id = current_setting('test.member_id')::uuid;
    raise exception 'FAIL: browser admin can delete auth profiles';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'PASS: signup, role guards, public/staff RLS, inquiry privacy, and atomic gallery writes' as result;
rollback;
