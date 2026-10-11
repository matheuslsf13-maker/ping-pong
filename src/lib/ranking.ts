import { jogada, mesDe, type Dados, type Partida, type Play } from './tipos'

export type Estatistica = {
  id: string
  jogos: number
  v: number
  d: number
  /** Sets (ou pontos, na partida unica) feitos e sofridos. */
  pro: number
  contra: number
  pontos: number
}

const nova = (id: string): Estatistica => ({ id, jogos: 0, v: 0, d: 0, pro: 0, contra: 0, pontos: 0 })

/**
 * PONTOS DO MES de uma partida, como no Play de Todas: quem vence leva os sets
 * que fez menos os da adversaria (minimo 1); quem perde nao pontua. Na partida
 * de um set so (lancada em pontos), a vitoria vale 1 -- senao um 11x0 valeria 11.
 */
export function pontosDoMes(p: Partida, play: Pick<Play, 'melhor_de'>): Record<string, number> {
  if (!jogada(p)) return { [p.a]: 0, [p.b]: 0 }
  const a = p.placar_a as number
  const b = p.placar_b as number
  const ganho = play.melhor_de > 1 ? Math.max(1, Math.abs(a - b)) : 1
  return { [p.a]: a > b ? ganho : 0, [p.b]: b > a ? ganho : 0 }
}

export function estatisticas(partidas: Partida[], plays?: Map<string, Play>): Map<string, Estatistica> {
  const out = new Map<string, Estatistica>()
  for (const p of partidas) {
    if (!jogada(p)) continue
    const a = p.placar_a as number
    const b = p.placar_b as number
    const ea = out.get(p.a) ?? nova(p.a)
    const eb = out.get(p.b) ?? nova(p.b)
    ea.jogos++
    eb.jogos++
    ea.pro += a
    ea.contra += b
    eb.pro += b
    eb.contra += a
    if (a > b) {
      ea.v++
      eb.d++
    } else {
      eb.v++
      ea.d++
    }
    const pts = pontosDoMes(p, plays?.get(p.play_id) ?? { melhor_de: 3 })
    ea.pontos += pts[p.a]
    eb.pontos += pts[p.b]
    out.set(p.a, ea)
    out.set(p.b, eb)
  }
  return out
}

export const saldo = (e: Estatistica) => e.pro - e.contra

/** O dia e por VITORIAS (o saldo e os pontos so desempatam). */
export function rankingDoDia(d: Dados, playId: string): Estatistica[] {
  const play = d.plays.find((p) => p.id === playId)
  const plays = new Map(play ? [[play.id, play]] : [])
  const e = estatisticas(d.partidas.filter((p) => p.play_id === playId), plays)
  // quem esta no play e ainda nao jogou aparece zerada, no fim
  for (const id of play?.jogador_ids ?? []) if (!e.has(id)) e.set(id, nova(id))
  return [...e.values()].sort((x, y) => y.v - x.v || saldo(y) - saldo(x) || y.pro - x.pro || x.d - y.d)
}

/** O mes e por PONTOS, so dos plays que valem (o avulso fica de fora). */
export function rankingDoMes(d: Dados, mes: string | null): Estatistica[] {
  const plays = new Map(d.plays.filter((p) => p.ranked && (mes === null || mesDe(p.data) === mes)).map((p) => [p.id, p]))
  const e = estatisticas(d.partidas.filter((p) => plays.has(p.play_id)), plays)
  return [...e.values()].sort((x, y) => y.pontos - x.pontos || y.v - x.v || saldo(y) - saldo(x) || x.jogos - y.jogos)
}

/** Os meses que tem play que vale, do mais novo para o mais antigo. */
export function mesesComPlay(d: Dados): string[] {
  return [...new Set(d.plays.filter((p) => p.ranked).map((p) => mesDe(p.data)))].sort().reverse()
}

/** Confrontos de um jogador: contra cada adversario, vitorias e derrotas. */
export function confrontos(d: Dados, id: string): { id: string; v: number; d: number }[] {
  const out = new Map<string, { id: string; v: number; d: number }>()
  for (const p of d.partidas) {
    if (!jogada(p) || (p.a !== id && p.b !== id)) continue
    const outro = p.a === id ? p.b : p.a
    const venceu = p.a === id ? (p.placar_a as number) > (p.placar_b as number) : (p.placar_b as number) > (p.placar_a as number)
    const c = out.get(outro) ?? { id: outro, v: 0, d: 0 }
    if (venceu) c.v++
    else c.d++
    out.set(outro, c)
  }
  return [...out.values()].sort((x, y) => y.v + y.d - (x.v + x.d))
}
