-- The notify function needs the new row's time to tell a day's first answer from a later one,
-- whatever order the calls arrive in.
create or replace function public.notify_new_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.call_edge_function(
      'notify',
      jsonb_build_object('collection', new.collection, 'data', new.data, 'created_at', new.created_at)
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke execute on function public.notify_new_item() from public, anon, authenticated;
