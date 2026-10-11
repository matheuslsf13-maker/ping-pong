/** Quem joga. */
export type Jogador = {
  id: string
  nome: string
  apelido?: string | null
  /** Ponto de partida da forca (padrao 1500, o meio da escala). */
  forca_inicial?: number | null
  ativo: boolean
  created_at: string
}

export type StatusDoPlay = 'aberto' | 'finalizado'

/** Um dia de jogos: todos contra todos, 1 contra 1. */
export type Play = {
  id: string
  data: string // YYYY-MM-DD
  titulo: string
  mesas: number
  /** Melhor de N sets. Com 1, a partida e um set so e o placar e lancado em pontos. */
  melhor_de: number
  /** Pontos que fecham o set (11 ou 21). */
  pontos_set: number
  jogador_ids: string[]
  status: StatusDoPlay
  /** false = avulso: nao soma no ranking do mes e faltar nao conta. */
  ranked: boolean
  created_at: string
}

/** Uma partida da fila. O placar e em sets (ou em pontos, na partida unica). */
export type Partida = {
  id: string
  play_id: string
  /** Posicao na fila. */
  ordem: number
  /** A rodada do rodizio de onde ela veio (todos jogam uma vez por rodada). */
  rodada: number
  a: string
  b: string
  placar_a: number | null
  placar_b: number | null
  /** Os pontos de cada set, do lado a e do b ([[11, 1], [9, 11], ...]). */
  sets?: [number, number][] | null
  mesa: number | null
  iniciada_em: string | null
  terminada_em: string | null
}

export type Dados = {
  jogadores: Jogador[]
  plays: Play[]
  partidas: Partida[]
}

export const dadosVazios = (): Dados => ({ jogadores: [], plays: [], partidas: [] })

export const jogada = (p: Partida) => p.placar_a !== null && p.placar_b !== null

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const mesDe = (data: string) => data.slice(0, 7)

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split('-')
  return `${MESES[Number(m) - 1]} de ${a}`
}

export function dataCurta(data: string): string {
  const [, m, d] = data.split('-')
  return `${d}/${m}`
}

/** "1 partida", "3 partidas". */
export function plural(n: number, um: string, varios = um + 's'): string {
  return `${n} ${n === 1 ? um : varios}`
}
