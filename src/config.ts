/**
 * O mesmo projeto Supabase do Play de Todas (o login e o mesmo), com as
 * tabelas proprias do ping-pong (prefixo pp_, script supabase/01-ping-pong.sql).
 *
 * A chave aqui e a PUBLICAVEL: ela vai dentro do site de qualquer jeito, e quem
 * protege os dados e o RLS (todo mundo le; so quem esta logada escreve).
 * NUNCA coloque aqui a chave secret / service_role.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://yavxfubztyuonryuvdhn.supabase.co'
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2Txknu1egyRRED_Y5exMXQ_64DSmH5q'
