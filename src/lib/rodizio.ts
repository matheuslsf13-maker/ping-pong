import { jogada, uid, type Partida } from './tipos'

/**
 * TODOS CONTRA TODOS, pelo metodo do circulo: um fica parado e os outros giram.
 * Cada rodada junta todo mundo uma vez (com numero impar, um folga), e depois
 * de todas as rodadas cada um enfrentou cada um exatamente uma vez.
 */
export function rodadasDoRodizio(ids: string[]): [string, string][][] {
  const lista: (string | null)[] = [...ids]
  if (lista.length % 2 === 1) lista.push(null) // quem cai com o null folga
  const n = lista.length
  const rodadas: [string, string][][] = []
  for (let r = 0; r < n - 1; r++) {
    const rodada: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const x = lista[i]
      const y = lista[n - 1 - i]
      if (x && y) rodada.push(r % 2 === 0 ? [x, y] : [y, x])
    }
    rodadas.push(rodada)
    // gira todos menos o primeiro
    lista.splice(1, 0, lista.pop() as string | null)
  }
  return rodadas
}

/** Quantas rodadas tem o rodizio completo de n jogadores. */
export const maxRodadas = (n: number) => (n < 2 ? 0 : n % 2 === 0 ? n - 1 : n)

/**
 * As partidas do play: as `rodadas` primeiras do rodizio, na ordem. Menos
 * rodadas que o completo = cada um joga menos (com numero par, todos jogam o
 * mesmo tanto; com impar, a diferenca e de no maximo uma).
 */
export function montarPartidas(playId: string, ids: string[], rodadas: number): Partida[] {
  const out: Partida[] = []
  rodadasDoRodizio(ids)
    .slice(0, rodadas)
    .forEach((r, ri) => {
      for (const [a, b] of r) {
        out.push({
          id: uid(), play_id: playId, ordem: out.length + 1, rodada: ri + 1, a, b,
          placar_a: null, placar_b: null, mesa: null, iniciada_em: null, terminada_em: null,
        })
      }
    })
  return out
}

/**
 * Quantas partidas terminaram desde que cada um jogou pela ultima vez (quem
 * ainda nao jogou fica de fora do mapa: e quem esta esperando ha mais tempo).
 */
export function descansoDe(partidas: Partida[]): Map<string, number> {
  const feitas = partidas
    .filter(jogada)
    .sort((x, y) => (x.terminada_em ?? '').localeCompare(y.terminada_em ?? '') || x.ordem - y.ordem)
  const out = new Map<string, number>()
  feitas.forEach((p, i) => {
    out.set(p.a, feitas.length - 1 - i)
    out.set(p.b, feitas.length - 1 - i)
  })
  return out
}

/**
 * A PROXIMA PARTIDA para uma mesa que vagou: entre as que ainda nao foram
 * jogadas nem comecaram, so as que tem os dois livres; dessas, a de quem esta
 * parado ha mais tempo (o mais descansado dos dois que menos descansou), e no
 * empate a que vem antes na fila. Assim ninguem emenda partida se der para evitar.
 */
export function proximaPartida(
  partidas: Partida[],
  ocupados: Set<string>,
  descanso: Map<string, number>,
): Partida | null {
  const pendentes = partidas.filter((p) => !jogada(p) && !p.iniciada_em && !ocupados.has(p.a) && !ocupados.has(p.b))
  if (pendentes.length === 0) return null
  const espera = (id: string) => descanso.get(id) ?? Infinity
  const valor = (p: Partida) => Math.min(espera(p.a), espera(p.b))
  return pendentes.reduce((melhor, p) => {
    const v = valor(p)
    const vm = valor(melhor)
    if (v > vm) return p
    if (v === vm && p.rodada < melhor.rodada) return p
    return melhor
  })
}

/**
 * O que cada mesa mostra agora: a partida em andamento nela, ou a sugerida
 * (quem ja esta numa mesa, ou sugerido para uma mesa anterior, nao entra).
 */
export function mesasAgora(
  partidas: Partida[],
  mesas: number,
): { mesa: number; partida: Partida | null; emJogo: boolean }[] {
  const emJogo = partidas.filter((p) => p.iniciada_em && !jogada(p))
  const ocupados = new Set(emJogo.flatMap((p) => [p.a, p.b]))
  const descanso = descansoDe(partidas)
  const sugeridas = new Set<string>()
  const out: { mesa: number; partida: Partida | null; emJogo: boolean }[] = []
  for (let m = 1; m <= mesas; m++) {
    const atual = emJogo.find((p) => p.mesa === m)
    if (atual) {
      out.push({ mesa: m, partida: atual, emJogo: true })
      continue
    }
    const livres = partidas.filter((p) => !sugeridas.has(p.id))
    const prox = proximaPartida(livres, ocupados, descanso)
    if (prox) {
      sugeridas.add(prox.id)
      ocupados.add(prox.a)
      ocupados.add(prox.b)
    }
    out.push({ mesa: m, partida: prox, emJogo: false })
  }
  // partida iniciada numa mesa que nao existe mais (mesas diminuiram): aparece no fim
  for (const p of emJogo) if (!out.some((x) => x.partida?.id === p.id)) out.push({ mesa: p.mesa ?? 0, partida: p, emJogo: true })
  return out
}

const parDe = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Os confrontos do todos contra todos que ainda nao estao no play. */
export function confrontosQueFaltam(ids: string[], partidas: Partida[]): [string, string][] {
  const tem = new Set(partidas.map((p) => parDe(p.a, p.b)))
  return rodadasDoRodizio(ids).flat().filter(([a, b]) => !tem.has(parDe(a, b)))
}

/**
 * As partidas que faltam para fechar o todos contra todos (um play criado com
 * menos rodadas, ou alguem que entrou depois), na ordem das rodadas do
 * rodizio, depois das que ja existem.
 */
export function completarRodizio(playId: string, ids: string[], partidas: Partida[]): Partida[] {
  const tem = new Set(partidas.map((p) => parDe(p.a, p.b)))
  let ordem = partidas.reduce((m, p) => Math.max(m, p.ordem), 0)
  const ultimaRodada = partidas.reduce((m, p) => Math.max(m, p.rodada), 0)
  const out: Partida[] = []
  let r = ultimaRodada
  for (const rodada of rodadasDoRodizio(ids)) {
    const faltam = rodada.filter(([a, b]) => !tem.has(parDe(a, b)))
    if (faltam.length === 0) continue
    r++
    for (const [a, b] of faltam) {
      out.push({
        id: uid(), play_id: playId, ordem: ++ordem, rodada: r, a, b,
        placar_a: null, placar_b: null, mesa: null, iniciada_em: null, terminada_em: null,
      })
    }
  }
  return out
}
