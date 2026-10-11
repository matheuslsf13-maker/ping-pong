-- Ping-Pong — os pontos de cada set ([[11, 1], [9, 11], ...]), para a força
-- levar em conta a diferença de pontos dentro dos sets. Rode uma vez.
alter table public.pp_partidas add column if not exists sets jsonb;
notify pgrst, 'reload schema';
