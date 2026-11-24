create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Calls an Edge Function with the shared hook secret. The project URL and the secret live in
-- Vault (set by `npm run sb:admin -- set-vault`), so nothing secret is committed here.
create or replace function public.call_edge_function(fn text, body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text;
  secret text;
begin
  select decrypted_secret into base   from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'hook_secret';
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url     := base || '/functions/v1/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', secret),
    body    := body
  );
end;
$$;

revoke execute on function public.call_edge_function(text, jsonb) from public, anon, authenticated;

-- A notification is a nicety: whatever goes wrong here must never stop the item from being saved.
create or replace function public.notify_new_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.call_edge_function('notify', jsonb_build_object('collection', new.collection, 'data', new.data));
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke execute on function public.notify_new_item() from public, anon, authenticated;

create trigger items_notify
  after insert on public.items
  for each row
  when (new.collection <> 'places')
  execute function public.notify_new_item();

-- 00:00 UTC = 09:00 in Korea.
select cron.schedule('anniversary-daily', '0 0 * * *', $$select public.call_edge_function('anniversary', '{}'::jsonb)$$);
