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
