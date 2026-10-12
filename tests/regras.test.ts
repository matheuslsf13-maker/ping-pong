import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarPartidas, proximaPartida, rodadasDoRodizio, maxRodadas } from '../src/lib/rodizio'
import { opcoesDePlacar, placarValido, vencedor } from '../src/lib/placar'
import { estatisticas, pontosDoMes, rankingDoDia, rankingDoMes } from '../src/lib/ranking'
import { calcularForca, historicoDeForca } from '../src/lib/forca'
import type { Dados, Partida, Play } from '../src/lib/tipos'

/* --------------------------------------------------------------- rodizio */

test('rodizio: cada um enfrenta cada um exatamente uma vez', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9]) {
    const ids = Array.from({ length: n }, (_, i) => `j${i}`)
    const rodadas = rodadasDoRodizio(ids)
    const vistos = new Set<string>()
    for (const r of rodadas) {
      const naRodada = new Set<string>()
      for (const [a, b] of r) {
        const k = [a, b].sort().join('|')
        assert.ok(!vistos.has(k), `repetiu ${k}`)
        vistos.add(k)
        // ninguem joga duas vezes na mesma rodada
        assert.ok(!naRodada.has(a) && !naRodada.has(b))
        naRodada.add(a)
        naRodada.add(b)
      }
    }
    assert.equal(vistos.size, (n * (n - 1)) / 2)
    assert.equal(rodadas.length, maxRodadas(n))
  }
})

test('menos rodadas: todos jogam o mesmo numero (com numero par de jogadores)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const ps = montarPartidas('p', ids, 3)
  assert.equal(ps.length, 9)
  for (const id of ids) assert.equal(ps.filter((x) => x.a === id || x.b === id).length, 3)
  assert.deepEqual(ps.map((x) => x.ordem), ps.map((_, i) => i + 1))
})

test('proxima partida: so com os dois livres, e quem esta parado ha mais tempo primeiro', () => {
  const ps: Partida[] = montarPartidas('p', ['a', 'b', 'c', 'd'], 3)
  // a x ? esta na mesa: nenhuma partida com 'a' pode sair
  const ocupados = new Set(['a', 'b'])
  const p = proximaPartida(ps, ocupados, new Map())
  assert.ok(p && !['a', 'b'].includes(p.a) && !['a', 'b'].includes(p.b))
  // c acabou de jogar (descanso 0); d e b estao parados ha mais tempo
  const descanso = new Map([['c', 0], ['d', 5], ['b', 5], ['a', 5]])
  const q = proximaPartida(ps, new Set(), descanso)
  assert.ok(q && q.a !== 'c' && q.b !== 'c')
})

/* ---------------------------------------------------------------- placar */

test('placar em sets: melhor de 3 termina em 2', () => {
  assert.ok(placarValido(2, 0, 3, 11))
  assert.ok(placarValido(1, 2, 3, 11))
  assert.ok(!placarValido(2, 2, 3, 11))
  assert.ok(!placarValido(3, 1, 3, 11))
  assert.ok(!placarValido(1, 0, 3, 11))
  assert.deepEqual(opcoesDePlacar(5, 11), [[3, 0], [3, 1], [3, 2]])
})

test('placar em pontos (partida unica): ate 11, com 2 de vantagem', () => {
  assert.ok(placarValido(11, 9, 1, 11))
  assert.ok(placarValido(12, 10, 1, 11))
  assert.ok(placarValido(3, 11, 1, 11))
  assert.ok(!placarValido(11, 10, 1, 11))
  assert.ok(!placarValido(13, 10, 1, 11))
  assert.ok(!placarValido(10, 8, 1, 11))
  assert.equal(opcoesDePlacar(1, 11)[0].join('x'), '11x0')
  assert.equal(opcoesDePlacar(1, 11).at(-1)?.join('x'), '12x10')
  assert.equal(vencedor({ a: 'x', b: 'y', placar_a: 1, placar_b: 3 } as Partida), 'y')
})

/* --------------------------------------------------------------- ranking */

function play(id: string, data: string, ids: string[], extra: Partial<Play> = {}): Play {
  return {
    id, data, titulo: id, mesas: 1, melhor_de: 3, pontos_set: 11, jogador_ids: ids,
    status: 'finalizado', ranked: true, created_at: `${data}T20:00:00Z`, ...extra,
  }
}
let n = 0
function partida(play_id: string, a: string, b: string, pa: number, pb: number): Partida {
  n++
  return { id: `m${n}`, play_id, ordem: n, rodada: 1, a, b, placar_a: pa, placar_b: pb, mesa: 1, iniciada_em: null, terminada_em: null }
}
const jogadores = (ids: string[]) => ids.map((id) => ({ id, nome: id, apelido: null, forca_inicial: null, ativo: true, created_at: '' }))

test('pontos do mes: sets do vencedor menos os do perdedor (minimo 1); quem perde nao pontua', () => {
  const p = play('p1', '2026-10-12', ['a', 'b'])
  assert.deepEqual(pontosDoMes(partida('p1', 'a', 'b', 2, 0), p), { a: 2, b: 0 })
  assert.deepEqual(pontosDoMes(partida('p1', 'a', 'b', 2, 1), p), { a: 1, b: 0 })
  // partida unica: a vitoria vale 1
  assert.deepEqual(pontosDoMes(partida('p1', 'a', 'b', 11, 7), { ...p, melhor_de: 1 }), { a: 1, b: 0 })
})

test('ranking do dia por vitorias; o do mes por pontos e so dos plays que valem', () => {
  const d: Dados = { jogadores: jogadores(['a', 'b', 'c']), plays: [], partidas: [] }
  d.plays.push(play('p1', '2026-10-12', ['a', 'b', 'c']))
  d.partidas.push(partida('p1', 'a', 'b', 2, 1), partida('p1', 'a', 'c', 2, 1), partida('p1', 'b', 'c', 2, 0))
  d.plays.push(play('p2', '2026-10-13', ['a', 'b', 'c'], { ranked: false }))
  d.partidas.push(partida('p2', 'c', 'a', 2, 0))
  const dia = rankingDoDia(d, 'p1')
  assert.deepEqual(dia.map((x) => x.id), ['a', 'b', 'c'])
  const mes = rankingDoMes(d, '2026-10')
  assert.equal(mes.find((x) => x.id === 'c')?.pontos, 0)
  assert.equal(mes.find((x) => x.id === 'b')?.pontos, 2)
  const e = estatisticas(d.partidas.filter((m) => m.play_id === 'p1'))
  assert.equal(e.get('a')?.v, 2)
  assert.equal(e.get('a')?.pro, 4)
})

/* ----------------------------------------------------------------- forca */

test('forca: vencer sobe, perder desce, a soma fica no meio', () => {
  const d: Dados = { jogadores: jogadores(['a', 'b']), plays: [play('p1', '2026-10-12', ['a', 'b'])], partidas: [] }
  d.partidas.push(partida('p1', 'a', 'b', 2, 0))
  const f = calcularForca(d)
  assert.ok(f.nota('a') > 1500 && f.nota('b') < 1500)
  assert.ok(Math.abs(f.nota('a') + f.nota('b') - 3000) < 1e-6)
})

test('forca: quem falta perde a partir da 2a falta; avulso nao conta, mas quem vem zera', () => {
  const d: Dados = { jogadores: jogadores(['x', 'a', 'b']), plays: [], partidas: [] }
  d.plays.push(play('p1', '2026-10-01', ['x', 'a']))
  d.partidas.push(partida('p1', 'x', 'a', 2, 0))
  const depois = calcularForca(d).nota('x')
  d.plays.push(play('p2', '2026-10-02', ['a', 'b']))
  d.partidas.push(partida('p2', 'a', 'b', 2, 1))
  assert.equal(calcularForca(d).nota('x'), depois, '1a falta nao tira nada')
  d.plays.push(play('p3', '2026-10-03', ['a', 'b'], { ranked: false }))
  d.partidas.push(partida('p3', 'a', 'b', 2, 1))
  assert.equal(calcularForca(d).queda.get('x')?.faltas, 1, 'avulso nao conta como falta')
  d.plays.push(play('p4', '2026-10-04', ['a', 'b']))
  d.partidas.push(partida('p4', 'a', 'b', 2, 1))
  const f = calcularForca(d)
  assert.equal(f.queda.get('x')?.faltas, 2)
  assert.ok(f.nota('x') < depois)
  const h = historicoDeForca(d, 'x')
  assert.deepEqual(h.map((p) => p.jogou), [false, true, false])
})

/* ------------------------------------------------------ placar por set */
import { desempenho, placarDosSets, setValido } from '../src/lib/placar'

test('set: ate 11 com 2 de vantagem; no deuce, exatamente 2', () => {
  assert.ok(setValido(11, 0) && setValido(9, 11) && setValido(12, 10) && setValido(15, 13))
  assert.ok(!setValido(11, 10) && !setValido(10, 8) && !setValido(13, 10) && !setValido(11, 11))
})

test('o placar final sai dos sets, e so fecha quando alguem chega nos sets da partida', () => {
  assert.deepEqual(placarDosSets([[11, 1], [11, 0], [9, 11], [11, 2]], 5), { a: 3, b: 1, completo: true })
  assert.deepEqual(placarDosSets([[11, 1], [11, 0]], 5), { a: 2, b: 0, completo: false })
  assert.equal(placarDosSets([[11, 1], [11, 0], [11, 2], [11, 3]], 5).completo, false, 'set a mais depois de fechar')
})

test('desempenho: 3x0 apertado vale menos que 3x0 atropelando, e mais que 3x2', () => {
  const p = (sets: [number, number][]) =>
    ({ a: 'x', b: 'y', placar_a: placarDosSets(sets, 5).a, placar_b: placarDosSets(sets, 5).b, sets }) as unknown as Partida
  const atropelo = desempenho(p([[11, 1], [11, 0], [11, 2]]))
  const apertado = desempenho(p([[11, 9], [12, 10], [11, 9]]))
  const cinco = desempenho(p([[11, 9], [9, 11], [11, 9], [9, 11], [11, 9]]))
  assert.ok(atropelo > apertado && apertado > cinco && cinco > 0.5)
  // sem o detalhe dos sets (partida antiga), so a fatia de sets
  assert.equal(desempenho({ placar_a: 3, placar_b: 1 } as Partida), 0.75)
})

/* ------------------------------------------- completar o todos contra todos */
import { completarRodizio, confrontosQueFaltam } from '../src/lib/rodizio'

test('completar: cria so os confrontos que faltam, continuando a fila', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const feitas = montarPartidas('p', ids, 3) // 9 de 15
  assert.equal(confrontosQueFaltam(ids, feitas).length, 6)
  const novas = completarRodizio('p', ids, feitas)
  assert.equal(novas.length, 6)
  const todas = [...feitas, ...novas]
  assert.equal(confrontosQueFaltam(ids, todas).length, 0)
  assert.deepEqual(novas.map((x) => x.ordem), [10, 11, 12, 13, 14, 15])
  assert.ok(novas.every((x) => x.rodada >= 4))
})
