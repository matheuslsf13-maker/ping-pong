import { jogada, type Dados } from './tipos'

/**
 * A FORCA: o mesmo Elo do Play de Todas, aqui de um contra um.
 *
 * Cada partida move a nota conforme quem estava do outro lado: vencer quem
 * esta melhor rende muito mais do que vencer quem esta pior. A margem conta
 * (a fatia de sets -- ou de pontos, na partida de um set so -- que cada um
 * fez): 2x0 vale mais que 2x1. E soma zero, entao a media fica em 1500 e as
 * faixas querem dizer a mesma coisa daqui a um ano.
 */
export const FORCA_MEDIA = 1500
const K = 24
/** Abaixo disso a nota aparece como provisoria. */
export const JOGOS_PARA_FIRMAR = 8

/*
 * QUEM FALTA PERDE FORCA, DEVAGAR (a regra do Play de Todas): a 1a falta nao
 * muda nada; da 2a seguida em diante, a cada play que vale, aumentando a cada
 * falta -- acima de 1500 perde 10%, 30%, 50% e dai 70% da distancia ate 1500
 * (no minimo 2); abaixo perde 2, 3, 4 e depois 5 por play, ate 20 na mesma
 * sequencia. Faltar a um play avulso nao conta, mas quem foi zera as faltas.
 * Quem nunca jogou nao cai.
 */
const quedaAcima = (k: number) => Math.min(0.1 + 0.2 * (k - 2), 0.7)
const QUEDA_MINIMA = 2
const quedaAbaixo = (k: number) => Math.min(2 + (k - 2), 5)
const QUEDA_ABAIXO_MAXIMA = 20

export type QuedaPorFalta = { faltas: number; perda: number }

export type PontoDeForca = { data: string; playId: string; nota: number; jogou: boolean }

export function calcularForca(d: Dados, acompanhar?: string) {
  const inicial = new Map(d.jogadores.map((j) => [j.id, j.forca_inicial ?? FORCA_MEDIA] as const))
  const elo = new Map<string, number>()
  const nota = (id: string) => elo.get(id) ?? inicial.get(id) ?? FORCA_MEDIA
  const jogos = new Map<string, number>()
  const jaJogou = new Set<string>()
  const queda = new Map<string, QuedaPorFalta>()
  const historico: PontoDeForca[] = []

  const porPlay = new Map<string, typeof d.partidas>()
  for (const p of d.partidas) if (jogada(p)) porPlay.set(p.play_id, [...(porPlay.get(p.play_id) ?? []), p])
  const plays = [...d.plays].sort((x, y) => x.data.localeCompare(y.data) || x.created_at.localeCompare(y.created_at))

  for (const play of plays) {
    const feitas = (porPlay.get(play.id) ?? []).sort(
      (x, y) => (x.terminada_em ?? '').localeCompare(y.terminada_em ?? '') || x.ordem - y.ordem,
    )
    for (const p of feitas) {
      const a = p.placar_a as number
      const b = p.placar_b as number
      const esperado = 1 / (1 + Math.pow(10, (nota(p.b) - nota(p.a)) / 400))
      const surpresa = a / (a + b) - esperado
      elo.set(p.a, nota(p.a) + K * surpresa)
      elo.set(p.b, nota(p.b) - K * surpresa)
      for (const id of [p.a, p.b]) {
        jaJogou.add(id)
        jogos.set(id, (jogos.get(id) ?? 0) + 1)
      }
    }
    if (feitas.length === 0) continue
    const presentes = new Set(feitas.flatMap((p) => [p.a, p.b]))
    if (acompanhar && presentes.has(acompanhar)) {
      historico.push({ data: play.data, playId: play.id, nota: Math.round(nota(acompanhar)), jogou: true })
    }
    for (const id of jaJogou) {
      if (presentes.has(id)) {
        queda.delete(id)
        continue
      }
      if (!play.ranked) continue // faltar a um avulso nao conta
      const q = queda.get(id) ?? { faltas: 0, perda: 0 }
      q.faltas++
      if (q.faltas >= 2) {
        const atual = nota(id)
        const perda =
          atual > FORCA_MEDIA
            ? Math.max(QUEDA_MINIMA, (atual - FORCA_MEDIA) * quedaAcima(q.faltas))
            : Math.max(0, Math.min(quedaAbaixo(q.faltas), QUEDA_ABAIXO_MAXIMA - q.perda))
        elo.set(id, atual - perda)
        q.perda += perda
        if (id === acompanhar && perda > 0) {
          historico.push({ data: play.data, playId: play.id, nota: Math.round(atual - perda), jogou: false })
        }
      }
      queda.set(id, q)
    }
  }
  return { nota, queda, historico, jogos, inicial: (id: string) => inicial.get(id) ?? FORCA_MEDIA }
}

/** A forca de um jogador ao longo do tempo, com o ponto de partida na frente. */
export function historicoDeForca(d: Dados, id: string): PontoDeForca[] {
  const { historico, inicial } = calcularForca(d, id)
  if (historico.length === 0) return []
  return [{ data: historico[0].data, playId: 'inicio', nota: Math.round(inicial(id)), jogou: false }, ...historico]
}

export type NivelDeForca = { de: number; emoji: string; titulo: string }

/** As faixas do Play de Todas (+-25 / +-75 em volta da media). */
const NIVEIS: NivelDeForca[] = [
  { de: 75, emoji: '🔥', titulo: 'Muito acima da média' },
  { de: 25, emoji: '💪', titulo: 'Acima da média' },
  { de: -25, emoji: '⚖️', titulo: 'Na média' },
  { de: -75, emoji: '🌱', titulo: 'Em evolução' },
  { de: -Infinity, emoji: '🐣', titulo: 'Começando' },
]

export function nivelDeForca(nota: number): NivelDeForca {
  return NIVEIS.find((n) => nota - FORCA_MEDIA >= n.de) as NivelDeForca
}

/** A lista da forca: quem ja jogou, da mais forte para a mais fraca. */
export function rankingDeForca(d: Dados) {
  const f = calcularForca(d)
  return d.jogadores
    .filter((j) => f.jogos.has(j.id))
    .map((j) => ({
      id: j.id,
      nota: Math.round(f.nota(j.id)),
      jogos: f.jogos.get(j.id) ?? 0,
      provisoria: (f.jogos.get(j.id) ?? 0) < JOGOS_PARA_FIRMAR,
      queda: f.queda.get(j.id),
    }))
    .sort((x, y) => y.nota - x.nota)
}
