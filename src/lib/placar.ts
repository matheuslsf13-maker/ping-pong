import type { Partida } from './tipos'

/** Sets que fecham a partida: melhor de 5 termina em 3. */
export const setsParaVencer = (melhorDe: number) => Math.ceil(melhorDe / 2)

/**
 * O placar fecha?
 *  - em sets (melhor de 3, 5, 7): quem vence chega exatamente em
 *    `setsParaVencer`, e quem perde fica abaixo;
 *  - em pontos (partida de um set so): quem vence chega no alvo com 2 de
 *    vantagem; passou do alvo (deuce), a diferenca e exatamente 2.
 */
export function placarValido(a: number, b: number, melhorDe: number, pontosSet: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return false
  const v = Math.max(a, b)
  const p = Math.min(a, b)
  if (melhorDe > 1) return v === setsParaVencer(melhorDe) && p < v
  if (v < pontosSet) return false
  if (v === pontosSet) return v - p >= 2
  return v - p === 2
}

/** Os placares para tocar, do lado de quem venceu (3x0, 3x1, 3x2 ou 11x0 ... 12x10). */
export function opcoesDePlacar(melhorDe: number, pontosSet: number): [number, number][] {
  if (melhorDe > 1) {
    const s = setsParaVencer(melhorDe)
    return Array.from({ length: s }, (_, i) => [s, i] as [number, number])
  }
  const out: [number, number][] = []
  for (let i = 0; i <= pontosSet - 2; i++) out.push([pontosSet, i])
  out.push([pontosSet + 1, pontosSet - 1])
  return out
}

/** Unidade do placar daquele play: sets ou pontos. */
export const unidade = (melhorDe: number) => (melhorDe > 1 ? 'sets' : 'pontos')

export function vencedor(p: Pick<Partida, 'a' | 'b' | 'placar_a' | 'placar_b'>): string | null {
  if (p.placar_a === null || p.placar_b === null || p.placar_a === p.placar_b) return null
  return p.placar_a > p.placar_b ? p.a : p.b
}

export function perdedor(p: Pick<Partida, 'a' | 'b' | 'placar_a' | 'placar_b'>): string | null {
  const v = vencedor(p)
  return v === null ? null : v === p.a ? p.b : p.a
}

/** Um set: 11 com 2 de vantagem; passou de 11 (deuce), a diferenca e exatamente 2. */
export function setValido(a: number, b: number): boolean {
  return placarValido(a, b, 1, 11)
}

/**
 * O placar da partida a partir dos sets. `completo` = alguem chegou nos sets
 * que fecham a partida no ultimo set lancado (nem antes, nem com set sobrando).
 */
export function placarDosSets(sets: [number, number][], melhorDe: number): { a: number; b: number; completo: boolean } {
  const alvo = setsParaVencer(melhorDe)
  let a = 0
  let b = 0
  let completo = false
  for (const [x, y] of sets) {
    if (completo) return { a, b, completo: false } // set depois de a partida fechar
    if (x > y) a++
    else b++
    completo = a === alvo || b === alvo
  }
  return { a, b, completo }
}

/**
 * QUANTO A (lado a) JOGOU MELHOR, de 0 a 1 -- o que a forca compara com o
 * esperado. Metade e a fatia de SETS (3x0 = 1, 3x2 = 0,6) e metade a fatia de
 * PONTOS somando os sets (11-1, 11-0, 11-2 = 33x3 = 0,92). Assim um 3x0 de
 * 11-9 em todos os sets rende menos que um 3x0 atropelando, e um 3x2 rende
 * pouco. Partida sem o detalhe dos sets usa so a fatia de sets.
 */
export function desempenho(p: Pick<Partida, 'placar_a' | 'placar_b' | 'sets'>): number {
  const a = p.placar_a as number
  const b = p.placar_b as number
  const fatiaSets = a / (a + b)
  if (!p.sets?.length) return fatiaSets
  const pa = p.sets.reduce((t, s) => t + s[0], 0)
  const pb = p.sets.reduce((t, s) => t + s[1], 0)
  return (fatiaSets + pa / (pa + pb)) / 2
}
