-- Cards guardados na nuvem por 30 dias depois da última vez que foram salvos.
create table public.saved_cards (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null check (card_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  orientation text not null default 'portrait' check (orientation in ('portrait', 'landscape')),
  has_back boolean not null default false,
  copies integer not null default 1 check (copies between 1 and 99),
  files text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, card_id)
);

create index saved_cards_updated_at_idx on public.saved_cards (updated_at);

create function public.saved_cards_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;

create trigger saved_cards_touch before insert or update on public.saved_cards
for each row execute function public.saved_cards_touch();

alter table public.saved_cards enable row level security;

create policy "ver os meus cards" on public.saved_cards for select to authenticated
  using (owner = (select auth.uid()));
create policy "guardar os meus cards" on public.saved_cards for insert to authenticated
  with check (owner = (select auth.uid()));
create policy "atualizar os meus cards" on public.saved_cards for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "apagar os meus cards" on public.saved_cards for delete to authenticated
  using (owner = (select auth.uid()));

revoke all on public.saved_cards from anon;

-- Pasta privada: cada aparelho só mexe em <id do aparelho>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cards', 'cards', false, 26214400,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/json']);

create policy "cards: ver os meus" on storage.objects for select to authenticated
  using (bucket_id = 'cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cards: enviar os meus" on storage.objects for insert to authenticated
  with check (bucket_id = 'cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cards: trocar os meus" on storage.objects for update to authenticated
  using (bucket_id = 'cards' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cards: apagar os meus" on storage.objects for delete to authenticated
  using (bucket_id = 'cards' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Para a limpeza diária: arquivos de cards vencidos (ou sem card, depois de 1 dia).
create function public.expired_card_files()
returns table (name text)
language sql security definer set search_path = '' stable as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'cards'
    and not exists (
      select 1 from public.saved_cards c
      where c.owner::text = (storage.foldername(o.name))[1]
        and c.card_id = (storage.foldername(o.name))[2]
        and c.updated_at > now() - interval '30 days'
    )
    and o.created_at < now() - interval '1 day'
  limit 1000;
$$;

revoke all on function public.expired_card_files() from public, anon, authenticated;
grant execute on function public.expired_card_files() to service_role;
