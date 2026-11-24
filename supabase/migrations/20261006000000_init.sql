create table public.items (
  collection text   not null check (collection in ('places','doodles','notes','bucket','moods','archive','votes')),
  id         text   not null,
  data       jsonb  not null,
  created_at bigint not null,
  primary key (collection, id)
);

create table public.settings (
  id   int primary key check (id = 1),
  data jsonb not null
);

create table public.push_subscriptions (
  endpoint   text primary key,
  p256dh     text   not null,
  auth       text   not null,
  who        text   not null check (who in ('A','B')),
  created_at bigint not null
);

create table public.private_content (
  key  text primary key,
  data jsonb not null
);

alter table public.items              enable row level security;
alter table public.settings           enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.private_content    enable row level security;

revoke all on public.items, public.settings, public.push_subscriptions, public.private_content from anon, authenticated;
grant select, insert, update, delete on public.items, public.settings, public.push_subscriptions to authenticated;
grant select on public.private_content to authenticated;
grant all on public.items, public.settings, public.push_subscriptions, public.private_content to service_role;

create policy "couple can do everything" on public.items
  for all to authenticated using (true) with check (true);
create policy "couple can do everything" on public.settings
  for all to authenticated using (true) with check (true);
create policy "couple can do everything" on public.push_subscriptions
  for all to authenticated using (true) with check (true);
create policy "couple can read" on public.private_content
  for select to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false), ('media', 'media', false)
on conflict (id) do nothing;

create policy "couple can use uploads" on storage.objects
  for all to authenticated using (bucket_id = 'uploads') with check (bucket_id = 'uploads');
create policy "couple can read media" on storage.objects
  for select to authenticated using (bucket_id = 'media');
