/** Modo noturno (padrao) ou diurno, guardado no aparelho. */
export type Tema = 'claro' | 'escuro'

const CHAVE = 'ping-pong:tema'
const BARRA: Record<Tema, string> = { claro: '#f3f7fb', escuro: '#0b1f33' }

export function temaSalvo(): Tema {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'claro' ? 'claro' : 'escuro'
  } catch {
    return 'escuro'
  }
}

export function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute('data-tema', tema)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BARRA[tema])
  try {
    localStorage.setItem(CHAVE, tema)
  } catch {
    /* vale so nesta sessao */
  }
}

export const aplicarTemaSalvo = () => aplicarTema(temaSalvo())
