alter table public.items drop constraint items_collection_check;
alter table public.items add constraint items_collection_check
  check (collection in ('places','doodles','notes','bucket','moods','archive','votes','pokes','events','answers','reactions','balance'));
