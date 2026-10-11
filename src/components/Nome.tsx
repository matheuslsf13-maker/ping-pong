import { createContext, useContext } from 'react'
import { useStore } from '../lib/store'

/** Abre a ficha de um jogador (quem prove e o App). */
export const AbrirPerfil = createContext<(id: string) => void>(() => {})

/** O nome de quem joga, tocavel: abre a ficha no Stats. */
export function Nome({ id, className }: { id: string; className?: string }) {
  const { nome } = useStore()
  const abrir = useContext(AbrirPerfil)
  return (
    <button type="button" className={`linkish nome${className ? ' ' + className : ''}`} onClick={() => abrir(id)}>
      {nome(id)}
    </button>
  )
}
