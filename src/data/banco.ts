import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import type { Dados, Jogador, Partida, Play } from '../lib/tipos'

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

/**
 * Uma escrita, em formato que vai para o localStorage: a fila sobrevive a um
 * refresh e a um celular sem sinal no meio do play.
 */
export type Escrita =
  | { id: string; tipo: 'jogador'; jogador: Jogador }
  | { id: string; tipo: 'play'; play: Play }
  | { id: string; tipo: 'apagarPlay'; playId: string }
  | { id: string; tipo: 'partidas'; partidas: Partida[] }
  | { id: string; tipo: 'apagarPartidas'; ids: string[] }

/** Aplica a escrita nos dados da tela (antes de o banco confirmar). */
export function aplicar(d: Dados, e: Escrita): Dados {
  switch (e.tipo) {
    case 'jogador':
      return { ...d, jogadores: trocar(d.jogadores, [e.jogador]) }
    case 'play':
      return { ...d, plays: trocar(d.plays, [e.play]) }
    case 'apagarPlay':
      return { ...d, plays: d.plays.filter((p) => p.id !== e.playId), partidas: d.partidas.filter((p) => p.play_id !== e.playId) }
    case 'partidas':
      return { ...d, partidas: trocar(d.partidas, e.partidas) }
    case 'apagarPartidas': {
      const fora = new Set(e.ids)
      return { ...d, partidas: d.partidas.filter((p) => !fora.has(p.id)) }
    }
  }
}

function trocar<T extends { id: string }>(lista: T[], novos: T[]): T[] {
  const porId = new Map(novos.map((x) => [x.id, x]))
  const out = lista.map((x) => porId.get(x.id) ?? x)
  for (const x of novos) if (!lista.some((y) => y.id === x.id)) out.push(x)
  return out
}

/** As tabelas ainda nao existem no banco (o script 01 nao foi rodado). */
export function faltaOScript(msg: string): boolean {
  return /pp_(jogadores|plays|partidas)/.test(msg) && /(does not exist|Could not find the table|schema cache)/i.test(msg)
}

export async function carregar(): Promise<Dados> {
  if (!supabase) throw new Error('Supabase não configurado')
  const [j, p, m] = await Promise.all([
    supabase.from('pp_jogadores').select('*').order('nome'),
    supabase.from('pp_plays').select('*').order('data', { ascending: false }),
    supabase.from('pp_partidas').select('*'),
  ])
  const erro = j.error || p.error || m.error
  if (erro) throw new Error(erro.message)
  return { jogadores: j.data as Jogador[], plays: p.data as Play[], partidas: m.data as Partida[] }
}

export async function enviar(e: Escrita): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado')
  const r =
    e.tipo === 'jogador'
      ? await supabase.from('pp_jogadores').upsert(e.jogador)
      : e.tipo === 'play'
        ? await supabase.from('pp_plays').upsert(e.play)
        : e.tipo === 'apagarPlay'
          ? await supabase.from('pp_plays').delete().eq('id', e.playId)
          : e.tipo === 'partidas'
            ? await gravarPartidas(e.partidas)
            : await supabase.from('pp_partidas').delete().in('id', e.ids)
  if (r.error) throw new Error(r.error.message)
}

/**
 * Sem o script 02 a coluna `sets` nao existe: grava o resto (placar final) em
 * vez de travar a fila para sempre -- e avisa, para rodarem o script.
 */
export let faltaColunaSets = false
async function gravarPartidas(ps: Partida[]) {
  const r = await supabase!.from('pp_partidas').upsert(ps)
  if (r.error && /'sets' column/.test(r.error.message)) {
    faltaColunaSets = true
    return supabase!.from('pp_partidas').upsert(ps.map(({ sets: _s, ...resto }) => resto))
  }
  return r
}

/* ------------------------------------------------- guardado no aparelho */

const CHAVE_FILA = 'ping-pong:fila'
const CHAVE_CACHE = 'ping-pong:cache'

function ler<T>(chave: string, padrao: T): T {
  try {
    const raw = localStorage.getItem(chave)
    return raw ? (JSON.parse(raw) as T) : padrao
  } catch {
    return padrao
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    /* sem espaco ou bloqueado: segue so em memoria */
  }
}

export const lerFila = () => ler<Escrita[]>(CHAVE_FILA, [])
export const gravarFila = (f: Escrita[]) => gravar(CHAVE_FILA, f)
export const lerCache = () => ler<Dados | null>(CHAVE_CACHE, null)
export const gravarCache = (d: Dados) => gravar(CHAVE_CACHE, d)
