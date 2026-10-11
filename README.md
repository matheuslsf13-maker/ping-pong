# Ping-Pong — 1 contra 1

Base do Play de Todas adaptada para ping-pong: todos contra todos, melhor de 3, 5
ou 7 (sets de 11), fila de partidas por mesa, ranking do dia (vitórias) e do mês
(pontos), força Elo com queda por falta, ficha de cada jogador com gráfico e
confrontos.

- Banco: o mesmo projeto Supabase do Play de Todas, com tabelas próprias
  (`pp_*`). Rode `supabase/01-ping-pong.sql` uma vez no SQL Editor.
- Login: o mesmo do Play de Todas. Sem login, só leitura.
- `npm run dev` · `npm test` · `npm run build`. Push na `main` publica no GitHub Pages.
- Pontos do mês: sets do vencedor − sets do perdedor (mínimo 1); quem perde não pontua.
