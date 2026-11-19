-- A Central de Criação Elane (repositório papelarialane) usa este mesmo banco.
-- As peças dela ficam guardadas sem prazo: só saem da nuvem quando ela apaga no app.
-- Os cards do app da Lavínia continuam com os 30 dias de sempre.

alter table public.saved_cards
  add column app text not null default 'lavinia' check (app in ('lavinia', 'elane'));

-- Limpeza diária: arquivos de cards vencidos (ou sem card, depois de 1 dia).
-- Cards da Elane nunca vencem.
create or replace function public.expired_card_files()
returns table (name text)
language sql security definer set search_path = '' stable as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'cards'
    and not exists (
      select 1 from public.saved_cards c
      where c.owner::text = (storage.foldername(o.name))[1]
        and c.card_id = (storage.foldername(o.name))[2]
        and (c.app = 'elane' or c.updated_at > now() - interval '30 days')
    )
    and o.created_at < now() - interval '1 day'
  limit 1000;
$$;

revoke all on function public.expired_card_files() from public, anon, authenticated;
grant execute on function public.expired_card_files() to service_role;
