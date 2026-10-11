-- ============================================================
--  Ping-Pong — tabelas próprias no MESMO projeto do Play de Todas
--  Rode uma vez no SQL Editor do Supabase.
--
--  Tudo com o prefixo pp_: os jogadores, plays e partidas do ping-pong
--  ficam separados dos do beach tennis (nada aqui toca nas tabelas dele).
--  O login é o mesmo: quem entra no Play de Todas entra aqui.
--
--  Leitura pública (o link mostra o ranking); escrita só logada.
-- ============================================================

create table if not exists public.pp_jogadores (
  id            text primary key,
  nome          text not null,
  apelido       text,
  forca_inicial integer,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.pp_plays (
  id          text primary key,
  data        date not null,
  titulo      text not null default 'Play de ping-pong',
  mesas       integer not null default 1,
  -- melhor de N sets (3, 5 ou 7), sets de 11 pontos
  melhor_de   integer not null default 5,
  pontos_set  integer not null default 11,
  jogador_ids text[] not null default '{}',
  status      text not null default 'aberto' check (status in ('aberto', 'finalizado')),
  -- false = play avulso: não soma no ranking do mês e faltar não conta
  ranked      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.pp_partidas (
  id           text primary key,
  play_id      text not null references public.pp_plays(id) on delete cascade,
  ordem        integer not null,
  rodada       integer not null default 1,
  a            text not null,
  b            text not null,
  placar_a     integer,
  placar_b     integer,
  mesa         integer,
  iniciada_em  timestamptz,
  terminada_em timestamptz
);
create index if not exists pp_partidas_play on public.pp_partidas (play_id);

alter table public.pp_jogadores enable row level security;
alter table public.pp_plays     enable row level security;
alter table public.pp_partidas  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pp_jogadores', 'pp_plays', 'pp_partidas'] loop
    execute format('drop policy if exists "leitura publica" on public.%I', t);
    execute format('drop policy if exists "escrita autenticada" on public.%I', t);
    execute format('create policy "leitura publica" on public.%I for select using (true)', t);
    execute format(
      'create policy "escrita autenticada" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- avisos em tempo real (o outro celular vê o placar sem recarregar)
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.pp_jogadores'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.pp_plays';     exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.pp_partidas';  exception when duplicate_object then null; end;
end $$;

notify pgrst, 'reload schema';
