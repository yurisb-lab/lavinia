-- Minha turma: um feed fechado de cards entre amigas e família.
--
-- * Quem tem o link de convite pede para entrar; um dono da turma aprova.
-- * Cada pessoa tem nome, avatar e uma "senha de figurinhas" (3 figurinhas em sequência),
--   guardada embaralhada (bcrypt) e com limite de tentativas.
-- * Cada aparelho continua com a conta anônima de sempre; group_devices liga o aparelho
--   à pessoa da turma (dá para entrar como a mesma pessoa em vários aparelhos).
-- * Os posts aparecem na hora e ficam 30 dias. Arquivos na pasta privada "groups":
--   <turma>/<post>/front.png, back.png e model.json (o modelo do card, sem as fotos).

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------- tabelas ----------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite text not null unique check (invite ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  avatar smallint not null default 0 check (avatar between 0 and 31),
  color smallint not null default 0 check (color between 0 and 15),
  status text not null default 'pending' check (status in ('pending', 'active')),
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index group_members_name_idx on public.group_members (group_id, lower(name));

-- Senhas ficam numa tabela separada, que ninguém lê pela API (só as funções abaixo).
create table public.member_secrets (
  member_id uuid primary key references public.group_members (id) on delete cascade,
  hash text not null,
  fails integer not null default 0,
  locked_until timestamptz
);

create table public.group_devices (
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  member_id uuid not null references public.group_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);
create index group_devices_member_idx on public.group_devices (member_id);
create index group_devices_group_idx on public.group_devices (group_id);

create table public.group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  member_id uuid not null references public.group_members (id) on delete cascade,
  card_id text check (card_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  format text not null default 'card' check (format in ('card', 'mini', 'bookmark', 'folded', 'poster')),
  orientation text not null default 'portrait' check (orientation in ('portrait', 'landscape')),
  has_back boolean not null default false,
  can_copy boolean not null default false,
  for_trade boolean not null default false,
  ready boolean not null default false,
  created_at timestamptz not null default now()
);
create index group_posts_feed_idx on public.group_posts (group_id, created_at desc);
create index group_posts_member_idx on public.group_posts (member_id);
create index group_posts_created_idx on public.group_posts (created_at);

create table public.post_reactions (
  post_id uuid not null references public.group_posts (id) on delete cascade,
  member_id uuid not null references public.group_members (id) on delete cascade,
  emoji text not null check (emoji in ('heart', 'love', 'star', 'fire')),
  created_at timestamptz not null default now(),
  primary key (post_id, member_id, emoji)
);
create index post_reactions_member_idx on public.post_reactions (member_id);

-- ---------- ajudantes (fora da API) ----------
-- Pessoa deste aparelho na turma (qualquer situação).
create function private.my_member(g uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select d.member_id from public.group_devices d where d.user_id = auth.uid() and d.group_id = g;
$$;

-- Pessoa deste aparelho na turma, se já foi aprovada.
create function private.my_active_member(g uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select d.member_id
  from public.group_devices d
  join public.group_members m on m.id = d.member_id
  where d.user_id = auth.uid() and d.group_id = g and m.status = 'active';
$$;

create function private.am_owner(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_devices d
    join public.group_members m on m.id = d.member_id
    where d.user_id = auth.uid() and d.group_id = g and m.status = 'active' and m.is_owner
  );
$$;

create function private.post_group(p uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select group_id from public.group_posts where id = p;
$$;

-- Pode ver um arquivo de post: o post existe, não venceu, e a pessoa é da turma.
create function private.can_read_post_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_posts p
    where p.group_id::text = (storage.foldername(path))[1]
      and p.id::text = (storage.foldername(path))[2]
      and p.created_at > now() - interval '30 days'
      and private.my_active_member(p.group_id) is not null
  );
$$;

-- Pode enviar um arquivo de post: o post é dela e ainda está sendo montado.
create function private.can_write_post_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select array_length(storage.foldername(path), 1) = 2
    and storage.filename(path) in ('front.png', 'back.png', 'model.json')
    and exists (
      select 1 from public.group_posts p
      where p.group_id::text = (storage.foldername(path))[1]
        and p.id::text = (storage.foldername(path))[2]
        and not p.ready
        and p.member_id = private.my_active_member(p.group_id)
    );
$$;

create function private.new_invite() returns text
language plpgsql volatile set search_path = '' as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  code text;
begin
  loop
    b := extensions.gen_random_bytes(8);
    code := '';
    for i in 0..7 loop
      code := code || substr(abc, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite = code);
  end loop;
  return code;
end $$;

-- Senha de figurinhas: 3 números de 0 a 15, separados por hífen (ex.: "3-0-12").
create function private.valid_secret(s text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(s ~ '^([0-9]|1[0-5])-([0-9]|1[0-5])-([0-9]|1[0-5])$', false);
$$;

create function private.hash_secret(s text) returns text
language sql volatile set search_path = '' as $$
  select extensions.crypt(s, extensions.gen_salt('bf', 8));
$$;

create function private.clean_name(s text) returns text
language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(coalesce(s, ''), '\s+', ' ', 'g')), 24);
$$;

grant execute on all functions in schema private to authenticated;

-- ---------- regras ----------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.member_secrets enable row level security;
alter table public.group_devices enable row level security;
alter table public.group_posts enable row level security;
alter table public.post_reactions enable row level security;

revoke all on public.groups, public.group_members, public.member_secrets, public.group_devices,
  public.group_posts, public.post_reactions from anon, authenticated;

grant select on public.groups, public.group_members, public.group_devices, public.group_posts, public.post_reactions to authenticated;
grant delete on public.group_devices, public.group_posts, public.post_reactions to authenticated;
grant insert (id, group_id, member_id, card_id, format, orientation, has_back, can_copy, for_trade) on public.group_posts to authenticated;
grant update (ready, for_trade, can_copy) on public.group_posts to authenticated;
grant insert (post_id, member_id, emoji) on public.post_reactions to authenticated;

create policy "turma: ver as minhas" on public.groups for select to authenticated
  using (private.my_member(id) is not null);

-- Na turma, cada um vê quem já foi aprovado; o dono vê também os pedidos; cada um vê a si mesmo.
create policy "turma: ver pessoas" on public.group_members for select to authenticated
  using (
    id = private.my_member(group_id)
    or (private.my_active_member(group_id) is not null and (status = 'active' or private.am_owner(group_id)))
  );

create policy "turma: ver meus aparelhos" on public.group_devices for select to authenticated
  using (user_id = (select auth.uid()));
create policy "turma: sair neste aparelho" on public.group_devices for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "turma: ver posts" on public.group_posts for select to authenticated
  using (
    private.my_active_member(group_id) is not null
    and created_at > now() - interval '30 days'
    and (ready or member_id = private.my_member(group_id))
  );
create policy "turma: postar" on public.group_posts for insert to authenticated
  with check (member_id = private.my_active_member(group_id) and not ready);
create policy "turma: mexer no meu post" on public.group_posts for update to authenticated
  using (member_id = private.my_active_member(group_id))
  with check (member_id = private.my_active_member(group_id));
create policy "turma: apagar post" on public.group_posts for delete to authenticated
  using (member_id = private.my_member(group_id) or private.am_owner(group_id));

create policy "turma: ver reações" on public.post_reactions for select to authenticated
  using (private.my_active_member(private.post_group(post_id)) is not null);
create policy "turma: reagir" on public.post_reactions for insert to authenticated
  with check (member_id = private.my_active_member(private.post_group(post_id)));
create policy "turma: tirar reação" on public.post_reactions for delete to authenticated
  using (member_id = private.my_member(private.post_group(post_id)));

-- No máximo 40 posts por pessoa a cada 24 horas (para ninguém lotar o feed sem querer).
create function private.posts_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.group_posts
      where member_id = new.member_id and created_at > now() - interval '24 hours') >= 40 then
    raise exception 'too_many_posts' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger group_posts_limit before insert on public.group_posts
for each row execute function private.posts_limit();

-- ---------- funções chamadas pelo app ----------
create function public.create_group(p_group text, p_name text, p_avatar int, p_color int, p_secret text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  g uuid;
  m uuid;
  code text;
  gname text := left(btrim(coalesce(p_group, '')), 40);
  mname text := private.clean_name(p_name);
begin
  if auth.uid() is null then raise exception 'no_session'; end if;
  if gname = '' or mname = '' then raise exception 'missing_name'; end if;
  if not private.valid_secret(p_secret) then raise exception 'bad_secret'; end if;
  if (select count(*) from public.group_devices where user_id = auth.uid()) >= 10 then
    raise exception 'too_many_groups';
  end if;
  code := private.new_invite();
  insert into public.groups (name, invite) values (gname, code) returning id into g;
  insert into public.group_members (group_id, name, avatar, color, status, is_owner)
    values (g, mname, coalesce(p_avatar, 0), coalesce(p_color, 0), 'active', true) returning id into m;
  insert into public.member_secrets (member_id, hash) values (m, private.hash_secret(p_secret));
  insert into public.group_devices (user_id, group_id, member_id) values (auth.uid(), g, m);
  return json_build_object('group_id', g, 'member_id', m, 'invite', code);
end $$;

-- Quem tem o convite vê o nome da turma e quem já está nela (para "Já sou da turma").
create function public.group_by_invite(p_invite text)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', g.id,
    'name', g.name,
    'members', coalesce((
      select json_agg(json_build_object('id', m.id, 'name', m.name, 'avatar', m.avatar, 'color', m.color) order by lower(m.name))
      from public.group_members m where m.group_id = g.id and m.status = 'active'
    ), '[]'::json)
  )
  from public.groups g
  where g.invite = upper(btrim(p_invite)) and auth.uid() is not null;
$$;

create function public.join_group(p_invite text, p_name text, p_avatar int, p_color int, p_secret text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  g uuid;
  m uuid;
  mname text := private.clean_name(p_name);
begin
  if auth.uid() is null then raise exception 'no_session'; end if;
  select id into g from public.groups where invite = upper(btrim(p_invite));
  if g is null then raise exception 'bad_invite'; end if;
  if mname = '' then raise exception 'missing_name'; end if;
  if not private.valid_secret(p_secret) then raise exception 'bad_secret'; end if;
  if exists (select 1 from public.group_devices where user_id = auth.uid() and group_id = g) then
    raise exception 'already_in';
  end if;
  if exists (select 1 from public.group_members where group_id = g and lower(name) = lower(mname)) then
    raise exception 'name_taken';
  end if;
  if (select count(*) from public.group_members where group_id = g and status = 'pending') >= 20 then
    raise exception 'too_many_requests';
  end if;
  if (select count(*) from public.group_members where group_id = g) >= 200 then
    raise exception 'group_full';
  end if;
  insert into public.group_members (group_id, name, avatar, color, status)
    values (g, mname, coalesce(p_avatar, 0), coalesce(p_color, 0), 'pending') returning id into m;
  insert into public.member_secrets (member_id, hash) values (m, private.hash_secret(p_secret));
  insert into public.group_devices (user_id, group_id, member_id) values (auth.uid(), g, m);
  return json_build_object('group_id', g, 'member_id', m, 'status', 'pending');
end $$;

-- Entrar como alguém que já é da turma (outro aparelho). 5 erros seguidos travam por um tempo
-- que vai dobrando (15 min, 30 min, 1 h… até 1 dia); o dono pode trocar a senha e destravar.
create function public.login_member(p_invite text, p_member uuid, p_secret text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  g uuid;
  s public.member_secrets%rowtype;
  wait interval;
begin
  if auth.uid() is null then raise exception 'no_session'; end if;
  select id into g from public.groups where invite = upper(btrim(p_invite));
  if g is null then raise exception 'bad_invite'; end if;
  select ms.* into s from public.member_secrets ms
    join public.group_members m on m.id = ms.member_id
    where ms.member_id = p_member and m.group_id = g
    for update of ms;
  if not found then raise exception 'no_member'; end if;
  if s.locked_until is not null and s.locked_until > now() then
    return json_build_object('ok', false, 'locked_minutes', ceil(extract(epoch from s.locked_until - now()) / 60));
  end if;
  if private.valid_secret(p_secret) and extensions.crypt(p_secret, s.hash) = s.hash then
    update public.member_secrets set fails = 0, locked_until = null where member_id = p_member;
    insert into public.group_devices (user_id, group_id, member_id) values (auth.uid(), g, p_member)
      on conflict (user_id, group_id) do update set member_id = excluded.member_id, created_at = now();
    return json_build_object('ok', true, 'group_id', g);
  end if;
  s.fails := s.fails + 1;
  if s.fails % 5 = 0 then
    wait := least(interval '15 minutes' * power(2, s.fails / 5 - 1), interval '1 day');
    update public.member_secrets set fails = s.fails, locked_until = now() + wait where member_id = p_member;
    return json_build_object('ok', false, 'locked_minutes', ceil(extract(epoch from wait) / 60));
  end if;
  update public.member_secrets set fails = s.fails where member_id = p_member;
  return json_build_object('ok', false, 'tries_left', 5 - s.fails % 5);
end $$;

create function public.set_my_secret(p_group uuid, p_secret text)
returns void language plpgsql security definer set search_path = '' as $$
declare m uuid := private.my_member(p_group);
begin
  if m is null then raise exception 'not_member'; end if;
  if not private.valid_secret(p_secret) then raise exception 'bad_secret'; end if;
  update public.member_secrets set hash = private.hash_secret(p_secret), fails = 0, locked_until = null where member_id = m;
end $$;

-- ---------- funções do dono ----------
create function private.owner_of_member(p_member uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select group_id into g from public.group_members where id = p_member;
  if g is null then raise exception 'no_member'; end if;
  if not private.am_owner(g) then raise exception 'not_owner'; end if;
  return g;
end $$;

create function public.approve_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.owner_of_member(p_member);
  update public.group_members set status = 'active' where id = p_member;
end $$;

-- Recusar um pedido ou tirar alguém da turma (os posts e reações da pessoa saem junto).
create function public.remove_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare g uuid := private.owner_of_member(p_member);
begin
  if p_member = private.my_member(g) then raise exception 'is_me'; end if;
  delete from public.group_members where id = p_member;
end $$;

create function public.set_member_secret(p_member uuid, p_secret text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.owner_of_member(p_member);
  if not private.valid_secret(p_secret) then raise exception 'bad_secret'; end if;
  update public.member_secrets set hash = private.hash_secret(p_secret), fails = 0, locked_until = null where member_id = p_member;
end $$;

create function public.set_member_owner(p_member uuid, p_owner boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare g uuid := private.owner_of_member(p_member);
begin
  if p_member = private.my_member(g) then raise exception 'is_me'; end if;
  update public.group_members set is_owner = coalesce(p_owner, false) where id = p_member and status = 'active';
end $$;

-- Link novo: o antigo para de funcionar (quem já está na turma continua).
create function public.new_group_invite(p_group uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare code text;
begin
  if not private.am_owner(p_group) then raise exception 'not_owner'; end if;
  code := private.new_invite();
  update public.groups set invite = code where id = p_group;
  return code;
end $$;

revoke all on function public.create_group(text, text, int, int, text), public.group_by_invite(text),
  public.join_group(text, text, int, int, text), public.login_member(text, uuid, text),
  public.set_my_secret(uuid, text), public.approve_member(uuid), public.remove_member(uuid),
  public.set_member_secret(uuid, text), public.set_member_owner(uuid, boolean), public.new_group_invite(uuid)
  from public, anon;
grant execute on function public.create_group(text, text, int, int, text), public.group_by_invite(text),
  public.join_group(text, text, int, int, text), public.login_member(text, uuid, text),
  public.set_my_secret(uuid, text), public.approve_member(uuid), public.remove_member(uuid),
  public.set_member_secret(uuid, text), public.set_member_owner(uuid, boolean), public.new_group_invite(uuid)
  to authenticated;

-- ---------- arquivos dos posts ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('groups', 'groups', false, 10485760, array['image/png', 'application/json']);

create policy "groups: ver posts da turma" on storage.objects for select to authenticated
  using (bucket_id = 'groups' and private.can_read_post_file(name));
create policy "groups: enviar meu post" on storage.objects for insert to authenticated
  with check (bucket_id = 'groups' and private.can_write_post_file(name));

-- ---------- limpeza diária (chamada pela função limpar-cards) ----------
-- Arquivos de posts vencidos ou apagados (depois de 1 dia, para não pegar um envio no meio).
create function public.expired_group_files()
returns table (name text)
language sql security definer set search_path = '' stable as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'groups'
    and not exists (
      select 1 from public.group_posts p
      where p.group_id::text = (storage.foldername(o.name))[1]
        and p.id::text = (storage.foldername(o.name))[2]
        and p.created_at > now() - interval '30 days'
    )
    and o.created_at < now() - interval '1 day'
  limit 1000;
$$;

-- Posts vencidos, posts que não terminaram de subir e pedidos esquecidos.
create function public.clean_groups()
returns json language plpgsql security definer set search_path = '' as $$
declare a int; b int; c int;
begin
  delete from public.group_posts where created_at < now() - interval '30 days';
  get diagnostics a = row_count;
  delete from public.group_posts where not ready and created_at < now() - interval '1 day';
  get diagnostics b = row_count;
  delete from public.group_members where status = 'pending' and created_at < now() - interval '30 days';
  get diagnostics c = row_count;
  return json_build_object('posts', a + b, 'requests', c);
end $$;

revoke all on function public.expired_group_files(), public.clean_groups() from public, anon, authenticated;
grant execute on function public.expired_group_files(), public.clean_groups() to service_role;
